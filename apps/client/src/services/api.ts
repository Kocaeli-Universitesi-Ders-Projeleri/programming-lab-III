import axios from 'axios';
import type { HealthResponse } from '@kou/shared';
export const api = axios.create({ baseURL: '/api/v1', timeout: 8000 });
const csrfApi = axios.create({ baseURL: '/api/v1', timeout: 8000 });
let csrf: Promise<string> | undefined;
api.interceptors.request.use(async config => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() ?? '')) {
    csrf ??= csrfApi.get<{ csrfToken: string }>('/auth/csrf').then(r => r.data.csrfToken).catch(error => { csrf = undefined; throw error; });
    config.headers.set('X-CSRF-Token', await csrf);
  }
  return config;
});
api.interceptors.response.use(response => {
  if (['/auth/login', '/auth/logout'].includes(response.config.url ?? '')) csrf = undefined;
  return response;
}, async error => {
  const config = error.config as (import('axios').InternalAxiosRequestConfig & { csrfRetried?: boolean }) | undefined;
  if (config && error.response?.status === 403 && error.response.data?.code === 'CSRF_INVALID' && !config.csrfRetried) {
    config.csrfRetried = true; csrf = undefined; return api.request(config);
  }
  if (error.response?.status === 403 && error.response.data?.code === 'FORBIDDEN_ROLE') window.dispatchEvent(new Event('kou:forbidden'));
  if (error.response?.status === 401 && !['/auth/login', '/auth/me', '/auth/logout'].includes(config?.url ?? '')) window.dispatchEvent(new Event('kou:session-expired'));
  throw error;
});
export async function getHealth() { return (await api.get<HealthResponse>('/health')).data; }
