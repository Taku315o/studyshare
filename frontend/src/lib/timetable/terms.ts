import type { TimetableResolvedTerm, TimetableTermOption } from '@/types/timetable';

export function formatSeasonLabel(season: string) {
  if (season === 'first_half') return '前期';
  if (season === 'second_half') return '後期';
  return season;
}

export function parseDateAtStartOfDay(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveCurrentTerm(terms: TimetableTermOption[], today: Date): TimetableResolvedTerm {
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const active = terms
    .filter((term) => term.startDate && term.endDate)
    .filter((term) => {
      if (!term.startDate || !term.endDate) return false;
      const endDate = new Date(term.endDate);
      endDate.setHours(23, 59, 59, 999);
      return term.startDate <= todayDate && todayDate <= endDate;
    })
    .sort((left, right) => {
      if (!left.startDate || !right.startDate) return 0;
      return right.startDate.getTime() - left.startDate.getTime();
  });

  if (active.length > 0) return active[0];

  return sortTermsDescending(terms)[0] ?? null;
}

export function sortTermsDescending(terms: TimetableTermOption[]) {
  const seasonRank = (season: string) => (season === 'second_half' ? 2 : 1);
  return [...terms].sort((left, right) => {
    if (left.year !== right.year) return right.year - left.year;
    return seasonRank(right.season) - seasonRank(left.season);
  });
}
