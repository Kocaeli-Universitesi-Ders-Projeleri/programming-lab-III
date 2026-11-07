import { Router, type Request } from 'express';
import multer from 'multer';
import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { applicationSchema, countInternshipDays, InternshipApplication, todayInTurkey, type ApplicationStatus } from '@kou/shared';
import { authenticate, authorize } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { Application, Document, ValidationReport } from '../models/application.js';
import { StudentProfile, AuditLog } from '../models/auth.js';
import { inspectDocument, DocumentError } from '../services/inspection.js';
import { savePrivateFile, removePrivateFile, readPrivateFile } from '../services/privateStorage.js';
import { buildApplicationReport } from '../services/buildApplicationReport.js';
import { normalizeApplicationContacts } from '../validators/rules.js';
import { HttpError } from '../utils/httpError.js';
import { uploadLimit, adminWriteLimit, admitHeavyWork, withHeavyWork } from '../middleware/rateLimits.js';
import { objectIdSchema } from '../middleware/requestValidation.js';
export const applicationRoutes = Router();
applicationRoutes.use(['/applications', '/documents', '/students/me/applications', '/students/me/dashboard', '/admin/applications'], authenticate);
applicationRoutes.use('/admin/applications', (req, res, next) => ['POST', 'PATCH'].includes(req.method) ? adminWriteLimit(req, res, next) : next());
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_DOCUMENT_MB * 1024 * 1024, files: 1, fields: 1, fieldSize: 50000 } }).single('file');
const studentOnly = authorize('ROLE_STUDENT'), adminOnly = authorize('ROLE_ADMIN');
const fileUpload = (req: Request, res: import('express').Response, next: import('express').NextFunction) => upload(req, res, error => error ? res.status(400).json({ message: `Tek dosya ve başvuru verisi yükleyin. Boyut sınırı ${env.MAX_DOCUMENT_MB} MB.` }) : next());
async function accessible(req: Request) {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new HttpError(404, 'Başvuru bulunamadı.');
  const record = await Application.findOne({ _id: req.params.id, ...(req.authUser!.role === 'ROLE_ADMIN' ? {} : { student: req.authUser!.id }) });
  if (!record) throw new HttpError(404, 'Başvuru bulunamadı.'); return record;
}
applicationRoutes.get('/applications/calendar', (_req, res) => res.json({ supportedYears: [2026, 2027], maxDocumentMB: env.MAX_DOCUMENT_MB }));
applicationRoutes.post('/applications/calculate-days', (req, res) => {
  const parsed = z.object({ startDate: z.string(), endDate: z.string(), workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Tarih ve çalışma günleri geçersiz.' }); return; }
  res.json(countInternshipDays(parsed.data.startDate, parsed.data.endDate, parsed.data.workingDays));
});
async function submit(req: Request, res: import('express').Response) {
  const previous = req.params.id ? await accessible(req) : null;
  if (previous && previous.status !== 'INVALID') throw new HttpError(409, 'Yalnızca hatalı/eksik başvuru yeniden yüklenebilir.');
  if (!await StudentProfile.exists({ user: req.authUser!.id })) throw new HttpError(400, 'Öğrenci profiliniz bulunamadı.');
  let input: unknown;
  try { input = JSON.parse(req.body.data); } catch { throw new HttpError(400, 'Başvuru formu JSON biçiminde olmalı.'); }
  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) { res.status(400).json({ message: 'Başvuru alanlarını kontrol edin.', fields: parsed.error.flatten().fieldErrors }); return; }
  const data = normalizeApplicationContacts(parsed.data);
  if (data.submissionDate !== todayInTurkey()) throw new HttpError(400, 'Teslim tarihi sistemin bugünkü tarihi olmalı. Sayfayı yenileyin.');
  if (!req.file) throw new HttpError(400, 'Ek-16 belgesi zorunludur.');
  let safe;
  try { safe = await inspectDocument(req.file.buffer, req.file.originalname, req.file.mimetype); }
  catch (error) { if (error instanceof DocumentError) throw new HttpError(400, error.message); throw error; }
  const key = await savePrivateFile(req.file.buffer, safe.ext);
  const appId = previous?._id ?? new mongoose.Types.ObjectId(), docId = new mongoose.Types.ObjectId();
  const session = await mongoose.startSession(); let committed = false;
  try {
    await session.withTransaction(async () => {
      const report = await buildApplicationReport(data, req.authUser!.id, null, session);
      const history = { status: 'UPLOADED', actor: req.authUser!.id, note: previous ? 'Belge ve form yeniden yüklendi.' : 'İlk başvuru oluşturuldu.', at: new Date() };
      await Document.create([{ _id: docId, application: appId, owner: req.authUser!.id, originalName: safe.name, storageKey: key, mime: safe.mime, size: req.file!.size, sha256: createHash('sha256').update(req.file!.buffer).digest('hex') }], { session });
      if (previous) {
        new InternshipApplication(previous.status as ApplicationStatus).transition('UPLOADED');
        const update = await Application.updateOne({ _id: appId, status: 'INVALID', version: previous.version }, { $set: { status: 'UPLOADED', data, calculatedDays: report.calculatedDays, document: docId, manualChecks: null }, $inc: { version: 1, documentVersion: 1 }, $push: { history } }, { session });
        if (!update.modifiedCount) throw new HttpError(409, 'Başvuru değişmiş; yeniden açıp deneyin.');
      } else await Application.create([{ _id: appId, number: `KOU-${new Date().getFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`, student: req.authUser!.id, data, calculatedDays: report.calculatedDays, document: docId, history: [history] }], { session });
      await ValidationReport.updateOne({ application: appId }, { $set: report }, { upsert: true, session });
      await AuditLog.create([{ user: req.authUser!.id, application: appId, event: previous ? 'APPLICATION_RESUBMITTED' : 'APPLICATION_CREATED', details: { document: docId, engineVersion: report.engineVersion }, ip: req.ip }], { session });
    });
    committed = true; res.status(previous ? 200 : 201).json({ id: appId, message: 'Başvuru ve belge kaydedildi.' });
  } finally {
    await session.endSession();
    // Preserve the file if an ambiguous commit cannot be checked during an outage.
    if (!committed) { const exists = await Document.exists({ _id: docId }).catch(() => true); if (!exists) await removePrivateFile(key); }
  }
}
applicationRoutes.post('/applications', studentOnly, uploadLimit, admitHeavyWork, fileUpload, withHeavyWork(submit));
applicationRoutes.post('/applications/:id/documents', studentOnly, uploadLimit, admitHeavyWork, fileUpload, withHeavyWork(submit));
async function list(req: Request, res: import('express').Response) {
  const parsed = z.object({ status: z.enum(['UPLOADED', 'UNDER_REVIEW', 'INVALID', 'APPROVED', 'COMPLETED']).optional(), page: z.coerce.number().int().min(1).max(100000).default(1) }).safeParse(req.query);
  if (!parsed.success) throw new HttpError(400, 'Filtre veya sayfa geçersiz.');
  const filter = { ...(req.authUser!.role === 'ROLE_STUDENT' ? { student: req.authUser!.id } : {}), ...(req.path.endsWith('/completed') ? { status: 'COMPLETED' } : parsed.data.status ? { status: parsed.data.status } : {}) };
  const [items, total] = await Promise.all([Application.find(filter).select('number status data.startDate data.endDate calculatedDays createdAt student document').populate('document', 'originalName mime size createdAt').populate('student', 'name').sort({ createdAt: -1 }).skip((parsed.data.page - 1) * 10).limit(10).lean(), Application.countDocuments(filter)]);
  res.json({ items, total, page: parsed.data.page, pageSize: 10 });
}
applicationRoutes.get('/students/me/applications', studentOnly, list);
applicationRoutes.get('/admin/applications', adminOnly, list);
applicationRoutes.get('/admin/applications/completed', adminOnly, list);
applicationRoutes.get(['/applications/:id', '/admin/applications/:id'], async (req, res) => {
  if (req.path.startsWith('/admin/') && req.authUser!.role !== 'ROLE_ADMIN') throw new HttpError(403, 'Yetkiniz bulunmuyor.');
  const record = await accessible(req); await record.populate('document', 'originalName mime size createdAt'); await record.populate('student', 'name email'); res.json(record);
});
applicationRoutes.get('/applications/:id/report', async (req, res) => { const record = await accessible(req); res.json(await ValidationReport.findOne({ application: record._id })); });
applicationRoutes.get('/documents/:id/download', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new HttpError(404, 'Belge bulunamadı.');
  const document = await Document.findOne({ _id: req.params.id, ...(req.authUser!.role === 'ROLE_STUDENT' ? { owner: req.authUser!.id } : {}) }).select('+storageKey');
  if (!document) throw new HttpError(404, 'Belge bulunamadı.');
  let bytes: Buffer;
  try { bytes = await readPrivateFile(document.storageKey, document.size!, document.sha256!); }
  catch { throw new HttpError(503, 'Belge alınamadı veya bütünlüğü doğrulanamadı. Staj komisyonuyla iletişime geçin.'); }
  res.setHeader('Cache-Control', 'no-store'); res.attachment(document.originalName); res.type(document.mime); res.send(bytes);
});
applicationRoutes.patch('/admin/applications/:id/status', adminOnly, async (req, res) => {
  const input = z.object({ status: z.enum(['UNDER_REVIEW', 'INVALID', 'APPROVED', 'COMPLETED']), note: z.string().trim().max(1000).default('') }).safeParse(req.body);
  if (!input.success || (input.data.status === 'INVALID' && !input.data.note)) throw new HttpError(400, 'Geçerli durum ve düzeltme gerekçesi girin.');
  const record = await accessible(req);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const report = await buildApplicationReport(record.data, record.student.toString(), record.manualChecks, session);
      try { new InternshipApplication(record.status as ApplicationStatus).transition(input.data.status, report.readyForApproval); }
      catch (error) {
        const reason = (input.data.status === 'APPROVED' || input.data.status === 'COMPLETED') && !report.readyForApproval ? `Doğrulama geçmedi: ${[...report.issues, ...report.pending].slice(0, 3).join(' ')} Raporu yeniden doğrulayın.` : (error as Error).message;
        throw new HttpError(409, reason);
      }
      const update = await Application.updateOne({ _id: record._id, version: record.version, status: record.status }, { $set: { status: input.data.status, calculatedDays: report.calculatedDays }, $inc: { version: 1 }, $push: { history: { status: input.data.status, actor: req.authUser!.id, note: input.data.note, at: new Date() } } }, { session });
      if (!update.modifiedCount) throw new HttpError(409, 'Başvuru değişmiş; sayfayı yenileyin.');
      await ValidationReport.updateOne({ application: record._id }, { $set: report }, { upsert: true, session });
      await AuditLog.create([{ user: req.authUser!.id, application: record._id, event: 'APPLICATION_STATUS_' + input.data.status, details: { from: record.status, to: input.data.status, engineVersion: report.engineVersion }, ip: req.ip }], { session });
    });
    res.json({ status: input.data.status });
  } finally { await session.endSession(); }
});
applicationRoutes.post('/admin/applications/:id/review', adminOnly, async (req, res) => {
  const input = z.object({ employerSignature: z.boolean(), employerStamp: z.boolean(), studentApprovalEmpty: z.boolean(), advisorApprovalEmpty: z.boolean() }).safeParse(req.body);
  if (!input.success) throw new HttpError(400, 'Tüm manuel kontrol alanlarını gönderin.');
  const record = await accessible(req);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const report = await buildApplicationReport(record.data, record.student.toString(), input.data, session);
      const updated = await Application.updateOne({ _id: record._id, status: 'UNDER_REVIEW', version: record.version }, { $set: { manualChecks: input.data, calculatedDays: report.calculatedDays }, $inc: { version: 1 } }, { session });
      if (!updated.modifiedCount) throw new HttpError(409, 'Başvuru incelemede olmalı ve güncel sürüm kullanılmalı.');
      await ValidationReport.updateOne({ application: record._id }, { $set: report }, { upsert: true, session });
      await AuditLog.create([{ user: req.authUser!.id, application: record._id, event: 'APPLICATION_MANUAL_REVIEW', details: { checks: input.data, engineVersion: report.engineVersion }, ip: req.ip }], { session });
    });
  } finally { await session.endSession(); }
  res.json({ message: 'Manuel kontroller kaydedildi.' });
});
applicationRoutes.post('/admin/applications/:id/validate', adminOnly, async (req, res) => {
  const record = await accessible(req);
  if (record.status === 'COMPLETED') throw new HttpError(409, 'Tamamlanan başvurunun raporu değiştirilemez.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const report = await buildApplicationReport(record.data, record.student.toString(), record.manualChecks, session);
      const update = await Application.updateOne({ _id: record._id, version: record.version, status: record.status }, { $set: { calculatedDays: report.calculatedDays }, $inc: { version: 1 } }, { session });
      if (!update.modifiedCount) throw new HttpError(409, 'Başvuru değişmiş; sayfayı yenileyin.');
      await ValidationReport.updateOne({ application: record._id }, { $set: report }, { upsert: true, session });
      await AuditLog.create([{ user: req.authUser!.id, application: record._id, event: 'APPLICATION_REVALIDATED', details: { engineVersion: report.engineVersion, automatedPassed: report.automatedPassed }, ip: req.ip }], { session });
    });
    res.json({ message: 'Rapor güncel kayıt ve kurallarla yeniden oluşturuldu.' });
  } finally { await session.endSession(); }
});
applicationRoutes.get('/students/me/dashboard', studentOnly, async (req, res) => {
  const student = req.authUser!.id;
  const [profile, total, invalid, completed, lastApplication] = await Promise.all([StudentProfile.findOne({ user: student }).select('studentNumber department academicYear user').lean(), Application.countDocuments({ student }), Application.countDocuments({ student, status: 'INVALID' }), Application.countDocuments({ student, status: 'COMPLETED' }), Application.findOne({ student }).sort({ updatedAt: -1 }).select('number status document updatedAt').populate('document', 'originalName').lean()]);
  if (!profile) throw new HttpError(404, 'Öğrenci profili bulunamadı.');
  res.json({ profile, stats: { total, invalid, completed }, lastApplication });
});
