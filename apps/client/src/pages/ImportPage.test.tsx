import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ImportPage } from './ImportPage';
import { api } from '../services/api';
vi.mock('../services/api', () => ({ api: { post: vi.fn() } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });
it('önizleme olmadan kayıt yapmaz; onay iptalinde bekler ve onayla sonuç gösterir', async () => {
  vi.mocked(api.post).mockResolvedValueOnce({ data: { id: 'batch', filename: 'test.csv', valid: 1, invalid: 1, expiresAt: '2030-01-01', rows: [{ line: 2, data: { name: 'Sentetik Bir', studentNumber: '123' }, errors: [] }, { line: 3, data: { name: 'Hatalı', studentNumber: '456' }, errors: ['email: Geçersiz'] }] } }).mockResolvedValueOnce({ data: { successful: 1, failed: 1, failures: [{ line: 3, errors: ['email'] }], credentials: [{ studentNumber: '123', username: 'student-123', password: 'test-password' }] } });
  const dialog = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  const user = userEvent.setup(); const cache = new QueryClient();
  render(<QueryClientProvider client={cache}><ImportPage/></QueryClientProvider>);
  expect(screen.queryByRole('button', { name: /onayla ve kaydet/ })).toBeNull();
  await user.upload(screen.getByLabelText('Öğrenci veri dosyası'), new File(['name'], 'test.csv', { type: 'text/csv' }));
  expect((screen.getByLabelText('Öğrenci veri dosyası') as HTMLInputElement).files?.length).toBe(1);
  // jsdom 29 reports a required file input as empty despite user-event's FileList.
  fireEvent.submit(screen.getByLabelText('Öğrenci veri dosyası').closest('form')!);
  await screen.findByText('1 geçerli');
  await user.click(screen.getByRole('checkbox', { name: 'Yalnızca hatalı satırları göster' }));
  expect(screen.queryByText('Sentetik Bir')).toBeNull();
  await user.click(screen.getByRole('button', { name: '1 geçerli satırı onayla ve kaydet' }));
  expect(dialog).toHaveBeenCalledTimes(1); expect(api.post).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: '1 geçerli satırı onayla ve kaydet' }));
  await screen.findByRole('heading', { name: 'Aktarım sonucu' });
  expect(api.post).toHaveBeenLastCalledWith('/admin/students/import/batch/confirm', { confirm: true }, expect.anything());
  expect(screen.getByRole('button', { name: 'Öğrenci giriş bilgilerini indir' })).toBeDefined();
  cache.clear();
});
