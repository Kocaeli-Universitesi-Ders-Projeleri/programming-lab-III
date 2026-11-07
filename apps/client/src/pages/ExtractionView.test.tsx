import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ExtractionResultView } from './ExtractionView';
import type { DocumentExtractionResponse } from '@kou/shared';
afterEach(cleanup);
it('belirsiz sonuçları başarı gibi göstermez, HTML metnini escape eder ve kimliği maskeler', () => {
  const result: DocumentExtractionResponse = { status: 'PARTIAL', extractorName: 'DocxExtractor', extractorVersion: '1', templateVersion: 'unverified', templateVerified: false, rawText: '', extractionErrors: [], fieldSources: [], extractedFields: [
    { fieldName: 'name', rawValue: '<img src=x onerror=alert(1)>', normalizedValue: '<img src=x onerror=alert(1)>', sourceLocation: null, extractionStatus: 'EXTRACTED' },
    { fieldName: 'identityNumber', rawValue: '10000000001', normalizedValue: '10000000001', sourceLocation: null, extractionStatus: 'EXTRACTED' },
    { fieldName: 'phone', rawValue: '', normalizedValue: null, sourceLocation: null, extractionStatus: 'AMBIGUOUS' },
  ] };
  render(<ExtractionResultView result={result}/>);
  expect(screen.getByText('Kısmi okuma — manuel inceleme gerekli')).toBeDefined();
  expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeDefined(); expect(document.querySelector('img')).toBeNull();
  expect(screen.queryByText('10000000001')).toBeNull(); expect(screen.getByText('•••••••0001')).toBeDefined();
  expect(screen.getByText('Belirsiz / çelişen değerler')).toBeDefined();
});
