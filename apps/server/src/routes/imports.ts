import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { z } from 'zod';
import { uploadLimit, adminWriteLimit, admitHeavyWork, withHeavyWork } from '../middleware/rateLimits.js';
import { objectIdSchema } from '../middleware/requestValidation.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { AuditLog } from '../models/auth.js';
import { StudentProfile } from '../models/auth.js';
import { Application } from '../models/application.js';
import { ImportBatch } from '../models/ImportBatch.js';
import { StudentReferenceRecord } from '../models/StudentReferenceRecord.js';
import { ImportError, inspectImport } from '../services/inspection.js';
import { safeFilename } from '../services/filename.js';
import { HttpError } from '../utils/httpError.js';

export const importRoutes = Router();
importRoutes.use(['/admin/students/import', '/admin/student-references'], authenticate, authorize('ROLE_ADMIN'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } });

async function referenceVersions(studentNumbers: string[], session?: mongoose.ClientSession) {
  const versions = await StudentReferenceRecord.aggregate<{ _id: string; version: number }>([
    { $match: { studentNumber: { $in: studentNumbers } } },
    { $group: { _id: '$studentNumber', version: { $max: '$version' } } },
  ]).session(session ?? null);
  return new Map(versions.map(row => [row._id, row.version]));
}

importRoutes.post('/admin/students/import', uploadLimit, admitHeavyWork, (req, res, next) => {
  upload.single('file')(req, res, error => {
    if (error) { res.status(400).json({ message: 'Tek bir dosya yükleyin. Dosya boyutu en fazla 5 MB olabilir.' }); return; }
    next();
  });
}, withHeavyWork(async (req, res) => {
  try {
    if (!req.file || req.file.size < 4) throw new ImportError('CSV veya XLSX dosyası seçin.');
    const filename = safeFilename(req.file.originalname);
    const rows = await inspectImport(req.file.buffer, filename, req.file.mimetype);
    const versions = await referenceVersions(rows.filter(row => !row.errors.length).map(row => String(row.data.studentNumber)));
    const batch = await ImportBatch.create({ owner: req.authUser!.id, purpose: 'REFERENCE', filename,
      rows: rows.map(row => ({ line: row.line, data: row.data, issues: row.errors, referenceVersion: versions.get(String(row.data.studentNumber)) ?? 0 })),
      expiresAt: new Date(Date.now() + 60 * 60000) });
    res.status(201).json({ id: batch.id, filename, rows: rows.map(row => ({ ...row, nextVersion: (versions.get(String(row.data.studentNumber)) ?? 0) + 1 })),
      valid: rows.filter(row => !row.errors.length).length, invalid: rows.filter(row => row.errors.length).length, expiresAt: batch.expiresAt });
  } catch (error) { if (error instanceof ImportError) { res.status(400).json({ message: error.message }); return; } throw error; }
}));

