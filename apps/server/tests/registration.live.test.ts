import { expect, it } from 'vitest';
import request from './helpers/request.js';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User, StudentProfile, AuditLog, Session } from '../src/models/auth.js';
import { StudentReferenceRecord } from '../src/models/StudentReferenceRecord.js';
import { bootstrapAdmin } from '../src/services/bootstrapAdmin.js';

it.skipIf(process.env.LIVE_AUTH_TEST !== '1')('Atlas: self-registration, minimum profil, yetki enjeksiyonu, yarış ve admin bootstrap', async () => {
  await mongoose.connect(env.MONGODB_URI, { dbName: 'kou_staj_registration_tests', serverSelectionTimeoutMS: 10000 });
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12), password = 'Kendi-' + randomUUID();
  const emails = ['student', 'duplicate', 'race-a', 'race-b', 'email-race', 'admin'].map(prefix => `${prefix}-${suffix}@example.test`);
  const studentNumber = '00' + suffix;
  const body = { name: 'Özgür Şahin', studentNumber, email: emails[0], password, confirmPassword: password };
  const register = (data: unknown) => request(app).post('/api/v1/auth/register').send(data);
  try {
    await Promise.all([User.init(), StudentProfile.init(), Session.init(), AuditLog.init(), StudentReferenceRecord.init()]);
    expect((await register({ ...body, role: 'ROLE_ADMIN', admin: true, isActive: true })).status).toBe(400);
    expect((await register({ ...body, studentNumber: { $ne: null } })).status).toBe(400);
    expect((await register({ ...body, confirmPassword: 'wrong' })).status).toBe(400);
    expect((await register({ ...body, password: 'ğ'.repeat(40), confirmPassword: 'ğ'.repeat(40) })).status).toBe(400);
    const created = await register({ ...body, email: emails[0]!.toUpperCase() });
    expect(created.status).toBe(201); expect(created.body).not.toHaveProperty('passwordHash');
    const student = await User.findOne({ email: emails[0] }).select('+passwordHash');
    expect(student).not.toBeNull(); expect(student!.role).toBe('ROLE_STUDENT'); expect(student!.active).toBe(true);
    expect(await bcrypt.compare(password, student!.passwordHash)).toBe(true);
    const profile = await StudentProfile.findOne({ user: student!._id }).lean();
    expect(profile!.studentNumber).toBe(studentNumber);
    for (const key of ['department', 'nationality', 'identityNumber', 'previousInternshipDays', 'healthStatus']) expect(profile).not.toHaveProperty(key);
    expect(await StudentReferenceRecord.countDocuments({ studentNumber })).toBe(0);
    expect((await register(body)).status).toBe(409);
    expect((await register({ ...body, email: emails[1] })).status).toBe(409);
    expect(await User.countDocuments({ email: emails[1] })).toBe(0); // Profile conflict rolls back User.
    const login = await request(app).post('/api/v1/auth/login').send({ identifier: emails[0], password });
    expect(login.status).toBe(200); const cookie = login.headers['set-cookie'][0].split(';')[0];
    const before = await request(app).get('/api/v1/students/me').set('Cookie', cookie);
    expect(before.status).toBe(200); expect(before.body.profileComplete).toBe(false);
    expect((await request(app).get('/api/v1/students/me/dashboard').set('Cookie', cookie)).status).toBe(200);
    const details = { department: 'Yazılım Mühendisliği', nationality: 'TR', phone: '+905550000001', academicYear: '2026-2027', identityNumber: '1' + Date.now().toString().slice(-10), birthDate: '2003-01-15', address: 'Örnek adres İzmit', previousInternshipDays: 0, healthStatus: 1 };
    expect((await request(app).patch('/api/v1/students/me').set('Cookie', cookie).send({ ...details, user: new mongoose.Types.ObjectId().toString(), role: 'ROLE_ADMIN', studentNumber: 'OTHER' })).status).toBe(400);
    expect((await request(app).patch('/api/v1/students/me').set('Cookie', cookie).send(details)).status).toBe(200);
    const after = await request(app).get('/api/v1/students/me').set('Cookie', cookie);
    expect(after.body.profileComplete).toBe(true); expect(after.body.profile).toMatchObject({ ...details, studentNumber });
    expect((await User.findById(student!._id))?.role).toBe('ROLE_STUDENT');
    expect((await request(app).get('/api/v1/admin/access').set('Cookie', cookie)).status).toBe(403);
    expect((await request(app).patch('/api/v1/students/me').send(details)).status).toBe(401);

    const duplicateNumber = '01' + suffix;
    const numberRace = await Promise.all([register({ ...body, studentNumber: duplicateNumber, email: emails[2] }), register({ ...body, studentNumber: duplicateNumber, email: emails[3] })]);
    expect(numberRace.map(result => result.status).sort()).toEqual([201, 409]);
    expect(await User.countDocuments({ email: { $in: [emails[2], emails[3]] } })).toBe(1);
    expect(await StudentProfile.countDocuments({ studentNumber: duplicateNumber })).toBe(1);
    const emailRace = await Promise.all([register({ ...body, email: emails[4], studentNumber: '02' + suffix }), register({ ...body, email: emails[4], studentNumber: '03' + suffix })]);
    expect(emailRace.map(result => result.status).sort()).toEqual([201, 409]);
    const racedUser = await User.findOne({ email: emails[4] });
    expect(await StudentProfile.countDocuments({ user: racedUser!._id })).toBe(1);

    const adminInput = { username: 'bootstrap-' + suffix, email: emails[5]!, name: 'Test Komisyonu', password };
    expect(await bootstrapAdmin(adminInput)).toEqual({ created: true });
    const admin = await User.findOne({ email: emails[5] }).select('+passwordHash');
    expect(await StudentProfile.countDocuments({ user: admin!._id })).toBe(0);
    expect(await bootstrapAdmin({ ...adminInput, password: 'Another-password-123' })).toEqual({ created: false });
    expect((await User.findById(admin!._id).select('+passwordHash'))!.passwordHash).toBe(admin!.passwordHash);
    await expect(bootstrapAdmin({ ...adminInput, username: student!.username, email: student!.email })).rejects.toThrow('çakışıyor');
    expect((await User.findById(student!._id))?.role).toBe('ROLE_STUDENT');
    expect(await AuditLog.countDocuments({ user: student!._id, event: 'STUDENT_REGISTERED' })).toBe(1);
    expect(await AuditLog.countDocuments({ user: student!._id, event: 'STUDENT_PROFILE_UPDATED' })).toBe(1);
    expect((await request(app).post('/api/v1/auth/logout').set('Cookie', cookie).send({})).status).toBe(204);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(401);
  } finally {
    const users = await User.find({ email: { $in: emails } }).select('_id').lean(); const ids = users.map(user => user._id);
    await Promise.all([StudentProfile.deleteMany({ user: { $in: ids } }), Session.deleteMany({ user: { $in: ids } }), AuditLog.deleteMany({ user: { $in: ids } }), User.deleteMany({ _id: { $in: ids } })]);
    await mongoose.disconnect();
  }
}, 180000);
