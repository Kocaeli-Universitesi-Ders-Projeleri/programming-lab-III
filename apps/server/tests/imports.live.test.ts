import { expect, it } from 'vitest';
import request from './helpers/request.js';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User, StudentProfile, AuditLog, Session } from '../src/models/auth.js';
import { ImportBatch } from '../src/models/ImportBatch.js';
import { StudentReferenceRecord } from '../src/models/StudentReferenceRecord.js';
import { columns } from '../src/services/importParser.js';

it.skipIf(process.env.LIVE_AUTH_TEST !== '1')('Atlas: bağımsız referans importu, eski hesap, sürümler, transaction ve erişim', async () => {
  // Never use the application database: only remove this test's own fixtures.
  await mongoose.connect(env.MONGODB_URI, { dbName: 'kou_staj_import_tests', serverSelectionTimeoutMS: 10000 });
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12), password = randomUUID();
  const ids: mongoose.Types.ObjectId[] = [];
  const studentNumber = '00' + suffix, secondNumber = '01' + suffix, extraNumber = '02' + suffix;
  const email = suffix + '@example.test', secondEmail = 'next-' + email;
  try {
    await Promise.all([User.init(), StudentProfile.init(), StudentReferenceRecord.init(), ImportBatch.init(), Session.init(), AuditLog.init()]);
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await User.create({ username: 'import-admin-' + suffix, email: 'admin-' + email, name: 'Import Test Admin', role: 'ROLE_ADMIN', passwordHash }); ids.push(admin._id);
    const other = await User.create({ username: 'other-' + suffix, email: 'other-' + email, name: 'Other Admin', role: 'ROLE_ADMIN', passwordHash }); ids.push(other._id);
    const student = await User.create({ username: 'legacy-' + suffix, email, name: 'Existing Student', role: 'ROLE_STUDENT', passwordHash }); ids.push(student._id);
    await StudentProfile.create({ user: student._id, studentNumber, department: 'Yazılım Mühendisliği' });
    async function login(username: string) { const response = await request(app).post('/api/v1/auth/login').send({ identifier: username, password }); expect(response.status).toBe(200); return response.headers['set-cookie'][0].split(';')[0]; }
    const cookie = await login(admin.username), otherCookie = await login(other.username), studentCookie = await login(student.username);
    const identity = '1' + Date.now().toString().slice(-10);
    const row = ['Sentetik Test', identity, 'TR', studentNumber, '2003-01-15', 'Örnek Mahallesi No:1 İzmit Kocaeli', 'Yazılım Mühendisliği', '2026-2027', '0', email, '+905550000001', '1'];
    const second = [...row]; second[1] = String(BigInt(identity) + 1n); second[3] = secondNumber; second[9] = secondEmail;
    const invalid = [...row]; invalid[3] = 'BAD' + suffix; invalid[1] = String(BigInt(identity) + 2n); invalid[9] = 'invalid';
    const csv = (rows: string[][]) => Buffer.from([columns.join(','), ...rows.map(item => item.join(','))].join('\n'));
    const preview = (rows: string[][], sessionCookie = cookie) => request(app).post('/api/v1/admin/students/import').set('Cookie', sessionCookie).attach('file', csv(rows), { filename: 'referans.csv', contentType: 'text/csv' });
    const confirm = (id: string, sessionCookie = cookie) => request(app).post('/api/v1/admin/students/import/' + id + '/confirm').set('Cookie', sessionCookie).send({ confirm: true });
    const staged = await preview([row, second, invalid]);
    expect(staged.status).toBe(201); expect(staged.body.valid).toBe(2); expect(staged.body.invalid).toBe(1);
    expect(await StudentReferenceRecord.countDocuments({ createdBy: admin._id })).toBe(0);
    expect((await confirm(staged.body.id, otherCookie)).status).toBe(404);
    expect((await request(app).post('/api/v1/admin/students/import/' + staged.body.id + '/confirm').set('Cookie', cookie).send({ confirm: false })).status).toBe(400);
    const committed = await confirm(staged.body.id);
    expect(committed.status).toBe(200); expect(committed.body).toMatchObject({ successful: 2, failed: 1 });
    expect(committed.body).not.toHaveProperty('credentials');
    expect(await User.countDocuments({ email: secondEmail })).toBe(0);
    expect(await StudentProfile.countDocuments({ studentNumber: secondNumber })).toBe(0);
    const oldAccount = await User.findById(student._id).select('+passwordHash');
    expect(oldAccount!.passwordHash).toBe(passwordHash); expect(oldAccount!.username).toBe(student.username);
    const stored = await StudentReferenceRecord.findOne({ studentNumber }).select('+identityNumber +healthCoverageStatus');
    expect(stored).toMatchObject({ studentNumber, fullName: row[0], identityNumber: row[1], healthCoverageStatus: 1, version: 1, sourceRowNumber: 2, sourceFileName: 'referans.csv' });
    expect((await confirm(staged.body.id)).body.alreadyCommitted).toBe(true);
    expect(await StudentReferenceRecord.countDocuments({ createdBy: admin._id })).toBe(2);

    const list = await request(app).get('/api/v1/admin/student-references').set('Cookie', cookie).query({ q: suffix });
    expect(list.status).toBe(200); expect(list.body.total).toBe(2); expect(list.headers['cache-control']).toBe('no-store');
    for (const item of list.body.items) for (const field of ['identityNumber', 'residenceAddress', 'dateOfBirth', 'healthCoverageStatus', 'email', 'phone']) expect(item).not.toHaveProperty(field);
    expect((await request(app).get('/api/v1/admin/student-references/' + stored!.id).set('Cookie', cookie)).body.identityNumber).toBe(identity);
    expect((await request(app).get('/api/v1/admin/student-references').set('Cookie', studentCookie)).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/student-references/' + stored!.id).set('Cookie', studentCookie)).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/student-references/' + stored!.id)).status).toBe(401);
    expect((await request(app).get('/api/v1/admin/student-references').set('Cookie', cookie).query({ q: { $ne: '' } })).status).toBe(400);
    expect((await request(app).get('/api/v1/admin/student-references').set('Cookie', cookie).query({ q: '.*' })).body.total).toBe(0);
    expect((await request(app).post('/api/v1/admin/students/import').set('Cookie', studentCookie).attach('file', csv([row]), 'test.csv')).status).toBe(403);

    // Reference-first / account-later is possible without changing the reference.
    const later = await User.create({ username: 'later-' + suffix, email: secondEmail, name: 'Later Student', role: 'ROLE_STUDENT', passwordHash }); ids.push(later._id);
    await StudentProfile.create({ user: later._id, studentNumber: secondNumber, department: 'Yazılım Mühendisliği' });
    await login(later.username); await login(student.username);
    const updated = [...row]; updated[0] = 'Yeni Referans Adı';
    const additional = [...row]; additional[1] = String(BigInt(identity) + 3n); additional[3] = extraNumber; additional[9] = 'extra-' + email;
    // Both previews see v1. A stale commit must not partially save its other row.
    const first = await preview([updated]), stale = await preview([updated, additional]);
    expect(first.body.rows[0].nextVersion).toBe(2); expect(stale.body.valid).toBe(2);
    expect((await confirm(first.body.id)).status).toBe(200);
    expect((await confirm(stale.body.id)).status).toBe(409);
    expect(await StudentReferenceRecord.countDocuments({ studentNumber: extraNumber })).toBe(0);
    expect((await ImportBatch.findById(stale.body.id))?.status).toBe('PREVIEW');
    expect(await StudentReferenceRecord.countDocuments({ studentNumber })).toBe(2);
    expect((await StudentReferenceRecord.findOne({ studentNumber, version: 1 }))?.fullName).toBe(row[0]);
    const latest = await request(app).get('/api/v1/admin/student-references').set('Cookie', cookie).query({ q: studentNumber });
    expect(latest.body.total).toBe(1); expect(latest.body.items[0]).toMatchObject({ fullName: 'Yeni Referans Adı', version: 2 });
    expect((await User.findById(student._id))?.name).toBe('Existing Student');
    const racing = [...additional]; racing[3] = '03' + suffix;
    const raceA = await preview([racing]), raceB = await preview([racing], otherCookie);
    const results = await Promise.all([confirm(raceA.body.id), confirm(raceB.body.id, otherCookie)]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    expect(await StudentReferenceRecord.countDocuments({ studentNumber: racing[3] })).toBe(1);
    expect(await AuditLog.countDocuments({ user: { $in: [admin._id, other._id] }, event: 'REFERENCE_IMPORT_COMMITTED' })).toBe(3);

    const legacy = await ImportBatch.create({ owner: admin._id, filename: 'legacy.csv', rows: [], expiresAt: new Date(Date.now() + 60000) });
    expect((await confirm(legacy.id)).status).toBe(409);
    await ImportBatch.updateOne({ _id: stale.body.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await confirm(stale.body.id)).status).toBe(404);
  } finally {
    await Promise.all([StudentReferenceRecord.deleteMany({ createdBy: { $in: ids } }), ImportBatch.deleteMany({ owner: { $in: ids } }), StudentProfile.deleteMany({ user: { $in: ids } }), Session.deleteMany({ user: { $in: ids } }), AuditLog.deleteMany({ user: { $in: ids } }), User.deleteMany({ _id: { $in: ids } })]);
    await mongoose.disconnect();
  }
}, 180000);
