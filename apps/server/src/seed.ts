import mongoose from 'mongoose';
import { env } from './config/env.js';
import { bootstrapAdmin } from './services/bootstrapAdmin.js';

if (env.NODE_ENV === 'production' && !process.env.BOOTSTRAP_ADMIN_EMAIL) throw new Error('Production için BOOTSTRAP_ADMIN_EMAIL zorunludur.');
try {
  await mongoose.connect(env.MONGODB_URI);
  const result = await bootstrapAdmin({ username: process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin', email: process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@example.test', name: process.env.BOOTSTRAP_ADMIN_NAME || 'Staj Komisyonu', password: process.env.SEED_PASSWORD ?? '' });
  console.log(result.created ? 'Admin hesabı oluşturuldu. Öğrenci hesabı oluşturulmadı.' : 'Admin hesabı zaten mevcut. Şifresi ve bilgileri değiştirilmedi.');
} finally { await mongoose.disconnect(); }
