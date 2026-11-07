import type { DocumentExtractionResult, ExtractedField, ExtractionSegment } from '@kou/shared';
export const TEMPLATE_VERSION = 'label-map-unverified-v1';
type Group = 'student' | 'company' | 'employer';
const definitions: { key: string; group: Group; labels: string[] }[] = [
  { key: 'name', group: 'student', labels: ['Ad soyad', 'Adı soyadı'] },
  { key: 'studentNumber', group: 'student', labels: ['Öğrenci numarası', 'Öğrenci no'] },
  { key: 'identityNumber', group: 'student', labels: ['TC / yabancı kimlik numarası', 'TC kimlik numarası', 'TC kimlik no', 'Yabancı kimlik numarası'] },
  { key: 'nationality', group: 'student', labels: ['Uyruk', 'Uyruğu'] },
  { key: 'department', group: 'student', labels: ['Bölüm', 'Bölümü'] },
  { key: 'birthDate', group: 'student', labels: ['Doğum tarihi'] },
  { key: 'academicYear', group: 'student', labels: ['Öğretim yılı'] },
  { key: 'previousInternshipDays', group: 'student', labels: ['Önceden yapılan staj günü', 'Önceki staj günü'] },
  { key: 'email', group: 'student', labels: ['E-posta', 'E posta', 'E-mail'] },
  { key: 'phone', group: 'student', labels: ['Telefon', 'Telefon no'] },
  { key: 'address', group: 'student', labels: ['İkametgâh adresi', 'Adres'] },
  { key: 'healthStatus', group: 'student', labels: ['Sağlık yardımı statüsü'] },
  { key: 'companyName', group: 'company', labels: ['İşyeri adı'] },
  { key: 'serviceArea', group: 'company', labels: ['Hizmet alanı'] },
  { key: 'abroad', group: 'company', labels: ['Yurt dışı stajı'] },
  { key: 'startDate', group: 'company', labels: ['Staj başlangıç tarihi', 'Başlangıç tarihi'] },
  { key: 'endDate', group: 'company', labels: ['Staj bitiş tarihi', 'Bitiş tarihi'] },
  { key: 'declaredDays', group: 'company', labels: ['Staj gün sayısı'] },
  { key: 'companyPhone', group: 'company', labels: ['İşyeri telefonu', 'Telefon', 'Telefon no'] },
  { key: 'fax', group: 'company', labels: ['Faks', 'Fax'] },
  { key: 'companyEmail', group: 'company', labels: ['İşyeri e-postası', 'E-posta', 'E posta', 'E-mail'] },
  { key: 'website', group: 'company', labels: ['Web adresi', 'Web sitesi'] },
  { key: 'employeeCount', group: 'company', labels: ['Çalışan sayısı'] },
  { key: 'engineerCount', group: 'company', labels: ['Mühendis sayısı'] },
  { key: 'engineerDepartments', group: 'company', labels: ['Mühendislerin mezun olduğu bölümler'] },
  { key: 'paid', group: 'company', labels: ['Ücret alma durumu'] },
  { key: 'companyAddress', group: 'company', labels: ['İşyeri adresi', 'Adres'] },
  { key: 'employerName', group: 'employer', labels: ['Yetkili ad soyad', 'İşveren ad soyad', 'Ad soyad', 'Adı soyadı'] },
  { key: 'employerTitle', group: 'employer', labels: ['Görev/unvan', 'Görev / unvan', 'Görev', 'Unvan'] },
  { key: 'employerPhone', group: 'employer', labels: ['Yetkili telefonu', 'Telefon', 'Telefon no'] },
  { key: 'employerEmail', group: 'employer', labels: ['Yetkili e-postası', 'E-posta', 'E posta', 'E-mail'] },
];
const labelKey = (text: string) => text.normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/[.:]/g, '').replace(/\s+/g, ' ').trim();
const isEmpty = (value: string) => !value.trim() || /^[\s._…\-–—]+$/.test(value);
function heading(text: string): Group | undefined {
  const key = labelKey(text);
  if (/^(işveren|yetkili|işveren \/ yetkili) bilgileri$/.test(key)) return 'employer';
  if (key === 'işyeri bilgileri') return 'company';
  if (key === 'öğrenci bilgileri') return 'student';
}
function fieldFor(label: string, group: Group) {
  const matches = definitions.filter(field => field.labels.some(alias => labelKey(alias) === labelKey(label)));
  return matches.find(field => field.group === group) ?? (matches.length === 1 ? matches[0] : undefined);
}
function normalizedValue(key: string, raw: string): string | null {
  const value = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (['identityNumber', 'studentNumber'].includes(key)) return /^[A-Za-z0-9]+$/.test(value) ? value : null;
  if (['birthDate', 'startDate', 'endDate'].includes(key)) {
    const match = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(value);
    const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : value;
    const date = new Date(iso + 'T00:00:00Z');
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
  }
  if (['previousInternshipDays', 'healthStatus', 'declaredDays', 'employeeCount', 'engineerCount'].includes(key)) return /^\d+(?:[.,]\d+)?$/.test(value) ? value.replace(',', '.') : null;
  if (['abroad', 'paid'].includes(key)) return labelKey(value) === 'evet' ? 'true' : labelKey(value) === 'hayır' ? 'false' : null;
  return value;
}
export function mapFields(segments: ExtractionSegment[]) {
  // PDF lines can contain several label/value pairs in separate columns.
  // Preserve original pieces in fieldSources; never consume the next label as a value.
  segments = segments.flatMap(segment => {
    if (segment.location.kind !== 'PDF_LINE' || !segment.text.includes('\t') || heading(segment.text)) return [segment];
    const tokens = segment.text.split('\t'), parts: ExtractionSegment[] = [];
    const isLabel = (text: string) => definitions.some(field => field.labels.some(alias => labelKey(alias) === labelKey(text.split(':')[0]!)));
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!;
      if (!isLabel(token)) continue;
      let text = token;
      if (!token.includes(':') && tokens[i + 1] && !isLabel(tokens[i + 1]!)) text += '\t' + tokens[++i];
      parts.push({ text, location: segment.location });
    }
    return parts.length ? parts : [segment];
  });
  let group: Group = 'student';
  const candidates = new Map<string, { value: string; segment: ExtractionSegment }[]>();
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!, text = segment.text.trim();
    const section = heading(text); if (section) { group = section; continue; }
    let label = text, value = '';
    const separator = text.search(/[:\t\n]/);
    if (separator >= 0) { label = text.slice(0, separator); value = text.slice(separator + 1).trim(); }
    const field = fieldFor(label, group); if (!field) continue;
    if (!value && segment.location.kind === 'DOCX_CELL') {
      const next = segments[i + 1];
      if (next && next.location.kind === 'DOCX_CELL' && next.location.table === segment.location.table && next.location.row === segment.location.row && next.location.column === segment.location.column! + (segment.location.gridSpan ?? 1) && !fieldFor(next.text, group) && !heading(next.text)) value = next.text;
    }
    const values = candidates.get(field.key) ?? []; values.push({ value: isEmpty(value) ? '' : value, segment }); candidates.set(field.key, values);
  }
  return definitions.map((definition): ExtractedField => {
    const matches = candidates.get(definition.key) ?? [], filled = matches.filter(match => match.value);
    const distinct = new Set(filled.map(match => normalizedValue(definition.key, match.value)));
    if (distinct.size > 1 || (filled.length && matches.some(match => !match.value))) return { fieldName: definition.key, rawValue: '', normalizedValue: null, sourceLocation: null, extractionStatus: 'AMBIGUOUS' };
    const candidate = filled[0];
    if (!candidate) return { fieldName: definition.key, rawValue: '', normalizedValue: null, sourceLocation: matches[0]?.segment.location ?? null, extractionStatus: 'MISSING' };
    const normalized = normalizedValue(definition.key, candidate.value);
    return { fieldName: definition.key, rawValue: candidate.value, normalizedValue: normalized, sourceLocation: candidate.segment.location, extractionStatus: normalized === null ? 'INVALID' : 'EXTRACTED' };
  });
}
export function extractionResult(extractorName: string, segments: ExtractionSegment[], errors: string[] = []): DocumentExtractionResult {
  const rawText = segments.map(segment => segment.text).join('\n');
  if (rawText.length > 500000 || segments.length > 10000 || segments.some(segment => segment.text.length > 10000) || JSON.stringify(segments).length > 2000000) throw new Error('EXTRACTION_LIMIT');
  const extractedFields = mapFields(segments), populated = extractedFields.filter(field => field.extractionStatus === 'EXTRACTED').length;
  return { extractorName, extractorVersion: '1.0.0', templateVersion: TEMPLATE_VERSION, templateVerified: false,
    status: !rawText.trim() ? 'EXTRACTION_UNAVAILABLE' : populated === definitions.length ? 'EXTRACTED' : 'PARTIAL',
    rawText, extractedFields, fieldSources: segments, extractionErrors: [...errors, 'Gerçek Ek-16 şablonuyla alan haritası doğrulanmadı.', ...(!rawText.trim() ? ['Okunabilir metin katmanı bulunamadı. OCR bu sürümde yok.'] : !populated ? ['Metin okundu; güvenilir etiket/değer eşlemesi bulunamadı.'] : [])] };
}
export function unavailableExtraction(message: string): DocumentExtractionResult {
  const result = extractionResult('UnavailableExtractor', []);
  result.extractionErrors = [message, 'Okunamayan alanlar tahmin edilmedi.']; return result;
}
