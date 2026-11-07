export function PageLoader() {
  return <div className="page-loader" role="status" aria-live="polite" aria-label="Sayfa yükleniyor">
    <div className="page-loader__logo">
      <span className="page-loader__ring" aria-hidden="true"/>
      <img src="/kou-logo.webp" alt="Kocaeli Üniversitesi" width={104} height={104}/>
    </div>
    <span className="sr-only">Sayfa yükleniyor…</span>
  </div>;
}
