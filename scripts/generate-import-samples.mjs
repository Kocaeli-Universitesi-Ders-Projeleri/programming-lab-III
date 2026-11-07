import ExcelJS from 'exceljs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const columns = ['name', 'identityNumber', 'nationality', 'studentNumber', 'birthDate', 'address', 'department', 'academicYear', 'previousInternshipDays', 'email', 'phone', 'healthStatus'];
const rows = [
  ['Sentetik Öğrenci Bir', '10000000001', 'TR', 'TEST2026001', '2003-01-15', 'Örnek Mahallesi Test Sokak No:1 D:1 İzmit Kocaeli', 'Yazılım Mühendisliği', '2026-2027', '0', 'sentetik.bir@example.test', '+90 555 000 00 01', '1'],
  ['Sentetik Öğrenci İki', '99000000001', 'AZ', 'TEST2026002', '2002-03-21', 'Örnek Mahallesi Test Sokak No:2 D:2 İzmit Kocaeli', 'Yazılım Mühendisliği', '2026-2027', '20', 'sentetik.iki@example.test', '+90 555 000 00 02', '2'],
];
const dir = new URL('../apps/client/public/samples/', import.meta.url);
await mkdir(dir, { recursive: true });
const quote = value => `"${value.replaceAll('"', '""')}"`;
await writeFile(new URL('students.csv', dir), '\uFEFF' + [columns, ...rows].map(r => r.map(quote).join(',')).join('\r\n') + '\r\n');
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Sentetik öğrenciler');
sheet.addRow(columns); rows.forEach(row => sheet.addRow(row));
sheet.getRow(1).font = { bold: true };
sheet.columns.forEach(c => { c.width = 24; c.numFmt = '@'; });
await workbook.xlsx.writeFile(fileURLToPath(new URL('students.xlsx', dir)));
console.log('Sentetik CSV ve XLSX örnekleri üretildi.');
