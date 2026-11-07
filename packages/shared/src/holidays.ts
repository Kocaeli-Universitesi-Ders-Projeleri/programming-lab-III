// Source content verified 2026-11-06. Update this configuration for new years.
export const holidaySources = {
  2026: 'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=158',
  2027: 'https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=159',
};
const fixed: [string, number][] = [['01-01', 1], ['04-23', 1], ['05-01', 1], ['05-19', 1], ['07-15', 1], ['08-30', 1], ['10-28', .5], ['10-29', 1]];
export const holidays: Record<number, Record<string, number>> = {};
for (const year of [2026, 2027]) holidays[year] = Object.fromEntries(fixed.map(([day, fraction]) => [`${year}-${day}`, fraction]));
Object.assign(holidays[2026], { '2026-03-19': .5, '2026-03-20': 1, '2026-03-21': 1, '2026-03-22': 1, '2026-05-26': .5, '2026-05-27': 1, '2026-05-28': 1, '2026-05-29': 1, '2026-05-30': 1 });
Object.assign(holidays[2027], { '2027-03-08': .5, '2027-03-09': 1, '2027-03-10': 1, '2027-03-11': 1, '2027-05-15': .5, '2027-05-16': 1, '2027-05-17': 1, '2027-05-18': 1, '2027-05-19': 1 });