importRoutes.post('/admin/students/import/:id/confirm', adminWriteLimit, admitHeavyWork, withHeavyWork(async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success || !z.object({ confirm: z.literal(true) }).strict().safeParse(req.body).success) throw new HttpError(400, 'Geçerli aktarım ve açık onay gerekli.');
  const batch = await ImportBatch.findOne({ _id: req.params.id, owner: req.authUser!.id, expiresAt: { $gt: new Date() } }).select('+rows');
  if (!batch) throw new HttpError(404, 'Aktarım bulunamadı veya süresi dolmuş.');
  if (batch.purpose !== 'REFERENCE') throw new HttpError(409, 'Bu önizleme eski hesap aktarımına ait. Referans kaydı için dosyayı yeniden yükleyin.');
  if (batch.status === 'COMMITTED') { res.json({ ...batch.result, alreadyCommitted: true }); return; }
  const accepted = batch.rows.filter(row => !row.issues.length);
  if (!accepted.length) throw new HttpError(400, 'Kaydedilebilecek geçerli satır yok.');
  await Promise.all([StudentReferenceRecord.init(), ImportBatch.init()]);
  const session = await mongoose.startSession();
  const result = { successful: accepted.length, failed: batch.rows.length - accepted.length,
    failures: batch.rows.filter(row => row.issues.length).map(row => ({ line: row.line, errors: row.issues })) };
  try {
    await session.withTransaction(async () => {
      const claimed = await ImportBatch.findOneAndUpdate({ _id: batch._id, purpose: 'REFERENCE', status: 'PREVIEW', expiresAt: { $gt: new Date() } }, { $set: { status: 'COMMITTED' } }, { session, new: true });
      if (!claimed) throw new ImportError('Aktarım daha önce onaylanmış veya süresi dolmuş.');
      const versions = await referenceVersions(accepted.map(row => String(row.data.studentNumber)), session);
      if (accepted.some(row => (versions.get(String(row.data.studentNumber)) ?? 0) !== row.referenceVersion)) throw new ImportError('Referans sürümü önizlemeden sonra değişti.');
      const records = accepted.map(row => {
        const d = row.data;
        return { studentNumber: d.studentNumber, fullName: d.name, identityNumber: d.identityNumber, nationality: d.nationality,
          dateOfBirth: d.birthDate, residenceAddress: d.address, department: d.department, academicYear: d.academicYear,
          previousInternshipDays: d.previousInternshipDays, email: d.email, phone: d.phone, healthCoverageStatus: d.healthStatus,
          importBatchId: batch._id, sourceFileName: batch.filename, sourceRowNumber: row.line, version: row.referenceVersion! + 1, createdBy: req.authUser!.id };
      });
      await StudentReferenceRecord.insertMany(records, { session });
      // Serialize reference changes against approvals and snapshot generation.
      // Only the optimistic version changes; submitted data/status/files stay intact.
      const profiles = await StudentProfile.find({ studentNumber: { $in: accepted.map(row => String(row.data.studentNumber)) } }).select('user').session(session).lean();
      await Application.updateMany({ student: { $in: profiles.map(profile => profile.user) }, deletedAt: null }, { $inc: { version: 1 } }, { session });
      await ImportBatch.updateOne({ _id: batch._id }, { $set: { result }, $unset: { rows: 1 } }, { session });
      await AuditLog.create([{ user: req.authUser!.id, event: 'REFERENCE_IMPORT_COMMITTED', details: { batchId: batch._id, successful: result.successful, failed: result.failed }, ip: req.ip }], { session });
    });
    res.json(result);
  } catch (error) {
    if (error instanceof ImportError || (error as { code?: number }).code === 11000) throw new HttpError(409, 'Aktarım tamamlanamadı. Referans sürümü değişmiş veya aktarım onaylanmış olabilir; dosyayı yeniden önizleyin. Hiçbir kısmi kayıt yapılmadı.');
    throw error;
  } finally { await session.endSession(); }
}));

importRoutes.get('/admin/student-references', async (req, res) => {
  const parsed = z.object({ q: z.string().trim().max(100).default(''), page: z.coerce.number().int().min(1).max(100000).default(1) }).safeParse(req.query);
  if (!parsed.success) throw new HttpError(400, 'Arama veya sayfa geçersiz.');
  const { q, page } = parsed.data;
  const search = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  // Aggregate does not apply Mongoose select:false: project before grouping.
  const [result] = await StudentReferenceRecord.aggregate([
    { $project: { studentNumber: 1, fullName: 1, department: 1, academicYear: 1, sourceFileName: 1, sourceRowNumber: 1, version: 1, createdAt: 1 } },
    { $sort: { studentNumber: 1, version: -1 } },
    { $group: { _id: '$studentNumber', record: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$record' } },
    ...(q ? [{ $match: { $or: [{ studentNumber: search }, { fullName: search }] } }] : []),
    { $sort: { studentNumber: 1 } },
    { $facet: { items: [{ $skip: (page - 1) * 10 }, { $limit: 10 }], count: [{ $count: 'total' }] } },
  ]);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ items: result?.items ?? [], total: result?.count[0]?.total ?? 0, page, pageSize: 10 });
});

importRoutes.get('/admin/student-references/:id', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new HttpError(404, 'Referans kaydı bulunamadı.');
  const record = await StudentReferenceRecord.findById(req.params.id).select('+identityNumber +dateOfBirth +residenceAddress +healthCoverageStatus').lean();
  if (!record) throw new HttpError(404, 'Referans kaydı bulunamadı.');
  res.setHeader('Cache-Control', 'no-store'); res.json(record);
});
