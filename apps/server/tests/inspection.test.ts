import { expect, it } from 'vitest';
import sharp from 'sharp';
import { inspectDocument, inspectImport } from '../src/services/inspection.js';
import { readFile } from 'node:fs/promises';
it('gerçek worker üzerinden görsel ve XLSX ayrıştırır; sahte PDF reddedilir', async () => {
  const png = await sharp({ create: { width: 3, height: 3, channels: 3, background: '#fff' } }).png().toBuffer(); expect((await inspectDocument(png,'audit.png','image/png')).ext).toBe('png');
  const xlsx = await readFile(new URL('../../client/public/samples/students.xlsx', import.meta.url)); expect(await inspectImport(xlsx,'students.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toHaveLength(2);
  await expect(inspectDocument(Buffer.from('not a PDF file'),'audit.pdf','application/pdf')).rejects.toThrow();
}, 30000);
