import { parentPort, workerData } from 'node:worker_threads';
import { DocumentError, ImportError } from '../services/inspectionErrors.js';
try {
  const { kind, bytes, filename, mime } = workerData;
  const buffer = Buffer.from(bytes);
  let value: unknown;
  if (kind === 'import') value = await (await import('../services/importParser.js')).parseImport(buffer, filename, mime);
  else {
    const safe = await (await import('../services/documentSafety.js')).checkDocument(buffer, filename, mime);
    value = kind === 'extraction' ? await new (await import('../services/extraction/extractors.js')).ExtractionService().extract(buffer, mime) : safe;
  }
  parentPort!.postMessage({ ok: true, value });
} catch (error) {
  parentPort!.postMessage({ ok: false, message: error instanceof DocumentError || error instanceof ImportError ? error.message : 'Dosya ayrıştırılamadı.' });
}
