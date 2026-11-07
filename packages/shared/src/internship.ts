import { holidays } from './holidays.js';
export function dateValue(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}
export function countInternshipDays(start: string, end: string, weekdays: number[]) {
  const from = dateValue(start), to = dateValue(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from > 366 * 86400000 || !weekdays.length || weekdays.some(d => !Number.isInteger(d) || d < 0 || d > 6)) return { days: null, excluded: 0, missingYears: [] as number[], message: 'Geçerli tarih aralığı ve en az bir çalışma günü seçin (en fazla 367 gün).' };
  const missing = new Set<number>(); let days = 0, excluded = 0;
  for (let time = from; time <= to; time += 86400000) {
    const date = new Date(time), year = date.getUTCFullYear();
    if (!holidays[year]) missing.add(year);
    if (!weekdays.includes(date.getUTCDay())) continue;
    const fraction = holidays[year]?.[date.toISOString().slice(0, 10)] ?? 0;
    days += 1 - fraction; excluded += fraction;
  }
  return { days: missing.size ? null : days, excluded, missingYears: [...missing], message: missing.size ? 'Tatil takvimi eksik; kesin gün sayısı hesaplanamadı.' : 'Başlangıç ve bitiş dahil; yarım gün tatiller 0,5 gün düşülür.' };
}
export function todayInTurkey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export const statusLabels = { UPLOADED: 'Yüklendi', UNDER_REVIEW: 'İnceleniyor', INVALID: 'Hatalı / Eksik', APPROVED: 'Onaylandı', COMPLETED: 'Tamamlandı' } as const;
export type ApplicationStatus = keyof typeof statusLabels;
export class InternshipApplication {
  #status: ApplicationStatus;
  constructor(status: ApplicationStatus) { this.#status = status; }
  get status() { return this.#status; }
  transition(next: ApplicationStatus, readyForApproval = false) {
    const allowed: Record<ApplicationStatus, ApplicationStatus[]> = { UPLOADED: ['UNDER_REVIEW'], UNDER_REVIEW: ['INVALID', 'APPROVED'], INVALID: ['UPLOADED'], APPROVED: ['COMPLETED'], COMPLETED: [] };
    if (!allowed[this.#status].includes(next)) throw new Error('Bu durum geçişine izin verilmiyor.');
    if ((next === 'APPROVED' || next === 'COMPLETED') && !readyForApproval) throw new Error('Doğrulamalar ve manuel kontroller tamamlanmadan onay verilemez.');
    this.#status = next;
  }
}
