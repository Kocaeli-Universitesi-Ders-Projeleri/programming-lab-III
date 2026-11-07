import { expect, it } from 'vitest';
import request from './helpers/request.js';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { countInternshipDays, todayInTurkey } from '@kou/shared';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User, StudentProfile, Session, AuditLog } from '../src/models/auth.js';
import { Application, Document, ValidationReport } from '../src/models/application.js';
import { removePrivateFile } from '../src/services/privateStorage.js';
import { positiveManualChecks, validationFixture } from './fixtures/validation.js';
it.skipIf(process.env.LIVE_AUTH_TEST !== '1')('Atlas: güncel doğrulama ve manuel kontrollerle onay → tamamlama', async () => {
  await mongoose.connect(env.MONGODB_URI, { dbName: 'kou_staj_validation_tests', serverSelectionTimeoutMS: 10000 });
  const ids: mongoose.Types.ObjectId[] = [], appIds: mongoose.Types.ObjectId[] = [];
  const prefix = randomUUID().replaceAll('-', '').slice(0, 12), password = randomUUID();
  try {
    await Promise.all([User.init(), StudentProfile.init(), Application.init(), Document.init(), ValidationReport.init(), Session.init(), AuditLog.init()]);
    const data = validationFixture().application;
    data.studentNumber = 'TEST' + prefix; data.email = prefix + '@example.test'; data.submissionDate = todayInTurkey(); data.startDate = '2027-07-01'; data.endDate = '2027-07-30'; data.academicYear = '2026-2027'; data.declaredDays = countInternshipDays(data.startDate, data.endDate, data.workingDays).days!;
    const student = await User.create({ username: 's-' + prefix, email: data.email, name: data.name, role: 'ROLE_STUDENT', passwordHash: await bcrypt.hash(password,12) }); ids.push(student._id);
    const profile = await StudentProfile.create({ user: student._id, studentNumber: data.studentNumber, identityNumber: data.identityNumber, nationality: data.nationality, department: data.department });
    const admin = await User.create({ username: 'a-' + prefix, email: 'admin-' + data.email, name: 'Sentetik Komisyon', role: 'ROLE_ADMIN', passwordHash: await bcrypt.hash(password,12) }); ids.push(admin._id);
    const login = async (identifier: string) => { const r = await request(app).post('/api/v1/auth/login').send({ identifier, password }); expect(r.status).toBe(200); return r.headers['set-cookie'][0].split(';')[0]; };
    const studentCookie = await login(student.username), adminCookie = await login(admin.username);
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toBuffer();
    const created = await request(app).post('/api/v1/applications').set('Cookie', studentCookie).field('data', JSON.stringify(data)).attach('file', png, { filename: 'sentetik-ek16.png', contentType: 'image/png' }); expect(created.status).toBe(201);
    const id = created.body.id; appIds.push(new mongoose.Types.ObjectId(id));
    const path = '/api/v1/admin/applications/' + id;
    const report = await ValidationReport.findOne({ application: id }); expect(report?.engineVersion).toBe('1.0.0'); expect(report?.automatedPassed).toBe(true); expect(report?.pending).toHaveLength(4); expect(report?.readyForApproval).toBe(false);
    expect((await request(app).post(path + '/validate').set('Cookie', studentCookie).send({})).status).toBe(403);
    // Existing stage-5 reports can be regenerated without editing their original documents.
    await ValidationReport.updateOne({ application: id }, { $set: { engineComplete: false }, $unset: { engineVersion: 1 } });
    expect((await request(app).post(path + '/validate').set('Cookie', adminCookie).send({})).status).toBe(200);
    expect((await ValidationReport.findOne({ application: id }))?.engineComplete).toBe(true);
    const status = async (value: string) => request(app).patch(path + '/status').set('Cookie', adminCookie).send({ status: value });
    expect((await status('UNDER_REVIEW')).status).toBe(200);
    expect((await status('APPROVED')).status).toBe(409);
    expect((await request(app).post(path + '/review').set('Cookie', adminCookie).send({ ...positiveManualChecks, employerStamp: false })).status).toBe(200);
    expect((await status('APPROVED')).status).toBe(409);
    expect((await request(app).post(path + '/review').set('Cookie', adminCookie).send(positiveManualChecks)).status).toBe(200);
    expect((await ValidationReport.findOne({ application: id }))?.readyForApproval).toBe(true);
    // A previously passing report must never authorize approval against changed registry data.
    await StudentProfile.updateOne({ _id: profile._id }, { $set: { department: 'Farklı Bölüm' } });
    expect((await status('APPROVED')).status).toBe(409); expect((await Application.findById(id))?.status).toBe('UNDER_REVIEW');
    expect((await request(app).post(path + '/validate').set('Cookie', adminCookie).send({})).status).toBe(200);
    expect((await ValidationReport.findOne({ application: id }))?.automatedPassed).toBe(false);
    await StudentProfile.updateOne({ _id: profile._id }, { $set: { department: data.department } });
    expect((await request(app).post(path + '/validate').set('Cookie', adminCookie).send({})).status).toBe(200);
    expect((await status('APPROVED')).status).toBe(200);
    // Completion also uses fresh data, independently of the stored APPROVED report.
    await User.updateOne({ _id: student._id }, { $set: { name: 'Farklı Ad' } });
    expect((await status('COMPLETED')).status).toBe(409);
    await User.updateOne({ _id: student._id }, { $set: { name: data.name } });
    expect((await status('COMPLETED')).status).toBe(200);
    expect((await Application.findById(id))?.status).toBe('COMPLETED');
    expect((await request(app).get('/api/v1/admin/applications/completed').set('Cookie', adminCookie)).body.total).toBe(1);
    expect((await request(app).post(path + '/validate').set('Cookie', adminCookie).send({})).status).toBe(409);
    expect((await request(app).post('/api/v1/applications/' + id + '/documents').set('Cookie', studentCookie).field('data', JSON.stringify(data)).attach('file', png, { filename: 'new.png', contentType: 'image/png' })).status).toBe(409);
    expect(await AuditLog.countDocuments({ user: admin._id, event: 'APPLICATION_STATUS_APPROVED' })).toBe(1); expect(await AuditLog.countDocuments({ user: admin._id, event: 'APPLICATION_STATUS_COMPLETED' })).toBe(1);
  } finally {
    const records = await Application.find({ student: { $in: ids } }).select('_id'); appIds.push(...records.map(a => a._id));
    for (const doc of await Document.find({ application: { $in: appIds } }).select('+storageKey')) await removePrivateFile(doc.storageKey);
    await Promise.all([Document.deleteMany({ application: { $in: appIds } }), ValidationReport.deleteMany({ application: { $in: appIds } }), Application.deleteMany({ _id: { $in: appIds } }), StudentProfile.deleteMany({ user: { $in: ids } }), Session.deleteMany({ user: { $in: ids } }), AuditLog.deleteMany({ user: { $in: ids } }), User.deleteMany({ _id: { $in: ids } })]);
    await mongoose.disconnect();
  }
}, 240000);
