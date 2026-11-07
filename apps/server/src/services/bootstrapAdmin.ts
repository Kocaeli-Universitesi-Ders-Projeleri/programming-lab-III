import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User, AuditLog } from '../models/auth.js';

const schema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{3,60}$/),
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(2).max(150),
  password: z.string().min(12).refine(value => Buffer.byteLength(value, 'utf8') <= 72),
});
export async function bootstrapAdmin(input: z.infer<typeof schema>) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error('Admin başlangıç ayarları geçersiz. E-posta, kullanıcı adı ve 12 karakter/72 bayt şifre sınırını kontrol edin.');
  const { password, ...account } = parsed.data;
  await Promise.all([User.init(), AuditLog.init()]);
  const session = await mongoose.startSession(); let created = false;
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await session.withTransaction(async () => {
      created = false;
      const existing = await User.find({ $or: [{ username: account.username }, { email: account.email }] }).session(session);
      if (existing.length) {
        if (existing.length !== 1 || existing[0]!.username !== account.username || existing[0]!.email !== account.email || existing[0]!.role !== 'ROLE_ADMIN') throw new Error('Admin başlangıç bilgileri mevcut hesapla çakışıyor. Mevcut hesap değiştirilmedi.');
        return;
      }
      const [user] = await User.create([{ ...account, passwordHash, role: 'ROLE_ADMIN', active: true }], { session });
      await AuditLog.create([{ user: user!._id, event: 'ADMIN_BOOTSTRAPPED' }], { session });
      created = true;
    });
    return { created };
  } finally { await session.endSession(); }
}
