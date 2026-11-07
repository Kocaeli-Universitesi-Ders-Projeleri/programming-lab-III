import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReviewControls } from './ReviewControls';
import { api } from '../services/api';
vi.mock('../services/api', () => ({ api: { post: vi.fn(), patch: vi.fn() } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });
function renderControls(ready = false) { const cache = new QueryClient(); render(<QueryClientProvider client={cache}><ReviewControls application={{ _id: 'test', status: 'UNDER_REVIEW', manualChecks: ready ? { employerSignature: true, employerStamp: true, studentApprovalEmpty: true, advisorApprovalEmpty: true } : undefined }} report={{ engineComplete: true, readyForApproval: ready }}/></QueryClientProvider>); return cache; }
it('rapor hazır değilse onay endpointini çağırmaz', async () => { renderControls(); const button = screen.getByRole('button', { name: 'Başvuruyu onayla' }); expect((button as HTMLButtonElement).disabled).toBe(true); await userEvent.setup().click(button); expect(api.patch).not.toHaveBeenCalled(); });
it('kısmi manuel incelemede işaretlenmeyenleri false gönderir', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: {} }); renderControls(); const user = userEvent.setup();
  await user.click(screen.getByRole('checkbox', { name: 'İşveren imzası var' })); await user.click(screen.getByRole('button', { name: 'Manuel kontrolleri kaydet' }));
  expect(api.post).toHaveBeenCalledWith('/admin/applications/test/review', { employerSignature: true, employerStamp: false, studentApprovalEmpty: false, advisorApprovalEmpty: false }, expect.anything());
});
it('hazır raporda onayı kullanıcı iptal ederse göndermez, kabul ederse gönderir', async () => {
  vi.mocked(api.patch).mockResolvedValue({ data: {} }); vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true); renderControls(true); const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Başvuruyu onayla' })); expect(api.patch).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Başvuruyu onayla' })); expect(api.patch).toHaveBeenCalledWith('/admin/applications/test/status', { status: 'APPROVED', note: '' }, expect.anything());
});
