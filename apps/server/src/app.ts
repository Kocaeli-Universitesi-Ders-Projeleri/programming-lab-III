import express from 'express';
import cookieParser from 'cookie-parser';
import { authRoutes } from './routes/auth.js';
import { panelRoutes } from './routes/panels.js';
import { importRoutes } from './routes/imports.js';
import { applicationRoutes } from './routes/applications.js';
import { adminApplicationRoutes } from './routes/adminApplications.js';
import { HttpError } from './utils/httpError.js';
import { randomUUID } from 'node:crypto';
import { configureHttpSecurity } from './middleware/httpSecurity.js';
import { validateQuery } from './middleware/requestValidation.js';
import { serveClient } from './services/serveClient.js';
import { generalLimit } from './middleware/rateLimits.js';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { databaseStatus } from './config/database.js';
import { logger, httpLogOptions } from './config/logger.js';
import { csrfToken, verifyCsrf } from './middleware/csrf.js';
export const app = express();
app.disable('x-powered-by');
app.use(pinoHttp({ logger, ...httpLogOptions, genReqId: (_req, res) => { const id = randomUUID(); res.setHeader('X-Request-ID', id); return id; } }));
configureHttpSecurity(app, { production: env.NODE_ENV === 'production', origin: env.CLIENT_ORIGIN, trustedProxies: env.TRUSTED_PROXY_CIDRS.split(',').map(v => v.trim()).filter(Boolean), hstsMaxAge: env.HSTS_MAX_AGE });
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api/v1', validateQuery);
app.use('/api', generalLimit);
app.get('/api/v1/auth/csrf', csrfToken);
app.use('/api/v1', verifyCsrf);
app.get('/api/v1/health', (_req, res) => {
  const database = databaseStatus();
  res.json({ status: database === 'connected' ? 'ok' : 'degraded', service: 'KOU Staj API', database, timestamp: new Date().toISOString(), version: '0.1.0' });
});
app.get('/api/v1/health/ready', (_req, res) => res.status(databaseStatus() === 'connected' ? 200 : 503).json({ ready: databaseStatus() === 'connected' }));
app.use('/api/v1', authRoutes);
app.use('/api/v1', panelRoutes);
app.use('/api/v1', importRoutes);
app.use('/api/v1', adminApplicationRoutes);
app.use('/api/v1', applicationRoutes);
app.use('/api', (_req, res) => { res.status(404).json({ message: 'Endpoint bulunamadı.' }); });
if (env.NODE_ENV === 'production') serveClient(app);
app.use((_req, res) => { res.status(404).json({ message: 'Endpoint bulunamadı.' }); });
app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) { res.end(); return; }
  if (error instanceof HttpError) { res.status(error.status).json({ message: error.message }); return; }
  const badJson = error instanceof SyntaxError && 'status' in error && error.status === 400;
  const tooLarge = error !== null && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large';
  const dbUnavailable = error instanceof Error && /MongoServerSelectionError|MongoNetworkError|server selection/i.test(error.name + ' ' + error.message);
  if (!badJson && !tooLarge) { const e = error as { name?: unknown; code?: unknown; stack?: unknown }; req.log.error({ event: 'REQUEST_ERROR', errorType: typeof e?.name === 'string' ? e.name.replace(/[^a-zA-Z0-9_]/g, '').slice(0,60) : 'Unknown', code: typeof e?.code === 'number' ? e.code : undefined, frames: typeof e?.stack === 'string' ? e.stack.split('\n').slice(1,8).join('\n') : undefined }, 'İstek işlenemedi.'); }
  res.status(badJson ? 400 : tooLarge ? 413 : dbUnavailable ? 503 : 500).json({ message: badJson ? 'Geçersiz JSON gövdesi.' : tooLarge ? 'İstek gövdesi çok büyük.' : dbUnavailable ? 'Veritabanı bağlantısı şu anda kullanılamıyor. Sunucu bağlantısını kontrol edip tekrar deneyin.' : 'Sunucu hatası. Destek için istek numarasını paylaşabilirsiniz.', requestId: req.id });
});
