import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { api } from '../services/api';
import { ReferenceRecords } from './ReferenceRecords';
import Swal from 'sweetalert2';
interface Row { nextVersion?: number; line: number; data: Record<string, string | number>; errors: string[] }
interface Preview { id: string; filename: string; rows: Row[]; valid: number; invalid: number; expiresAt: string }
interface Result { successful: number; failed: number; failures: { line: number; errors: string[] }[]; alreadyCommitted?: boolean }
function message(error: unknown) { return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'İşlem tamamlanamadı. Bağlantınızı kontrol edin. Sonuçtan emin değilseniz yeniden kayıt düğmesine basarak durumu kontrol edebilirsiniz.'; }
const labels: Record<string, string> = { name: 'Ad soyad', identityNumber: 'Kimlik numarası', nationality: 'Uyruk', studentNumber: 'Öğrenci numarası', birthDate: 'Doğum tarihi', address: 'Adres', department: 'Bölüm', academicYear: 'Öğretim yılı', previousInternshipDays: 'Önceki staj günü', email: 'E-posta', phone: 'Telefon', healthStatus: 'Sağlık statüsü' };
export function ImportPage() {
  const [file, setFile] = useState<File>(); const [preview, setPreview] = useState<Preview>(); const [result, setResult] = useState<Result>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [errorsOnly, setErrorsOnly] = useState(false); const [page, setPage] = useState(1);
  const input = useRef<HTMLInputElement>(null); const cache = useQueryClient();
  async function upload(e: FormEvent) {
    e.preventDefault(); if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !/\.(csv|xlsx)$/i.test(file.name)) { setError('En fazla 5 MB boyutunda CSV veya XLSX seçin.'); return; }
    setBusy(true); setError(''); setPreview(undefined); setResult(undefined);
    try { const body = new FormData(); body.append('file', file); const response = await api.post<Preview>('/admin/students/import', body, { timeout: 60000 }); setPreview(response.data); setPage(1); setErrorsOnly(false); toast.success('Dosya önizlemesi hazır. Henüz referans kaydı yapılmadı.'); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function confirm() {
    if (!preview || busy) return;
    const result = await Swal.fire({
      title: 'Aktarımı onayla',
      text: `${preview.valid} geçerli satır kaydedilecek; ${preview.invalid} hatalı satır atlanacak. Yalnızca referans verileri kaydedilecek; hesap veya parola oluşturulmayacak. Mevcut referanslar için yeni sürüm eklenecek.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Onayla ve kaydet',
      cancelButtonText: 'İptal',
      reverseButtons: true,
      confirmButtonColor: '#123f61',
      cancelButtonColor: '#64748b',
    });
    if (!result.isConfirmed) return;
    setBusy(true); setError('');
    try {
      const response = await api.post<Result>(`/admin/students/import/${preview.id}/confirm`, { confirm: true }, { timeout: 600000 });
      setResult(response.data); await Promise.all(['student-references', 'comparison', 'report', 'application'].map(key => cache.invalidateQueries({ queryKey: [key] })));
      toast.success('Aktarım tamamlandı.');
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  const filtered = preview?.rows.filter(r => !errorsOnly || r.errors.length) ?? [];
  return <><div className="mb-7"><p className="mb-2 text-xs font-semibold tracking-widest text-teal">ÖĞRENCİ YÖNETİMİ</p><h1 className="text-3xl font-semibold text-primary">Veri seti aktarımı</h1><p className="mt-3 text-sm leading-6 text-slate-500">Karşılaştırma için referans verilerini yükleyin. Öğrenci hesapları ve şifreleri bu işlemden bağımsızdır.</p></div>
    <section className="panel"><div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">1. Dosya seçimi</h2><p className="mt-2 text-sm text-slate-500">CSV (UTF-8) veya XLSX · En fazla 5 MB ve 500 veri satırı · Tek sayfa</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><a href="/samples/students.csv" download><Download size={15}/>Örnek CSV</a></Button><Button asChild variant="outline" size="sm"><a href="/samples/students.xlsx" download><Download size={15}/>Örnek Excel</a></Button></div></div>
      <form onSubmit={upload} className="flex flex-wrap items-end gap-4"><label className="min-w-0 flex-1 text-sm font-medium">Öğrenci veri dosyası<input ref={input} type="file" accept=".csv,.xlsx" required disabled={busy} onChange={e => { setFile(e.target.files?.[0]); setPreview(undefined); setResult(undefined); setError(''); }} className="mt-2 block w-full rounded-lg border border-dashed border-slate-300 p-4 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2"/></label><Button type="submit" disabled={!file || busy}><Upload size={16}/>{busy ? 'İşleniyor…' : 'Önizlemeyi oluştur'}</Button></form>
      <details className="mt-5 text-sm text-slate-500"><summary className="cursor-pointer font-medium">Sütunlar ve dosya kuralları</summary><p className="mt-3 leading-6">Türkçe başlıklar kabul edilir: öğrenci ad soyad, TC kimlik no, uyruk, öğrenci no, doğum tarihi, ikametgâh adresi (açık adres), öğrencinin okuduğu bölüm, öğrencinin Ek-16’yı teslim ettiği yıl, daha önce yapılan staj gün sayısı, e-posta, telefon no ve sağlık yardımı statüsü.</p><p className="mt-2">Öğrenci ve kimlik numaralarını Excel’de metin olarak saklayın. Tarihler YYYY-AA-GG, öğretim yılı 2026-2027 biçiminde olmalı. Sağlık statüsü 1–6 arasıdır. Formül ve bağlantılı Excel hücreleri kabul edilmez.</p></details>
    </section>
    {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger">{error}</p>}
    {busy && <p role="status" className="mt-5 text-sm text-slate-500">Referans verileri işleniyor. Sonucu kontrol etmek için sayfayı açık tutun.</p>}
    {preview && !result && <section className="panel mt-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">2. Önizleme ve kontrol</h2><p className="mt-2 break-all text-sm text-slate-500">{preview.filename}</p><p className="mt-2 text-xs text-slate-400">Önizleme son geçerlilik: {new Date(preview.expiresAt).toLocaleString('tr-TR')}</p></div><div className="flex gap-3 text-sm"><span className="rounded-lg bg-success/10 px-3 py-2 text-success">{preview.valid} geçerli</span><span className="rounded-lg bg-red-50 px-3 py-2 text-danger">{preview.invalid} hatalı</span></div></div>
      <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={errorsOnly} onChange={e => { setErrorsOnly(e.target.checked); setPage(1); }}/>Yalnızca hatalı satırları göster</label>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr>{['Satır', 'Öğrenci no', 'Ad soyad', 'E-posta', 'Kontrol sonucu', 'Tüm alanlar'].map(s => <th key={s} className="px-3 py-3 font-medium">{s}</th>)}</tr></thead><tbody>{filtered.slice((page - 1) * 10, page * 10).map(row => <tr key={row.line} className="border-b border-slate-100 align-top"><td className="px-3 py-4">{row.line}</td><td className="px-3 py-4">{row.data.studentNumber}</td><td className="px-3 py-4">{row.data.name}</td><td className="px-3 py-4">{row.data.email}</td><td className="min-w-52 px-3 py-4">{row.errors.length ? <ul className="space-y-1 text-xs text-danger">{row.errors.map((e, i) => <li key={i}>{e}</li>)}</ul> : <span className="text-success">Kayda uygun</span>}</td><td className="min-w-52 px-3 py-4"><details><summary className="cursor-pointer text-teal">Alanları göster</summary><dl className="mt-3 space-y-2 text-xs">{Object.entries(row.data).map(([k, v]) => <div key={k}><dt className="text-slate-500">{labels[k] ?? k}</dt><dd className="mt-1 break-words">{v}</dd></div>)}</dl></details></td></tr>)}</tbody></table></div>
      {!filtered.length && <p className="py-8 text-center text-sm text-slate-500">Gösterilecek satır yok.</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-500">Sayfa {page} / {Math.max(1, Math.ceil(filtered.length / 10))}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 1 || busy} onClick={() => setPage(p => p - 1)}>Önceki</Button><Button variant="outline" size="sm" disabled={page * 10 >= filtered.length || busy} onClick={() => setPage(p => p + 1)}>Sonraki</Button></div></div>
      <div className="mt-6 border-t border-slate-200 pt-5"><p className="mb-4 text-sm leading-6 text-slate-500">Hatalı satırlar kaydedilmez. Hesap veya parola oluşturulmaz. Aynı öğrenci numarası yeniden yüklenirse eski referans korunur ve yeni sürüm eklenir.</p><Button onClick={confirm} disabled={busy || !preview.valid}><CheckCircle2 size={16}/>{preview.valid} geçerli satırı onayla ve kaydet</Button></div></section>}
    {result && <section className="panel mt-6"><CheckCircle2 className="text-success" size={30}/><h2 className="mt-3 text-xl font-semibold">Aktarım sonucu</h2><p className="mt-3 text-sm">{result.successful} kayıt başarılı · {result.failed} satır atlandı</p>{result.failures.length > 0 && <details className="mt-4 text-sm"><summary className="cursor-pointer text-danger">Atlanan satırların nedenleri</summary><ul className="mt-3 space-y-2">{result.failures.map(f => <li key={f.line}>Satır {f.line}: {f.errors.join(' · ')}</li>)}</ul></details>}{result.alreadyCommitted && <p className="mt-4 text-sm text-slate-500">Bu aktarım daha önce tamamlandı; tekrar kayıt oluşturulmadı.</p>}<Button onClick={() => { setResult(undefined); setPreview(undefined); setFile(undefined); setError(''); if (input.current) input.current.value = ''; }} className="mt-5" variant="outline"><FileSpreadsheet size={16}/>Yeni dosya aktar</Button></section>}
    <ReferenceRecords/>
  </>;
}
