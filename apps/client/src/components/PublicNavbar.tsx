import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../pages/Auth';

export function PublicNavbar() {
  const { user } = useAuth();
  const destination = user ? (user.role === 'ROLE_ADMIN' ? '/admin' : '/student') : '/login';
  return <header className="landing-header">
    <Link to="/" className="flex items-center gap-3" aria-label="Kocaeli Üniversitesi ana sayfa">
      <img src="/kou-logo.webp" width={48} height={48} alt="Kocaeli Üniversitesi logosu"/>
      <span className="text-xs leading-5"><strong className="block tracking-wide">KOCAELİ ÜNİVERSİTESİ</strong><span className="text-slate-500">Staj Yönetim Sistemi</span></span>
    </Link>
    <nav aria-label="Ana sayfa menüsü" className="flex items-center gap-7">
      <Link to="/#nasil-calisir" className="hidden text-sm text-slate-600 sm:block">Nasıl çalışır?</Link>
      <Link to={destination} className="landing-nav-button">{user ? 'Panelime git' : 'Giriş yap'}<ArrowRight size={16}/></Link>
    </nav>
  </header>;
}
