export type ExtractionStatus = 'EXTRACTED' | 'PARTIAL' | 'EXTRACTION_UNAVAILABLE' | 'FAILED';
export interface SourceLocation {
  kind: 'DOCX_CELL' | 'PARAGRAPH' | 'PDF_LINE' | 'DOC_TEXT';
  page?: number; table?: number; row?: number; column?: number; paragraph?: number;
  x?: number; y?: number; gridSpan?: number; verticalMerge?: string;
  pieces?: { text: string; x: number; y: number; width: number; height: number }[];
}
export interface ExtractionSegment { text: string; location: SourceLocation }
export interface ExtractedField {
  fieldName: string; rawValue: string; normalizedValue: string | null;
  sourceLocation: SourceLocation | null;
  extractionStatus: 'EXTRACTED' | 'MISSING' | 'AMBIGUOUS' | 'INVALID';
}
export interface DocumentExtractionResult {
  extractorName: string; extractorVersion: string; templateVersion: string;
  templateVerified: boolean; status: ExtractionStatus; rawText: string;
  extractedFields: ExtractedField[]; fieldSources: ExtractionSegment[]; extractionErrors: string[];
}
export interface DocumentExtractionResponse extends DocumentExtractionResult {
  documentId?: string; documentVersion?: number; documentHash?: string;
}
