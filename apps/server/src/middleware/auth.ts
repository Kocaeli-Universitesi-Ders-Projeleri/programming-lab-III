import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Session, User } from '../models/auth.js';
import { env } from '../config/env.js';
import { z } from 'zod';
const claims = z.object({ sub: z.string().regex(/^[a-f\d]{24}$/i), jti: z.string().regex(/^[a-f\d]{24}$/i) });
export interface AuthUser { id: string; name: string; username: string; email: string; role: string }
declare global { namespace Express { interface Request { authUser?: AuthUser; sessionId?: string } } }
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.kou_session;
  if (!token) { res.status(401).json({ message: 'Oturum açmanız gerekiyor.' }); return; }
  let payload;
  try { payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'kou-staj', audience: 'kou-client' }); }
  catch { res.status(401).json({ message: 'Oturum geçersiz veya süresi dolmuş.' }); return; }
  const parsed = claims.safeParse(payload);
  if (!parsed.success) { res.status(401).json({ message: 'Oturum bilgisi geçersiz.' }); return; }
  try {
    const session = await Session.findOne({ _id: parsed.data.jti, user: parsed.data.sub, expiresAt: { $gt: new Date() } });
    const user = session && await User.findById(session.user);
    if (!user || user.active === false) { res.status(401).json({ message: 'Oturum sonlandırılmış.' }); return; }
    req.authUser = { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role };
    req.sessionId = session!.id;
    next();
  } catch (error) { next(error); }
}
export function authorize(role: 'ROLE_ADMIN' | 'ROLE_STUDENT') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) { res.sendStatus(401); return; }
    if (req.authUser.role !== role) { res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmuyor.' }); return; }
    next();
  };
}
