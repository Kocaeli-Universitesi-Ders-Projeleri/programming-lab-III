import { describe, expect, it } from 'vitest';
import { countInternshipDays, dateValue, InternshipApplication } from '@kou/shared';
import { checkDocument } from '../src/services/documentSafety.js';
import { PDFDocument, PDFName } from 'pdf-lib';
import sharp from 'sharp';
import * as CFB from 'cfb';
describe('Staj günü ve durumlar', () => {
  it('hafta günlerini dahil, resmî tatili hariç sayar', () => { expect(countInternshipDays('2026-07-13', '2026-07-17', [1,2,3,4,5]).days).toBe(4); });
  it('arefeyi yarım gün düşer ve hafta sonu seçimini uygular', () => { expect(countInternshipDays('2026-03-19', '2026-03-23', [0,1,2,3,4,5,6]).days).toBe(1.5); expect(countInternshipDays('2026-07-18', '2026-07-19', [1,2,3,4,5]).days).toBe(0); });
  it('aynı tarihe denk gelen iki bayramı bir kez düşer', () => { expect(countInternshipDays('2027-05-19', '2027-05-19', [3]).days).toBe(0); });
  it('eksik takvimde kesin sayı üretmez', () => { expect(countInternshipDays('2028-01-01', '2028-01-05', [1,2,3,4,5])).toMatchObject({ days: null, missingYears: [2028] }); });
  it('geçersiz gün ve ters tarihi reddeder', () => { expect(dateValue('2026-02-30')).toBeNaN(); expect(countInternshipDays('2026-02-03', '2026-02-01', [1]).days).toBeNull(); expect(countInternshipDays('2026-02-01', '2026-02-02', []).days).toBeNull(); });
  it('durum sırasını ve tamamlanmış başvurunun değişmezliğini korur', () => {
    const a = new InternshipApplication('UPLOADED'); expect(() => a.transition('COMPLETED', true)).toThrow(); a.transition('UNDER_REVIEW'); expect(() => a.transition('APPROVED')).toThrow(); a.transition('INVALID'); a.transition('UPLOADED'); a.transition('UNDER_REVIEW'); a.transition('APPROVED', true); a.transition('COMPLETED', true); expect(() => a.transition('UPLOADED')).toThrow();
  });
});
describe('Belge yapısı denetimi', () => {
  it('DOCX yapısını okur ve dış bağlantı içeren DOCX dosyasını reddeder', async () => {
    const container = CFB.utils.cfb_new();
    CFB.utils.cfb_add(container, '[Content_Types].xml', Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));
    CFB.utils.cfb_add(container, 'word/document.xml', Buffer.from('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Sentetik Ek-16</w:t></w:r></w:p></w:body></w:document>'));
    const valid = Buffer.from(CFB.write(container, { type: 'buffer', fileType: 'zip' }));
    expect((await checkDocument(valid, 'test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).ext).toBe('docx');
    CFB.utils.cfb_add(container, 'word/_rels/document.xml.rels', Buffer.from('<Relationship TargetMode="External" Target="https://example.test/template"/>'));
    await expect(checkDocument(Buffer.from(CFB.write(container, { type: 'buffer', fileType: 'zip' })), 'test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).rejects.toThrow();
  });
  it('legacy DOC makro akışını ve sahte Word kapsayıcısını reddeder', async () => {
    const container = CFB.utils.cfb_new(); const fib = Buffer.alloc(68); fib.writeUInt16LE(0xa5ec, 0);
    CFB.utils.cfb_add(container, 'WordDocument', fib); CFB.utils.cfb_add(container, '0Table', Buffer.alloc(8));
    expect((await checkDocument(Buffer.from(CFB.write(container, { type: 'buffer' })), 'test.doc', 'application/msword')).ext).toBe('doc');
    CFB.utils.cfb_add(container, 'Macros/VBA', Buffer.from('synthetic'));
    await expect(checkDocument(Buffer.from(CFB.write(container, { type: 'buffer' })), 'test.doc', 'application/msword')).rejects.toThrow();
  });
  it('geçerli PDF kabul eder ve sahte MIME/uzantı birleşimini reddeder', async () => {
    const pdf = await PDFDocument.create(); pdf.addPage(); const bytes = Buffer.from(await pdf.save());
    expect((await checkDocument(bytes, 'Ek16.pdf', 'application/pdf')).ext).toBe('pdf');
    await expect(checkDocument(bytes, 'Ek16.png', 'image/png')).rejects.toThrow();
  });
  it('PDF etkin içeriğini reddeder', async () => {
    const pdf = await PDFDocument.create(); pdf.addPage(); pdf.catalog.set(PDFName.of('OpenAction'), pdf.context.obj({ S: PDFName.of('JavaScript') }));
    await expect(checkDocument(Buffer.from(await pdf.save()), 'test.pdf', 'application/pdf')).rejects.toThrow('Etkin içerik');
  });
  it('görseli tamamen decode eder, bozuk dosyayı ve yanlış MIME türünü reddeder', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer();
    expect((await checkDocument(png, 'form.png', 'image/png')).mime).toBe('image/png');
    await expect(checkDocument(png, 'form.png', 'text/plain')).rejects.toThrow();
    await expect(checkDocument(png.subarray(0, 30), 'form.png', 'image/png')).rejects.toThrow();
  });
});
