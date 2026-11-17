import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { isIP } from 'node:net';
import { isAbsolute } from 'node:path';
config({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)) });
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TRUSTED_PROXY_CIDRS: z.string().default('').refine(value => !value || value.split(',').every(part => { const [address, prefix] = part.trim().split('/'); const family = isIP(address); return family && (prefix === undefined || /^\d+$/.test(prefix) && +prefix > 0 && +prefix <= (family === 4 ? 32 : 128)); }), 'Proxy ayarı açık IP veya CIDR listesi olmalı.'),
  HSTS_MAX_AGE: z.coerce.number().int().min(0).max(31536000).default(0),
  JWT_SECRET: z.string().min(32),
  MAX_DOCUMENT_MB: z.coerce.number().int().min(1).max(20).default(10),
  PRIVATE_STORAGE_DIR: z.string().trim().optional().transform(v => v || undefined).refine(v => !v || isAbsolute(v), 'Depolama yolu mutlak olmalı.'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LISTEN_HOST: z.string().default('127.0.0.1').refine(v => isIP(v) > 0, 'LISTEN_HOST bir IP adresi olmalı.'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173').refine(v => { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol) && u.pathname === '/' && !u.search && !u.hash && !u.username && !u.password; }, 'Origin yalnızca http/https scheme, host ve port içermeli.').transform(v => new URL(v).origin),
  ALLOW_TEST_APPROVALS: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  MONGODB_URI: z.string().default('').refine(v => { if (!v) return true; if (!v.startsWith('mongodb+srv://')) return false; try { const u = new URL(v); return ![...u.searchParams].some(([k, val]) => /^(tls|ssl)$/i.test(k) && val === 'false' || /^(tlsAllowInvalidCertificates|tlsAllowInvalidHostnames|tlsInsecure)$/i.test(k) && val === 'true'); } catch { return false; } }, 'MongoDB Atlas bağlantısı TLS ve sertifika doğrulamasını devre dışı bırakamaz.'),
}).superRefine((v, ctx) => { if (v.NODE_ENV === 'production') { if (!v.CLIENT_ORIGIN.startsWith('https://')) ctx.addIssue({ code: 'custom', path: ['CLIENT_ORIGIN'], message: 'Production frontend origin HTTPS olmalı.' }); if (!v.MONGODB_URI) ctx.addIssue({ code: 'custom', path: ['MONGODB_URI'], message: 'Production Atlas bağlantısı zorunludur.' }); } });
export const env = schema.parse(process.env);
