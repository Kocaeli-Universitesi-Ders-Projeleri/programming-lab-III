import { useQuery } from '@tanstack/react-query';
import type { DocumentExtractionResponse } from '@kou/shared';
import { api } from '../services/api';
const statuses = { EXTRACTED: 'Alanlar okundu', PARTIAL: 'Kısmi okuma — manuel inceleme gerekli', EXTRACTION_UNAVAILABLE: 'Otomatik okuma kullanılamıyor', FAILED: 'Otomatik okuma tamamlanamadı' };
const fields = { EXTRACTED: 'Okundu', MISSING: 'Belgede bulunamadı / boş', AMBIGUOUS: 'Belirsiz / çelişen değerler', INVALID: 'Ortak biçime dönüştürülemedi' };
export function ExtractionResultView({ result, labels = {} }: { result: DocumentExtractionResponse; labels?: Record<string, string> }) {
  return <div><p className="mt-3 font-medium text-primary">{statuses[result.status]}</p><p className="mt-2 text-xs leading-6 text-slate-500">Otomatik okuma eşleşme veya onay anlamına gelmez. {result.templateVerified ? '' : 'Gerçek Ek-16 şablonuyla alan haritası doğrulanmadı.'} Okunamayan alanlar tahmin edilmez.</p>
    {result.extractionErrors.length > 0 && <ul className="mt-3 space-y-1 text-xs text-slate-500">{result.extractionErrors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
    <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Alan', 'Belgeden okunan', 'Durum', 'Kaynak'].map(label => <th key={label} className="border-b px-3 py-3 text-xs text-slate-500">{label}</th>)}</tr></thead><tbody>{result.extractedFields.map(field => <tr key={field.fieldName}><td className="border-b px-3 py-3">{labels[field.fieldName] ?? field.fieldName}</td><td className="max-w-xs break-words border-b px-3 py-3">{field.fieldName === 'identityNumber' && field.rawValue ? '•••••••' + field.rawValue.slice(-4) : field.rawValue || '—'}</td><td className="border-b px-3 py-3 text-xs">{fields[field.extractionStatus]}</td><td className="border-b px-3 py-3 text-xs text-slate-500">{field.sourceLocation?.kind === 'DOCX_CELL' ? `Tablo ${field.sourceLocation.table}, satır ${field.sourceLocation.row}, hücre ${field.sourceLocation.column}` : field.sourceLocation?.page ? `Sayfa ${field.sourceLocation.page}` : field.sourceLocation?.paragraph ? `Paragraf ${field.sourceLocation.paragraph}` : '—'}</td></tr>)}</tbody></table></div>
    {result.rawText && <details className="mt-4 text-sm"><summary className="cursor-pointer text-teal">Ham belge metnini incele</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-xs">{result.rawText}</pre></details>}
    {result.documentVersion && <p className="mt-4 text-xs text-slate-500">Belge sürümü: {result.documentVersion} · Okuyucu: {result.extractorName} {result.extractorVersion}</p>}
  </div>;
}
export function ExtractionView({ applicationId, labels }: { applicationId: string; labels: Record<string, string> }) {
  const result = useQuery({ queryKey: ['extraction', applicationId], queryFn: async () => (await api.get<DocumentExtractionResponse>(`/applications/${applicationId}/extraction`)).data });
  return <section className="panel mt-6"><h2 className="font-semibold">Belgeden otomatik okunan bilgiler</h2>{result.isPending ? <p role="status" className="mt-3 text-sm">Belge okuma sonucu yükleniyor…</p> : result.isError ? <p role="alert" className="mt-3 text-sm text-danger">Belge okuma sonucu alınamadı.</p> : <ExtractionResultView result={result.data} labels={labels}/>}</section>;
}
