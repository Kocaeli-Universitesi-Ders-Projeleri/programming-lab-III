import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app.js';
describe('API temel davranışları', () => {
  it('veritabanı yokken dürüst bir sağlık sonucu döndürür', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'degraded', database: 'disconnected' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
  it('hazır olmayan veritabanını 503 ile bildirir', async () => {
    expect((await request(app).get('/api/v1/health/ready')).status).toBe(503);
  });
  it('bilinmeyen endpoint için 404 döndürür', async () => {
    expect((await request(app).get('/api/v1/missing')).status).toBe(404);
  });
});
