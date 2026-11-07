import { expect, it } from 'vitest';
import rawRequest from 'supertest';
import request from './helpers/request.js';
import { app } from '../src/app.js';

it('kayıt girişlerini ve yetki enjeksiyonunu DB işleminden önce reddeder', async () => {
  const body = { name: 'Test Öğrenci', studentNumber: '00123', email: 'test@example.test', password: 'Test-password-123', confirmPassword: 'Test-password-123' };
  for (const value of [{}, { ...body, role: 'ROLE_ADMIN' }, { ...body, email: { $ne: null } }, { ...body, password: 'short' }, { ...body, confirmPassword: 'different' }]) {
    expect((await request(app).post('/api/v1/auth/register').send(value)).status).toBe(400);
  }
  expect((await rawRequest(app).post('/api/v1/auth/register').send(body)).status).toBe(403);
  expect((await request(app).patch('/api/v1/students/me').send({})).status).toBe(401);
});
