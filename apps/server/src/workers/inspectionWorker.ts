import { parentPort, workerData } from 'node:worker_threads';
import { DocumentError, ImportError } from '../services/inspectionErrors.js';
try {
  const { kind, bytes, filename, mime } = workerData;
  const buffer = Buffer.from(bytes);
  const value = kind === 'document' ? await (await import('../services/documentSafety.js')).checkDocument(buffer, filename, mime) : await (await import('../services/importParser.js')).parseImport(buffer, filename, mime);
  parentPort!.postMessage({ ok: true, value });
} catch (error) {
  parentPort!.postMessage({ ok: false, message: error instanceof DocumentError || error instanceof ImportError ? error.message : 'Dosya ayrıştırılamadı.' });
}
