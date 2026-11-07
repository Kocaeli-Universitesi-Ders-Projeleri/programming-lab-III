import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ValidationReportView } from './ValidationReportView';
afterEach(cleanup);
it('uyuşmazlığı, eksik alanı ve bekleyen kontrolü ayrı gösterir; geçenleri filtreler', async () => {
  render(<ValidationReportView report={{ engineComplete: true, automatedPassed: false, readyForApproval: false, calculatedDays: 20, latestSubmissionDate: '2027-06-01', results: [
    { ruleCode: 'MATCH_name', category: 'Öğrenci eşleştirme', field: 'name', valid: false, severity: 'error', kind: 'mismatch', message: 'Ad soyad uyuşmuyor.', suggestion: 'Kaydınızı kontrol edin.' },
    { ruleCode: 'ADDRESS', category: 'Adres bilgileri', field: 'street', valid: false, severity: 'error', kind: 'missing', message: 'Sokak eksik.' },
    { ruleCode: 'MANUAL', category: 'Manuel kontroller', field: '', valid: false, severity: 'pending', kind: 'pending', message: 'İmza kontrolü bekliyor.' },
    { ruleCode: 'DATE', category: 'Tarih kontrolleri', field: '', valid: true, severity: 'info', kind: 'passed', message: 'Geçerli tarih aralığı.' },
  ], issues: ['Ad soyad uyuşmuyor.', 'Sokak eksik.'], warnings: [] }}/ >);
  expect(screen.getByText('Uyuşmazlık')).toBeDefined(); expect(screen.getByText('Eksik')).toBeDefined(); expect(screen.getByText('Bekliyor')).toBeDefined();
  expect(screen.getByText('2027-06-01')).toBeDefined();
  await userEvent.setup().click(screen.getByRole('checkbox'));
  expect(screen.queryByText('Geçerli tarih aralığı.')).toBeNull();
});
it('eski rapor için yeniden doğrulama gerektiğini söyler', () => { render(<ValidationReportView report={{ engineComplete: false, calculatedDays: 20, issues: [], warnings: [] }}/>); expect(screen.getByText(/eski sürümden kalmış/)).toBeDefined(); });
