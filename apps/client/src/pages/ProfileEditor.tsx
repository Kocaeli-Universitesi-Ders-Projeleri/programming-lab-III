import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { studentProfileSchema, type StudentProfileInput } from '@kou/shared';
import { toast } from 'sonner';
import { api } from '../services/api';
import { Button } from '../components/ui/button';

const fields = [ ['department', 'Bölüm', 'text'], ['nationality', 'Uyruk', 'text'], ['phone', 'Telefon', 'tel'], ['academicYear', 'Öğretim yılı', 'text'], ['identityNumber', 'TC / yabancı kimlik numarası', 'text'], ['birthDate', 'Doğum tarihi', 'date'], ['address', 'İkametgâh adresi', 'text'], ['previousInternshipDays', 'Önceden yapılan staj günü', 'number'], ['healthStatus', 'Sağlık yardımı statüsü (1–6)', 'number'] ] as const;
export function ProfileEditor({ profile, complete }: { profile: Partial<StudentProfileInput>; complete?: boolean }) {
  const [editing, setEditing] = useState(false), [error, setError] = useState('');
  const cache = useQueryClient();
  const values = Object.fromEntries(fields.filter(([key]) => profile[key] !== undefined).map(([key]) => [key, profile[key]]));
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<StudentProfileInput>({ resolver: zodResolver(studentProfileSchema), defaultValues: values });
  async function submit(data: StudentProfileInput) {
    setError('');
    try {
      await api.patch('/students/me', data);
      await Promise.all([cache.invalidateQueries({ queryKey: ['student-profile'] }), cache.invalidateQueries({ queryKey: ['dashboard'] }), cache.invalidateQueries({ queryKey: ['application-form'] })]);
      toast.success('Profil bilgileriniz kaydedildi.'); setEditing(false);
    } catch (error) { setError((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Profil kaydedilemedi. Lütfen tekrar deneyin.'); }
  }
  return <div className="mt-8 border-t border-slate-100 pt-5">{!complete && <p className="mb-4 text-sm leading-6 text-slate-500">Eksik profil bilgilerinizi tamamlayabilirsiniz. Hesap ve öğrenci numaranız bu formdan değiştirilemez.</p>}<Button variant="outline" onClick={() => setEditing(value => !value)} disabled={isSubmitting}>{editing ? 'Düzenlemeyi kapat' : 'Profil bilgilerimi düzenle'}</Button>{editing && <form onSubmit={handleSubmit(submit)} noValidate className="mt-5"><div className="grid gap-5 sm:grid-cols-2">{fields.map(([key, label, type]) => <label key={key} className="text-sm">{label}<input aria-label={label} type={type} placeholder={key === 'academicYear' ? '2026-2027' : undefined} {...register(key, type === 'number' ? { valueAsNumber: true } : {})} maxLength={500} className="mt-2 block w-full rounded-lg border border-slate-300 p-3" aria-invalid={Boolean(errors[key])}/>{key === 'academicYear' && <span className="mt-1 block text-xs text-slate-500">Örnek: 2026-2027</span>}{errors[key] && <span className="mt-1 block text-xs text-danger">{errors[key]?.message}</span>}</label>)}</div>{error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}<Button className="mt-5" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor…' : 'Profilimi kaydet'}</Button></form>}</div>;
}
