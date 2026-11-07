import path from 'node:path';
import { safeFilename } from './filename.js';
import { fileTypeFromBuffer } from 'file-type';
import { PDFDocument, PDFDict, PDFName, PDFArray, PDFString, PDFHexString } from 'pdf-lib';
import * as CFB from 'cfb';
import sharp from 'sharp';
import yauzl from 'yauzl';
import { DocumentError } from './inspectionErrors.js';
export { DocumentError } from './inspectionErrors.js';
const formats: Record<string, string> = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
function inspectPdfObject(value: unknown, seen: Set<unknown>, budget: { count: number }, depth = 0) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  if (depth > 50 || ++budget.count > 100000) throw new DocumentError('PDF nesne karmaşıklığı sınırı aşıldı.');
  seen.add(value);
  if (value instanceof PDFDict) {
    const decodedName = (name: PDFName) => name.decodeText().replace(/#([\da-f]{2})/gi, (_m, code: string) => String.fromCharCode(parseInt(code, 16)));
    const entries = value.entries(), get = (key: string) => entries.find(([k]) => decodedName(k) === key)?.[1];
    const action = get('S'), type = get('Type');
    const blocked = entries.some(([k]) => ['JS', 'JavaScript', 'AA', 'OpenAction', 'Launch', 'EmbeddedFiles', 'EF', 'XFA', 'RichMediaContent'].includes(decodedName(k))) || action instanceof PDFName && ['JavaScript', 'Launch', 'SubmitForm', 'ImportData', 'GoToR', 'GoToE', 'RichMediaExecute'].includes(decodedName(action)) || type instanceof PDFName && decodedName(type) === 'EmbeddedFile';
    if (blocked) throw new DocumentError('Etkin içerik veya gömülü dosya içeren PDF kabul edilmez.');
    if (action instanceof PDFName && decodedName(action) === 'URI') { const uri = get('URI'); if (!(uri instanceof PDFString || uri instanceof PDFHexString) || !/^https?:\/\//i.test(uri.decodeText().trim())) throw new DocumentError('PDF içindeki bağlantı şeması güvenli değil.'); }
    for (const [, child] of value.entries()) inspectPdfObject(child, seen, budget, depth + 1);
  } else if (value instanceof PDFArray) { for (const child of value.asArray()) inspectPdfObject(child, seen, budget, depth + 1); }
  else if ('dict' in value) inspectPdfObject(value.dict, seen, budget, depth + 1);
}
function xmlText(bytes: Buffer) {
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new DocumentError('Word XML dosyaları UTF-8 olmalı.'); }
  if (text.includes('\0') || /encoding\s*=\s*["'](?!utf-8["']|utf8["']|us-ascii["'])/i.test(text)) throw new DocumentError('Word XML kodlaması desteklenmiyor.');
  return text.replace(/&#(x[\da-f]+|\d+);/gi, (_match, code: string) => { const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1),16) : parseInt(code,10); return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; });
}
async function inspectDocx(buffer: Buffer) {
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) { reject(new DocumentError('Word arşivi okunamadı.')); return; }
      let size = 0, actual = 0, entries = 0, document = false, contentTypes = false, failed = false;
      const fail = () => { if (failed) return; failed = true; zip.close(); reject(new DocumentError('Word dosyası makro, dış bağlantı, gömülü nesne veya geçersiz arşiv içeriyor.')); };
      zip.on('error', fail);
      zip.on('entry', entry => {
        size += entry.uncompressedSize; entries++;
        if (size > 30 * 1024 * 1024 || entries > 1000 || (entry.generalPurposeBitFlag & 1) || /vba|embeddings|activeX|\.\./i.test(entry.fileName)) { fail(); return; }
        if (entry.fileName === 'word/document.xml') document = true;
        if (entry.fileName === '[Content_Types].xml') contentTypes = true;
        zip.openReadStream(entry, (err, stream) => {
          if (err || !stream) { fail(); return; }
          const chunks: Buffer[] = []; const inspect = /\.xml$|\.rels$/i.test(entry.fileName);
          stream.on('data', chunk => { actual += chunk.length; if (actual > 30 * 1024 * 1024) { stream.destroy(); fail(); } else if (inspect) chunks.push(chunk); });
          stream.on('error', fail);
          stream.on('end', () => {
            if (failed) return;
            if (inspect) { try { if (/<!DOCTYPE|<!ENTITY|macroEnabled|TargetMode\s*=\s*["']\s*External\s*["']|attachedTemplate|OLEObject|altChunk/i.test(xmlText(Buffer.concat(chunks)))) { fail(); return; } } catch { fail(); return; } }
            zip.readEntry();
          });
        });
      });
      zip.on('end', () => { if (!failed) document && contentTypes ? resolve() : reject(new DocumentError('Dosya bir DOCX belgesi değil.')); });
      zip.readEntry();
    });
  });
}
export async function checkDocument(buffer: Buffer, originalname: string, mime: string) {
  const name = safeFilename(originalname);
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (!formats[ext] || formats[ext] !== mime || buffer.length < 8) throw new DocumentError('Dosya uzantısı ve MIME türü uyuşmuyor. PDF, DOC, DOCX, JPG veya PNG seçin.');
  try {
    if (ext === 'doc') {
      if (buffer.subarray(0, 8).toString('hex') !== 'd0cf11e0a1b11ae1') throw new DocumentError('Word dosya imzası geçersiz.');
      const cfb = CFB.read(buffer, { type: 'buffer' }); const word = CFB.find(cfb, 'WordDocument');
      if (!word || word.content.length < 68 || /VBA|Macros|ObjectPool|Ole10Native/i.test(cfb.FullPaths.join('|'))) throw new DocumentError('Makrolu, gömülü nesneli veya geçersiz DOC kabul edilmez.');
      const fib = Buffer.from(word.content);
      if (fib.readUInt16LE(0) !== 0xa5ec || (fib.readUInt16LE(10) & 0x8100)) throw new DocumentError('Şifreli veya desteklenmeyen Word belgesi.');
      if (!CFB.find(cfb, fib.readUInt16LE(10) & 0x0200 ? '1Table' : '0Table')) throw new DocumentError('DOC tablo akışı eksik.');
    } else {
      const detected = await fileTypeFromBuffer(buffer);
      if (!detected || detected.mime !== formats[ext]) throw new DocumentError('Dosyanın gerçek türü uzantısıyla uyuşmuyor.');
      if (ext === 'docx') await inspectDocx(buffer);
      else if (ext === 'pdf') {
        if (!buffer.subarray(-1024).includes(Buffer.from('%%EOF'))) throw new DocumentError('PDF eksik veya bozuk.');
        const pdf = await PDFDocument.load(buffer, { updateMetadata: false });
        const seen = new Set<unknown>(), budget = { count: 0 };
        for (const [, object] of pdf.context.enumerateIndirectObjects()) inspectPdfObject(object, seen, budget);
        if (!pdf.getPageCount()) throw new DocumentError('PDF en az bir sayfa içermeli.');
      } else {
        // Full raster decoding checks validity and bounds pixel memory. Original bytes are preserved.
        await sharp(buffer, { limitInputPixels: 16000000, failOn: 'warning' }).stats();
      }
    }
  } catch (error) { if (error instanceof DocumentError) throw error; throw new DocumentError('Dosya yapısı okunamadı; şifreli veya bozuk belge kabul edilmez.'); }
  return { name, ext: ext === 'jpeg' ? 'jpg' : ext, mime: formats[ext] };
}
