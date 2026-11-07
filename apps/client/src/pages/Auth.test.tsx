import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, Login, Protected, AccountMenu } from './Auth';
import { api } from '../services/api';

vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it.each(['ROLE_ADMIN', 'ROLE_STUDENT'])('girişten sonra %s paneline gider, çıkışta girişe döner', async role => {
  vi.mocked(api.get).mockRejectedValue({ response: { status: 401 } });
  const user = { id: 'demo', name: 'Demo', username: 'demo', email: 'demo@example.test', role };
  vi.mocked(api.post).mockResolvedValueOnce({ data: { user } }).mockResolvedValueOnce({ status: 204 });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const interaction = userEvent.setup();
  render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={['/login']}><AuthProvider><Routes>
    <Route path="/login" element={<Login/>}/>
    <Route path="/admin" element={<Protected role="ROLE_ADMIN"><h1>Admin paneli</h1><AccountMenu/></Protected>}/>
    <Route path="/student" element={<Protected role="ROLE_STUDENT"><h1>Öğrenci paneli</h1><AccountMenu/></Protected>}/>
  </Routes></AuthProvider></MemoryRouter></QueryClientProvider>);
  await screen.findByRole('heading', { name: 'Staj sistemine giriş' });
  // Wait for the initial unauthenticated request to settle before login.
  await vi.waitFor(() => expect(cache.getQueryData(['me'])).toBeNull());
  await interaction.type(screen.getByLabelText('Kullanıcı adı veya e-posta'), 'demo');
  await interaction.type(screen.getByLabelText('Şifre'), 'test-password');
  await interaction.click(screen.getByRole('button', { name: 'Giriş yap' }));
  await screen.findByRole('heading', { name: role === 'ROLE_ADMIN' ? 'Admin paneli' : 'Öğrenci paneli' });
  expect(cache.getQueryData(['me'])).toEqual(user);
  await interaction.click(screen.getByRole('button', { name: 'Çıkış' }));
  await screen.findByRole('heading', { name: 'Staj sistemine giriş' });
  expect(cache.getQueryData(['me'])).toBeNull();
  cache.clear();
});
