import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ComparisonResponse, ComparisonStatus } from '@kou/shared';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
const labels: Record<ComparisonStatus, string> = { MATCH: 'Eşleşiyor', MISMATCH: 'Uyuşmazlık', MISSING_IN_DOCUMENT: 'Belgede eksik', MISSING_IN_FORM: 'Formda eksik', REFERENCE_NOT_FOUND: 'Referans yok', EXTRACTION_UNAVAILABLE: 'Belge okunamadı', MANUAL_REVIEW_REQUIRED: 'Manuel inceleme gerekli' };
function display(value: unknown, identity: boolean) {
  if (value === null || value === undefined || value === '') return '—';
  const text = typeof value === 'boolean' ? value ? 'Evet' : 'Hayır' : Array.isArray(value) ? value.join(', ') : String(value);
  return identity ? '•••••••' + text.slice(-4) : text;
}
export function ComparisonView({ applicationId, admin, status, fieldLabels }: { applicationId: string; admin: boolean; status: string; fieldLabels: Record<string, string> }) {
  const cache = useQueryClient(); const [busy, setBusy] = useState(false), [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false);
  const result = useQuery({ queryKey: ['comparison', applicationId], queryFn: async () => (await api.get<ComparisonResponse>(`/applications/${applicationId}/comparison`, { timeout: 30000 })).data, refetchOnWindowFocus: true, refetchInterval: 30000 });
  useEffect(() => { void cache.invalidateQueries({ queryKey: ['report', applicationId] }); setConfirmed(false); setReason(''); }, [result.data?.sourceFingerprint, result.data?.state, cache, applicationId]);
  async function action(review: boolean) {
    if (busy || !result.data) return;
    setBusy(true);
    try {
      if (review) await api.post(`/admin/applications/${applicationId}/comparison-review`, { sourceFingerprint: result.data.sourceFingerprint, reason, confirm: confirmed }, { timeout: 30000 });
      else await api.post(`/applications/${applicationId}/comparison`, {}, { timeout: 30000 });
      await Promise.all([cache.invalidateQueries({ queryKey: ['comparison', applicationId] }), cache.invalidateQueries({ queryKey: ['report', applicationId] }), cache.invalidateQueries({ queryKey: ['application', applicationId] })]);
      toast.success(review ? 'Gerekçeli inceleme kaydedildi; uyuşmazlıklar raporda korunur.' : 'Karşılaştırma güncellendi.');
    } catch (error) { toast.error((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Karşılaştırma işlemi tamamlanamadı.'); }
    finally { setBusy(false); }
  }
  const data = result.data, report = data?.report;
  return <section className="panel mt-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Manuel form · Belge · Referans karşılaştırması</h2><Button variant="outline" disabled={result.isFetching || busy} onClick={() => void result.refetch()}>Güncelliği kontrol et</Button></div>
    {result.isPending ? <p role="status" className="mt-4 text-sm">Karşılaştırma yükleniyor…</p> : result.isError ? <p role="alert" className="mt-4 text-sm text-danger">Karşılaştırma alınamadı veya erişim yetkiniz yok.</p> : data && <>
      <p className={`mt-4 rounded-lg p-3 text-sm ${data.state === 'CURRENT' ? 'bg-slate-50 text-primary' : 'bg-amber-50 text-amber-900'}`}>{data.state === 'STALE' ? 'STALE — Kaynaklar değişti. Bu eski raporla onay verilemez.' : data.state === 'NOT_GENERATED' ? 'Bu başvuru için karşılaştırma henüz oluşturulmadı.' : 'Karşılaştırma güncel. Güncel olması bütün alanların eşleştiği anlamına gelmez.'}</p>
      <p className="mt-3 text-xs leading-6 text-slate-500">Öğrenci alanları A-B-C, işyeri ve yetkili alanları A-B karşılaştırılır. Eksik kaynaklar başarı sayılmaz. Referans hesaba bağlı öğrenci numarasıyla seçilir.</p>
      {(admin || status !== 'COMPLETED') && <Button variant="outline" className="mt-4" disabled={busy} onClick={() => void action(false)}>Karşılaştırmayı yeniden oluştur</Button>}
      {report && <><div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-500"><span>Form v{String(report.sourceVersions.formVersion)}</span><span>Belge v{String(report.sourceVersions.documentVersion)}</span><span>Referans {report.sourceVersions.referenceVersion ? `v${report.sourceVersions.referenceVersion}` : 'bulunamadı'}</span><span>{report.summary.mismatched} uyuşmazlık · {report.summary.incomplete} eksik/belirsiz alan</span></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Alan', 'Manuel (A)', 'Belgeden okunan (B)', 'Referans (C)', 'Sonuç / açıklama'].map(label => <th key={label} className="border-b px-3 py-3 text-xs text-slate-500">{label}</th>)}</tr></thead><tbody>{report.rows.map(row => <tr key={row.fieldName}><td className="border-b px-3 py-4">{fieldLabels[row.fieldName] ?? row.fieldName}</td>{[row.manualValue, row.documentValue, row.referenceValue].map((value, index) => <td key={index} className="max-w-60 break-words border-b px-3 py-4">{index === 2 && row.sources.reference === 'NOT_APPLICABLE' ? 'Uygulanmaz' : display(value, row.fieldName === 'identityNumber')}</td>)}<td className="min-w-56 border-b px-3 py-4"><ul className="space-y-1 text-xs">{row.issues.map(issue => <li key={issue} className={issue === 'MISMATCH' ? 'text-danger' : issue === 'MATCH' ? 'text-success' : 'text-slate-600'}>{labels[issue]}</li>)}</ul><details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer text-teal">Kaynak durumları</summary><p className="mt-2">A: {row.sources.manual} · B: {row.sources.document} · C: {row.sources.reference}</p><p className="mt-2">{row.explanation}</p></details></td></tr>)}</tbody></table></div>
      {report.manualReview && <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm"><p className="font-medium">Komisyonun gerekçeli incelemesi kaydedildi.</p><p className="mt-2 whitespace-pre-wrap break-words text-slate-600">{report.manualReview.reason}</p><p className="mt-2 text-xs text-slate-500">{data.state === 'CURRENT' ? 'Bu inceleme gösterilen kaynak sürümlerine aittir. Alanlardaki eksikler veya uyuşmazlıklar korunur.' : 'İnceleme eski kaynaklara aittir; yeniden oluşturulan rapor için geçerli değildir.'}</p></div>}
      {admin && status === 'UNDER_REVIEW' && data.state === 'CURRENT' && report.requiresManualReview && !report.manualReview && <div className="mt-6 border-t pt-5"><h3 className="font-medium">Gerekçeli komisyon incelemesi</h3><label className="mt-3 block text-sm">İnceleme gerekçesi<textarea value={reason} onChange={event => setReason(event.target.value)} minLength={10} maxLength={1000} className="mt-2 block w-full rounded-lg border border-slate-300 p-3"/></label><label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>Belgeyi ve kaynak farklarını manuel inceledim; gerekçemi bu kaynak sürümleri için kaydediyorum.</label><Button className="mt-4" variant="outline" disabled={busy || !confirmed || reason.trim().length < 10} onClick={() => void action(true)}>Karşılaştırma incelemesini kaydet</Button></div>}</>}
    </>}
  </section>;
}
