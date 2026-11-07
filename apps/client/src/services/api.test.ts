import { afterEach, expect, it, vi } from 'vitest';
import axios, { AxiosError, type AxiosAdapter } from 'axios';
const original = axios.defaults.adapter;
afterEach(() => { axios.defaults.adapter = original; vi.resetModules(); });
it('yazma isteklerine CSRF ekler, login sonrası yeniler', async () => {
  vi.resetModules(); let handshakes = 0; const headers: string[] = [];
  axios.defaults.adapter = (async config => {
    const data = config.url === '/auth/csrf' ? { csrfToken: 'token-' + ++handshakes } : {};
    if (config.url !== '/auth/csrf') headers.push(String(config.headers.get('X-CSRF-Token')));
    return { config, data, status: 200, statusText: 'OK', headers: {} };
  }) satisfies AxiosAdapter;
  const { api } = await import('./api'); await api.post('/x'); await api.post('/auth/login'); await api.post('/y');
  expect(headers).toEqual(['token-1', 'token-1', 'token-2']); expect(handshakes).toBe(2);
});
it('yalnızca CSRF_INVALID için bir kez güvenli yeniden deneme yapar', async () => {
  vi.resetModules(); let handshakes = 0, writes = 0;
  axios.defaults.adapter = (async config => {
    if (config.url === '/auth/csrf') return { config, data: { csrfToken: 't' + ++handshakes }, status: 200, statusText: 'OK', headers: {} };
    writes++; if (writes === 1) throw new AxiosError('CSRF', 'ERR_BAD_REQUEST', config, undefined, { config, data: { code: 'CSRF_INVALID' }, status: 403, statusText: 'Forbidden', headers: {} });
    return { config, data: {}, status: 200, statusText: 'OK', headers: {} };
  }) satisfies AxiosAdapter;
  const { api } = await import('./api'); await api.patch('/x'); expect(handshakes).toBe(2); expect(writes).toBe(2);
});
it('oturum isteyen API 401 verirse oturum sona erdi olayını yayınlar', async () => {
  vi.resetModules(); const listener = vi.fn(); window.addEventListener('kou:session-expired', listener);
  axios.defaults.adapter = (async config => { throw new AxiosError('Unauthorized','ERR_BAD_REQUEST',config,undefined,{config,data:{},status:401,statusText:'Unauthorized',headers:{}}); }) satisfies AxiosAdapter;
  try { const { api } = await import('./api'); await expect(api.get('/students/me')).rejects.toThrow(); expect(listener).toHaveBeenCalledTimes(1); }
  finally { window.removeEventListener('kou:session-expired', listener); }
});
