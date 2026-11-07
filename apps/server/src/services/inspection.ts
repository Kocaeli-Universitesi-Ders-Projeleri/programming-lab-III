import { Worker } from 'node:worker_threads';
import { DocumentError, ImportError } from './inspectionErrors.js';
import type { PreviewRow } from './importParser.js';
export { DocumentError, ImportError } from './inspectionErrors.js';
async function inspect<T>(kind: 'document' | 'import', bytes: Buffer, filename: string, mime: string): Promise<T> {
  const workerPath = import.meta.url.endsWith('.ts') ? new URL('../../dist/workers/inspectionWorker.js', import.meta.url) : new URL('../workers/inspectionWorker.js', import.meta.url);
  const Failure = kind === 'document' ? DocumentError : ImportError;
  const worker = new Worker(workerPath, { workerData: { kind, bytes, filename, mime }, resourceLimits: { maxOldGenerationSizeMb: kind === 'import' ? 256 : 128 }, stdout: true, stderr: true });
  worker.stdout.resume(); worker.stderr.resume();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => reject(new Failure('Dosya incelemesi süre sınırını aştı. Daha sade veya daha küçük bir belge yükleyin.')), kind === 'import' ? 15000 : 10000);
      worker.once('message', message => message?.ok === true ? resolve(message.value) : reject(new Failure(typeof message?.message === 'string' ? message.message : 'Dosya okunamadı.')));
      worker.once('error', () => reject(new Failure('Dosya incelemesi tamamlanamadı.')));
      worker.once('exit', () => reject(new Failure('Dosya incelemesi beklenmeden sonlandı.')));
    });
  } finally { if (timer) clearTimeout(timer); await worker.terminate(); }
}
export const inspectDocument = (bytes: Buffer, filename: string, mime: string) => inspect<{ name: string; ext: string; mime: string }>('document', bytes, filename, mime);
export const inspectImport = (bytes: Buffer, filename: string, mime: string) => inspect<PreviewRow[]>('import', bytes, filename, mime);
