import { resolveSafeNextPath } from '@/lib/nextPath';
import type {
  TimetableAddContext,
  TimetableDayParam,
  TimetablePeriod,
  TimetableReturnHighlight,
  TimetableWeekday,
} from '@/types/timetable';

export const TIMETABLE_SCROLL_STORAGE_KEY = 'studyshare:timetable:return-scroll';
export const TIMETABLE_HIGHLIGHT_STORAGE_KEY = 'studyshare:timetable:return-highlight';

const DAY_PARAM_BY_WEEKDAY: Record<TimetableWeekday, TimetableDayParam> = {
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
  7: 'sun',
};

const WEEKDAY_BY_DAY_PARAM: Record<TimetableDayParam, TimetableWeekday> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
};

export function parseTimetableDayParam(value: string | null | undefined): TimetableWeekday | null {
  if (!value) return null;
  return WEEKDAY_BY_DAY_PARAM[value as TimetableDayParam] ?? null;
}

export function weekdayToDayParam(value: TimetableWeekday): TimetableDayParam {
  return DAY_PARAM_BY_WEEKDAY[value];
}

export function normalizeCourseText(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

type BuildTimetableAddHrefArgs = {
  termId?: string | null;
  dayOfWeek?: TimetableWeekday | null;
  period?: TimetablePeriod | null;
  query?: string | null;
  returnTo?: string | null;
};

export function buildTimetableAddHref(args: BuildTimetableAddHrefArgs) {
  const params = new URLSearchParams();

  if (args.termId) {
    params.set('termId', args.termId);
  }

  if (args.dayOfWeek) {
    params.set('day', weekdayToDayParam(args.dayOfWeek));
  }

  if (typeof args.period === 'number' && Number.isFinite(args.period)) {
    params.set('period', String(args.period));
  }

  const query = args.query?.trim();
  if (query) {
    params.set('q', query);
  }

  params.set('returnTo', resolveSafeNextPath(args.returnTo, { fallback: '/timetable' }));

  const queryString = params.toString();
  return queryString ? `/timetable/add?${queryString}` : '/timetable/add';
}

export function readTimetableAddContext(searchParams: URLSearchParams): TimetableAddContext {
  const periodParam = searchParams.get('period');
  const period = periodParam ? Number(periodParam) : null;

  return {
    termId: searchParams.get('termId'),
    dayParam: (searchParams.get('day') as TimetableDayParam | null) ?? null,
    dayOfWeek: parseTimetableDayParam(searchParams.get('day')),
    period: Number.isInteger(period) && period !== null && period > 0 ? period : null,
    query: searchParams.get('q')?.trim() ?? '',
    returnTo: resolveSafeNextPath(searchParams.get('returnTo'), { fallback: '/timetable' }),
  };
}

export function persistTimetableScrollPosition() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(TIMETABLE_SCROLL_STORAGE_KEY, String(window.scrollY));
}

export function consumeTimetableScrollPosition() {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(TIMETABLE_SCROLL_STORAGE_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(TIMETABLE_SCROLL_STORAGE_KEY);
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function persistTimetableReturnHighlight(value: TimetableReturnHighlight) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(TIMETABLE_HIGHLIGHT_STORAGE_KEY, JSON.stringify(value));
}

export function consumeTimetableReturnHighlight(): TimetableReturnHighlight | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(TIMETABLE_HIGHLIGHT_STORAGE_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(TIMETABLE_HIGHLIGHT_STORAGE_KEY);

  try {
    const parsed = JSON.parse(raw) as TimetableReturnHighlight;
    return parsed;
  } catch {
    return null;
  }
}
