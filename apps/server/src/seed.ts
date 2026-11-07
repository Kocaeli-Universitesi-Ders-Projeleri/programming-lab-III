import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { User, StudentProfile } from './models/auth.js';
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12) throw new Error('SEED_PASSWORD en az 12 karakter olmalı.');
try {
  await mongoose.connect(env.MONGODB_URI);
  await Promise.all([User.init(), StudentProfile.init()]);
  const passwordHash = await bcrypt.hash(password, 12);
  for (const account of [{ username: 'admin', email: 'admin@example.test', name: 'Demo Yönetici', role: 'ROLE_ADMIN' }, { username: 'student', email: 'student@example.test', name: 'Demo Öğrenci', role: 'ROLE_STUDENT' }]) {
    const user = await User.findOneAndUpdate({ username: account.username }, { $setOnInsert: { ...account, passwordHash } }, { upsert: true, new: true });
    if (account.role === 'ROLE_STUDENT') await StudentProfile.updateOne({ user: user._id }, { $setOnInsert: { user: user._id, studentNumber: 'DEMO2026001', department: 'Yazılım Mühendisliği', nationality: 'TR', academicYear: '2026-2027' } }, { upsert: true });
  }
  console.log('Sentetik admin ve student hesapları hazır. Mevcut şifreler değiştirilmedi.');
} finally { await mongoose.disconnect(); }
