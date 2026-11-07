import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { columns, parseImport } from '../src/services/importParser.js';
const valid = ['Sentetik Öğrenci', '10000000001', 'TR', 'TEST001', '2003-01-15', 'Örnek adres No:1 İzmit Kocaeli', 'Yazılım Mühendisliği', '2026-2027', '0', 'test@example.test', '05550000001', '1'];
const csv = (rows: string[][], delimiter = ',') => Buffer.from([columns.join(delimiter), ...rows.map(r => r.join(delimiter))].join('\r\n'));
describe('Dosya ve satır doğrulaması', () => {
  it('CSV alanlarını normalize eder', async () => { const rows = await parseImport(csv([valid]), 'test.csv', 'text/csv'); expect(rows[0].errors).toEqual([]); expect(rows[0].data).toMatchObject({ phone: '+905550000001', previousInternshipDays: 0, healthStatus: 1 }); });
  it('noktalı virgüllü CSV kabul eder', async () => { expect((await parseImport(csv([valid], ';'), 't.csv', 'text/plain'))[0].errors).toEqual([]); });
  it('sütun eksikse dosyayı reddeder', async () => { await expect(parseImport(Buffer.from('name\nTest'), 't.csv', 'text/csv')).rejects.toThrow('Sütunlar'); });
  it('dosyadaki tekrarların her iki satırını işaretler', async () => { const rows = await parseImport(csv([valid, valid]), 't.csv', 'text/csv'); expect(rows.every(r => r.errors.some(e => e.includes('mükerrer')))).toBe(true); });
  it('hatalı tarih, e-posta ve boş gün alanlarını raporlar', async () => { const row = [...valid]; row[4] = '2003-02-30'; row[8] = ''; row[9] = 'invalid'; const [r] = await parseImport(csv([row]), 't.csv', 'text/csv'); expect(r.errors).toHaveLength(3); });
  it('yabancı kimlik numarasının 99 ile başlamasını ister', async () => { const row = [...valid]; row[2] = 'AZ'; expect((await parseImport(csv([row]), 't.csv', 'text/csv'))[0].errors.join()).toContain('99'); });
  it('500 satır sınırını uygular', async () => { await expect(parseImport(csv(Array(501).fill(valid)), 't.csv', 'text/csv')).rejects.toThrow('1–500'); });
  it('sahte XLSX imzasını ve yanlış MIME türünü reddeder', async () => { await expect(parseImport(Buffer.from('not excel'), 't.xlsx', 'application/octet-stream')).rejects.toThrow('imzası'); await expect(parseImport(csv([valid]), 't.csv', 'image/png')).rejects.toThrow('MIME'); });
  it('boş ara satırın gerçek satır numarasını korur', async () => { const rows = await parseImport(csv([valid, [], valid]), 't.csv', 'text/csv'); expect(rows[1].line).toBe(3); expect(rows[1].errors.length).toBeGreaterThan(0); expect(rows[2].line).toBe(4); });
  it('üretilmiş sentetik XLSX dosyasını okur', async () => { const buffer = await readFile(new URL('../../client/public/samples/students.xlsx', import.meta.url)); const rows = await parseImport(buffer, 'students.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); expect(rows).toHaveLength(2); expect(rows.every(r => !r.errors.length)).toBe(true); });
  it('Excel formüllerini kabul etmez', async () => { const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Test'); sheet.addRow([...columns]); sheet.addRow(valid); sheet.getCell('A2').value = { formula: '1+1', result: 2 }; const b = await workbook.xlsx.writeBuffer(); await expect(parseImport(Buffer.from(b), 't.xlsx', 'application/octet-stream')).rejects.toThrow('Formül'); });
});
