import { createHash } from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
const message = { message: 'Çok fazla istek gönderildi. Lütfen biraz bekleyip tekrar deneyin.' };
export const generalLimit = rateLimit({ windowMs: 60000, limit: 10000, standardHeaders: 'draft-7', legacyHeaders: false, message });
export const loginIpLimit = rateLimit({ windowMs: 15 * 60000, limit: 1000, standardHeaders: 'draft-7', legacyHeaders: false, message });
export const loginAccountLimit = rateLimit({ windowMs: 15 * 60000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message, keyGenerator: req => createHash('sha256').update(typeof req.body?.identifier === 'string' ? req.body.identifier.trim().toLowerCase() : 'invalid').digest('hex') });
export function userLimit(limit: number, windowMs: number) { return rateLimit({ limit, windowMs, message, standardHeaders: 'draft-7', legacyHeaders: false, keyGenerator: req => req.authUser?.id ?? 'unauthenticated' }); }
export const uploadLimit = userLimit(10, 15 * 60000);
export const adminWriteLimit = userLimit(60, 60000);
export function heavyWorkAdmission(maxTotal = 2) {
  let running = 0; const users = new Set<string>();
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.authUser?.id;
    if (!user) { res.status(401).json({ message: 'Oturum gerekli.' }); return; }
    if (running >= maxTotal || users.has(user)) { res.setHeader('Retry-After', '5'); res.status(429).json({ message: 'Dosya işlemi sürüyor. Birkaç saniye sonra yeniden deneyin.' }); return; }
    running++; users.add(user); let released = false;
    const release = () => { if (released) return; released = true; running--; users.delete(user); };
    res.once('finish', release);
    res.once('close', () => { if (!res.locals.heavyProcessing) release(); });
    res.locals.releaseHeavyWork = release;
    next();
  };
}
export const admitHeavyWork = heavyWorkAdmission();
export function withHeavyWork(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => { res.locals.heavyProcessing = true; try { await handler(req, res, next); } catch (error) { next(error); } finally { res.locals.releaseHeavyWork?.(); } };
}
