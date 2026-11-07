import { Component, type ReactNode } from 'react';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="mx-auto min-h-[70dvh] max-w-lg px-5 py-16"><h1 className="text-2xl font-semibold text-primary">Sayfa görüntülenemedi</h1><p className="mt-4 text-sm leading-6 text-slate-500">Beklenmeyen bir görüntüleme sorunu oluştu. Sayfayı yeniden yükleyebilir veya giriş ekranına dönebilirsiniz.</p><div className="mt-5 flex gap-3"><button className="rounded-lg bg-primary px-4 py-3 text-sm text-white" onClick={() => window.location.reload()}>Sayfayı yenile</button><a className="rounded-lg border border-slate-300 px-4 py-3 text-sm" href="/login">Giriş ekranı</a></div></main> : this.props.children; }
}
