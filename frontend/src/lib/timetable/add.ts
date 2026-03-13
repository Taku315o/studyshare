import { resolveSafeNextPath } from '@/lib/nextPath';
import { buildOfferingFinderHref, readOfferingFinderContext } from '@/lib/offerings/finder';
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
  return buildOfferingFinderHref({
    mode: 'timetable-add',
    termId: args.termId,
    dayOfWeek: args.dayOfWeek,
    period: args.period,
    q: args.query,
    returnTo: args.returnTo,
  });
}

export function readTimetableAddContext(searchParams: URLSearchParams): TimetableAddContext {
  const context = readOfferingFinderContext(searchParams, 'timetable-add');

  return {
    termId: context.termId,
    dayParam: context.day,
    dayOfWeek: context.dayOfWeek,
    period: context.period,
    query: context.q,
    returnTo: context.returnTo ?? resolveSafeNextPath(null, { fallback: '/timetable' }),
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
