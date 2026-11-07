import { expect, it } from 'vitest';
import { DocumentComparisonService, normalizeComparisonValue } from '../src/services/DocumentComparisonService.js';
import { sourceHash } from '../src/services/comparisonReports.js';
import type { ExtractedField } from '@kou/shared';
const field = (fieldName: string, value: string): ExtractedField => ({ fieldName, rawValue: value, normalizedValue: value, sourceLocation: null, extractionStatus: 'EXTRACTED' });
it('eksik kaynak sorunlarını birlikte korur ve işyeri için sahte referans hatası üretmez', () => {
  const result = new DocumentComparisonService().compare({ manual: { name: 'Özgür Şahin', companyName: 'Firma' }, extraction: null, reference: null });
  const student = result.rows.find(row => row.fieldName === 'name')!, company = result.rows.find(row => row.fieldName === 'companyName')!;
  expect(student.issues).toEqual(expect.arrayContaining(['EXTRACTION_UNAVAILABLE', 'REFERENCE_NOT_FOUND', 'MANUAL_REVIEW_REQUIRED']));
  expect(company.issues).not.toContain('REFERENCE_NOT_FOUND'); expect(company.sources.reference).toBe('NOT_APPLICABLE');
  expect(student.pairs.every(pair => pair.status === 'UNAVAILABLE')).toBe(true); expect(result.fullyMatched).toBe(false);
});
it('A-B-C çiftlerini ve uyuşmazlıkları ayrı gösterir; boş değerleri MATCH saymaz', () => {
  const result = new DocumentComparisonService().compare({ manual: { name: 'Özgür Şahin', studentNumber: '00123', companyName: 'Firma' },
    extraction: { status: 'PARTIAL', templateVerified: true, extractedFields: [field('name', 'ÖZGÜR ŞAHİN'), field('studentNumber', '00123'), field('companyName', 'Diğer Firma')] },
    reference: { fullName: 'Özgür Şahin', studentNumber: '123' } });
  expect(result.rows.find(row => row.fieldName === 'name')?.status).toBe('MATCH');
  expect(result.rows.find(row => row.fieldName === 'studentNumber')?.pairs).toEqual([{ pair: 'A-B', status: 'MATCH' }, { pair: 'A-C', status: 'MISMATCH' }, { pair: 'B-C', status: 'MISMATCH' }]);
  expect(result.rows.find(row => row.fieldName === 'companyName')?.issues).toContain('MISMATCH');
  expect(result.rows.find(row => row.fieldName === 'identityNumber')?.status).not.toBe('MATCH');
});
it('belirsiz çıkarım, şablon ve referans belirsizliği otomatik başarı üretmez', () => {
  const result = new DocumentComparisonService().compare({ manual: { name: 'Aynı Ad' }, extraction: { status: 'PARTIAL', templateVerified: false, extractedFields: [{ ...field('name', 'Aynı Ad'), extractionStatus: 'AMBIGUOUS' }] }, reference: null, referenceAmbiguous: true });
  const row = result.rows.find(row => row.fieldName === 'name')!;
  expect(row.sources.document).toBe('AMBIGUOUS'); expect(row.sources.reference).toBe('AMBIGUOUS'); expect(row.status).not.toBe('MATCH');
});
it('numaralar tam string eşleşmedir; tarih, telefon ve metin kontrollü normalize edilir', () => {
  expect(normalizeComparisonValue('studentNumber', '00123')).toBe('00123'); expect(normalizeComparisonValue('studentNumber', 123)).toBeNull();
  expect(normalizeComparisonValue('birthDate', '15.01.2003')).toBe('2003-01-15'); expect(normalizeComparisonValue('birthDate', '31.02.2003')).toBeNull();
  expect(normalizeComparisonValue('phone', '0555 000 00 01')).toBe('+905550000001');
  expect(normalizeComparisonValue('healthStatus', 0)).toBe('0'); expect(normalizeComparisonValue('paid', false)).toBe('false');
  expect(normalizeComparisonValue('website', 'https://EXAMPLE.test/Case')).not.toBe(normalizeComparisonValue('website', 'https://example.test/case'));
  expect(sourceHash({ a: 1, b: 2 })).toBe(sourceHash({ b: 2, a: 1 })); expect(sourceHash({ a: '001' })).not.toBe(sourceHash({ a: '1' }));
});
