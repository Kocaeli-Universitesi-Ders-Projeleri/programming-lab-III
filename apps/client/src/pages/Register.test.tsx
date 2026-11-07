import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Register } from './Register';
import { api } from '../services/api';
vi.mock('../services/api', () => ({ api: { post: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('şifre tekrarı eşleşmeden göndermez; kayıt sonrası girişe yönlendirir', async () => {
  vi.mocked(api.post).mockResolvedValue({ status: 201 });
  render(<MemoryRouter initialEntries={['/register']}><Routes><Route path="/register" element={<Register/>}/><Route path="/login" element={<h1>Giriş ekranı</h1>}/></Routes></MemoryRouter>);
  for (const [label, value] of [['Ad soyad', 'Özgür Şahin'], ['Öğrenci numarası', '00123'], ['E-posta', 'student@example.test'], ['Şifre', 'Student-password-123'], ['Şifre tekrarı', 'wrong']]) fireEvent.change(screen.getByLabelText(label!), { target: { value } });
  fireEvent.submit(screen.getByRole('button', { name: 'Hesap oluştur' }).closest('form')!);
  await screen.findByText('Şifreler eşleşmiyor.'); expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Şifre tekrarı'), { target: { value: 'Student-password-123' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Hesap oluştur' }).closest('form')!);
  await screen.findByRole('heading', { name: 'Giriş ekranı' });
  expect(api.post).toHaveBeenCalledWith('/auth/register', { name: 'Özgür Şahin', studentNumber: '00123', email: 'student@example.test', password: 'Student-password-123', confirmPassword: 'Student-password-123' }, expect.anything());
});
