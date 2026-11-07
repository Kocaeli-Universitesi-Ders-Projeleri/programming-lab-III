import yauzl from 'yauzl';
import { XMLParser } from 'fast-xml-parser';
import type { DocumentExtractionResult, ExtractionSegment } from '@kou/shared';
import { extractionResult, unavailableExtraction } from './fieldMapping.js';

export abstract class DocumentExtractor {
  abstract supports(mime: string): boolean;
  abstract extract(bytes: Buffer): Promise<DocumentExtractionResult>;
}
type Node = Record<string, unknown>;
const children = (value: unknown): Node[] => Array.isArray(value) ? value as Node[] : [];
function nodeText(nodes: Node[]): string {
  return nodes.map(node => Object.entries(node).filter(([key]) => key !== ':@').map(([key, value]) => key === '#text' ? String(value) : key === 'br' ? '\n' : key === 'tab' ? '\t' : nodeText(children(value)) + (key === 'p' ? '\n' : '')).join('')).join('');
}
function property(nodes: Node[], tag: string): string | undefined {
  for (const node of nodes) for (const [key, value] of Object.entries(node)) {
    if (key === tag) return String((node[':@'] as Record<string, unknown> | undefined)?.['@_val'] ?? 'continue');
    if (key !== ':@') { const result = property(children(value), tag); if (result !== undefined) return result; }
  }
}
export class DocxExtractor extends DocumentExtractor {
  supports(mime: string) { return mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; }
  async extract(bytes: Buffer) {
    const xml = await new Promise<string>((resolve, reject) => {
      yauzl.fromBuffer(bytes, { lazyEntries: true }, (error, zip) => {
        if (error || !zip) { reject(new Error('DOCX_READ')); return; }
        let found = false;
        zip.on('error', reject); zip.on('end', () => { if (!found) reject(new Error('DOCX_XML_MISSING')); });
        zip.on('entry', entry => {
          if (entry.fileName !== 'word/document.xml') { zip.readEntry(); return; }
          found = true;
          zip.openReadStream(entry, (error, stream) => {
            if (error || !stream) { zip.close(); reject(new Error('DOCX_READ')); return; }
            const chunks: Buffer[] = []; let size = 0;
            stream.on('data', chunk => { size += chunk.length; if (size > 4 * 1024 * 1024) { stream.destroy(new Error('DOCX_LIMIT')); } else chunks.push(chunk); });
            stream.on('error', () => { zip.close(); reject(new Error('DOCX_READ')); });
            stream.on('end', () => { zip.close(); try { resolve(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); } catch { reject(new Error('DOCX_ENCODING')); } });
          });
        }); zip.readEntry();
      });
    });
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DOCX_XML_UNSAFE');
    const tree = new XMLParser({ preserveOrder: true, ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, parseAttributeValue: false, trimValues: false, processEntities: true }).parse(xml) as Node[];
    const segments: ExtractionSegment[] = []; let table = 0, paragraph = 0;
    const visit = (nodes: Node[]) => {
      for (const node of nodes) for (const [tag, value] of Object.entries(node)) {
        if (segments.length > 10000) throw new Error('DOCX_LIMIT');
        if (tag === 'tbl') {
          table++; let row = 0;
          for (const item of children(value)) if (item.tr) {
            row++; let column = 1;
            for (const itemCell of children(item.tr)) if (itemCell.tc) {
              const cell = children(itemCell.tc), span = Number(property(cell, 'gridSpan') ?? 1), merge = property(cell, 'vMerge');
              if (!Number.isInteger(span) || span < 1 || span > 100) throw new Error('DOCX_SPAN');
              segments.push({ text: merge === 'continue' ? '' : nodeText(cell).trim(), location: { kind: 'DOCX_CELL', table, row, column, gridSpan: span, ...(merge ? { verticalMerge: merge } : {}) } }); column += span;
            }
          }
        } else if (tag === 'p') segments.push({ text: nodeText(children(value)).trim(), location: { kind: 'PARAGRAPH', paragraph: ++paragraph } });
        else if (tag !== ':@') visit(children(value));
      }
    }; visit(tree);
    return extractionResult('DocxExtractor', segments);
  }
}
export class PdfExtractor extends DocumentExtractor {
  supports(mime: string) { return mime === 'application/pdf'; }
  async extract(bytes: Buffer) {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({ data: Uint8Array.from(bytes), disableFontFace: true, useSystemFonts: false, useWorkerFetch: false, useWasm: false, stopAtErrors: true, verbosity: 0, maxImageSize: 16000000 });
    const segments: ExtractionSegment[] = [];
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 30) throw new Error('PDF_PAGE_LIMIT');
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const page = await pdf.getPage(pageNo), content = await page.getTextContent();
        const items = content.items.filter((item): item is import('pdfjs-dist/types/src/display/api.js').TextItem => 'str' in item).filter(item => item.str.trim());
        if (items.length > 10000) throw new Error('PDF_TEXT_LIMIT');
        items.sort((a, b) => Math.abs(a.transform[5] - b.transform[5]) > 2 ? b.transform[5] - a.transform[5] : a.transform[4] - b.transform[4]);
        let line: typeof items = [];
        const flush = () => { if (!line.length) return; segments.push({ text: line.map(item => item.str).join('\t'), location: { kind: 'PDF_LINE', page: pageNo, x: line[0]!.transform[4], y: line[0]!.transform[5], pieces: line.map(item => ({ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height })) } }); line = []; };
        for (const item of items) { if (line.length && Math.abs(line[0]!.transform[5] - item.transform[5]) > 2) flush(); line.push(item); } flush();
        page.cleanup();
      }
      return extractionResult('PdfExtractor', segments);
    } finally { await task.destroy(); }
  }
}
export class DocExtractor extends DocumentExtractor {
  supports(mime: string) { return mime === 'application/msword'; }
  async extract(bytes: Buffer) {
    const { default: WordExtractor } = await import('word-extractor');
    const doc = await new WordExtractor().extract(bytes);
    const text = doc.getBody({ filterUnicode: false });
    if (text.length > 500000) throw new Error('DOC_TEXT_LIMIT');
    return extractionResult('DocExtractor', text.split(/\r?\n|\r|\x07/).map((text, index) => ({ text, location: { kind: 'DOC_TEXT', paragraph: index + 1 } })), ['Eski DOC metninde hücre/görsel yerleşim doğrulanmadı.']);
  }
}
export class UnsupportedImageExtractor extends DocumentExtractor {
  supports(mime: string) { return ['image/jpeg', 'image/png'].includes(mime); }
  async extract(_bytes: Buffer) { const result = unavailableExtraction('Görüntü dosyası OCR olmadan okunamaz. Bilgileri manuel girin.'); result.extractorName = 'UnsupportedImageExtractor'; return result; }
}
export class ExtractionService {
  readonly #extractors: readonly DocumentExtractor[];
  constructor(extractors: readonly DocumentExtractor[] = [new DocxExtractor(), new PdfExtractor(), new DocExtractor(), new UnsupportedImageExtractor()]) { this.#extractors = extractors; }
  async extract(bytes: Buffer, mime: string): Promise<DocumentExtractionResult> {
    const extractor = this.#extractors.find(extractor => extractor.supports(mime));
    if (!extractor) return unavailableExtraction('Bu biçim için otomatik okuyucu bulunamadı.');
    try { return await extractor.extract(bytes); }
    catch { const result = unavailableExtraction('Belge metni veya alanları güvenilir biçimde okunamadı. Manuel inceleme gerekli.'); result.extractorName = extractor.constructor.name; result.status = 'FAILED'; return result; }
  }
}
