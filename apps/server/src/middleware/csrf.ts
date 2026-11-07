import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
const options = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/v1', maxAge: 60 * 60000 };
function sign(nonce: string, req: Request) {
  const binding = createHash('sha256').update(typeof req.cookies?.kou_session === 'string' ? req.cookies.kou_session : 'anonymous').digest('hex');
  return createHmac('sha256', env.JWT_SECRET).update(nonce + '.' + binding).digest('hex');
}
function equal(a: string, b: string) { return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
function valid(token: unknown, req: Request): token is string {
  if (typeof token !== 'string' || !/^[a-f\d]{64}\.[a-f\d]{64}$/.test(token)) return false;
  const [nonce, signature] = token.split('.'); return equal(signature, sign(nonce, req));
}
export function csrfToken(req: Request, res: Response) {
  const existing = req.cookies?.kou_csrf;
  const nonce = randomBytes(32).toString('hex');
  const token = valid(existing, req) ? existing : nonce + '.' + sign(nonce, req);
  res.setHeader('Cache-Control', 'no-store');
  res.cookie('kou_csrf', token, options).json({ csrfToken: token });
}
export function verifyCsrf(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) { next(); return; }
  const cookie = req.cookies?.kou_csrf, header = req.get('X-CSRF-Token');
  if (!valid(cookie, req) || !header || !equal(header, cookie)) { res.status(403).json({ code: 'CSRF_INVALID', message: 'Güvenlik doğrulaması yenilenmeli. Sayfayı yenileyip tekrar deneyin.' }); return; }
  next();
}
