import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
export function AdminApplicationActions({ id, version }: { id: string; version: number }) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false);
  const navigate = useNavigate(), cache = useQueryClient();
  async function remove() {
    if (busy || !confirmed || reason.trim().length < 10 || !window.confirm('Başvuru normal erişime kapatılacak. Dosyalar ve işlem geçmişi korunacak. Silmeyi onaylıyor musunuz?')) return;
    setBusy(true);
    try {
      await api.delete(`/admin/applications/${id}`, { data: { version, reason, confirm: true }, timeout: 30000 });
      await Promise.all(['applications', 'dashboard', 'application', 'report', 'comparison', 'extraction', 'application-audit'].map(key => cache.invalidateQueries({ queryKey: [key] })));
      toast.success('Başvuru erişime kapatıldı. İşlem geçmişi korunuyor.'); navigate(`/admin/applications/${id}/audit`);
    } catch (error) { toast.error((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Silme tamamlanamadı. İşlem geçmişinden durumu kontrol edin.'); }
    finally { setBusy(false); }
  }
  return <section className="panel mt-6"><h2 className="font-semibold">Komisyon kayıt yönetimi</h2><p className="mt-2 text-sm leading-6 text-slate-500">Tamamlanan başvurular dahil, düzeltmeler gerekçe ve sürüm geçmişiyle kaydedilir. İçerik değişirse başvuru yeniden incelemeye alınır.</p><div className="mt-4 flex flex-wrap gap-3"><Button variant="outline" asChild><Link to={`/admin/applications/${id}/edit`}>Formu veya belgeyi düzenle</Link></Button><Button variant="outline" asChild><Link to={`/admin/applications/${id}/audit`}>İşlem geçmişi</Link></Button><Button variant="outline" disabled={busy} onClick={() => { setOpen(value => !value); setConfirmed(false); }}>Başvuruyu sil</Button></div>{open && <div className="mt-5 rounded-lg border border-red-200 p-4"><label className="block text-sm">Silme gerekçesi<textarea value={reason} onChange={event => setReason(event.target.value)} minLength={10} maxLength={1000} className="mt-2 block w-full rounded-lg border border-slate-300 p-3"/></label><label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>Başvurunun listelerden kaldırılacağını ve belge/rapor bağlantılarının kapanacağını onaylıyorum.</label><Button variant="outline" className="mt-4 text-danger" disabled={busy || !confirmed || reason.trim().length < 10} onClick={() => void remove()}>{busy ? 'İşleniyor…' : 'Gerekçeli silmeyi onayla'}</Button></div>}</section>;
}
