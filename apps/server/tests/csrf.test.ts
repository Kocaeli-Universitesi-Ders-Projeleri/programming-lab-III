import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
describe('CSRF', () => {
  it('token eksik veya değiştirilmişse login dahil yazmayı reddeder', async () => {
    expect((await request(app).post('/api/v1/auth/login').send({})).status).toBe(403);
    const r = await request(app).get('/api/v1/auth/csrf');
    const cookie = r.headers['set-cookie'][0].split(';')[0];
    expect(r.headers['set-cookie'][0]).toContain('HttpOnly');
    expect((await request(app).post('/api/v1/auth/login').set('Cookie', cookie).set('X-CSRF-Token', 'bad').send({})).status).toBe(403);
    expect((await request(app).post('/api/v1/auth/login').set('Cookie', cookie).set('X-CSRF-Token', r.body.csrfToken).send({})).status).toBe(400);
  });
  it('CSRF değerini oturum cookie değerine bağlar', async () => {
    const r = await request(app).get('/api/v1/auth/csrf'); const cookie = r.headers['set-cookie'][0].split(';')[0];
    const response = await request(app).post('/api/v1/auth/login').set('Cookie', cookie + '; kou_session=changed-session').set('X-CSRF-Token', r.body.csrfToken).send({});
    expect(response.status).toBe(403); expect(response.body.code).toBe('CSRF_INVALID');
  });
  it('geçerli token olsa bile yabancı Origin reddedilir', async () => {
    const r = await request(app).get('/api/v1/auth/csrf');
    const response = await request(app).post('/api/v1/auth/login').set('Cookie', r.headers['set-cookie'][0].split(';')[0]).set('X-CSRF-Token', r.body.csrfToken).set('Origin', 'https://evil.example').send({}); expect(response.status).toBe(403);
  });
});
