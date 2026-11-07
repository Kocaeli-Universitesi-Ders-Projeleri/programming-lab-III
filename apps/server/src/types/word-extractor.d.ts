declare module 'word-extractor' {
  export default class WordExtractor {
    extract(bytes: Buffer): Promise<{ getBody(options?: { filterUnicode?: boolean }): string }>;
  }
}
