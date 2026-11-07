import { useState } from 'react';
import type { ApplicationValidationReport, RuleResult } from '@kou/shared';
export function ValidationReportView({ report }: { report: Partial<ApplicationValidationReport> }) {
  const [problemsOnly, setProblemsOnly] = useState(false);
  const results = report.results ?? [];
  const categories = [...new Set(results.map(r => r.category))];
  return <>
    <div className="mt-5 grid gap-3 sm:grid-cols-4">{[['Geçen kontrol', report.summary?.passed ?? 0], ['Hata', report.summary?.errors ?? report.issues?.length ?? 0], ['Uyarı', report.summary?.warnings ?? report.warnings?.length ?? 0], ['Manuel inceleme bekleyen', report.summary?.pending ?? 0]].map(([label, count]) => <div key={label} className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold">{count}</p></div>)}</div>
    <div className="mt-5 space-y-2 text-sm"><p>Hesaplanan staj günü: <strong>{report.calculatedDays ?? 'Kesin hesap yapılamadı'}</strong></p>{report.latestSubmissionDate && <p>En geç uygun teslim tarihi: <strong>{report.latestSubmissionDate}</strong></p>}<p className={report.readyForApproval ? 'text-success' : 'text-slate-500'}>{report.readyForApproval ? 'Otomatik doğrulamalar ve kaydedilmiş manuel kontroller geçti. Başvuru onaya uygun.' : report.automatedPassed ? 'Otomatik doğrulamalar geçti. Onay için manuel kontrollerin tamamlanması gerekiyor.' : 'Otomatik doğrulamalarda hata var. İlgili alanları kontrol edin.'}</p></div>
    {results.length > 0 ? <><label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={problemsOnly} onChange={e => setProblemsOnly(e.target.checked)}/>Yalnızca hata, uyarı ve bekleyen kontroller</label>{categories.map(category => {
      const items = results.filter(r => r.category === category && (!problemsOnly || r.severity !== 'info'));
      if (!items.length) return null;
      return <section key={category} className="mt-5"><h3 className="text-sm font-semibold text-primary">{category}</h3><ul className="mt-3 space-y-3">{items.map((r, i) => <li key={r.ruleCode + i} className={`rounded-lg border p-3 text-sm ${r.severity === 'error' ? 'border-red-200 bg-red-50' : r.severity === 'pending' ? 'border-amber-200 bg-amber-50' : 'border-slate-100'}`}><span className={`mr-2 text-xs font-semibold ${r.severity === 'error' ? 'text-danger' : r.severity === 'pending' || r.severity === 'warning' ? 'text-amber-700' : 'text-success'}`}>{resultLabel(r)}</span>{r.message}{r.suggestion && !r.valid && <p className="mt-2 text-xs leading-5 text-slate-500">Öneri: {r.suggestion}</p>}</li>)}</ul></section>;
    })}</> : <div className="mt-4"><p className="text-sm text-amber-700">Bu başvurunun raporu eski sürümden kalmış. Komisyon “Raporu yeniden doğrula” ile güncelleyebilir.</p>{report.issues?.map((s, i) => <p key={i} className="mt-2 text-sm text-danger">{s}</p>)}</div>}
    {(report.suggestions?.length ?? 0) > 0 && <details className="mt-6"><summary className="cursor-pointer text-sm font-medium">Tüm düzeltme önerileri</summary><ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-500">{report.suggestions!.map(s => <li key={s}>{s}</li>)}</ul></details>}
    <ul className="mt-6 space-y-2 text-xs leading-6 text-slate-500">{report.warnings?.map((s, i) => <li key={i}>{s}</li>)}</ul>
    {report.engineVersion && <p className="mt-4 text-xs text-slate-400">Doğrulama motoru sürümü: {report.engineVersion}</p>}
  </>;
}
function resultLabel(r: RuleResult) {
  if (r.severity === 'pending') return 'Bekliyor';
  if (r.severity === 'warning') return 'Uyarı';
  if (r.valid) return 'Geçti';
  if (r.kind === 'missing') return 'Eksik';
  if (r.kind === 'mismatch') return 'Uyuşmazlık';
  return 'Hata';
}
