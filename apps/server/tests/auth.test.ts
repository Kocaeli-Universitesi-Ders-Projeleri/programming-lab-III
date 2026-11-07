import { describe, it, expect } from 'vitest';
import request from './helpers/request.js';
import { app } from '../src/app.js';
describe('Oturum güvenliği', () => {
  it('oturumsuz me çağrısını reddeder', async () => { expect((await request(app).get('/api/v1/auth/me')).status).toBe(401); });
  it('sahte JWT ile erişimi reddeder', async () => { expect((await request(app).get('/api/v1/auth/me').set('Cookie', 'kou_session=invalid')).status).toBe(401); });
  it('admin ve öğrenci uçlarını korur', async () => {
    for (const path of ['/admin/access', '/students/me']) expect((await request(app).get('/api/v1' + path)).status).toBe(401);
  });
  it('boş giriş formunu reddeder', async () => { expect((await request(app).post('/api/v1/auth/login').send({})).status).toBe(400); });
  it('farklı origin üzerinden yazmayı reddeder', async () => { expect((await request(app).post('/api/v1/auth/login').set('Origin', 'https://invalid.example').send({})).status).toBe(403); });
});
