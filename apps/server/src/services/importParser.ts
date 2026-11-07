import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import yauzl from 'yauzl';
import { z } from 'zod';
import { ImportError } from './inspectionErrors.js';
export { ImportError } from './inspectionErrors.js';
export const columns = ['name', 'identityNumber', 'nationality', 'studentNumber', 'birthDate', 'address', 'department', 'academicYear', 'previousInternshipDays', 'email', 'phone', 'healthStatus'] as const;
const fieldNames: Record<string, string> = { name: 'Ad soyad', identityNumber: 'Kimlik numarası', nationality: 'Uyruk', studentNumber: 'Öğrenci numarası', birthDate: 'Doğum tarihi', address: 'Adres', department: 'Bölüm', academicYear: 'Öğretim yılı', previousInternshipDays: 'Önceki staj günü', email: 'E-posta', phone: 'Telefon', healthStatus: 'Sağlık statüsü' };
const requiredText = z.string().trim().min(2).max(250).refine(v => !/^[=+@\-]/.test(v), 'Formül benzeri değer kullanılamaz');
export const studentRowSchema = z.object({
  name: requiredText,
  identityNumber: z.string().regex(/^[1-9]\d{10}$/, 'Kimlik numarası 11 rakam olmalı'),
  nationality: z.string().trim().min(2).max(50),
  studentNumber: z.string().regex(/^[A-Za-z0-9]{3,30}$/, 'Öğrenci numarası 3–30 harf/rakam olmalı'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Doğum tarihi YYYY-AA-GG olmalı').refine(v => { const d = new Date(v); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && v < new Date().toISOString().slice(0, 10); }, 'Geçerli geçmiş tarih girin'),
  address: requiredText,
  department: requiredText,
  academicYear: z.string().regex(/^\d{4}-\d{4}$/).refine(v => Number(v.slice(5)) === Number(v.slice(0, 4)) + 1, 'Öğretim yılları ardışık olmalı'),
  previousInternshipDays: z.string().min(1, 'Önceki staj günü zorunlu').transform(Number).pipe(z.number().int().min(0).max(365)),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().transform(v => v.replace(/[\s()-]/g, '').replace(/^0/, '+90')).pipe(z.string().regex(/^\+90\d{10}$/, 'Telefon +90 ve 10 rakam olmalı')),
  healthStatus: z.string().min(1).transform(Number).pipe(z.number().int().min(1).max(6)),
}).superRefine((v, ctx) => {
  if (!['TR', 'TÜRKİYE', 'TC', 'T.C.'].includes(v.nationality.toLocaleUpperCase('tr-TR')) && !v.identityNumber.startsWith('99')) ctx.addIssue({ code: 'custom', path: ['identityNumber'], message: 'Yabancı kimlik numarası 99 ile başlamalı' });
});
export type StudentRow = z.infer<typeof studentRowSchema>;
export interface PreviewRow { line: number; data: Record<string, unknown>; errors: string[] }
async function inspectZip(buffer: Buffer) {
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (err, zip) => {
      if (err || !zip) { reject(new ImportError('Geçersiz XLSX arşivi.')); return; }
      let bytes = 0, actualBytes = 0, entries = 0, workbook = false;
      const fail = () => { zip.close(); reject(new ImportError('XLSX arşivi güvenlik veya boyut sınırını aşıyor.')); };
      zip.on('error', () => { zip.close(); reject(new ImportError('XLSX arşivi okunamadı.')); });
      zip.on('entry', entry => {
        bytes += entry.uncompressedSize; entries++;
        if (bytes > 20 * 1024 * 1024 || entries > 500 || /vbaProject|externalLinks/i.test(entry.fileName) || (entry.generalPurposeBitFlag & 1)) { fail(); return; }
        if (entry.fileName === 'xl/workbook.xml') workbook = true;
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) { fail(); return; }
          stream.on('error', fail);
          stream.on('data', chunk => { actualBytes += chunk.length; if (actualBytes > 20 * 1024 * 1024) { stream.destroy(); fail(); } });
          stream.on('end', () => zip.readEntry());
        });
      });
      zip.on('end', () => workbook ? resolve() : reject(new ImportError('Dosya bir XLSX çalışma kitabı değil.')));
      zip.readEntry();
    });
  });
}
export async function parseImport(buffer: Buffer, filename: string, mime: string): Promise<PreviewRow[]> {
  let table: string[][];
  if (filename.toLowerCase().endsWith('.csv')) {
    if (!['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'].includes(mime)) throw new ImportError('CSV MIME türü geçersiz.');
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { throw new ImportError('CSV dosyasını UTF-8 olarak kaydedin.'); }
    if (text.includes('\0')) throw new ImportError('CSV metin içeriği geçersiz.');
    const firstLine = text.split(/\r?\n/)[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';
    try { table = parse(text, { bom: true, delimiter, relax_column_count: true, skip_empty_lines: false, max_record_size: 16000, to: 502 }); }
    catch { throw new ImportError('CSV satır veya tırnak yapısı geçersiz.'); }
  } else if (filename.toLowerCase().endsWith('.xlsx')) {
    if (!['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'].includes(mime) || buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) throw new ImportError('XLSX türü veya dosya imzası geçersiz.');
    await inspectZip(buffer);
    const workbook = new ExcelJS.Workbook();
    try { await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer); } catch { throw new ImportError('Excel dosyası okunamadı.'); }
    if (workbook.worksheets.length !== 1) throw new ImportError('Dosyada yalnızca bir çalışma sayfası bulunmalı.');
    const sheet = workbook.worksheets[0];
    if (sheet.rowCount > 501 || sheet.columnCount > 20) throw new ImportError('En fazla 500 veri satırı ve 20 sütun desteklenir.');
    table = [];
    sheet.eachRow({ includeEmpty: true }, row => {
      const values: string[] = [];
      for (let i = 1; i <= sheet.columnCount; i++) {
        const value = row.getCell(i).value;
        if (typeof value === 'object' && value !== null && !(value instanceof Date)) throw new ImportError('Formül, bağlantı veya özel hücre içeriği desteklenmiyor. Hücreleri düz metin olarak kaydedin.');
        values.push(value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? ''));
      }
      table.push(values);
    });
  } else throw new ImportError('Yalnızca CSV ve XLSX desteklenir.');
  if (table.length < 2 || table.length > 501) throw new ImportError('Dosya 1–500 veri satırı içermeli.');
  const headers = table[0].map(h => String(h).trim());
  if (headers.length !== columns.length || new Set(headers).size !== headers.length || columns.some(c => !headers.includes(c))) throw new ImportError('Sütunlar şablonla eşleşmiyor. Örnek dosyadaki sütun adlarını kullanın.');
  const rows = table.slice(1).map((values, i): PreviewRow => {
    const raw = Object.fromEntries(headers.map((h, j) => [h, String(values[j] ?? '').trim()]));
    const parsed = studentRowSchema.safeParse(raw);
    return { line: i + 2, data: parsed.success ? parsed.data : raw, errors: [...(values.length !== headers.length ? ['Sütun sayısı uyuşmuyor'] : []), ...(parsed.success ? [] : parsed.error.issues.map(e => {
      const field = String(e.path[0]);
      const explanation = /^(Invalid|Too |Expected|Unrecognized)/.test(e.message) ? (field === 'email' ? 'Geçerli e-posta adresi girin' : field === 'healthStatus' ? '1–6 arasında tam sayı girin' : field === 'previousInternshipDays' ? '0–365 arasında tam sayı girin' : 'Alan boş veya beklenen biçimde değil') : e.message;
      return `${fieldNames[field] ?? field}: ${explanation}`;
    }))] };
  });
  for (const key of ['studentNumber', 'email', 'identityNumber']) {
    const counts = new Map<string, number>();
    for (const row of rows) { const v = String(row.data[key]).toLowerCase(); counts.set(v, (counts.get(v) ?? 0) + 1); }
    for (const row of rows) if ((counts.get(String(row.data[key]).toLowerCase()) ?? 0) > 1) row.errors.push(`Dosyada mükerrer ${fieldNames[key].toLocaleLowerCase('tr-TR')}`);
  }
  return rows;
}
