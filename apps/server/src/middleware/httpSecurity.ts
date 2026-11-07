import type { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
interface SecurityOptions { production: boolean; origin: string; trustedProxies: string[]; hstsMaxAge: number }
export function configureHttpSecurity(app: Express, options: SecurityOptions) {
  app.set('trust proxy', options.trustedProxies.length ? options.trustedProxies : false);
  app.use(helmet({
    strictTransportSecurity: options.production && options.hstsMaxAge > 0 ? { maxAge: options.hstsMaxAge, includeSubDomains: false, preload: false } : false,
    referrerPolicy: { policy: 'no-referrer' },
    frameguard: { action: 'deny' },
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], fontSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'blob:'], frameSrc: ["'self'", 'blob:'], frameAncestors: ["'none'"], objectSrc: ["'none'"], connectSrc: ["'self'"], upgradeInsecureRequests: options.production ? [] : null } },
  }));
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    if (options.production && !req.secure) {
      if (['GET', 'HEAD'].includes(req.method)) { res.redirect(308, options.origin + req.originalUrl); return; }
      res.status(400).json({ message: 'Bu işlem HTTPS üzerinden yapılmalı.' }); return;
    }
    const origin = req.get('Origin');
    if (origin && origin !== options.origin) { res.status(403).json({ message: 'İstek kaynağına izin verilmiyor.' }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('Sec-Fetch-Site') === 'cross-site') { res.status(403).json({ message: 'Siteler arası yazma isteği reddedildi.' }); return; }
      if (!origin && req.get('Referer')) { let referer = ''; try { referer = new URL(req.get('Referer')!).origin; } catch { /* Invalid referers are rejected. */ } if (referer !== options.origin) { res.status(403).json({ message: 'İstek kaynağına izin verilmiyor.' }); return; } }
    }
    next();
  });
  app.use(cors({ origin: options.origin, credentials: true, methods: ['GET', 'HEAD', 'POST', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token'], exposedHeaders: ['X-Request-ID'] }));
}
