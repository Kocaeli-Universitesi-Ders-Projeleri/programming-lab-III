import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ChevronRight, ClipboardList, FileCheck2, LayoutDashboard, Menu, Upload, UserRound, Users, X } from 'lucide-react';
import { Login, Protected, AccountMenu, useAuth } from './Auth';
import { Landing } from './Landing';
import { PageLoader } from '../components/PageLoader';
import { PrivacyPage } from '../components/Privacy';
const Dashboard = lazy(() => import('./Panels').then(m => ({ default: m.Dashboard })));
const StudentProfilePage = lazy(() => import('./Panels').then(m => ({ default: m.StudentProfilePage })));
const Students = lazy(() => import('./Panels').then(m => ({ default: m.Students })));
const ApplicationFormPage = lazy(() => import('./ApplicationForm').then(m => ({ default: m.ApplicationFormPage })));
const ApplicationList = lazy(() => import('./ApplicationViews').then(m => ({ default: m.ApplicationList })));
const ApplicationDetail = lazy(() => import('./ApplicationViews').then(m => ({ default: m.ApplicationDetail })));
const ImportPage = lazy(() => import('./ImportPage').then(m => ({ default: m.ImportPage })));
export function App() {
  return <Suspense fallback={<PageLoader/>}><Routes><Route path="/" element={<Landing/>}/><Route path="/privacy" element={<PrivacyPage/>}/><Route path="/cookies" element={<PrivacyPage cookies/>}/><Route path="/login" element={<main className="flex min-h-[85dvh] items-center justify-center bg-background px-5 py-8"><Login/></main>}/><Route path="*" element={<Protected><PanelLayout/></Protected>}/></Routes></Suspense>;
}
function PanelLayout() {
  const { user } = useAuth();
  const admin = user?.role === 'ROLE_ADMIN';
  const base = admin ? '/admin' : '/student';
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => { if (!open) return; const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, [open]);
  const links = [
    { to: base, icon: LayoutDashboard, name: 'Genel bakış' },
    ...(admin ? [{ to: '/admin/students', icon: Users, name: 'Öğrenci yönetimi' }] : [{ to: '/student/profile', icon: UserRound, name: 'Öğrenci bilgilerim' }]),
    { to: base + '/applications', icon: ClipboardList, name: admin ? 'Başvuru yönetimi' : 'Başvurularım' },
    { to: base + '/completed', icon: FileCheck2, name: 'Tamamlanan belgeler' },
    { to: base + (admin ? '/import' : '/upload'), icon: Upload, name: admin ? 'Veri seti aktarımı' : 'Ek-16 evrak yükle' },
  ];
  const current = links.find(l => l.to === location.pathname)?.name ?? 'Çalışma alanı';
  const guard = (role: 'ROLE_ADMIN' | 'ROLE_STUDENT', child: ReactNode) => <Protected role={role}>{child}</Protected>;
  return <div className="min-h-dvh">
    {open && <button aria-label="Menüyü kapat" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-slate-950/50 md:hidden"/>}
    <aside id="panel-menu" className={`sidebar overflow-y-auto ${open ? 'is-open' : ''}`}>
      <Link to={base} className="flex items-center gap-3 border-b border-white/10 px-5 py-7"><img src="/kou-logo.webp" alt="Kocaeli Üniversitesi logosu" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full bg-white"/><span><span className="block text-xs font-semibold tracking-wide">KOCAELİ ÜNİVERSİTESİ</span><span className="mt-1 block text-xs text-slate-300">Staj Yönetim Sistemi</span></span></Link>
      <div className="flex items-center justify-between px-6 pt-7"><span className="text-[10px] tracking-[.2em] text-slate-400">{admin ? 'STAJ KOMİSYONU' : 'ÖĞRENCİ ÇALIŞMA ALANI'}</span><button className="md:hidden" onClick={() => setOpen(false)} aria-label="Menüyü kapat"><X size={18}/></button></div>
      <nav className="mt-4 space-y-1 px-3 pb-5" aria-label="Panel menüsü">{links.map(item => <NavLink key={item.to} to={item.to} end className={({ isActive }) => `flex items-center gap-3 rounded-lg border-l-2 px-4 py-3 text-sm ${isActive ? 'border-teal bg-white/10 text-white' : 'border-transparent text-slate-300 hover:bg-white/5'}`}><item.icon size={18}/>{item.name}</NavLink>)}</nav>
    </aside>
    <div className="md:ml-72"><header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 md:px-8"><div className="flex items-center gap-3"><button onClick={() => setOpen(true)} aria-label="Menüyü aç" aria-expanded={open} aria-controls="panel-menu" className="md:hidden"><Menu/></button><span className="hidden text-sm text-slate-500 lg:inline">{admin ? 'Yönetici paneli' : 'Öğrenci paneli'}<ChevronRight size={14} className="mx-2 inline"/></span><span className="text-sm font-medium">{current}</span></div><AccountMenu/></header>
      <main className="mx-auto max-w-7xl p-5 md:p-8"><Routes>
        <Route path="/admin" element={guard('ROLE_ADMIN', <Dashboard admin/>)}/><Route path="/student" element={guard('ROLE_STUDENT', <Dashboard/>)}/>
        <Route path="/student/profile" element={guard('ROLE_STUDENT', <StudentProfilePage/>)}/><Route path="/admin/students" element={guard('ROLE_ADMIN', <Students/>)}/>
        <Route path="/student/applications" element={guard('ROLE_STUDENT', <ApplicationList/>)}/><Route path="/admin/applications" element={guard('ROLE_ADMIN', <ApplicationList admin/>)}/>
        <Route path="/student/completed" element={guard('ROLE_STUDENT', <ApplicationList completed/>)}/><Route path="/admin/completed" element={guard('ROLE_ADMIN', <ApplicationList admin completed/>)}/>
        <Route path="/student/upload" element={guard('ROLE_STUDENT', <ApplicationFormPage/>)}/><Route path="/admin/import" element={guard('ROLE_ADMIN', <ImportPage/>)}/>
        <Route path="/student/applications/:id/edit" element={guard('ROLE_STUDENT', <ApplicationFormPage/>)}/>
        <Route path="/student/applications/:id" element={guard('ROLE_STUDENT', <ApplicationDetail/>)}/><Route path="/admin/applications/:id" element={guard('ROLE_ADMIN', <ApplicationDetail/>)}/>
        <Route path="*" element={<div className="panel"><h1 className="text-xl font-semibold">Sayfa bulunamadı</h1><Link to={base} className="mt-4 block text-teal">Panelime dön</Link></div>}/>
      </Routes></main>
    </div>
  </div>;
}
