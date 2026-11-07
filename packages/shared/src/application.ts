import { z } from 'zod';
import { dateValue } from './internship.js';
const text = z.string().trim().min(1, 'Bu alan zorunludur.').max(500, 'En fazla 500 karakter.');
const optionalText = z.string().trim().max(500);
const date = z.string().refine(v => Number.isFinite(dateValue(v)), 'Geçerli bir tarih girin.');
const phone = z.string().trim().min(1, 'Telefon zorunludur.').max(50, 'Telefon en fazla 50 karakter olabilir.');
export const applicationSchema = z.object({
  name: text, studentNumber: text, identityNumber: z.string().regex(/^[1-9]\d{10}$/, '11 rakam girin.'), nationality: text, department: text,
  birthDate: date, academicYear: z.string().regex(/^\d{4}-\d{4}$/, 'Öğretim yılını 2026-2027 biçiminde girin.').refine(v => +v.slice(5) === +v.slice(0, 4) + 1, 'Ardışık öğretim yılları girin.'), semester: z.enum(['Güz', 'Bahar', 'Yaz']),
  previousInternshipDays: z.number({ error: 'Sayısal bir değer girin.' }).int('Tam sayı girin.').min(0, 'En az 0 olmalı.').max(365, 'En fazla 365 olabilir.'), email: z.string().email('Geçerli e-posta girin.'), phone, address: text, healthStatus: z.number({ error: 'Sağlık statüsü girin.' }).int('Tam sayı girin.').min(1, '1–6 arasında değer girin.').max(6, '1–6 arasında değer girin.'),
  startDate: date, endDate: date, submissionDate: date, workingDays: z.array(z.number().int().min(0).max(6)).min(1, 'En az bir çalışma günü seçin.').max(7), declaredDays: z.number().positive().max(367).multipleOf(.5),
  companyName: text, abroad: z.boolean(), serviceArea: text, companyPhone: text, fax: optionalText, companyEmail: z.string().email('Geçerli işyeri e-postası girin.'), website: optionalText.refine(v => !v || /^https?:\/\//.test(v), 'Web adresi http veya https ile başlamalı.'),
  employeeCount: z.number({ error: 'Çalışan sayısını girin.' }).int('Tam sayı girin.').min(1, 'En az bir çalışan olmalı.').max(10000000, 'Çalışan sayısı çok yüksek.'), engineerCount: z.number({ error: 'Mühendis sayısını girin.' }).int('Tam sayı girin.').min(0, 'Negatif değer olamaz.').max(1000000, 'Mühendis sayısı çok yüksek.'), engineerDepartments: optionalText, paid: z.boolean(), companyAddress: text,
  employerName: text, employerTitle: text, employerEmail: z.string().email('Geçerli işveren e-postası girin.'), employerPhone: text,
  neighborhood: optionalText.optional(), street: optionalText.optional(), buildingNumber: optionalText.optional(), apartmentNumber: optionalText.optional(), district: optionalText.optional(), city: optionalText.optional(),
  companyNeighborhood: optionalText.optional(), companyStreet: optionalText.optional(), companyBuildingNumber: optionalText.optional(), companyApartmentNumber: optionalText.optional(), companyDistrict: optionalText.optional(), companyCity: optionalText.optional(),
}).refine(v => dateValue(v.endDate) >= dateValue(v.startDate), { path: ['endDate'], message: 'Bitiş, başlangıçtan önce olamaz.' }).refine(v => dateValue(v.endDate) - dateValue(v.startDate) <= 366 * 86400000, { path: ['endDate'], message: 'Tarih aralığı en fazla 367 gün olabilir.' });
export type ApplicationInput = z.infer<typeof applicationSchema>;
