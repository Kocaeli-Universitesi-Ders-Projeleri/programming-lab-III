export type ComparisonStatus = 'MATCH' | 'MISMATCH' | 'MISSING_IN_DOCUMENT' | 'MISSING_IN_FORM' | 'REFERENCE_NOT_FOUND' | 'EXTRACTION_UNAVAILABLE' | 'MANUAL_REVIEW_REQUIRED';
export type SourceState = 'PRESENT' | 'MISSING' | 'UNAVAILABLE' | 'AMBIGUOUS' | 'INVALID' | 'NOT_APPLICABLE';
export interface ComparisonRow {
  fieldName: string;
  manualValue: unknown; documentValue: unknown; referenceValue: unknown;
  sources: { manual: SourceState; document: SourceState; reference: SourceState };
  pairs: { pair: 'A-B' | 'A-C' | 'B-C'; status: 'MATCH' | 'MISMATCH' | 'UNAVAILABLE' | 'NOT_APPLICABLE' }[];
  status: ComparisonStatus; issues: ComparisonStatus[]; explanation: string;
}
export interface ComparisonResult {
  rows: ComparisonRow[]; fullyMatched: boolean; requiresManualReview: boolean;
  summary: { matched: number; mismatched: number; incomplete: number };
}
export interface ComparisonResponse {
  state: 'CURRENT' | 'STALE' | 'NOT_GENERATED'; sourceFingerprint: string;
  sourceVersions: Record<string, unknown>; approvalEligible: boolean;
  report: (ComparisonResult & { sourceFingerprint: string; sourceVersions: Record<string, unknown>; createdAt?: string;
    manualReview?: { reason: string; reviewer: string; reviewedAt: string } | null }) | null;
}
