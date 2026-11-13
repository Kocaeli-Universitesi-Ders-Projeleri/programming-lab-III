import { z } from 'zod';

export const registrationSchema = z.object({
  name: z.string().trim().min(2, 'Ad soyad en az 2 karakter olmalı.').max(150),
  studentNumber: z.string().trim().regex(/^[A-Za-z0-9]{3,30}$/, 'Öğrenci numarası 3–30 harf veya rakam olmalı.'),
  email: z.string().trim().toLowerCase().email('Geçerli e-posta adresi girin.').max(254),
  password: z.string().min(12, 'Şifre en az 12 karakter olmalı.').max(72).refine(value => new TextEncoder().encode(value).length <= 72, 'Şifre UTF-8 olarak en fazla 72 bayt olabilir.'),
  confirmPassword: z.string(),
}).strict().refine(value => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Şifreler eşleşmiyor.' });
export type RegistrationInput = z.infer<typeof registrationSchema>;

export const studentProfileSchema = z.object({
  department: z.string().trim().min(2, 'Bölüm zorunludur.').max(150),
  nationality: z.string().trim().min(2).max(50),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,30}$/, 'Geçerli telefon numarası girin.'),
  academicYear: z.string().trim().regex(/^\d{4}-\d{4}$/, 'Öğretim yılı 2026-2027 biçiminde olmalı.').refine(value => +value.slice(5) === +value.slice(0, 4) + 1, 'Ardışık öğretim yılları girin.'),
  identityNumber: z.string().regex(/^[1-9]\d{10}$/, '11 rakamdan oluşan kimlik numarası girin.'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const d = new Date(value); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value && value < new Date().toISOString().slice(0, 10); }, 'Geçerli geçmiş tarih girin.'),
  address: z.string().trim().min(2).max(500),
  previousInternshipDays: z.number().int().min(0).max(365),
  healthStatus: z.number().int().min(1).max(6),
}).strict();
export type StudentProfileInput = z.infer<typeof studentProfileSchema>;
