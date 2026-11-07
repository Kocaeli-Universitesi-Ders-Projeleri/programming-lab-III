import { mkdir, writeFile, unlink, lstat, realpath, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { env } from '../config/env.js';
export const storageRoot = path.resolve(env.PRIVATE_STORAGE_DIR ?? fileURLToPath(new URL('../../../../storage/documents', import.meta.url)));
for (const publicRoot of ['../../../client/public','../../../client/dist']) {
  const relative = path.relative(fileURLToPath(new URL(publicRoot,import.meta.url)),storageRoot);
  if (!relative || !relative.startsWith('..') && !path.isAbsolute(relative)) throw new Error('Özel depolama web public/dist dizininde olamaz.');
}
export function storagePath(key: string) {
  if (!/^[a-f\d-]+\.(pdf|doc|docx|jpg|png)$/.test(key)) throw new Error('Geçersiz depolama anahtarı.');
  return path.join(storageRoot, key);
}
async function checkRoot() {
  const stat = await lstat(storageRoot);
  const canonical = await realpath(storageRoot);
  const normalize = (p: string) => process.platform === 'win32' ? p.toLowerCase() : p;
  if (!stat.isDirectory() || stat.isSymbolicLink() || normalize(canonical) !== normalize(storageRoot)) throw new Error('Özel depolama dizini güvenli değil.');
}
export async function savePrivateFile(buffer: Buffer, ext: string) {
  if (!/^(pdf|doc|docx|jpg|png)$/.test(ext)) throw new Error('Geçersiz dosya türü.');
  await mkdir(storageRoot, { recursive: true, mode: 0o700 }); await checkRoot(); const key = `${randomUUID()}.${ext}`;
  await writeFile(storagePath(key), buffer, { flag: 'wx', mode: 0o600 }); return key;
}
export async function readPrivateFile(key: string, size: number, sha256: string) {
  await checkRoot(); const target = storagePath(key), entry = await lstat(target);
  if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1 || entry.size !== size || !Number.isInteger(size) || size <= 0 || size > 20 * 1024 * 1024) throw new Error('Belge bütünlüğü doğrulanamadı.');
  const file = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await file.stat(); if (stat.size !== size || stat.ino !== entry.ino || stat.dev !== entry.dev || stat.nlink !== 1) throw new Error('Belge değişmiş.');
    const bytes = Buffer.alloc(size + 1); let offset = 0;
    while (offset < bytes.length) { const read = await file.read(bytes, offset, bytes.length - offset, offset); if (!read.bytesRead) break; offset += read.bytesRead; }
    const buffer = bytes.subarray(0, offset);
    if (offset !== size || createHash('sha256').update(buffer).digest('hex') !== sha256) throw new Error('Belge bütünlüğü doğrulanamadı.');
    return buffer;
  } finally { await file.close(); }
}
export async function removePrivateFile(key: string) { await checkRoot().then(() => unlink(storagePath(key))).catch(() => undefined); }
