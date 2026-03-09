import type { TimetableResolvedTerm, TimetableTermOption } from '@/types/timetable';

export function buildTermLabel(term: Pick<TimetableTermOption, 'academicYear' | 'displayName'>) {
  return `${term.academicYear} ${term.displayName}`.trim();
}

export function parseDateAtStartOfDay(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function sortTermsForSelector(terms: TimetableTermOption[]) {
  return [...terms].sort((left, right) => {
    if (left.academicYear !== right.academicYear) {
      return right.academicYear - left.academicYear;
    }

    if (left.sortKey !== right.sortKey) {
      return right.sortKey - left.sortKey;
    }

    return right.displayName.localeCompare(left.displayName, 'ja');
  });
}

export function resolveDefaultTerm(terms: TimetableTermOption[], today: Date): TimetableResolvedTerm {
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const activeTerms = sortTermsForSelector(
    terms.filter((term) => {
      if (!term.startDate || !term.endDate) return false;
      const endDate = new Date(term.endDate);
      endDate.setHours(23, 59, 59, 999);
      return term.startDate <= todayDate && todayDate <= endDate;
    }),
  );

  if (activeTerms.length > 0) {
    return activeTerms[0];
  }

  return sortTermsForSelector(terms)[0] ?? null;
}
