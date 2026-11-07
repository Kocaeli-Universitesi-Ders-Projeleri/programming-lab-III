import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { registrationSchema, studentProfileSchema } from '@kou/shared';
import { loginAccountLimit, loginIpLimit, registrationIpLimit, registrationIdentityLimit, anonymousWorkAdmission, withHeavyWork, userLimit } from '../middleware/rateLimits.js';
import { HttpError } from '../utils/httpError.js';
import { User, Session, AuditLog, StudentProfile } from '../models/auth.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { env } from '../config/env.js';
export const authRoutes = Router();
const cookieOptions = { httpOnly: true, sameSite: 'strict' as const, secure: env.NODE_ENV === 'production', path: '/api/v1' };
// Unknown accounts still perform a bcrypt comparison to reduce timing differences.
const dummyHash = await bcrypt.hash('unusable-dummy-password', 12);

authRoutes.post('/auth/register', registrationIpLimit, registrationIdentityLimit, anonymousWorkAdmission(), withHeavyWork(async (req, res) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Kayıt alanlarını kontrol edin.', fields: parsed.error.flatten().fieldErrors }); return; }
  const { name, studentNumber, email, password } = parsed.data;
  await Promise.all([User.init(), StudentProfile.init(), AuditLog.init()]);
  const passwordHash = await bcrypt.hash(password, 12);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const [user] = await User.create([{ name, email, username: 'student-' + randomUUID(), passwordHash, role: 'ROLE_STUDENT', active: true }], { session });
      await StudentProfile.create([{ user: user!._id, studentNumber }], { session });
      await AuditLog.create([{ user: user!._id, event: 'STUDENT_REGISTERED', ip: req.ip }], { session });
    });
    res.status(201).json({ message: 'Hesabınız oluşturuldu. E-posta adresiniz ve şifrenizle giriş yapabilirsiniz.' });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new HttpError(409, 'Bu e-posta veya öğrenci numarasıyla kayıt oluşturulamıyor. Mevcut hesabınızla giriş yapmayı deneyin.');
    throw error;
  } finally { await session.endSession(); }
}));
authRoutes.post('/auth/login', loginIpLimit, loginAccountLimit, async (req, res) => {
  const parsed = z.object({ identifier: z.string().trim().min(1).max(254), password: z.string().min(1).max(128) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Kullanıcı adı/e-posta ve şifre zorunludur.' }); return; }
  const identifier = parsed.data.identifier.toLowerCase();
  const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] }).select('+passwordHash');
  const matches = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? dummyHash);
  if (user?.active === false) {
    await AuditLog.create({ user: user._id, event: 'LOGIN_DISABLED', ip: req.ip });
    res.status(401).json({ message: 'Kullanıcı bilgileri hatalı veya hesap kullanılamıyor.' }); return;
  }
  if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await AuditLog.create({ user: user._id, event: 'LOGIN_LOCKED', ip: req.ip });
    res.status(423).json({ message: 'Hesap geçici olarak kilitli. 15 dakika sonra tekrar deneyin.' }); return;
  }
  if (!user || !matches) {
    if (user) {
      // Single atomic update keeps concurrent failed requests from losing increments.
      await User.updateOne({ _id: user._id, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: new Date() } }] }, [{ $set: { failedAttempts: { $add: [{ $cond: [{ $and: [{ $ne: ['$lockedUntil', null] }, { $lte: ['$lockedUntil', '$$NOW'] }] }, 0, '$failedAttempts'] }, 1] } } }, { $set: { lockedUntil: { $cond: [{ $gte: ['$failedAttempts', 5] }, { $add: ['$$NOW', 15 * 60000] }, null] } } }]);
    }
    await AuditLog.create({ user: user?._id, event: 'LOGIN_FAILED', ip: req.ip });
    res.status(401).json({ message: 'Kullanıcı bilgileri hatalı.' }); return;
  }
  const unlocked = await User.updateOne({ _id: user._id, passwordHash: user.passwordHash, active: { $ne: false }, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: new Date() } }] }, { $set: { failedAttempts: 0, lockedUntil: null } });
  if (!unlocked.matchedCount) { await AuditLog.create({ user: user._id, event: 'LOGIN_LOCKED_OR_CHANGED', ip: req.ip }); res.status(423).json({ message: 'Hesap kullanılamıyor veya geçici olarak kilitli. Daha sonra tekrar deneyin.' }); return; }
  // Rotate only this browser's prior session; other devices remain independent.
  const previous = req.cookies?.kou_session;
  if (typeof previous === 'string') {
    let old: string | jwt.JwtPayload | undefined;
    try { old = jwt.verify(previous, env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'kou-staj', audience: 'kou-client' }); }
    catch { /* Invalid prior cookies do not prevent a credential-based login. */ }
    if (old && typeof old !== 'string' && typeof old.jti === 'string' && /^[a-f\d]{24}$/i.test(old.jti) && typeof old.sub === 'string' && /^[a-f\d]{24}$/i.test(old.sub)) await Session.deleteOne({ _id: old.jti, user: old.sub });
  }
  const session = await Session.create({ user: user._id, expiresAt: new Date(Date.now() + 60 * 60000) });
  const token = jwt.sign({}, env.JWT_SECRET, { algorithm: 'HS256', subject: user.id, jwtid: session.id, expiresIn: '1h', issuer: 'kou-staj', audience: 'kou-client' });
  await AuditLog.create({ user: user._id, event: 'LOGIN_SUCCESS', ip: req.ip });
  res.cookie('kou_session', token, { ...cookieOptions, maxAge: 60 * 60000 }).json({ user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role } });
});
authRoutes.get('/auth/me', authenticate, (req, res) => { res.json({ user: req.authUser }); });
authRoutes.post('/auth/logout', authenticate, async (req, res) => {
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => { await Session.deleteOne({ _id: req.sessionId }, { session }); await AuditLog.create([{ user: req.authUser!.id, event: 'LOGOUT', ip: req.ip }], { session }); }); }
  finally { await session.endSession(); }
  res.clearCookie('kou_session', cookieOptions).clearCookie('kou_csrf', cookieOptions).sendStatus(204);
});
authRoutes.get('/students/me', authenticate, authorize('ROLE_STUDENT'), async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.authUser!.id }).select('+identityNumber +birthDate +address').lean();
  if (!profile) { res.status(404).json({ message: 'Öğrenci profili bulunamadı.' }); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ user: req.authUser, profile, profileComplete: studentProfileSchema.strip().safeParse(profile).success });
});

authRoutes.patch('/students/me', authenticate, authorize('ROLE_STUDENT'), userLimit(20, 60000), async (req, res) => {
  const parsed = studentProfileSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Profil alanlarını kontrol edin.', fields: parsed.error.flatten().fieldErrors }); return; }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await StudentProfile.updateOne({ user: req.authUser!.id }, { $set: parsed.data }, { session, runValidators: true });
      if (!updated.matchedCount) throw new HttpError(404, 'Öğrenci profili bulunamadı.');
      await AuditLog.create([{ user: req.authUser!.id, event: 'STUDENT_PROFILE_UPDATED', ip: req.ip }], { session });
    });
    res.json({ message: 'Profil bilgileriniz kaydedildi.' });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new HttpError(409, 'Profil bilgileri mevcut bir kayıtla çakışıyor. Staj komisyonuyla iletişime geçin.');
    throw error;
  } finally { await session.endSession(); }
});
authRoutes.get('/admin/access', authenticate, authorize('ROLE_ADMIN'), (req, res) => { res.json({ user: req.authUser, message: 'Yönetici erişimi doğrulandı.' }); });
