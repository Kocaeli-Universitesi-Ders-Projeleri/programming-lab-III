import type { ComparisonResult, ComparisonRow, ComparisonStatus, DocumentExtractionResult, SourceState } from '@kou/shared';

export const studentReferenceFields: Record<string, string> = { name: 'fullName', studentNumber: 'studentNumber', identityNumber: 'identityNumber', nationality: 'nationality', department: 'department', birthDate: 'dateOfBirth', academicYear: 'academicYear', previousInternshipDays: 'previousInternshipDays', email: 'email', phone: 'phone', address: 'residenceAddress', healthStatus: 'healthCoverageStatus' };
const businessFields = ['companyName', 'serviceArea', 'abroad', 'startDate', 'endDate', 'declaredDays', 'workingDays', 'companyPhone', 'fax', 'companyEmail', 'website', 'employeeCount', 'engineerCount', 'engineerDepartments', 'paid', 'companyAddress', 'employerName', 'employerTitle', 'employerPhone', 'employerEmail'];
const optional = new Set(['fax', 'website', 'engineerDepartments']);
const numeric = new Set(['previousInternshipDays', 'healthStatus', 'declaredDays', 'employeeCount', 'engineerCount']);
const present = (value: unknown) => value !== undefined && value !== null && !(typeof value === 'string' && !value.trim());
export function normalizeComparisonValue(key: string, value: unknown, abroad = false): string | null {
  if (!present(value)) return null;
  const text = String(value).normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (['identityNumber', 'studentNumber'].includes(key)) return typeof value === 'string' ? value.trim() : null;
  if (['birthDate', 'startDate', 'endDate'].includes(key)) {
    const match = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(text), iso = match ? `${match[3]}-${match[2]}-${match[1]}` : text;
    const date = new Date(iso + 'T00:00:00Z');
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
  }
  if (numeric.has(key)) return /^\d+(?:[.,]\d+)?$/.test(text) ? String(Number(text.replace(',', '.'))) : null;
  if (['abroad', 'paid'].includes(key)) return [true, 'true', 'Evet', 'evet'].includes(value as string | boolean) ? 'true' : [false, 'false', 'Hayır', 'hayır'].includes(value as string | boolean) ? 'false' : null;
  if (key === 'workingDays') return Array.isArray(value) && value.every(day => Number.isInteger(day) && day >= 0 && day <= 6) ? [...new Set(value)].sort().join(',') : null;
  if (/email$/i.test(key)) return text.toLowerCase();
  if (key === 'website') {
    try { const url = new URL(text); return ['http:', 'https:'].includes(url.protocol) ? url.origin + url.pathname + url.search + url.hash : null; } catch { return null; }
  }
  if (/phone$/i.test(key) || key === 'fax') {
    let phone = text.replace(/[\s().-]/g, '').replace(/^00/, '+');
    if (key === 'phone' || !abroad) { if (/^0\d{10}$/.test(phone)) phone = '+90' + phone.slice(1); else if (/^\d{10}$/.test(phone)) phone = '+90' + phone; else if (/^90\d{10}$/.test(phone)) phone = '+' + phone; }
    return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
  }
  if (key === 'nationality' && ['TR', 'TC', 'T.C.', 'TÜRKİYE', 'TÜRK', 'TURKEY'].includes(text.toLocaleUpperCase('tr-TR'))) return 'TR';
  return text.toLocaleUpperCase('tr-TR');
}
interface Input { manual: Record<string, unknown>; extraction: Pick<DocumentExtractionResult, 'status' | 'templateVerified' | 'extractedFields'> | null; reference: Record<string, unknown> | null; referenceAmbiguous?: boolean }
export class DocumentComparisonService {
  compare({ manual, extraction, reference, referenceAmbiguous = false }: Input): ComparisonResult {
    const rows = [...Object.keys(studentReferenceFields), ...businessFields].map((fieldName): ComparisonRow => {
      const referenceApplies = fieldName in studentReferenceFields;
      const values = extraction?.extractedFields.filter(field => field.fieldName === fieldName) ?? [], field = values.length === 1 ? values[0] : undefined;
      const unavailable = !extraction || ['FAILED', 'EXTRACTION_UNAVAILABLE'].includes(extraction.status);
      const manualValue = manual[fieldName] ?? null, documentValue = field?.rawValue || null, referenceValue = referenceApplies ? reference?.[studentReferenceFields[fieldName]!] ?? null : null;
      const a = normalizeComparisonValue(fieldName, manualValue, manual.abroad === true);
      const b = field?.extractionStatus === 'EXTRACTED' ? normalizeComparisonValue(fieldName, field.normalizedValue, manual.abroad === true) : null;
      const c = normalizeComparisonValue(fieldName, referenceValue, manual.abroad === true);
      const sources: ComparisonRow['sources'] = {
        manual: !present(manualValue) ? 'MISSING' : a === null ? 'INVALID' : 'PRESENT',
        document: unavailable ? 'UNAVAILABLE' : values.length > 1 || field?.extractionStatus === 'AMBIGUOUS' ? 'AMBIGUOUS' : field?.extractionStatus === 'INVALID' || field?.extractionStatus === 'EXTRACTED' && b === null ? 'INVALID' : b === null ? 'MISSING' : 'PRESENT',
        reference: !referenceApplies ? 'NOT_APPLICABLE' : referenceAmbiguous ? 'AMBIGUOUS' : !present(referenceValue) ? 'MISSING' : c === null ? 'INVALID' : 'PRESENT',
      };
      const pair = (name: 'A-B' | 'A-C' | 'B-C', left: string | null, right: string | null, states: SourceState[]): ComparisonRow['pairs'][number] => ({ pair: name, status: states.includes('NOT_APPLICABLE') ? 'NOT_APPLICABLE' : states.every(state => state === 'PRESENT') ? left === right ? 'MATCH' : 'MISMATCH' : 'UNAVAILABLE' });
      const pairs = [pair('A-B', a, b, [sources.manual, sources.document]), pair('A-C', a, c, [sources.manual, sources.reference]), pair('B-C', b, c, [sources.document, sources.reference])];
      const issues: ComparisonStatus[] = [];
      if (pairs.some(pair => pair.status === 'MISMATCH')) issues.push('MISMATCH');
      if (sources.manual === 'MISSING' && (!optional.has(fieldName) || sources.document === 'PRESENT')) issues.push('MISSING_IN_FORM');
      if (sources.document === 'UNAVAILABLE') issues.push('EXTRACTION_UNAVAILABLE');
      else if (sources.document === 'MISSING' && !(optional.has(fieldName) && sources.manual === 'MISSING')) issues.push('MISSING_IN_DOCUMENT');
      if (referenceApplies && !reference && !referenceAmbiguous) issues.push('REFERENCE_NOT_FOUND');
      if (!extraction?.templateVerified || Object.values(sources).some(state => ['INVALID', 'AMBIGUOUS'].includes(state)) || referenceApplies && sources.reference === 'MISSING') issues.push('MANUAL_REVIEW_REQUIRED');
      const canMatch = pairs.filter(pair => pair.status !== 'NOT_APPLICABLE').every(pair => pair.status === 'MATCH');
      if (!issues.length && !canMatch) issues.push('MANUAL_REVIEW_REQUIRED');
      const status = issues[0] ?? 'MATCH';
      return { fieldName, manualValue, documentValue, referenceValue, sources, pairs, status, issues: issues.length ? issues : ['MATCH'],
        explanation: `${referenceApplies ? 'A-B-C' : 'A-B; referans bu alana uygulanmaz'}. ${pairs.map(pair => `${pair.pair}: ${pair.status}`).join('; ')}${!extraction?.templateVerified ? '. Şablon eşlemesi doğrulanmadı; manuel inceleme gerekir.' : ''}` };
    });
    const fullyMatched = rows.length > 0 && rows.every(row => row.status === 'MATCH');
    return { rows, fullyMatched, requiresManualReview: !fullyMatched, summary: { matched: rows.filter(row => row.status === 'MATCH').length, mismatched: rows.filter(row => row.issues.includes('MISMATCH')).length, incomplete: rows.filter(row => row.status !== 'MATCH' && !row.issues.includes('MISMATCH')).length } };
  }
}
