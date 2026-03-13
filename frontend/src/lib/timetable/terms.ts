import type { TimetableResolvedTerm, TimetableTermOption } from '@/types/timetable';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const DEFAULT_TERM_CODE_PRIORITY: Record<string, number> = {
  full_year: 0,
  first_half: 10,
  quarter_1: 10,
  quarter_2: 20,
  second_half: 20,
  quarter_3: 30,
  quarter_4: 40,
  intensive: 80,
  other: 90,
};

export function buildTermLabel(term: Pick<TimetableTermOption, 'academicYear' | 'displayName'>) {
  return `${term.academicYear} ${term.displayName}`.trim();
}

export function parseDateOnly(value: string | null) {
  if (!value) return null;
  return DATE_ONLY_PATTERN.test(value) ? value : null;
}

export function parseDateAtStartOfDay(value: string | null): Date | null {
  if (!value) return null;
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function toDateKey(value: Date | string | null) {
  if (!value) return null;

  const date = value instanceof Date ? value : parseDateAtStartOfDay(value);
  if (!date || Number.isNaN(date.getTime())) return null;

  return date.getFullYear() * 10_000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function toLocalDateKey(today: Date) {
  return today.getFullYear() * 10_000 + (today.getMonth() + 1) * 100 + today.getDate();
}

function compareTermsForDefaultFallback(left: TimetableTermOption, right: TimetableTermOption) {
  if (left.academicYear !== right.academicYear) {
    return right.academicYear - left.academicYear;
  }

  const leftPriority = DEFAULT_TERM_CODE_PRIORITY[left.code] ?? 50;
  const rightPriority = DEFAULT_TERM_CODE_PRIORITY[right.code] ?? 50;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  if (left.sortKey !== right.sortKey) {
    return right.sortKey - left.sortKey;
  }

  return right.displayName.localeCompare(left.displayName, 'ja');
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
  const todayKey = toLocalDateKey(today);
  const datedTerms = terms
    .map((term) => ({
      term,
      startKey: toDateKey(term.startDate),
      endKey: toDateKey(term.endDate),
    }))
    .filter(
      (entry): entry is { term: TimetableTermOption; startKey: number; endKey: number } =>
        entry.startKey !== null && entry.endKey !== null,
    );

  const activeTerms = sortTermsForSelector(
    datedTerms
      .filter((entry) => entry.startKey <= todayKey && todayKey <= entry.endKey)
      .map((entry) => entry.term),
  );

  if (activeTerms.length > 0) {
    return activeTerms[0];
  }

  const nearestDatedTerm = [...datedTerms].sort((left, right) => {
    const leftRelation = left.startKey > todayKey ? 0 : 1;
    const rightRelation = right.startKey > todayKey ? 0 : 1;

    if (leftRelation !== rightRelation) {
      return leftRelation - rightRelation;
    }

    const leftDistance = left.startKey > todayKey ? left.startKey - todayKey : todayKey - left.endKey;
    const rightDistance = right.startKey > todayKey ? right.startKey - todayKey : todayKey - right.endKey;

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return compareTermsForDefaultFallback(left.term, right.term);
  })[0]?.term;

  if (nearestDatedTerm) {
    return nearestDatedTerm;
  }

  return [...terms].sort(compareTermsForDefaultFallback)[0] ?? null;
}
