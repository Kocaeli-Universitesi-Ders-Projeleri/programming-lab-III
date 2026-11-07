import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';
export async function connectDatabase() {
  if (!env.MONGODB_URI) {
    logger.warn('MONGODB_URI tanımlı değil; Atlas bağlantısı kurulmadı.');
    return;
  }
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    logger.info('MongoDB Atlas bağlantısı kuruldu.');
  } catch {
    logger.error('Atlas bağlantısı kurulamadı. URI, ağ erişimi ve veritabanı kullanıcısını kontrol edin.');
  }
}
export function databaseStatus(): 'connected' | 'connecting' | 'disconnected' {
  return mongoose.connection.readyState === 1 ? 'connected' : mongoose.connection.readyState === 2 ? 'connecting' : 'disconnected';
}
