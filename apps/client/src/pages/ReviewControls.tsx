import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ApplicationStatus, ApplicationValidationReport, ManualChecks } from '@kou/shared';
import { toast } from 'sonner';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { confirmAction } from '../components/confirm';
interface ReviewData { _id: string; status: ApplicationStatus; manualChecks?: Record<string, boolean> }
type ReviewReport = Partial<ApplicationValidationReport> & { testApprovalOverride?: boolean };
const labels: Record<keyof ManualChecks, string> = { employerSignature: 'İşveren imzası var', employerStamp: 'İşveren kaşesi var', studentApprovalEmpty: 'Öğrenci onay alanı boş', advisorApprovalEmpty: 'Staj danışmanı onay alanı boş' };
export function ReviewControls({ application: a, report }: { application: ReviewData; report?: ReviewReport | null }) {
  const [busy, setBusy] = useState(false), [note, setNote] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({ employerSignature: false, employerStamp: false, studentApprovalEmpty: false, advisorApprovalEmpty: false, ...a.manualChecks });
  const cache = useQueryClient();
  const testApprovalOverride = report?.testApprovalOverride === true;
  const ready = testApprovalOverride || report?.readyForApproval === true && Object.keys(labels).every(k => checks[k] === true);
  async function action(operation: ApplicationStatus | 'review' | 'validate') {
    if (operation === 'INVALID' && !note.trim()) { toast.error('Düzeltme gerekçesi girin.'); return; }
    if ((operation === 'APPROVED' || operation === 'COMPLETED') && testApprovalOverride && !note.trim()) { toast.error('Test onayı için gerekçe girin.'); return; }
    if ((operation === 'APPROVED' || operation === 'COMPLETED') && !await confirmAction(operation === 'COMPLETED' ? 'Başvuruyu tamamla?' : 'Başvuruyu onayla?', operation === 'COMPLETED' ? 'Başvuru öğrenci değişikliklerine kapatılacak. Komisyon düzeltmeleri gerekçe ve yeniden inceleme gerektirir.' : 'Başvuruyu onaylamak istiyor musunuz?')) return;
    setBusy(true);
    try {
      const path = `/admin/applications/${a._id}`;
      if (operation === 'review') await api.post(path + '/review', checks, { timeout: 30000 });
      else if (operation === 'validate') await api.post(path + '/validate', {}, { timeout: 30000 });
      else await api.patch(path + '/status', { status: operation, note }, { timeout: 30000 });
      await Promise.all([cache.invalidateQueries({ queryKey: ['applications'] }), cache.invalidateQueries({ queryKey: ['dashboard'] }), cache.invalidateQueries({ queryKey: ['report', a._id] }), cache.invalidateQueries({ queryKey: ['application', a._id] })]);
      toast.success('İşlem kaydedildi.');
    } catch (e) { toast.error((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'İşlem kaydedilemedi.'); }
    finally { setBusy(false); }
  }
  return <section className="panel mt-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Komisyon incelemesi</h2>{a.status !== 'COMPLETED' && <Button variant="outline" disabled={busy} onClick={() => void action('validate')}>Raporu yeniden doğrula</Button>}</div>
    {a.status === 'UPLOADED' && <Button className="mt-4" disabled={busy} onClick={() => void action('UNDER_REVIEW')}>İncelemeyi başlat</Button>}
    {a.status === 'UNDER_REVIEW' && <><fieldset className="mt-5"><legend className="mb-4 text-sm text-slate-500">Orijinal belgeyi form bilgileriyle karşılaştırın ve görsel kontrolleri kaydedin.</legend><div className="grid gap-4 sm:grid-cols-2">{Object.entries(labels).map(([key, label]) => <label key={key} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={Boolean(checks[key])} disabled={busy} onChange={e => setChecks({ ...checks, [key]: e.target.checked })}/>{label}</label>)}</div></fieldset><Button className="mt-5" variant="outline" disabled={busy} onClick={() => void action('review')}>Manuel kontrolleri kaydet</Button>
      <label className="mt-6 block text-sm">{testApprovalOverride ? 'Test onayı gerekçesi' : 'Düzeltme gerekçesi'}<textarea value={note} disabled={busy} onChange={e => setNote(e.target.value)} maxLength={1000} className="mt-2 block w-full rounded-lg border border-slate-300 p-3"/></label><div className="mt-4 flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={() => void action('INVALID')}>Düzeltme için öğrenciye gönder</Button><Button disabled={busy || !ready} onClick={() => void action('APPROVED')}>Başvuruyu onayla</Button></div>
      <p className="mt-4 text-sm leading-6 text-slate-500">{testApprovalOverride ? 'Sunum/test onayı açık. Gerekçe audit kaydına yazılır; normal doğrulama sonuçları korunur.' : ready ? 'Kayıtlı rapor ve manuel kontroller onaya uygun. Sunucu onay anında doğrulamayı tekrar yapar.' : 'Onay için doğrulamalar geçmeli, karşılaştırma güncel olmalı ve gerekiyorsa gerekçeli inceleme kaydedilmeli. Dört manuel kontrolü de kaydedin.'}</p></>}
    {a.status === 'APPROVED' && <>{testApprovalOverride && <label className="mt-5 block text-sm">Test tamamlama gerekçesi<textarea value={note} disabled={busy} onChange={e => setNote(e.target.value)} maxLength={1000} className="mt-2 block w-full rounded-lg border border-slate-300 p-3"/></label>}<Button className="mt-5" disabled={busy || !ready} onClick={() => void action('COMPLETED')}>Tamamlandı olarak işaretle</Button><p className="mt-3 text-sm text-slate-500">Tamamlama anında öğrenci kayıtları ve doğrulamalar tekrar kontrol edilir.</p></>}
    {a.status === 'INVALID' && <p className="mt-5 text-sm text-slate-500">Öğrencinin formu ve belgeyi düzelterek yeniden göndermesi bekleniyor.</p>}
    {a.status === 'COMPLETED' && <p className="mt-5 text-sm text-success">Başvuru öğrenci değişikliklerine kapalıdır. Komisyonun gerekçeli içerik düzeltmesi başvuruyu yeniden incelemeye alır.</p>}
  </section>;
}
