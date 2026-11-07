import { expect, it } from 'vitest';
import { Writable } from 'node:stream';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import express from 'express';
import request from 'supertest';
import { httpLogOptions } from '../src/config/logger.js';
it('HTTP loglarında query, parola, JWT veya CSRF header değeri bulunmaz', async () => {
  let output = ''; const stream = new Writable({ write(chunk, _encoding, done) { output += String(chunk); done(); } });
  const server = express(); server.use(pinoHttp({ logger: pino(stream), ...httpLogOptions })); server.get('/test', (_req,res) => { res.cookie('kou_session','jwt-response-sentinel'); res.sendStatus(200); });
  await request(server).get('/test?identityNumber=private-id-sentinel').set('Cookie', 'kou_session=jwt-request-sentinel').set('X-CSRF-Token','csrf-sentinel');
  expect(output).toContain('statusCode'); for (const marker of ['private-id-sentinel','jwt-request-sentinel','jwt-response-sentinel','csrf-sentinel']) expect(output).not.toContain(marker);
});
