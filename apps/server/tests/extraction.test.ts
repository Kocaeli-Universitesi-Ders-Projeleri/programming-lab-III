import { expect, it } from 'vitest';
import { PDFDocument, StandardFonts, PDFName } from 'pdf-lib';
import sharp from 'sharp';
import { inspectDocument, inspectExtraction } from '../src/services/inspection.js';
import { DocExtractor, ExtractionService } from '../src/services/extraction/extractors.js';
import { mapFields } from '../src/services/extraction/fieldMapping.js';
import { docFixture, docxFixture, docxMime } from './helpers/extractionFixtures.js';

it('gerçek DOCX hücrelerini, birleşik hücreyi, Türkçe metni ve boş alanı korur', async () => {
  const bytes = docxFixture([['Ad soyad', 'Özgür Şahin'], ['Öğrenci no', '0012345'], ['Doğum tarihi', '15.01.2003'], ['Telefon', ''], ['İşyeri bilgileri'], ['Telefon', '+905550000002'], ['İşveren / yetkili bilgileri'], ['Ad soyad', 'Çağrı Öztürk']], true);
  const result = await inspectExtraction(bytes, 'ek16.docx', docxMime);
  expect(result.status).toBe('PARTIAL'); expect(result.templateVerified).toBe(false);
  const field = (key: string) => result.extractedFields.find(field => field.fieldName === key)!;
  expect(field('name')).toMatchObject({ rawValue: 'Özgür Şahin', extractionStatus: 'EXTRACTED', sourceLocation: { gridSpan: 2 } });
  expect(field('studentNumber').normalizedValue).toBe('0012345'); expect(field('birthDate').normalizedValue).toBe('2003-01-15');
  expect(field('phone').extractionStatus).toBe('MISSING'); expect(field('companyPhone').normalizedValue).toBe('+905550000002');
  expect(field('employerName').rawValue).toBe('Çağrı Öztürk');
  expect(result.fieldSources[1]?.location.column).toBe(3);
}, 30000);
it('metin katmanlı PDF satırlarını koordinatlarıyla okur, metinsiz PDF için unavailable verir', async () => {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica), page = pdf.addPage();
  page.drawText('Uyruk', { x: 50, y: 700, font, size: 12 }); page.drawText('TR', { x: 200, y: 700, font, size: 12 });
  page.drawText('E-posta', { x: 250, y: 700, font, size: 12 }); page.drawText('test@example.test', { x: 350, y: 700, font, size: 12 });
  page.drawText('Telefon: +905550000001', { x: 50, y: 670, font, size: 12 });
  const result = await inspectExtraction(Buffer.from(await pdf.save()), 'ek16.pdf', 'application/pdf');
  expect(result.extractorName).toBe('PdfExtractor'); expect(result.status).toBe('PARTIAL');
  expect(result.extractedFields.find(field => field.fieldName === 'nationality')?.normalizedValue).toBe('TR');
  expect(result.fieldSources[0]?.location).toMatchObject({ kind: 'PDF_LINE', page: 1, x: 50, y: 700 });
  expect(result.fieldSources[0]?.location.pieces).toHaveLength(4);
  expect(result.extractedFields.find(field => field.fieldName === 'email')?.normalizedValue).toBe('test@example.test');
  const blank = await PDFDocument.create(), scan = blank.addPage();
  const raster = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toBuffer();
  scan.drawImage(await blank.embedPng(raster), { x: 0, y: 0, width: 100, height: 100 });
  expect((await inspectExtraction(Buffer.from(await blank.save()), 'scan.pdf', 'application/pdf')).status).toBe('EXTRACTION_UNAVAILABLE');
}, 30000);
it('eski DOC Unicode gövdesini dönüştürücü çalıştırmadan okur', async () => {
  const bytes = docFixture('Ad soyad: Özgür Şahin\rÖğrenci no: 0012345\r');
  await expect(inspectDocument(bytes, 'old.doc', 'application/msword')).resolves.toMatchObject({ ext: 'doc' });
  const result = await inspectExtraction(bytes, 'old.doc', 'application/msword');
  expect(result.status).toBe('PARTIAL'); expect(result.extractedFields.find(field => field.fieldName === 'name')?.rawValue).toBe('Özgür Şahin');
  expect((await new ExtractionService([new DocExtractor()]).extract(Buffer.from('bad'), 'application/msword')).status).toBe('FAILED');
}, 30000);
it('görüntüde tahmin üretmez ve aktif PDF extractor aşamasından önce reddedilir', async () => {
  const png = await sharp({ create: { width: 3, height: 3, channels: 3, background: '#fff' } }).png().toBuffer();
  const result = await inspectExtraction(png, 'image.png', 'image/png');
  expect(result.status).toBe('EXTRACTION_UNAVAILABLE'); expect(result.extractedFields.every(field => field.extractionStatus === 'MISSING')).toBe(true);
  const pdf = await PDFDocument.create(); pdf.addPage(); pdf.catalog.set(PDFName.of('OpenAction'), pdf.context.obj({ S: PDFName.of('JavaScript'), JS: 'synthetic-test-only' }));
  const unsafe = Buffer.from(await pdf.save());
  await expect(inspectDocument(unsafe, 'unsafe.pdf', 'application/pdf')).rejects.toThrow();
  expect((await inspectExtraction(unsafe, 'unsafe.pdf', 'application/pdf')).extractorName).toBe('UnavailableExtractor');
}, 30000);
it('çelişen alanlar ve geçersiz tarih doğruymuş gibi seçilmez', () => {
  const fields = mapFields(['Ad soyad: Bir Ad', 'Ad soyad: Diğer Ad', 'Doğum tarihi: 31.02.2003'].map((text, index) => ({ text, location: { kind: 'DOC_TEXT', paragraph: index } })));
  expect(fields.find(field => field.fieldName === 'name')?.extractionStatus).toBe('AMBIGUOUS');
  expect(fields.find(field => field.fieldName === 'birthDate')?.extractionStatus).toBe('INVALID');
});
