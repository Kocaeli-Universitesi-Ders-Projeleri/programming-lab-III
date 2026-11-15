import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { AuthProvider } from './Auth';
import { api } from '../services/api';
vi.mock('../services/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function setup(path: string, role: string | null) {
  vi.mocked(api.get).mockImplementation(async url => {
    if (url === '/auth/me') {
      if (!role) throw { response: { status: 401 } };
      return { data: { user: { id: 'demo', name: 'Demo', email: 'demo@example.test', role } } };
    }
    if (url === '/admin/dashboard/stats') return { data: { students: 7, applications: 0, statusCounts: [], lastApplications: [], recentEvents: [] } };
    if (url === '/students/me' || url === '/students/me/dashboard') return { data: { profile: { studentNumber: '12345', department: 'Yazılım Mühendisliği' }, stats: { total: 0, invalid: 0, completed: 0 }, lastApplication: null } };
    throw new Error('Unexpected endpoint');
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={[path]}><AuthProvider><App/></AuthProvider></MemoryRouter></QueryClientProvider>);
}
it('giriş sayfasında panel menüsü göstermez', async () => {
  setup('/login', null);
  await screen.findByRole('heading', { name: 'Staj sistemine giriş' });
  expect(screen.queryByRole('navigation', { name: 'Panel menüsü' })).toBeNull();
});
it('admin panelinde gerçek öğrenci sayısını ve admin menüsünü görür', async () => {
  setup('/admin', 'ROLE_ADMIN');
  await screen.findByText('7', {}, { timeout: 10000 });
  expect(screen.getByRole('link', { name: /Öğrenci yönetimi/ })).toBeDefined();
  expect(screen.queryByRole('link', { name: 'Öğrenci bilgilerim' })).toBeNull();
}, 15000);
it('öğrenci kendi profilini açar ve admin menüsünü görmez', async () => {
  setup('/student', 'ROLE_STUDENT');
  await screen.findByText(/Öğrenci no: 12345/);
  expect(screen.queryByRole('link', { name: /Öğrenci yönetimi/ })).toBeNull();
  await userEvent.setup().click(screen.getByRole('link', { name: 'Öğrenci bilgilerim' }));
  await screen.findByRole('heading', { name: 'Kişisel ve akademik bilgiler' });
  expect(screen.getByText('12345')).toBeDefined();
});
it('öğrenci admin paneline doğrudan giderse oturumu kapatılıp login sayfasına yönlendirilir', async () => {
  setup('/admin', 'ROLE_STUDENT');
  await screen.findByRole('heading', { name: 'Staj sistemine giriş' });
  await screen.findByText(/403 · Yetkisiz erişim/);
  expect(api.post).toHaveBeenCalledWith('/auth/logout', {}, { timeout: 30000 });
  expect(api.get).not.toHaveBeenCalledWith('/admin/dashboard/stats');
});
