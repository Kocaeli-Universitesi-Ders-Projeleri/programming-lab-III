import { ArrowDown, ArrowRight, Check, CheckCheck, FileCheck2, FileText, GraduationCap, ShieldCheck, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from './Auth';

const steps = [
  { icon: Upload, title: 'Belgeni yükle', text: 'Ek-16 belgeni ekle, başvuru bilgilerini doldur ve süreci başlat.' },
  { icon: FileCheck2, title: 'Sonuçları incele', text: 'Bilgi ve tarih kontrollerini gör. Eksik alanları rapor üzerinden takip et.' },
  { icon: CheckCheck, title: 'Onayını takip et', text: 'Komisyon incelemesinden tamamlanan belgene kadar her adımı panelinden izle.' },
];
export function Landing() {
  const { user } = useAuth();
  const destination = user ? user.role === 'ROLE_ADMIN' ? '/admin' : '/student' : '/login';
  return <div className="landing">
    <header className="landing-header">
      <Link to="/" className="flex items-center gap-3" aria-label="Kocaeli Üniversitesi ana sayfa"><img src="/kou-logo.webp" width={48} height={48} alt="Kocaeli Üniversitesi logosu"/><span className="text-xs leading-5"><strong className="block tracking-wide">KOCAELİ ÜNİVERSİTESİ</strong><span className="text-slate-500">Staj Yönetim Sistemi</span></span></Link>
      <nav aria-label="Ana sayfa menüsü" className="flex items-center gap-7"><a href="#nasil-calisir" className="hidden text-sm text-slate-600 sm:block">Nasıl çalışır?</a><Link to={destination} className="landing-nav-button">{user ? 'Panelime git' : 'Giriş yap'}<ArrowRight size={16}/></Link></nav>
    </header>
    <main>
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-copy">
            <p className="landing-eyebrow"><span/> ÖĞRENCİDEN KOMİSYONA, TEK PLATFORM</p>
            <h1>Stajına odaklan.<br/>Evraklarını <em>kolayca yönet.</em></h1>
            <p className="landing-description">Başvurunu oluştur, Ek-16 belgeni yükle ve inceleme sürecini takip et. Staj yolculuğunun her adımı tek bir yerde.</p>
            <div className="mt-9 flex flex-wrap items-center gap-5"><Link to={destination} className="landing-primary">{user ? 'Çalışma alanıma git' : 'Sisteme giriş yap'}<ArrowRight size={18}/></Link><a href="#nasil-calisir" className="flex items-center gap-2 text-sm text-slate-300">Süreci keşfet<ArrowDown size={15}/></a></div>
            <div className="landing-trust"><ShieldCheck size={17}/><span>Kişisel çalışma alanı</span><span className="landing-trust-dot"/><span>Öğrenci & staj komisyonu</span></div>
          </div>
          <div className="landing-visual" aria-label="Başvuru sürecinin temsili görünümü">
            <div className="landing-orbit" aria-hidden="true"/>
            <div className="landing-document">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5"><img src="/kou-logo.webp" width={44} height={44} alt=""/><span className="text-[10px] font-semibold tracking-[.18em] text-slate-400">STAJ BAŞVURUSU</span></div>
              <div className="mt-6 flex items-start gap-3"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><FileText size={25}/></div><div><p className="text-lg font-semibold text-primary">Ek-16 Belgesi</p><p className="mt-1 text-xs text-slate-400">Başvuru ve inceleme süreci</p></div></div>
              <div className="mt-7 space-y-4">{['Başvuru bilgileri', 'Belge kontrolleri', 'Komisyon incelemesi'].map((label, i) => <div key={label} className="flex items-center gap-3 text-sm text-slate-600"><span className={`flex h-6 w-6 items-center justify-center rounded-full ${i < 2 ? 'bg-emerald-50 text-emerald-600' : 'border border-slate-200 text-slate-400'}`}>{i < 2 ? <Check size={13}/> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300"/>}</span>{label}</div>)}</div>
              <div className="mt-7 rounded-lg bg-slate-50 p-3"><div className="flex justify-between text-[10px] text-slate-500"><span>Başvurudan onaya</span><span>Adım adım takip</span></div><div className="mt-3 h-1.5 rounded-full bg-slate-200"><div className="h-full w-2/3 rounded-full bg-emerald-500"/></div></div>
              <p className="mt-4 text-center text-[10px] text-slate-400">Temsili süreç görünümü</p>
            </div>
            <div className="landing-floating"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><GraduationCap size={21}/></span><div><p className="text-xs font-semibold text-primary">Bir sonraki adımın hazır.</p><p className="mt-1 text-[11px] text-slate-500">Staj yolculuğun burada başlar.</p></div></div>
          </div>
        </div>
        <div className="landing-hero-bottom"><span>KOCAELİ ÜNİVERSİTESİ</span><span>STAJ EVRAK DOĞRULAMA VE YÖNETİMİ</span></div>
      </section>
      <section id="nasil-calisir" className="landing-steps">
        <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold tracking-[.18em] text-teal">SÜREÇ NASIL İŞLER?</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-primary md:text-4xl">Üç adımda daha düzenli bir süreç.</h2></div><p className="max-w-xs text-sm leading-6 text-slate-500">Evraklarını, kontrol sonuçlarını ve başvuru durumunu aynı yerden takip et.</p></div>
        <div className="landing-step-grid">{steps.map(({ icon: Icon, title, text }, i) => <article key={title} className="landing-step"><div className="flex items-center justify-between"><Icon size={25} className="text-teal"/><span className="text-sm text-slate-300">0{i + 1}</span></div><h3 className="mt-7 text-xl font-semibold text-primary">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-500">{text}</p></article>)}</div>
        <div className="landing-commission"><div><p className="text-xs font-semibold tracking-wider text-teal">STAJ KOMİSYONU İÇİN</p><h2 className="mt-2 text-xl font-semibold text-primary">Başvurular bir arada. İnceleme daha düzenli.</h2><p className="mt-2 text-sm leading-6 text-slate-500">Öğrenci kayıtlarını yönetin, belgeleri inceleyin ve onay sürecini takip edin.</p></div><Link to={destination} className="flex shrink-0 items-center gap-3 text-sm font-semibold text-primary">{user ? 'Panelime git' : 'Komisyon girişi'}<ArrowRight size={18}/></Link></div>
      </section>
    </main>
  </div>;
}
