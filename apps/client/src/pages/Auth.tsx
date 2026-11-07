import { PageLoader } from '../components/PageLoader';
import { createContext, useContext, useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
interface User { id: string; name: string; username: string; email: string; role: string }
const AuthContext = createContext<{ user?: User; pending: boolean; failed: boolean }>({ pending: true, failed: false });
export function useAuth() { return useContext(AuthContext); }
export function AuthProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  useEffect(() => {
    const expire = () => { void cache.cancelQueries().then(() => { cache.removeQueries({ predicate: q => q.queryKey[0] !== 'me' }); cache.setQueryData(['me'], null); }); };
    window.addEventListener('kou:session-expired', expire); return () => window.removeEventListener('kou:session-expired', expire);
  }, [cache]);
  const q = useQuery({ queryKey: ['me'], queryFn: async () => {
    try { return (await api.get<{ user: User }>('/auth/me')).data.user; }
    catch (error) { if ((error as { response?: { status: number } }).response?.status === 401) return null; throw error; }
  }, retry: false });
  return <AuthContext.Provider value={{ user: q.data ?? undefined, pending: q.isPending, failed: q.isError }}>{children}</AuthContext.Provider>;
}
function home(user: User) { return user.role === 'ROLE_ADMIN' ? '/admin' : '/student'; }
export function Login() {
  const auth = useContext(AuthContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const cache = useQueryClient();
  if (auth.user) return <Navigate to={home(auth.user)} replace/>;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    const data = new FormData(e.currentTarget);
    try {
      const result = await api.post<{ user: User }>('/auth/login', { identifier: data.get('identifier'), password: data.get('password') }, { timeout: 30000 });
      await cache.cancelQueries();
      cache.removeQueries({ predicate: query => query.queryKey[0] !== 'me' });
      cache.setQueryData(['me'], result.data.user);
      toast.success('Giriş başarılı.'); navigate(home(result.data.user), { replace: true });
    } catch (e) { setError((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.'); }
    finally { setBusy(false); }
  }
  return <div className="w-full max-w-md"><div className="panel"><img src="/kou-logo.webp" alt="Kocaeli Üniversitesi" className="mx-auto h-16 w-16"/><h1 className="mt-5 text-center text-2xl font-semibold text-primary">Staj sistemine giriş</h1><p className="mt-2 text-center text-sm text-slate-500">Kullanıcı adınız veya e-posta adresinizle devam edin.</p><form onSubmit={submit} className="mt-7 space-y-5"><label className="block text-sm font-medium">Kullanıcı adı veya e-posta<input name="identifier" autoComplete="username" required maxLength={254} className="mt-2 block w-full rounded-lg border border-slate-300 p-3 focus:outline-teal"/></label><label className="block text-sm font-medium">Şifre<input name="password" type="password" autoComplete="current-password" required maxLength={128} className="mt-2 block w-full rounded-lg border border-slate-300 p-3 focus:outline-teal"/></label>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-danger">{error}</p>}<Button className="w-full" disabled={busy}>{busy ? 'Giriş yapılıyor…' : 'Giriş yap'}</Button></form><p className="mt-5 text-center text-sm text-slate-500">Hesabınız yok mu? <Link to="/register" className="font-medium text-teal">Öğrenci hesabı oluştur</Link></p><p className="mt-5 text-xs leading-5 text-slate-500">Beş hatalı denemeden sonra hesabınız 15 dakika kilitlenir. Oturum süresi bir saattir.</p></div></div>;
}
export function Protected({ role, children }: { role?: string; children: ReactNode }) {
  const auth = useContext(AuthContext);
  if (auth.pending) return <PageLoader/>;
  if (auth.failed) return <p role="alert">Oturum kontrolü yapılamadı. Sunucu bağlantısını kontrol edip sayfayı yenileyin.</p>;
  if (!auth.user) return <Navigate to="/login" replace/>;
  if (role && auth.user.role !== role) return <div className="panel"><h1 className="text-xl">Erişim yetkiniz bulunmuyor</h1><Link className="mt-4 block text-teal" to={home(auth.user)}>Kendi panelime dön</Link></div>;
  return <>{children}</>;
}
export function AccountMenu() {
  const auth = useContext(AuthContext); const cache = useQueryClient(); const navigate = useNavigate(); const [busy, setBusy] = useState(false);
  if (!auth.user) return <Button asChild size="sm"><Link to="/login">Giriş yap</Link></Button>;
  async function logout() {
    setBusy(true);
    try { await api.post('/auth/logout', {}, { timeout: 30000 }); }
    catch (error) { if ((error as { response?: { status: number } }).response?.status !== 401) { toast.error('Çıkış yapılamadı. Tekrar deneyin.'); setBusy(false); return; } }
    await cache.cancelQueries();
    cache.removeQueries({ predicate: query => query.queryKey[0] !== 'me' });
    cache.setQueryData(['me'], null); navigate('/login'); setBusy(false);
  }
  return <div className="flex items-center gap-3"><Link to={home(auth.user)} className="text-sm font-medium">{auth.user.name}</Link><Button variant="outline" size="sm" onClick={logout} disabled={busy}><LogOut size={15}/>Çıkış</Button></div>;
}
export function RoleHome({ admin = false }: { admin?: boolean }) {
  const auth = useContext(AuthContext);
  const profile = useQuery({ queryKey: ['role-profile', auth.user?.id], queryFn: async () => (await api.get(admin ? '/admin/access' : '/students/me')).data });
  return <div className="panel"><ShieldCheck className="text-teal" size={32}/><h1 className="mt-4 text-2xl font-semibold text-primary">{admin ? 'Yönetici' : 'Öğrenci'} çalışma alanı</h1><p className="mt-3">Hoş geldiniz, {auth.user?.name}.</p><p className="mt-2 text-sm text-slate-500">{auth.user?.email}</p>{profile.isPending ? <p className="mt-5" role="status">Profil yükleniyor…</p> : profile.isError ? <p className="mt-5 text-danger" role="alert">Profil alınamadı. Lütfen tekrar deneyin.</p> : <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm">{admin ? 'Yönetici erişiminiz sunucuda doğrulandı.' : <><p>Öğrenci no: {profile.data.profile.studentNumber}</p><p className="mt-2">Bölüm: {profile.data.profile.department}</p></>}</div>}<p className="mt-6 text-sm leading-6 text-slate-500">Aşama 2 · Oturum ve rol yönetimi hazır. Başvuru işlemleri ve yönetim panelleri sonraki aşamalarda eklenecek.</p></div>;
}
