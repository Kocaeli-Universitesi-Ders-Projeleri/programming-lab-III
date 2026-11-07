import { expect, it } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { todayInTurkey } from '@kou/shared';
import request from './helpers/request.js';
import rawRequest from 'supertest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User, StudentProfile, Session, AuditLog } from '../src/models/auth.js';
import { Application, Document, ValidationReport } from '../src/models/application.js';
import { ApplicationRevision } from '../src/models/ApplicationRevision.js';
import { DocumentExtraction } from '../src/models/DocumentExtraction.js';
import { ComparisonReport } from '../src/models/ComparisonReport.js';
import { readPrivateFile, removePrivateFile } from '../src/services/privateStorage.js';
import { validationFixture, positiveManualChecks } from './fixtures/validation.js';
import { docxFixture, docxMime } from './helpers/extractionFixtures.js';

it.skipIf(process.env.LIVE_AUTH_TEST !== '1')('Atlas: VIZE onayı, admin completed düzeltme/dosya/silme ve eski URL koruması', async () => {
  await mongoose.connect(env.MONGODB_URI, { dbName: 'kou_staj_admin_application_tests', serverSelectionTimeoutMS: 10000 });
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12), password = randomUUID(), ids: mongoose.Types.ObjectId[] = [];
  try {
    await Promise.all([User.init(), StudentProfile.init(), Application.init(), Document.init(), DocumentExtraction.init(), ComparisonReport.init(), ApplicationRevision.init(), ValidationReport.init(), AuditLog.init(), Session.init()]);
    const data = validationFixture().application;
    Object.assign(data, { studentNumber: '00' + suffix, email: suffix + '@example.test', submissionDate: todayInTurkey(), engineerCount: 0, declaredDays: 1, neighborhood: '', companyNeighborhood: '' });
    const start = new Date(todayInTurkey() + 'T00:00:00Z'); start.setUTCDate(start.getUTCDate() + 10); const end = new Date(start); end.setUTCDate(end.getUTCDate() + 20);
    data.startDate = start.toISOString().slice(0, 10); data.endDate = end.toISOString().slice(0, 10);
    const hash = await bcrypt.hash(password, 12), cookies: string[] = [];
    for (const [index, role] of ['ROLE_STUDENT', 'ROLE_STUDENT', 'ROLE_ADMIN', 'ROLE_ADMIN'].entries()) {
      const user = await User.create({ username: suffix + index, email: index === 0 ? data.email : `${index}-${data.email}`, name: index === 0 ? data.name : 'Test Kullanıcı', role, passwordHash: hash }); ids.push(user._id);
      if (role === 'ROLE_STUDENT') await StudentProfile.create({ user: user._id, studentNumber: index === 0 ? data.studentNumber : '01' + suffix });
      const login = await request(app).post('/api/v1/auth/login').send({ identifier: user.username, password }); expect(login.status).toBe(200); cookies.push(login.headers['set-cookie'][0].split(';')[0]);
    }
    const student = cookies[0]!, foreign = cookies[1]!, admin = cookies[2]!, otherAdmin = cookies[3]!;
    const bytes = docxFixture([['Ad soyad', data.name], ['Öğrenci no', data.studentNumber]]);
    const created = await request(app).post('/api/v1/applications').set('Cookie', student).field('data', JSON.stringify(data)).attach('file', bytes, { filename: 'ek16.docx', contentType: docxMime });
    expect(created.status).toBe(201); const id = created.body.id, path = '/api/v1/applications/' + id, adminPath = '/api/v1/admin/applications/' + id;
    const status = (value: string) => request(app).patch(adminPath + '/status').set('Cookie', admin).send({ status: value });
    const getVersion = async () => (await Application.findById(id))!.version;
    const complete = async () => {
      if ((await Application.findById(id))!.status === 'UPLOADED') expect((await status('UNDER_REVIEW')).status).toBe(200);
      expect((await request(app).post(path + '/comparison').set('Cookie', admin).send({})).status).toBe(200);
      const comparison = await request(app).get(path + '/comparison').set('Cookie', admin);
      expect((await request(app).post(adminPath + '/comparison-review').set('Cookie', admin).send({ sourceFingerprint: comparison.body.sourceFingerprint, reason: 'Vize kapsamındaki belgeyi ve kaynak eksiklerini manuel inceledim.', confirm: true })).status).toBe(200);
      expect((await request(app).post(adminPath + '/review').set('Cookie', admin).send(positiveManualChecks)).status).toBe(200);
      const report = await request(app).get(path + '/report').set('Cookie', student);
      expect(report.body.policy).toBe('VIZE'); expect(report.body.readyForApproval).toBe(true);
      expect((await status('APPROVED')).status).toBe(200); expect((await status('COMPLETED')).status).toBe(200);
    };
    const initial = await request(app).get(path + '/report').set('Cookie', student);
    expect(initial.body.policy).toBe('VIZE'); expect(initial.body.readyForApproval).toBe(false);
    expect(initial.body.results.find((result: { ruleCode: string }) => result.ruleCode === 'ENGINEER_COUNT')).toMatchObject({ valid: false, severity: 'warning', blocking: false });
    await complete();
    const docIds: string[] = [(await Application.findById(id))!.document.toString()];
    // A completed record can be reopened for source/policy review without fabricating a data edit.
    const reopen = await request(app).patch(adminPath).set('Cookie', admin).send({ version: await getVersion(), reason: 'Kaynak ve politika incelemesi için aynı form yeniden açıldı.', data });
    expect(reopen.status).toBe(200); expect((await Application.findById(id))!.status).toBe('UNDER_REVIEW');
    await complete();
    const originalVersion = await getVersion(), changed = { ...data, companyName: 'Komisyonun Düzelttiği İşyeri' };
    expect((await request(app).patch(adminPath).set('Cookie', student).send({ version: originalVersion, reason: 'Yetkisiz öğrenci değişikliği.', data: changed })).status).toBe(403);
    expect((await request(app).delete(adminPath).set('Cookie', student).send({ version: originalVersion, reason: 'Yetkisiz öğrenci silmesi.', confirm: true })).status).toBe(403);
    expect((await request(app).get(adminPath + '/audit').set('Cookie', foreign)).status).toBe(403);
    expect((await request(app).post(path + '/documents').set('Cookie', student).field('data', JSON.stringify(data)).attach('file', bytes, { filename: 'again.docx', contentType: docxMime })).status).toBe(409);
    expect((await rawRequest(app).patch(adminPath).set('Cookie', admin).send({ version: originalVersion, reason: 'CSRF eksik olduğu için reddedilmeli.', data: changed })).status).toBe(403);
    expect((await request(app).patch(adminPath).set('Cookie', admin).send({ version: originalVersion, reason: 'kısa', data: changed })).status).toBe(400);
    expect((await request(app).patch(adminPath).set('Cookie', admin).send({ version: originalVersion, reason: 'Rol alanı enjekte edilemez.', data: changed, role: 'ROLE_STUDENT' })).status).toBe(400);
    const update = await request(app).patch(adminPath).set('Cookie', admin).send({ version: originalVersion, reason: 'İşyeri adı asıl belgeye göre düzeltildi.', data: changed });
    expect(update.status).toBe(200); const updated = await Application.findById(id);
    expect(updated!.status).toBe('UNDER_REVIEW'); expect(updated!.manualChecks).toBeNull(); expect(updated!.formVersion).toBe(3); expect(updated!.documentVersion).toBe(1);
    expect((await request(app).get(path + '/comparison').set('Cookie', student)).body.state).toBe('STALE');
    expect((await request(app).get(path + '/report').set('Cookie', student)).body.readyForApproval).toBe(false);
    expect((await request(app).patch(adminPath).set('Cookie', admin).send({ version: originalVersion, reason: 'Eski sürüm tekrar gönderilemez.', data: changed })).status).toBe(409);
    // Two different admins pass per-user admission and race the same DB version.
    const version = await getVersion();
    const race = await Promise.all([request(app).patch(adminPath).set('Cookie', admin).send({ version, reason: 'Eşzamanlı komisyon düzeltmesi bir.', data: { ...changed, companyName: 'Yarış A' } }), request(app).patch(adminPath).set('Cookie', otherAdmin).send({ version, reason: 'Eşzamanlı komisyon düzeltmesi iki.', data: { ...changed, companyName: 'Yarış B' } })]);
    expect(race.map(response => response.status).sort()).toEqual([200, 409]);
    const current = (await Application.findById(id))!;
    const replacement = docxFixture([['Ad soyad', 'Yeni Belgedeki Ad'], ['Öğrenci no', data.studentNumber]]);
    const replace = await request(app).patch(adminPath).set('Cookie', admin).field('version', String(current.version)).field('reason', 'Yeni imzalı belge sürümü komisyonca kaydedildi.').field('data', JSON.stringify(current.data)).attach('file', replacement, { filename: 'yeni.docx', contentType: docxMime });
    expect(replace.status).toBe(200);
    const replaced = (await Application.findById(id))!; docIds.push(replaced.document.toString());
    expect(replaced.documentVersion).toBe(2); expect((await Document.findById(replaced.document))!.owner!.toString()).toBe(ids[0]!.toString());
    expect((await request(app).get(path + '/extraction').set('Cookie', student)).body.extractedFields.find((field: { fieldName: string }) => field.fieldName === 'name').rawValue).toBe('Yeni Belgedeki Ad');
    await complete();
    const beforeDelete = await getVersion();
    expect((await request(app).delete(adminPath).set('Cookie', admin).send({ version: beforeDelete, reason: 'Yanlış mükerrer kayıt komisyonca kapatılacak.', confirm: false })).status).toBe(400);
    expect((await Application.findById(id))!.deletedAt).toBeNull();
    expect((await request(app).delete(adminPath).set('Cookie', admin).send({ version: beforeDelete - 1, reason: 'Eski sürümle silme reddedilmeli.', confirm: true })).status).toBe(409);
    expect((await request(app).delete(adminPath).set('Cookie', admin).send({ version: beforeDelete, reason: 'Yanlış mükerrer kayıt komisyonca kapatıldı.', confirm: true })).status).toBe(200);
    expect((await Application.findById(id))!.deletedAt).toBeInstanceOf(Date);
    for (const sessionCookie of [student, foreign, admin]) {
      for (const suffix of ['', '/report', '/comparison', '/extraction']) expect((await request(app).get(path + suffix).set('Cookie', sessionCookie)).status).toBe(404);
      for (const docId of docIds) expect((await request(app).get('/api/v1/documents/' + docId + '/download').set('Cookie', sessionCookie)).status).toBe(404);
    }
    const stats = await request(app).get('/api/v1/students/me/dashboard').set('Cookie', student); expect(stats.body.stats).toEqual({ total: 0, invalid: 0, completed: 0 });
    expect((await request(app).get('/api/v1/students/me/applications').set('Cookie', student)).body.total).toBe(0);
    expect((await request(app).get('/api/v1/admin/applications/completed').set('Cookie', admin)).body.total).toBe(0);
    expect((await request(app).get('/api/v1/admin/dashboard/stats').set('Cookie', admin)).body.applications).toBe(0);
    const audit = await request(app).get(adminPath + '/audit').set('Cookie', admin);
    expect(audit.status).toBe(200); expect(audit.headers['cache-control']).toBe('no-store'); expect(audit.body.total).toBe(5);
    expect(audit.body.items.find((item: { operation: string }) => item.operation === 'SOFT_DELETE').reason).toContain('kapatıldı');
    const firstRevision = await ApplicationRevision.findOne({ application: id, fromVersion: originalVersion }).select('+before +after');
    expect(firstRevision!.before.status).toBe('COMPLETED'); expect(firstRevision!.after.status).toBe('UNDER_REVIEW'); expect(firstRevision!.before.data.companyName).toBe(data.companyName);
    expect(await Document.countDocuments({ application: id })).toBe(2);
    const retained = (await Document.findById(replaced.document).select('+storageKey'))!;
    expect(await readPrivateFile(retained.storageKey, retained.size!, retained.sha256!)).toEqual(replacement);
    expect(await AuditLog.countDocuments({ application: id, event: 'APPLICATION_ADMIN_UPDATED' })).toBe(4);
    expect(await AuditLog.countDocuments({ application: id, event: 'APPLICATION_SOFT_DELETED' })).toBe(1);
  } finally {
    const applications = await Application.find({ student: { $in: ids } }).select('_id').lean(), appIds = applications.map(record => record._id);
    const docs = await Document.find({ application: { $in: appIds } }).select('+storageKey').lean();
    for (const doc of docs) await removePrivateFile(doc.storageKey);
    await Promise.all([ApplicationRevision.deleteMany({ application: { $in: appIds } }), ComparisonReport.deleteMany({ application: { $in: appIds } }), DocumentExtraction.deleteMany({ documentId: { $in: docs.map(doc => doc._id) } }), Document.deleteMany({ application: { $in: appIds } }), ValidationReport.deleteMany({ application: { $in: appIds } }), Application.deleteMany({ _id: { $in: appIds } }), StudentProfile.deleteMany({ user: { $in: ids } }), Session.deleteMany({ user: { $in: ids } }), AuditLog.deleteMany({ user: { $in: ids } }), User.deleteMany({ _id: { $in: ids } })]);
    await mongoose.disconnect();
  }
}, 300000);
