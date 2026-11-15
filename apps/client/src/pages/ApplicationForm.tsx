import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { applicationSchema, countInternshipDays, todayInTurkey, type ApplicationInput } from '@kou/shared';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import type { DocumentExtractionResponse } from '@kou/shared';
import { ExtractionResultView } from './ExtractionView';
import { confirmAction } from '../components/confirm';
type Field = { key: keyof ApplicationInput; label: string; type?: 'number' | 'date' | 'email'; optional?: boolean };
const groups: { title: string; fields: Field[] }[] = [
  { title: 'Öğrenci bilgileri', fields: [{ key: 'name', label: 'Ad soyad' }, { key: 'studentNumber', label: 'Öğrenci numarası' }, { key: 'identityNumber', label: 'TC / yabancı kimlik numarası' }, { key: 'nationality', label: 'Uyruk' }, { key: 'department', label: 'Bölüm' }, { key: 'birthDate', label: 'Doğum tarihi', type: 'date' }, { key: 'academicYear', label: 'Öğretim yılı (2026-2027)' }, { key: 'previousInternshipDays', label: 'Önceki staj günü', type: 'number' }, { key: 'email', label: 'E-posta', type: 'email' }, { key: 'phone', label: 'Telefon (+90)' }, { key: 'address', label: 'İkametgâh adresi' }, { key: 'healthStatus', label: 'Sağlık yardımı statüsü (1–6)', type: 'number' }] },
  { title: 'İkametgâh adresi bileşenleri', fields: [{ key: 'neighborhood', label: 'İkametgâh mahallesi' }, { key: 'street', label: 'İkametgâh cadde / sokak' }, { key: 'buildingNumber', label: 'İkametgâh bina numarası' }, { key: 'apartmentNumber', label: 'İkametgâh daire numarası (yoksa Müstakil)' }, { key: 'district', label: 'İkametgâh ilçesi' }, { key: 'city', label: 'İkametgâh ili' }] },
  { title: 'İşyeri bilgileri', fields: [{ key: 'companyName', label: 'İşyeri adı' }, { key: 'serviceArea', label: 'Hizmet alanı' }, { key: 'companyPhone', label: 'İşyeri telefonu' }, { key: 'fax', label: 'Faks', optional: true }, { key: 'companyEmail', label: 'İşyeri e-postası', type: 'email' }, { key: 'website', label: 'Web adresi (https://)', optional: true }, { key: 'employeeCount', label: 'Çalışan sayısı', type: 'number' }, { key: 'engineerCount', label: 'Mühendis sayısı', type: 'number' }, { key: 'engineerDepartments', label: 'Mühendislerin mezun olduğu bölümler (1–4 mühendis varsa)', optional: true }, { key: 'companyAddress', label: 'İşyeri adresi' }] },
  { title: 'İşyeri adresi bileşenleri', fields: [{ key: 'companyNeighborhood', label: 'İşyeri mahallesi' }, { key: 'companyStreet', label: 'İşyeri cadde / sokak' }, { key: 'companyBuildingNumber', label: 'İşyeri bina numarası' }, { key: 'companyApartmentNumber', label: 'İşyeri daire numarası (yoksa Müstakil)' }, { key: 'companyDistrict', label: 'İşyeri ilçesi / bölgesi' }, { key: 'companyCity', label: 'İşyeri ili / şehri' }] },
  { title: 'İşveren / yetkili bilgileri', fields: [{ key: 'employerName', label: 'Yetkili ad soyad' }, { key: 'employerTitle', label: 'Görev / unvan' }, { key: 'employerEmail', label: 'Yetkili e-postası', type: 'email' }, { key: 'employerPhone', label: 'Yetkili telefonu' }] },
];
export function ApplicationFormPage({ admin = false }: { admin?: boolean } = {}) {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['application-form', id, admin], queryFn: async () => {
    if (admin) {
      const [previous, config] = await Promise.all([api.get('/applications/' + id), api.get('/applications/calendar')]);
      return { student: { user: { name: previous.data.data.name, email: previous.data.data.email }, profile: {} }, config: config.data, previous: previous.data };
    }
    const [student, config, previous] = await Promise.all([api.get('/students/me'), api.get('/applications/calendar'), id ? api.get('/applications/' + id) : Promise.resolve(null)]);
    return { student: student.data, config: config.data, previous: previous?.data };
  } });
  if (q.isPending) return <div role="status" className="h-64 animate-pulse rounded-xl bg-slate-200"><span className="sr-only">Form yükleniyor</span></div>;
  if (q.isError) return <div className="panel" role="alert"><p>Başvuru formu alınamadı.</p><Button onClick={() => void q.refetch()} className="mt-4">Tekrar dene</Button></div>;
  if (!admin && id && q.data.previous.status !== 'INVALID') return <div className="panel" role="alert">Yalnızca hatalı/eksik başvuru yeniden yüklenebilir.</div>;
  return <ApplicationForm initial={q.data} id={id} admin={admin}/>;
}
function ApplicationForm({ initial, id, admin = false }: { initial: { student: { user: { name: string; email: string }; profile: Record<string, unknown> }; config: { maxDocumentMB: number }; previous?: { data: ApplicationInput; version?: number } }; id?: string; admin?: boolean }) {
  const [file, setFile] = useState<File>(); const [preview, setPreview] = useState(''); const [message, setMessage] = useState('');
  const [reading, setReading] = useState(false), [extraction, setExtraction] = useState<DocumentExtractionResponse>();
  const [reason, setReason] = useState('');
  const navigate = useNavigate(), cache = useQueryClient();
  const defaults: ApplicationInput = { name: '', studentNumber: '', identityNumber: '', nationality: '', department: '', birthDate: '', academicYear: '', semester: 'Yaz', previousInternshipDays: 0, email: '', phone: '', address: '', healthStatus: 1, startDate: '', endDate: '', submissionDate: todayInTurkey(), workingDays: [1, 2, 3, 4, 5], declaredDays: 20, companyName: '', abroad: false, serviceArea: '', companyPhone: '', fax: '', companyEmail: '', website: '', employeeCount: 1, engineerCount: 1, engineerDepartments: '', paid: false, companyAddress: '', employerName: '', employerTitle: '', employerEmail: '', employerPhone: '' };
  const profile = initial.student.profile;
  const prefill = Object.fromEntries(Object.keys(defaults).filter(k => profile[k] !== undefined && profile[k] !== null).map(k => [k, profile[k]]));
  const { register, handleSubmit, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm<ApplicationInput>({ resolver: zodResolver(applicationSchema), defaultValues: { ...defaults, name: initial.student.user.name, email: initial.student.user.email, ...prefill, ...initial.previous?.data, submissionDate: admin ? initial.previous?.data.submissionDate ?? todayInTurkey() : todayInTurkey() } });
  const engineerCount = watch('engineerCount');
  const workingDays = watch('workingDays'), start = watch('startDate'), end = watch('endDate');
  const count = countInternshipDays(start, end, workingDays);
  useEffect(() => { setExtraction(undefined); }, [file]);
  async function readDocument() {
    if (!file || reading) return;
    setReading(true); setMessage(''); setExtraction(undefined);
    try { const body = new FormData(); body.append('file', file); setExtraction((await api.post<DocumentExtractionResponse>('/applications/extract', body, { timeout: 60000 })).data); }
    catch (error) { setMessage((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Belge okunamadı. Manuel alanları doldurabilirsiniz.'); }
    finally { setReading(false); }
  }
  async function useExtractedValues() {
    if (!extraction || !await confirmAction('Okunan değerleri aktar?', 'Okunabilen değerler formdaki ilgili alanların yerine yazılacak. Orijinal belge okuma sonucu değişmeyecek.')) return;
    const numbers = ['previousInternshipDays', 'healthStatus', 'declaredDays', 'employeeCount', 'engineerCount'];
    for (const field of extraction.extractedFields) {
      if (field.extractionStatus !== 'EXTRACTED' || field.normalizedValue === null || !(field.fieldName in defaults)) continue;
      const value = numbers.includes(field.fieldName) ? Number(field.normalizedValue) : ['abroad', 'paid'].includes(field.fieldName) ? field.normalizedValue === 'true' : field.normalizedValue;
      setValue(field.fieldName as keyof ApplicationInput, value, { shouldDirty: true, shouldValidate: true });
    }
  }
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  async function submit(data: ApplicationInput) {
    setMessage('');
    if (!file && !admin) { setMessage('Ek-16 belgesi seçin.'); return; }
    if (file && file.size > initial.config.maxDocumentMB * 1024 * 1024) { setMessage(`Dosya en fazla ${initial.config.maxDocumentMB} MB olabilir.`); return; }
    if (admin && reason.trim().length < 10) { setMessage('En az 10 karakter güncelleme gerekçesi girin.'); return; }
    if (id && !await confirmAction('Başvuruyu güncelle?', admin ? 'Başvuru yeni sürümle güncellenecek, yeniden incelemeye alınacak ve eski onay geçersiz olacak.' : 'Bu başvurunun formu ve belgesi yeni sürümle değiştirilecek.', 'Kaydet ve gönder')) return;
    const body = new FormData(); body.append('data', JSON.stringify(data)); if (file) body.append('file', file);
    if (admin) { body.append('reason', reason); body.append('version', String(initial.previous?.version ?? 0)); }
    try {
      const response = admin ? await api.patch(`/admin/applications/${id}`, body, { timeout: 120000 }) : await api.post(id ? `/applications/${id}/documents` : '/applications', body, { timeout: 120000 });
      await Promise.all([cache.invalidateQueries({ queryKey: ['applications'] }), cache.invalidateQueries({ queryKey: ['dashboard'] }), cache.invalidateQueries({ queryKey: ['application', id] }), cache.invalidateQueries({ queryKey: ['report', id] })]);
      await Promise.all(['comparison', 'extraction', 'application-audit'].map(key => cache.invalidateQueries({ queryKey: [key, id] })));
      toast.success('Başvuru kaydedildi.'); navigate((admin ? '/admin' : '/student') + '/applications/' + response.data.id);
    } catch (e) {
      const error = (e as { response?: { data?: { message?: string; fields?: Record<string, string[]> } } }).response?.data;
      setMessage(error?.message ?? 'Başvuru kaydedilemedi. Bağlantınızı kontrol edin; tekrar göndermeden önce başvurularınızı kontrol edin.');
      if (error?.fields) for (const [field, messages] of Object.entries(error.fields)) setError(field as keyof ApplicationInput, { message: messages[0] });
    }
  }
  const control = 'mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3 text-sm focus:outline-teal disabled:bg-slate-100';
  return <><h1 className="text-3xl font-semibold text-primary">{admin ? 'Komisyon başvuru düzeltmesi' : id ? 'Başvuruyu düzelt ve yeniden yükle' : 'Ek-16 başvurusu'}</h1><p className="mb-7 mt-3 text-sm leading-6 text-slate-500">Belgenizi yükleyin ve doğrulamada kullanılacak bilgileri girin. Desteklenen belgelerde alan okumayı deneyebilir, sonuçları kontrol edip forma aktarabilirsiniz. Belirsiz alanlar için manuel giriş ve komisyon incelemesi gerekir.</p>
    <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
      <section className="panel"><h2 className="font-semibold">Staj tarihleri ve çalışma günleri</h2><div className="mt-5 grid gap-5 sm:grid-cols-3">{([{ key: 'startDate', label: 'Staj başlangıcı' }, { key: 'endDate', label: 'Staj bitişi' }, { key: 'submissionDate', label: 'Evrak teslim tarihi (sistem)' }] as const).map(f => <label key={f.key} className="text-sm">{f.label}<input type="date" readOnly={f.key === 'submissionDate' && !admin} {...register(f.key)} className={control}/>{errors[f.key] && <span className="mt-1 block text-xs text-danger">{errors[f.key]?.message}</span>}</label>)}<label className="text-sm">Yarıyıl<select {...register('semester')} className={control}>{['Güz', 'Bahar', 'Yaz'].map(t => <option key={t}>{t}</option>)}</select></label><label className="text-sm">Beyan edilen staj günü<input type="number" step="0.5" {...register('declaredDays', { valueAsNumber: true })} className={control}/>{errors.declaredDays && <span className="block text-xs text-danger">Pozitif gün sayısı girin.</span>}</label></div>
        <fieldset className="mt-6"><legend className="mb-3 text-sm font-medium">Haftalık çalışma günleri</legend><div className="flex flex-wrap gap-4">{['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'].map((day, i) => <label key={day} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={workingDays.includes(i)} onChange={e => setValue('workingDays', e.target.checked ? [...workingDays, i] : workingDays.filter(d => d !== i), { shouldValidate: true })}/>{day}</label>)}</div>{errors.workingDays && <p className="mt-2 text-xs text-danger">En az bir gün seçin.</p>}</fieldset><div role="status" className="mt-5 rounded-lg bg-teal/10 p-4 text-sm text-primary"><strong>Hesaplanan gün: {count.days ?? '—'}</strong><p className="mt-2">{count.message} {count.days !== null && `Düşülen tatil: ${count.excluded} gün.`}</p>{count.missingYears.length > 0 && <p className="mt-2 text-danger">Eksik takvim: {count.missingYears.join(', ')}</p>}</div></section>
      {groups.map(group => <section key={group.title} className="panel"><h2 className="font-semibold">{group.title}</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">{group.fields.map(f => <label key={f.key} className="text-sm">{f.label}{f.optional && !(f.key === 'engineerDepartments' && engineerCount >= 1 && engineerCount <= 4) && <span className="text-slate-400"> · isteğe bağlı</span>}<input type={f.type ?? 'text'} maxLength={500} {...register(f.key, f.type === 'number' ? { valueAsNumber: true } : {})} className={control} aria-invalid={Boolean(errors[f.key])}/>{errors[f.key] && <span className="mt-1 block text-xs text-danger">{String(errors[f.key]?.message ?? 'Bu alanı kontrol edin.')}</span>}</label>)}</div>{group.title === 'İşyeri bilgileri' && <div className="mt-6 flex flex-wrap gap-6"><label className="flex gap-2 text-sm"><input type="checkbox" {...register('abroad')}/>Yurt dışında staj</label><label className="flex gap-2 text-sm"><input type="checkbox" {...register('paid')}/>Ücret alıyorum</label><p className="w-full text-xs text-slate-500">Hafta sonu çalışma durumu seçilen çalışma günlerinden belirlenir.</p></div>}</section>)}
      <section className="panel"><h2 className="font-semibold">Ek-16 belgesi</h2><p className="mt-2 text-sm text-slate-500">PDF, DOC, DOCX, JPG, JPEG, PNG · En fazla {initial.config.maxDocumentMB} MB. Makrolu, şifreli veya etkin içerikli belgeler kabul edilmez.</p><input aria-label="Ek-16 belgesi" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" disabled={isSubmitting || reading} onChange={e => setFile(e.target.files?.[0])} className="mt-5 block w-full rounded-lg border border-dashed border-slate-300 p-4 text-sm"/>{file && <p className="mt-3 break-all text-sm">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}{preview && file?.type.startsWith('image/') && <img src={preview} alt="Seçilen belge önizlemesi" className="mt-4 max-h-96 max-w-full rounded-lg border"/>}{preview && file?.type === 'application/pdf' && <iframe sandbox="" title="Seçilen PDF önizlemesi" src={preview} className="mt-4 h-96 w-full rounded-lg border"/>}{file && /\.docx?$/i.test(file.name) && <p className="mt-4 text-sm text-slate-500">Word belgesi tarayıcı içinde görüntülenemez. Kayıt sonrası indirilerek incelenebilir.</p>}</section>
      {file && <section className="panel"><h2 className="font-semibold">Belgeden alan okuma</h2><Button type="button" variant="outline" className="mt-4" onClick={() => void readDocument()} disabled={reading || isSubmitting}>{reading ? 'Belge okunuyor…' : 'Belgeden alanları oku'}</Button>{extraction && <><ExtractionResultView result={extraction} labels={Object.fromEntries(groups.flatMap(group => group.fields.map(field => [field.key, field.label])))}/><Button type="button" variant="outline" className="mt-4" onClick={useExtractedValues} disabled={isSubmitting || reading}>Okunan değerleri forma aktar</Button></>}</section>}
      {admin && <section className="panel"><h2 className="font-semibold">Güncelleme gerekçesi</h2><p className="mt-2 text-sm text-slate-500">Yeni belge seçmek isteğe bağlıdır. Güncelleme başvuruyu yeniden incelemeye alır ve eski onayı geçersiz kılar.</p><label className="mt-4 block text-sm">Komisyon gerekçesi<textarea value={reason} onChange={event => setReason(event.target.value)} minLength={10} maxLength={1000} className="mt-2 block w-full rounded-lg border border-slate-300 p-3"/></label></section>}
      {message && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-danger">{message}</p>}<Button type="submit" disabled={isSubmitting || reading}><Upload size={16}/>{isSubmitting ? 'Kaydediliyor…' : admin ? 'Komisyon düzeltmesini kaydet' : id ? 'Düzeltmeleri ve yeni belgeyi gönder' : 'Başvuruyu ve belgeyi kaydet'}</Button>
    </form></>;
}
