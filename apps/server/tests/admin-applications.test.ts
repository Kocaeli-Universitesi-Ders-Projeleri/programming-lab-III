import { expect, it } from 'vitest';
import request from './helpers/request.js';
import { app } from '../src/app.js';
it('yeni admin içerik, silme ve audit uçları anonim kullanıcıya kapalıdır', async () => {
  const id = '000000000000000000000001';
  expect((await request(app).patch('/api/v1/admin/applications/' + id).send({})).status).toBe(401);
  expect((await request(app).delete('/api/v1/admin/applications/' + id).send({})).status).toBe(401);
  expect((await request(app).get('/api/v1/admin/applications/' + id + '/audit')).status).toBe(401);
  expect((await request(app).get('/api/v1/admin/applications/' + id + '/audit').query({ page: { $ne: 0 } })).status).toBe(400);
});
