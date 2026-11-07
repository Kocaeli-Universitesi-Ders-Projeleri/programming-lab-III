import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import secureRequest from './helpers/request.js';
import { app } from '../src/app.js';
import { configureHttpSecurity } from '../src/middleware/httpSecurity.js';
import { userLimit, heavyWorkAdmission, withHeavyWork } from '../src/middleware/rateLimits.js';
describe('HTTP ve girdi sınırları', () => {
  it('geliştirmede aynı porttaki loopback adreslerini kabul eder, yabancı adres ve portları reddeder', async () => {
    const server = express(); configureHttpSecurity(server, { production: false, origin: 'http://localhost:5173', trustedProxies: [], hstsMaxAge: 0 });
    server.post('/auth', (_req, res) => res.sendStatus(204));
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173']) {
      const response = await request(server).post('/auth').set('Origin', origin);
      expect(response.status).toBe(204); expect(response.headers['access-control-allow-origin']).toBe(origin);
      expect((await request(server).post('/auth').set('Referer', origin + '/register')).status).toBe(204);
    }
    for (const origin of ['http://localhost:5174', 'http://localhost.evil.test:5173', 'null', 'https://evil.test']) expect((await request(server).post('/auth').set('Origin', origin)).status).toBe(403);
    expect((await request(server).post('/auth').set('Origin', 'http://localhost:5173').set('Sec-Fetch-Site', 'cross-site')).status).toBe(403);
  });
  it('production ortamında loopback eş adlarını genişletmez', async () => {
    const server = express(); configureHttpSecurity(server, { production: true, origin: 'https://localhost:5173', trustedProxies: ['127.0.0.1/32', '::1/128'], hstsMaxAge: 0 });
    server.post('/auth', (_req, res) => res.sendStatus(204));
    expect((await request(server).post('/auth').set('X-Forwarded-Proto', 'https').set('Origin', 'https://127.0.0.1:5173')).status).toBe(403);
    expect((await request(server).options('/auth').set('X-Forwarded-Proto', 'https').set('Origin', 'https://localhost:5173').set('Access-Control-Request-Method', 'DELETE')).headers['access-control-allow-methods']).toContain('DELETE');
  });
  it('NoSQL operatör nesnelerini ve bilinmeyen sorgu alanlarını reddeder', async () => {
    expect((await secureRequest(app).post('/api/v1/auth/login').send({ identifier: { $ne: null }, password: { $gt: '' } })).status).toBe(400);
    for (const query of [{ q: { $regex: '.*' } }, { sort: '$where' }, { page: ['1','2'] }, { $where: 'synthetic' }]) expect((await request(app).get('/api/v1/admin/students').query(query)).status).toBe(400);
  });
  it('başlıkları verir; HSTS yerelde açık değildir; Origin allowlist uygular', async () => {
    const r = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(r.status).toBe(200); expect(r.headers['access-control-allow-origin']).toBe('http://localhost:5173'); expect(r.headers['x-frame-options']).toBe('DENY'); expect(r.headers['permissions-policy']).toContain('camera=()'); expect(r.headers['content-security-policy']).toContain("script-src 'self'"); expect(r.headers['content-security-policy']).toContain('blob:'); expect(r.headers['strict-transport-security']).toBeUndefined(); expect(r.headers['x-request-id']).toMatch(/^[a-f\d-]{36}$/);
    expect((await request(app).get('/api/v1/health').set('Origin', 'https://evil.example')).status).toBe(403);
  });
  it('güvenilmeyen proxy başlığı HTTPS şartını atlayamaz; yönlendirme Host başlığına güvenmez', async () => {
    const server = express(); configureHttpSecurity(server, { production: true, origin: 'https://audit.example.test', trustedProxies: [], hstsMaxAge: 0 }); server.get('/test', (_req,res) => res.send('ok'));
    const r = await request(server).get('/test').set('Host', 'evil.example').set('X-Forwarded-Proto', 'https'); expect(r.status).toBe(308); expect(r.headers.location).toBe('https://audit.example.test/test');
    expect((await request(server).post('/test')).status).toBe(400);
  });
  it('yalnızca yapılandırılmış proxy ve TLS isteği için HSTS seçeneğini kullanır', async () => {
    const server = express(); configureHttpSecurity(server, { production: true, origin: 'https://audit.example.test', trustedProxies: ['127.0.0.1/32','::1/128'], hstsMaxAge: 3600 }); server.get('/test', (_req,res) => res.send('ok'));
    const r = await request(server).get('/test').set('X-Forwarded-Proto', 'https'); expect(r.status).toBe(200); expect(r.headers['strict-transport-security']).toBe('max-age=3600');
  });
  it('bozuk JSON ve fazla büyük JSON için teknik hata sızdırmaz', async () => {
    const r = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{bad'); expect(r.status).toBe(400); expect(r.body.stack).toBeUndefined(); expect(r.body.requestId).toBeDefined();
    expect((await request(app).post('/api/v1/auth/login').send({ identifier: 'x'.repeat(110000) })).status).toBe(413);
  });
});
describe('NAT ve iş sınırları', () => {
  it('aynı IP altındaki farklı kullanıcıları birbirinden ayırır', async () => {
    const server = express(); server.use((req,_res,next) => { req.authUser = { id: String(req.get('X-Test-User')), name: '', email: '', username: '', role: 'ROLE_STUDENT' }; next(); }); server.post('/limit', userLimit(2, 60000), (_req,res) => res.json({ ok:true }));
    for (let i = 0; i < 2; i++) expect((await request(server).post('/limit').set('X-Test-User','a')).status).toBe(200);
    const blocked = await request(server).post('/limit').set('X-Test-User','a'); expect(blocked.status).toBe(429); expect(blocked.body.message).toContain('bekleyip');
    expect((await request(server).post('/limit').set('X-Test-User','b')).status).toBe(200);
  });
  it('aynı anda ikinci pahalı işi reddeder ve iş bitince kapasiteyi bırakır', async () => {
    let finish!: () => void, signal!: () => void; const pending = new Promise<void>(r => { finish=r; }), started = new Promise<void>(r => { signal=r; });
    const server = express(); server.use((req,_res,next) => { req.authUser = { id: 'same', name: '', email: '', username: '', role: 'ROLE_STUDENT' }; next(); }); server.post('/heavy', heavyWorkAdmission(1), withHeavyWork(async (_req,res) => { signal(); await pending; res.sendStatus(200); }));
    const first = request(server).post('/heavy').then(r => r); await started;
    expect((await request(server).post('/heavy')).status).toBe(429); finish(); expect((await first).status).toBe(200); expect((await request(server).post('/heavy')).status).toBe(200);
  });
});
