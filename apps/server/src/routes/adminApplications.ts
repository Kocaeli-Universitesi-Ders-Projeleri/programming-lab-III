import { Router, type Request } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { applicationSchema } from '@kou/shared';
import { authenticate, authorize } from '../middleware/auth.js';
import { adminWriteLimit, uploadLimit, admitHeavyWork, withHeavyWork } from '../middleware/rateLimits.js';
import { objectIdSchema } from '../middleware/requestValidation.js';
import { Application, Document, ValidationReport } from '../models/application.js';
import { ApplicationRevision } from '../models/ApplicationRevision.js';
import { DocumentExtraction } from '../models/DocumentExtraction.js';
import { AuditLog } from '../models/auth.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { inspectDocument, inspectExtraction, DocumentError } from '../services/inspection.js';
import { savePrivateFile, removePrivateFile } from '../services/privateStorage.js';
import { sourceHash } from '../services/comparisonReports.js';
import { normalizeApplicationContacts } from '../validators/rules.js';

export const adminApplicationRoutes = Router();
adminApplicationRoutes.use('/admin/applications', authenticate, authorize('ROLE_ADMIN'));
const version = z.union([z.number().int().min(1).max(1000000000), z.string().regex(/^[1-9]\d{0,9}$/).refine(value => Number(value) <= 1000000000).transform(Number)]);
const editSchema = z.object({ version, reason: z.string().trim().min(10).max(1000), data: applicationSchema }).strict();
const deleteSchema = z.object({ version: z.number().int().min(1).max(1000000000), reason: z.string().trim().min(10).max(1000), confirm: z.literal(true) }).strict();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_DOCUMENT_MB * 1024 * 1024, files: 1, fields: 3, fieldSize: 50000 } }).single('file');
async function recordFor(req: Request) {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new HttpError(404, 'Başvuru bulunamadı.');
  const record = await Application.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) throw new HttpError(404, 'Başvuru bulunamadı.'); return record;
}
function snapshot(record: { data: unknown; document: unknown; status: unknown; version: unknown; formVersion?: unknown; documentVersion?: unknown; manualChecks?: unknown; deletedAt?: unknown }) {
  return { data: record.data, document: record.document, status: record.status, version: record.version, formVersion: record.formVersion ?? 1, documentVersion: record.documentVersion ?? 1, manualChecks: record.manualChecks ?? null, deletedAt: record.deletedAt ?? null };
}
adminApplicationRoutes.patch('/admin/applications/:id', adminWriteLimit, uploadLimit, admitHeavyWork, (req, res, next) => {
  if (!req.is('multipart/form-data')) { next(); return; }
  upload(req, res, error => { if (error) { res.status(400).json({ message: 'Tek dosya ve data/reason/version alanları gönderin. Dosya boyutunu kontrol edin.' }); return; } next(); });
}, withHeavyWork(async (req, res) => {
  let body = req.body;
  if (req.is('multipart/form-data')) { try { body = { ...req.body, data: JSON.parse(req.body.data) }; } catch { throw new HttpError(400, 'Başvuru formu JSON biçiminde olmalı.'); } }
  const input = editSchema.safeParse(body);
  if (!input.success) throw new HttpError(400, 'Geçerli tam form, sürüm ve en az 10 karakter gerekçe girin.');
  const record = await recordFor(req);
  if (record.version !== input.data.version) throw new HttpError(409, 'Başvuru sürümü değişmiş. Yeniden açın.');
  const data = normalizeApplicationContacts(input.data.data);
  if (!req.file && sourceHash(data) === sourceHash(record.data) && !['APPROVED', 'COMPLETED'].includes(record.status)) throw new HttpError(409, 'Form veya belge değişikliği bulunamadı.');
  let safe: Awaited<ReturnType<typeof inspectDocument>> | undefined, extraction: Awaited<ReturnType<typeof inspectExtraction>> | undefined;
  if (req.file) {
    try { safe = await inspectDocument(req.file.buffer, req.file.originalname, req.file.mimetype); }
    catch (error) { if (error instanceof DocumentError) throw new HttpError(400, error.message); throw error; }
    extraction = await inspectExtraction(req.file.buffer, req.file.originalname, req.file.mimetype);
  }
  await Promise.all([ApplicationRevision.init(), DocumentExtraction.init()]);
  const key = safe && req.file ? await savePrivateFile(req.file.buffer, safe.ext) : undefined;
  const docId = key ? new mongoose.Types.ObjectId() : record.document;
  const documentVersion = (record.documentVersion ?? 1) + (key ? 1 : 0);
  const session = await mongoose.startSession(); let committed = false;
  try {
    await session.withTransaction(async () => {
      const oldValidation = await ValidationReport.findOne({ application: record._id }).session(session).lean();
      const updated = await Application.findOneAndUpdate({ _id: record._id, version: input.data.version, deletedAt: null }, { $set: { data, document: docId, documentVersion, formVersion: (record.formVersion ?? 1) + 1, status: 'UNDER_REVIEW', manualChecks: null, calculatedDays: null }, $inc: { version: 1 }, $push: { history: { status: 'UNDER_REVIEW', actor: req.authUser!.id, note: 'Komisyon güncellemesi: ' + input.data.reason, at: new Date() } } }, { session, new: true, runValidators: true });
      if (!updated) throw new HttpError(409, 'Başvuru değişmiş veya silinmiş. Yeniden açın.');
      if (key && safe && req.file && extraction) {
        const sha256 = createHash('sha256').update(req.file.buffer).digest('hex');
        await Document.create([{ _id: docId, application: record._id, owner: record.student, originalName: safe.name, storageKey: key, mime: safe.mime, size: req.file.size, sha256 }], { session });
        await DocumentExtraction.create([{ ...extraction, documentId: docId, documentVersion, documentHash: sha256 }], { session });
      }
      await ValidationReport.updateOne({ application: record._id }, { $set: { readyForApproval: false, engineComplete: false } }, { session });
      const [revision] = await ApplicationRevision.create([{ application: record._id, fromVersion: record.version, toVersion: updated.version, operation: 'UPDATE', actor: req.authUser!.id, reason: input.data.reason, before: { ...snapshot(record), validationReport: oldValidation }, after: snapshot(updated) }], { session });
      await AuditLog.create([{ user: req.authUser!.id, application: record._id, event: 'APPLICATION_ADMIN_UPDATED', details: { revision: revision!._id, fromVersion: record.version, toVersion: updated.version }, ip: req.ip }], { session });
    });
    committed = true; res.json({ id: record.id, status: 'UNDER_REVIEW', version: record.version + 1, comparisonState: 'STALE' });
  } finally {
    await session.endSession();
    if (key && !committed && !await Document.exists({ _id: docId }).catch(() => true)) await removePrivateFile(key);
  }
}));
adminApplicationRoutes.delete('/admin/applications/:id', adminWriteLimit, async (req, res) => {
  const input = deleteSchema.safeParse(req.body);
  if (!input.success) throw new HttpError(400, 'Sürüm, en az 10 karakter silme gerekçesi ve açık onay zorunludur.');
  const record = await recordFor(req); await ApplicationRevision.init();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await Application.findOneAndUpdate({ _id: record._id, version: input.data.version, deletedAt: null }, { $set: { deletedAt: new Date(), deletedBy: req.authUser!.id, deletionReason: input.data.reason }, $inc: { version: 1 }, $push: { history: { status: record.status, actor: req.authUser!.id, note: 'Silme gerekçesi: ' + input.data.reason, at: new Date() } } }, { session, new: true });
      if (!updated) throw new HttpError(409, 'Başvuru değişmiş veya zaten silinmiş.');
      const [revision] = await ApplicationRevision.create([{ application: record._id, fromVersion: record.version, toVersion: updated.version, operation: 'SOFT_DELETE', actor: req.authUser!.id, reason: input.data.reason, before: snapshot(record), after: { ...snapshot(updated), deletionReason: input.data.reason, deletedBy: req.authUser!.id } }], { session });
      await AuditLog.create([{ user: req.authUser!.id, application: record._id, event: 'APPLICATION_SOFT_DELETED', details: { revision: revision!._id }, ip: req.ip }], { session });
    });
    res.json({ id: record.id, deleted: true });
  } finally { await session.endSession(); }
});
adminApplicationRoutes.get('/admin/applications/:id/audit', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new HttpError(404, 'Başvuru bulunamadı.');
  const page = z.coerce.number().int().min(1).max(100000).safeParse(req.query.page ?? 1);
  if (!page.success) throw new HttpError(400, 'Sayfa geçersiz.');
  const record = await Application.findById(req.params.id).select('number status version deletedAt deletedBy +deletionReason').lean();
  if (!record) throw new HttpError(404, 'Başvuru bulunamadı.');
  const [items, total, events] = await Promise.all([
    ApplicationRevision.find({ application: record._id }).select('+before +after').sort({ fromVersion: -1 }).skip((page.data - 1) * 10).limit(10).populate('actor', 'name').lean(),
    ApplicationRevision.countDocuments({ application: record._id }), AuditLog.find({ application: record._id }).select('event user createdAt').sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  res.setHeader('Cache-Control', 'no-store'); res.json({ application: record, items, total, page: page.data, pageSize: 10, events });
});
