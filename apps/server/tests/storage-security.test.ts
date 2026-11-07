import { afterEach, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { writeFile, unlink, symlink, link } from 'node:fs/promises';
import { savePrivateFile, readPrivateFile, removePrivateFile, storagePath } from '../src/services/privateStorage.js';
const keys: string[] = [];
afterEach(async () => { for (const key of keys.splice(0)) await removePrivateFile(key); });
it('dosya hash/boyutunu doğrular ve yol geçişini reddeder', async () => {
  const bytes = Buffer.from('synthetic-file'), hash = createHash('sha256').update(bytes).digest('hex'); const key = await savePrivateFile(bytes, 'pdf'); keys.push(key);
  expect(await readPrivateFile(key, bytes.length, hash)).toEqual(bytes); expect(() => storagePath('../.env')).toThrow(); expect(() => storagePath('C:\\secret.pdf')).toThrow();
  await writeFile(storagePath(key), Buffer.from('modified-data!')); await expect(readPrivateFile(key, bytes.length, hash)).rejects.toThrow();
});
it('sembolik bağlantı dosyasını indirmez', async context => {
  const bytes = Buffer.from('synthetic-link-target'); const original = await savePrivateFile(bytes, 'pdf'); keys.push(original); const link = randomUUID() + '.pdf';
  try { await symlink(storagePath(original), storagePath(link), 'file'); }
  catch (error) { if (['EPERM','EACCES','ENOTSUP'].includes((error as {code:string}).code)) { context.skip(); return; } throw error; }
  try { await expect(readPrivateFile(link, bytes.length, createHash('sha256').update(bytes).digest('hex'))).rejects.toThrow(); } finally { await unlink(storagePath(link)); }
});
it('aynı içeriğe işaret etse bile hard link dosyasını reddeder', async () => {
  const bytes = Buffer.from('synthetic-hardlink-target'), hash = createHash('sha256').update(bytes).digest('hex'); const original = await savePrivateFile(bytes,'pdf'); keys.push(original); const another = randomUUID()+'.pdf';
  await link(storagePath(original),storagePath(another));
  try { await expect(readPrivateFile(another,bytes.length,hash)).rejects.toThrow(); } finally { await unlink(storagePath(another)); }
});
