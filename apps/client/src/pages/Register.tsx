import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registrationSchema, type RegistrationInput } from '@kou/shared';
import { toast } from 'sonner';
import { useAuth } from './Auth';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { PublicNavbar } from '../components/PublicNavbar';

export function Register() {
  const { user } = useAuth(), navigate = useNavigate();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegistrationInput>({ resolver: zodResolver(registrationSchema) });
  if (user) return <Navigate to={user.role === 'ROLE_ADMIN' ? '/admin' : '/student'} replace/>;
  async function submit(data: RegistrationInput) {
    setError('');
    try { await api.post('/auth/register', data, { timeout: 30000 }); toast.success('Hesabınız oluşturuldu. Giriş yapabilirsiniz.'); navigate('/login', { replace: true }); }
    catch (error) { setError((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Kayıt tamamlanamadı. Bağlantınızı kontrol edin; tekrar göndermeden önce giriş yapmayı deneyin.'); }
  }
  return <><PublicNavbar/><main className="flex min-h-[85dvh] items-center justify-center bg-background px-5 py-8"><div className="panel w-full max-w-md"><Link to="/" aria-label="Ana sayfa"><img src="/kou-logo.webp" alt="Kocaeli Üniversitesi" className="mx-auto h-16 w-16"/></Link><h1 className="mt-5 text-center text-2xl font-semibold text-primary">Öğrenci hesabı oluştur</h1><p className="mt-2 text-center text-sm text-slate-500">Referans veri setinde kayıtlı olmanız gerekmez.</p><form onSubmit={handleSubmit(submit)} noValidate className="mt-7 space-y-4">{([
    ['name', 'Ad soyad', 'text', 'name'], ['studentNumber', 'Öğrenci numarası', 'text', 'off'], ['email', 'E-posta', 'email', 'email'], ['password', 'Şifre', 'password', 'new-password'], ['confirmPassword', 'Şifre tekrarı', 'password', 'new-password'],
  ] as const).map(([key, label, type, autoComplete]) => <label key={key} className="block text-sm font-medium">{label}<input aria-label={label} type={type} autoComplete={autoComplete} {...register(key)} maxLength={key === 'email' ? 254 : key === 'name' ? 150 : key === 'studentNumber' ? 30 : 72} className="mt-2 block w-full rounded-lg border border-slate-300 p-3 focus:outline-teal" aria-invalid={Boolean(errors[key])}/>{errors[key] && <span className="mt-1 block text-xs text-danger">{errors[key]?.message}</span>}</label>)}<p className="text-xs leading-5 text-slate-500">Şifreniz en az 12 karakter olmalı. Diğer profil bilgilerinizi girişten sonra tamamlayabilirsiniz.</p>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-danger">{error}</p>}<Button disabled={isSubmitting} className="w-full">{isSubmitting ? 'Hesap oluşturuluyor…' : 'Hesap oluştur'}</Button></form><p className="mt-5 text-center text-sm text-slate-500">Hesabınız var mı? <Link to="/login" className="font-medium text-teal">Giriş yap</Link></p></div></main></>;
}
