import { Router } from 'express';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { uploadLimit, adminWriteLimit, admitHeavyWork, withHeavyWork } from '../middleware/rateLimits.js';
import { objectIdSchema } from '../middleware/requestValidation.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { User, StudentProfile, AuditLog } from '../models/auth.js';
import { ImportBatch } from '../models/ImportBatch.js';
import { ImportError, inspectImport } from '../services/inspection.js';
import type { PreviewRow } from '../services/importParser.js';
import { safeFilename } from '../services/filename.js';
export const importRoutes = Router();
importRoutes.use('/admin/students/import', authenticate, authorize('ROLE_ADMIN'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } });
async function markExisting(rows: PreviewRow[], session?: mongoose.ClientSession) {
  const profiles = await StudentProfile.find({ $or: [{ studentNumber: { $in: rows.map(r => r.data.studentNumber) } }, { identityNumber: { $in: rows.map(r => r.data.identityNumber) } }] }).select('studentNumber +identityNumber').session(session ?? null).lean();
  const users = await User.find({ $or: [{ email: { $in: rows.map(r => String(r.data.email).toLowerCase()) } }, { username: { $in: rows.map(r => 'student-' + String(r.data.studentNumber).toLowerCase()) } }] }).select('email username').session(session ?? null).lean();
  for (const row of rows) {
    if (profiles.some(p => p.studentNumber === row.data.studentNumber)) row.errors.push('Öğrenci numarası zaten kayıtlı');
    if (profiles.some(p => p.identityNumber === row.data.identityNumber)) row.errors.push('Kimlik numarası zaten kayıtlı');
    if (users.some(u => u.email === String(row.data.email).toLowerCase())) row.errors.push('E-posta zaten kayıtlı');
    if (users.some(u => u.username === 'student-' + String(row.data.studentNumber).toLowerCase())) row.errors.push('Kullanıcı adı zaten kayıtlı');
  }
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
    await markExisting(rows);
    const batch = await ImportBatch.create({ owner: req.authUser!.id, filename, rows: rows.map(r => ({ line: r.line, data: r.data, issues: r.errors })), expiresAt: new Date(Date.now() + 60 * 60000) });
    res.status(201).json({ id: batch.id, filename: batch.filename, rows, valid: rows.filter(r => !r.errors.length).length, invalid: rows.filter(r => r.errors.length).length, expiresAt: batch.expiresAt });
  } catch (error) { if (error instanceof ImportError) { res.status(400).json({ message: error.message }); return; } throw error; }
}));
importRoutes.post('/admin/students/import/:id/confirm', adminWriteLimit, admitHeavyWork, withHeavyWork(async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success || !z.object({ confirm: z.literal(true) }).strict().safeParse(req.body).success) { res.status(400).json({ message: 'Geçerli aktarım ve açık onay gerekli.' }); return; }
  const batch = await ImportBatch.findOne({ _id: req.params.id, owner: req.authUser!.id, expiresAt: { $gt: new Date() } }).select('+rows');
  if (!batch) { res.status(404).json({ message: 'Aktarım bulunamadı veya süresi dolmuş.' }); return; }
  if (batch.status === 'COMMITTED') { res.json({ ...batch.result, credentials: [], alreadyCommitted: true }); return; }
  const rows: PreviewRow[] = batch.rows.map(r => ({ line: r.line!, data: r.data, errors: [...r.issues] }));
  const candidates = rows.filter(r => !r.errors.length);
  if (!candidates.length) { res.status(400).json({ message: 'Kaydedilebilecek geçerli satır yok.' }); return; }
  await Promise.all([User.init(), StudentProfile.init(), ImportBatch.init()]);
  // Password hashing is performed before the transaction to keep its duration short.
  const accounts = new Map<number, { id: mongoose.Types.ObjectId; username: string; password: string; passwordHash: string }>();
  for (let i = 0; i < candidates.length; i += 8) await Promise.all(candidates.slice(i, i + 8).map(async row => {
    const password = 'Kou_' + randomBytes(18).toString('base64url');
    accounts.set(row.line, { id: new mongoose.Types.ObjectId(), username: 'student-' + String(row.data.studentNumber).toLowerCase(), password, passwordHash: await bcrypt.hash(password, 12) });
  }));
  const session = await mongoose.startSession();
  let result: { successful: number; failed: number; failures: { line: number; errors: string[] }[] } | undefined;
  let credentials: { studentNumber: string; username: string; password: string }[] = [];
  try {
    await session.withTransaction(async () => {
      const claimed = await ImportBatch.findOneAndUpdate({ _id: batch._id, status: 'PREVIEW', expiresAt: { $gt: new Date() } }, { $set: { status: 'COMMITTED' } }, { session, new: true });
      if (!claimed) throw new ImportError('Aktarım daha önce onaylanmış veya süresi dolmuş.');
      const checked: PreviewRow[] = rows.map(r => ({ ...r, errors: [...r.errors] }));
      await markExisting(checked, session);
      const accepted = checked.filter(r => !r.errors.length);
      const users = accepted.map(r => { const data = r.data; const a = accounts.get(r.line)!; return { _id: a.id, username: a.username, email: data.email, name: data.name, role: 'ROLE_STUDENT', passwordHash: a.passwordHash }; });
      const profiles = accepted.map(r => { const { name: _name, email: _email, ...data } = r.data; return { ...data, user: accounts.get(r.line)!.id }; });
      if (users.length) { await User.insertMany(users, { session }); await StudentProfile.insertMany(profiles, { session }); }
      result = { successful: accepted.length, failed: checked.length - accepted.length, failures: checked.filter(r => r.errors.length).map(r => ({ line: r.line, errors: r.errors })) };
      credentials = accepted.map(r => { const a = accounts.get(r.line)!; return { studentNumber: String(r.data.studentNumber), username: a.username, password: a.password }; });
      await ImportBatch.updateOne({ _id: batch._id }, { $set: { result }, $unset: { rows: 1 } }, { session });
      await AuditLog.create([{ user: req.authUser!.id, event: 'STUDENT_IMPORT_COMMITTED', ip: req.ip }], { session });
    });
    res.json({ ...result, credentials });
  } catch (error) {
    if (error instanceof ImportError || (error as { code?: number }).code === 11000) { res.status(409).json({ message: 'Aktarım tamamlanamadı. Eşzamanlı değişiklik olabilir; dosyayı yeniden önizleyin. Hiçbir kısmi kayıt yapılmadı.' }); return; }
    throw error;
  } finally { await session.endSession(); }
}));
