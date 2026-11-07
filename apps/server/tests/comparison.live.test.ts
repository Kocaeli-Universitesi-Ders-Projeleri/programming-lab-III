import { ApplicationRevision } from '../src/models/ApplicationRevision.js';
import { expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { countInternshipDays, todayInTurkey } from '@kou/shared';
import request from './helpers/request.js';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User, StudentProfile, AuditLog, Session } from '../src/models/auth.js';
import { Application, Document, ValidationReport } from '../src/models/application.js';
import { DocumentExtraction } from '../src/models/DocumentExtraction.js';
import { ComparisonReport } from '../src/models/ComparisonReport.js';
import { StudentReferenceRecord } from '../src/models/StudentReferenceRecord.js';
import { ImportBatch } from '../src/models/ImportBatch.js';
import { columns } from '../src/services/importParser.js';
import * as reportService from '../src/services/buildApplicationReport.js';
import { removePrivateFile } from '../src/services/privateStorage.js';
import { validationFixture, positiveManualChecks } from './fixtures/validation.js';
import { docxFixture, docxMime } from './helpers/extractionFixtures.js';

it.skipIf(process.env.LIVE_AUTH_TEST !== '1')('Atlas: üç kaynak, sahiplik, stale rapor ve eşzamanlı import/onay', async () => {
  await mongoose.connect(env.MONGODB_URI, { dbName: 'kou_staj_comparison_tests', serverSelectionTimeoutMS: 10000 });
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12), password = randomUUID(), ids: mongoose.Types.ObjectId[] = [];
  try {
    await Promise.all([User.init(), StudentProfile.init(), Application.init(), Document.init(), DocumentExtraction.init(), ComparisonReport.init(), StudentReferenceRecord.init(), ImportBatch.init(), ValidationReport.init(), AuditLog.init(), Session.init()]);
    const data = validationFixture().application;
    Object.assign(data, { studentNumber: '00' + suffix, email: suffix + '@example.test', submissionDate: todayInTurkey(), startDate: '2027-07-01', endDate: '2027-07-30', academicYear: '2026-2027' });
    data.declaredDays = countInternshipDays(data.startDate, data.endDate, data.workingDays).days!;
    const hash = await bcrypt.hash(password, 12);
    const student = await User.create({ username: 'student-' + suffix, name: data.name, email: data.email, role: 'ROLE_STUDENT', passwordHash: hash }); ids.push(student._id);
    const foreign = await User.create({ username: 'foreign-' + suffix, name: 'Diğer Öğrenci', email: 'foreign-' + data.email, role: 'ROLE_STUDENT', passwordHash: hash }); ids.push(foreign._id);
    const admin = await User.create({ username: 'admin-' + suffix, name: 'Komisyon', email: 'admin-' + data.email, role: 'ROLE_ADMIN', passwordHash: hash }); ids.push(admin._id);
    await StudentProfile.create({ user: student._id, studentNumber: data.studentNumber, department: data.department, identityNumber: data.identityNumber, nationality: data.nationality });
    await StudentProfile.create({ user: foreign._id, studentNumber: '01' + suffix });
    const login = async (username: string) => { const result = await request(app).post('/api/v1/auth/login').send({ identifier: username, password }); expect(result.status).toBe(200); return result.headers['set-cookie'][0].split(';')[0]; };
    const cookie = await login(student.username), foreignCookie = await login(foreign.username), adminCookie = await login(admin.username);
    const created = await request(app).post('/api/v1/applications').set('Cookie', cookie).field('data', JSON.stringify(data)).attach('file', docxFixture([['Ad soyad', data.name], ['Öğrenci no', data.studentNumber]]), { filename: 'ek16.docx', contentType: docxMime });
    expect(created.status).toBe(201); const id = created.body.id, path = '/api/v1/applications/' + id, adminPath = '/api/v1/admin/applications/' + id;
    const get = (sessionCookie = cookie) => request(app).get(path + '/comparison').set('Cookie', sessionCookie);
    const regenerate = (sessionCookie = cookie) => request(app).post(path + '/comparison').set('Cookie', sessionCookie).send({});
    const status = (value: string) => request(app).patch(adminPath + '/status').set('Cookie', adminCookie).send({ status: value });
    const first = await get(); expect(first.body.state).toBe('CURRENT'); expect(first.body.approvalEligible).toBe(false); expect(first.headers['cache-control']).toBe('no-store');
    expect(first.body.report.rows.find((row: { fieldName: string }) => row.fieldName === 'name').issues).toContain('REFERENCE_NOT_FOUND');
    expect(first.body.report.rows.find((row: { fieldName: string }) => row.fieldName === 'companyName').issues).not.toContain('REFERENCE_NOT_FOUND');
    expect((await get(foreignCookie)).status).toBe(404); expect((await regenerate(foreignCookie)).status).toBe(404);
    expect((await request(app).get(path + '/comparison')).status).toBe(401);
    expect((await request(app).post(adminPath + '/comparison-review').set('Cookie', cookie).send({})).status).toBe(403);
    expect((await request(app).post(path + '/comparison').set('Cookie', cookie).send({ studentNumber: '01' + suffix })).status).toBe(400);
    expect((await status('UNDER_REVIEW')).status).toBe(200);
    const importReference = async (name: string) => {
      const values = [name, data.identityNumber, data.nationality, data.studentNumber, data.birthDate, data.address, data.department, data.academicYear, String(data.previousInternshipDays), data.email, data.phone, String(data.healthStatus)];
      const csv = Buffer.from(columns.join(',') + '\n' + values.map(value => '"' + value.replaceAll('"', '""') + '"').join(','));
      const preview = await request(app).post('/api/v1/admin/students/import').set('Cookie', adminCookie).attach('file', csv, { filename: 'reference.csv', contentType: 'text/csv' });
      expect(preview.status).toBe(201); expect(preview.body.valid).toBe(1);
      const result = await request(app).post('/api/v1/admin/students/import/' + preview.body.id + '/confirm').set('Cookie', adminCookie).send({ confirm: true }); expect(result.status).toBe(200);
    };
    const beforeImportVersion = (await Application.findById(id))!.version;
    await importReference('Referanstaki Farklı Ad');
    expect((await Application.findById(id))!.version).toBe(beforeImportVersion + 1);
    expect((await get()).body.state).toBe('STALE');
    expect((await request(app).post(adminPath + '/comparison-review').set('Cookie', adminCookie).send({ confirm: true, sourceFingerprint: first.body.sourceFingerprint, reason: 'Kaynakları manuel inceledim.' })).status).toBe(409);
    const current = await regenerate(); expect(current.status).toBe(200); expect(current.body.state).toBe('CURRENT');
    const name = current.body.report.rows.find((row: { fieldName: string }) => row.fieldName === 'name');
    expect(name.manualValue).toBe(data.name); expect(name.documentValue).toBe(data.name); expect(name.referenceValue).toBe('Referanstaki Farklı Ad'); expect(name.issues).toContain('MISMATCH');
    // A forged form number cannot select another student's private reference.
    await Application.updateOne({ _id: id }, { $set: { 'data.studentNumber': '01' + suffix } });
    expect((await get()).body.state).toBe('STALE');
    const forged = await regenerate();
    expect(forged.body.report.rows.find((row: { fieldName: string }) => row.fieldName === 'studentNumber').referenceValue).toBe(data.studentNumber);
    await Application.updateOne({ _id: id }, { $set: { 'data.studentNumber': data.studentNumber } });
    const reviewComparison = async () => {
      const report = await regenerate(adminCookie); expect(report.status).toBe(200);
      const reviewed = await request(app).post(adminPath + '/comparison-review').set('Cookie', adminCookie).send({ confirm: true, sourceFingerprint: report.body.sourceFingerprint, reason: 'Belgedeki ve referanstaki farkları asıl belgeyle manuel inceledim.' }); expect(reviewed.status).toBe(200);
    };
    await reviewComparison();
    expect((await request(app).post(adminPath + '/review').set('Cookie', adminCookie).send(positiveManualChecks)).status).toBe(200);
    expect((await request(app).get(path + '/report').set('Cookie', cookie)).body.readyForApproval).toBe(true);
    // Freeze after comparison validation but before the approval writes Application.
    let release!: () => void, started!: () => void, freeze = true;
    const gate = new Promise<void>(resolve => { release = resolve; }), signal = new Promise<void>(resolve => { started = resolve; });
    const original = reportService.buildApplicationReport;
    const spy = vi.spyOn(reportService, 'buildApplicationReport').mockImplementation(async (...args) => { if (freeze) { freeze = false; started(); await gate; } return original(...args); });
    try {
      const approval = status('APPROVED').then(response => response);
      await Promise.race([signal, approval.then(() => { throw new Error('Approval ended before source race test.'); })]);
      await importReference('Yeni Sürümdeki Referans Ad'); release();
      expect((await approval).status).toBe(409);
    } finally { release(); spy.mockRestore(); }
    expect((await Application.findById(id))!.status).toBe('UNDER_REVIEW');
    expect((await get()).body.state).toBe('STALE');
    expect((await request(app).get(path + '/report').set('Cookie', cookie)).body.readyForApproval).toBe(false);
    await reviewComparison();
    expect((await status('APPROVED')).status).toBe(200); expect((await status('COMPLETED')).status).toBe(200);
    expect(await ComparisonReport.countDocuments({ application: id })).toBeGreaterThanOrEqual(3);
    expect(await AuditLog.countDocuments({ application: id, event: 'COMPARISON_MANUALLY_REVIEWED' })).toBe(2);
    const document = await Document.findOne({ application: id });
    await DocumentExtraction.updateOne({ documentId: document!._id }, { $set: { documentHash: 'changed-in-test' } });
    expect((await get()).body.state).toBe('STALE');
    expect((await regenerate()).status).toBe(409); // Completed student lock remains.
  } finally {
    const applications = await Application.find({ student: { $in: ids } }).select('_id').lean(), appIds = applications.map(record => record._id);
    const documents = await Document.find({ application: { $in: appIds } }).select('+storageKey').lean();
    for (const doc of documents) await removePrivateFile(doc.storageKey);
    await ApplicationRevision.deleteMany({ application: { $in: appIds } });
    await Promise.all([ComparisonReport.deleteMany({ application: { $in: appIds } }), DocumentExtraction.deleteMany({ documentId: { $in: documents.map(doc => doc._id) } }), Document.deleteMany({ application: { $in: appIds } }), ValidationReport.deleteMany({ application: { $in: appIds } }), Application.deleteMany({ _id: { $in: appIds } }), StudentReferenceRecord.deleteMany({ createdBy: { $in: ids } }), ImportBatch.deleteMany({ owner: { $in: ids } }), StudentProfile.deleteMany({ user: { $in: ids } }), AuditLog.deleteMany({ user: { $in: ids } }), Session.deleteMany({ user: { $in: ids } }), User.deleteMany({ _id: { $in: ids } })]);
    await mongoose.disconnect();
  }
}, 240000);
