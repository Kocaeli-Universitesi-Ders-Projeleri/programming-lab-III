import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { toast } from 'sonner';
import { isValidGoogleFormUrl } from '@kou/shared';
import { api } from '../services/api';
import { Button } from '../components/ui/button';

const invalidMessage = 'Girilen adres geçerli bir Google Form adresi değil. Adres https://docs.google.com/forms/... veya https://forms.gle/... biçiminde olmalıdır.';

export function showInvalidGoogleFormPopup(text = invalidMessage) {
  return Swal.fire({ title: 'Geçersiz Google Form adresi', text, icon: 'warning', confirmButtonText: 'Tamam', confirmButtonColor: '#123f61' });
}

export function GoogleFormCard({ current }: { current?: string | null }) {
  const [url, setUrl] = useState(current ?? ''), [saving, setSaving] = useState(false);
  const cache = useQueryClient();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidGoogleFormUrl(url)) { await showInvalidGoogleFormPopup(); return; }
    setSaving(true);
    try {
      await api.put('/students/me/google-form', { url: url.trim() });
      await cache.invalidateQueries({ queryKey: ['student-profile'] });
      toast.success('Google Form adresi kaydedildi.');
    } catch (error) {
      const response = (error as { response?: { status?: number; data?: { code?: string; message?: string } } }).response;
      if (response?.data?.code === 'INVALID_GOOGLE_FORM_URL') await showInvalidGoogleFormPopup(response.data.message);
      else toast.error(response?.data?.message ?? 'Adres kaydedilemedi. Lütfen tekrar deneyin.');
    } finally { setSaving(false); }
  }
  return <section className="panel mt-6">
    <h2 className="font-semibold">Staj evrakı teslim Google Form adresi</h2>
    <p className="mt-2 text-sm leading-6 text-slate-500">Bölümün staj evrakı teslim formunun adresini girin. Belgeniz “Tamamlandı” statüsüne geçtiğinde bilgiler bu forma aktarılacaktır.</p>
    <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex-1 text-sm">Google Form URL'si<input aria-label="Google Form URL'si" type="url" inputMode="url" placeholder="https://docs.google.com/forms/d/e/.../viewform" value={url} onChange={e => setUrl(e.target.value)} maxLength={500} className="mt-2 block w-full rounded-lg border border-slate-300 p-3"/></label>
      <Button disabled={saving || !url.trim()}>{saving ? 'Kaydediliyor…' : 'Adresi kaydet'}</Button>
    </form>
    {current && <p className="mt-3 break-all text-xs text-slate-500">Kayıtlı adres: {current}</p>}
  </section>;
}
