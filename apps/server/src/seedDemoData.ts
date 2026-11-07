import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { User, StudentProfile } from './models/auth.js';
if (env.NODE_ENV === 'production') throw new Error('Demo öğrenci oluşturma production ortamında kapalıdır.');
const password = process.env.SEED_PASSWORD ?? '';
if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('SEED_PASSWORD en az 12 karakter ve en fazla 72 bayt olmalı.');
try {
  await mongoose.connect(env.MONGODB_URI);
  await Promise.all([User.init(), StudentProfile.init()]);
  const session = await mongoose.startSession();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await session.withTransaction(async () => {
      const existing = await User.findOne({ username: 'student' }).session(session);
      if (existing) { if (existing.role !== 'ROLE_STUDENT') throw new Error('Demo kullanıcı adı başka hesap tarafından kullanılıyor.'); return; }
      const [user] = await User.create([{ username: 'student', email: 'student@example.test', name: 'Demo Öğrenci', role: 'ROLE_STUDENT', passwordHash }], { session });
      await StudentProfile.create([{ user: user!._id, studentNumber: 'DEMO2026001', department: 'Yazılım Mühendisliği', nationality: 'TR', academicYear: '2026-2027' }], { session });
    });
    console.log('Sentetik öğrenci hazır. Mevcut hesaplar ve şifreler değiştirilmedi.');
  } finally { await session.endSession(); }
} finally { await mongoose.disconnect(); }
