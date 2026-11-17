import { Worker } from 'node:worker_threads';
import { DocumentError, ImportError } from './inspectionErrors.js';
import type { PreviewRow } from './importParser.js';
import type { DocumentExtractionResult } from '@kou/shared';
import { unavailableExtraction } from './extraction/fieldMapping.js';
export { DocumentError, ImportError } from './inspectionErrors.js';
async function inspect<T>(kind: 'document' | 'import' | 'extraction', bytes: Buffer, filename: string, mime: string): Promise<T> {
  const workerPath = import.meta.url.endsWith('.ts') ? new URL('../../dist/workers/inspectionWorker.js', import.meta.url) : new URL('../workers/inspectionWorker.js', import.meta.url);
  const Failure = kind === 'document' ? DocumentError : ImportError;
  const worker = new Worker(workerPath, { workerData: { kind, bytes, filename, mime }, resourceLimits: { maxOldGenerationSizeMb: kind === 'document' ? 128 : 256 }, stdout: true, stderr: true });
  worker.stdout.resume(); worker.stderr.resume();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      // XLSX parsing has a higher cold-start cost on Windows because ExcelJS is
      // loaded inside an isolated worker. Keep document safety strict while
      // allowing normal 500-row reference sheets enough time to finish.
      // A cold worker must load the document-security stack (sharp, pdf-lib,
      // yauzl, and file-type) before it can inspect the first byte. Ten seconds
      // is too short on slower development machines and serverless cold starts.
      // The heavy-work admission limit and worker memory cap still bound work.
      const timeout = kind === 'document' ? 30000 : kind === 'import' ? 30000 : 30000;
      timer = setTimeout(() => reject(new Failure(kind === 'import' ? 'Veri seti incelemesi süre sınırını aştı. Dosyanın tek sayfa ve 500 satırdan küçük olduğunu kontrol edin.' : 'Dosya incelemesi süre sınırını aştı. Daha sade veya daha küçük bir belge yükleyin.')), timeout);
      worker.once('message', message => message?.ok === true ? resolve(message.value) : reject(new Failure(typeof message?.message === 'string' ? message.message : 'Dosya okunamadı.')));
      worker.once('error', () => reject(new Failure('Dosya incelemesi tamamlanamadı.')));
      worker.once('exit', () => reject(new Failure('Dosya incelemesi beklenmeden sonlandı.')));
    });
  } finally { if (timer) clearTimeout(timer); await worker.terminate(); }
}
export const inspectDocument = (bytes: Buffer, filename: string, mime: string) => inspect<{ name: string; ext: string; mime: string }>('document', bytes, filename, mime);
export const inspectImport = (bytes: Buffer, filename: string, mime: string) => inspect<PreviewRow[]>('import', bytes, filename, mime);
export async function inspectExtraction(bytes: Buffer, filename: string, mime: string): Promise<DocumentExtractionResult> {
  try { return await inspect<DocumentExtractionResult>('extraction', bytes, filename, mime); }
  catch { return unavailableExtraction('Otomatik okuma süre veya kaynak sınırında tamamlanamadı. Manuel inceleme gerekli.'); }
}
