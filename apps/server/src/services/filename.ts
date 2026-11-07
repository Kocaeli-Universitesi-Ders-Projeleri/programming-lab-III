import path from 'node:path';

/** Multipart legacy headers can expose UTF-8 bytes as Latin-1. */
export function safeFilename(input: string) {
  let name = input;
  if ([...input].every(char => char.charCodeAt(0) <= 255)) {
    try { name = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(input, 'latin1')); } catch { /* Already a legacy filename. */ }
  }
  return path.win32.basename(path.posix.basename(name.normalize('NFC')))
    .replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, 180);
}
