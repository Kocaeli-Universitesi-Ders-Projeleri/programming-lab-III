import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'dotenv';
const root = fileURLToPath(new URL('../', import.meta.url));
const local = parse(await readFile(path.join(root,'.env'),'utf8').catch(() => ''));
const candidates = ['JWT_SECRET','SEED_PASSWORD','MONGODB_URI'].filter(k => local[k]?.length >= 12).map(k => [k, local[k]]);
try { const password = decodeURIComponent(new URL(local.MONGODB_URI).password); if (password.length >= 8) candidates.push(['ATLAS_PASSWORD',password]); } catch { /* No URI is also a valid source-only scan. */ }
const hits = []; let scanned = 0;
async function walk(directory) {
  for (const entry of await readdir(directory,{withFileTypes:true})) {
    if (['node_modules','.git','storage'].includes(entry.name) || entry.name === '.env') continue;
    const filename = path.join(directory,entry.name);
    if (entry.isDirectory()) await walk(filename);
    else if (entry.isFile()) { const bytes = await readFile(filename); if (bytes.includes(0) || bytes.length > 10*1024*1024) continue; scanned++; const text = bytes.toString('utf8'); const keys = candidates.filter(([,value]) => text.includes(value)).map(([key]) => key); if (keys.length) hits.push({file:path.relative(root,filename),keys}); }
  }
}
await walk(root);
const ignore = await readFile(path.join(root,'.gitignore'),'utf8').catch(() => '');
console.log(JSON.stringify({ filesScanned:scanned, literalSecretHits:hits, envIgnoreRule:ignore.split(/\r?\n/).includes('.env'), gitHistoryVerified:false },null,2));
if (hits.length) process.exitCode=1;
