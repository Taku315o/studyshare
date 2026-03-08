import { resolveSafeNextPath } from '@/lib/nextPath';
import type { TimetableDayParam, TimetablePeriod, TimetableWeekday } from '@/types/timetable';

export type OfferingFinderMode = 'browse' | 'timetable-add';

export type OfferingFinderContext = {
  mode: OfferingFinderMode;
  termId: string | null;
  q: string;
  day: TimetableDayParam | null;
  dayOfWeek: TimetableWeekday | null;
  period: TimetablePeriod | null;
  returnTo: string | null;
};

type SearchParamsRecord = Record<string, string | string[] | undefined>;

type SearchParamsInput = URLSearchParams | SearchParamsRecord;

type BuildOfferingFinderHrefArgs = {
  mode: OfferingFinderMode;
  termId?: string | null;
  q?: string | null;
  day?: TimetableDayParam | null;
  dayOfWeek?: TimetableWeekday | null;
  period?: TimetablePeriod | null;
  returnTo?: string | null;
};

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

function readSearchParam(searchParams: SearchParamsInput, key: string): string | null {
  if (searchParams instanceof URLSearchParams) {
    return searchParams.get(key);
  }

  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export function parseFinderDayParam(value: string | null | undefined): TimetableDayParam | null {
  if (!value) return null;
  return value in WEEKDAY_BY_DAY_PARAM ? (value as TimetableDayParam) : null;
}

export function dayParamToWeekday(value: TimetableDayParam | null | undefined): TimetableWeekday | null {
  if (!value) return null;
  return WEEKDAY_BY_DAY_PARAM[value] ?? null;
}

export function weekdayToDayParam(value: TimetableWeekday | null | undefined): TimetableDayParam | null {
  if (!value) return null;
  return DAY_PARAM_BY_WEEKDAY[value] ?? null;
}

export function readOfferingFinderContext(searchParams: SearchParamsInput, mode: OfferingFinderMode): OfferingFinderContext {
  const termId = readSearchParam(searchParams, 'termId')?.trim() || null;
  const q = readSearchParam(searchParams, 'q')?.trim() ?? '';

  if (mode === 'browse') {
    return {
      mode,
      termId,
      q,
      day: null,
      dayOfWeek: null,
      period: null,
      returnTo: null,
    };
  }

  const day = parseFinderDayParam(readSearchParam(searchParams, 'day'));
  const rawPeriod = readSearchParam(searchParams, 'period');
  const periodValue = rawPeriod ? Number(rawPeriod) : null;

  return {
    mode,
    termId,
    q,
    day,
    dayOfWeek: dayParamToWeekday(day),
    period: Number.isInteger(periodValue) && periodValue !== null && periodValue > 0 ? periodValue : null,
    returnTo: resolveSafeNextPath(readSearchParam(searchParams, 'returnTo'), { fallback: '/timetable' }),
  };
}

export function buildOfferingFinderHref(args: BuildOfferingFinderHrefArgs) {
  const params = new URLSearchParams();

  if (args.termId) {
    params.set('termId', args.termId);
  }

  const q = args.q?.trim();
  if (q) {
    params.set('q', q);
  }

  if (args.mode === 'timetable-add') {
    const day = args.day ?? weekdayToDayParam(args.dayOfWeek) ?? null;
    if (day) {
      params.set('day', day);
    }

    if (typeof args.period === 'number' && Number.isFinite(args.period)) {
      params.set('period', String(args.period));
    }

    params.set('returnTo', resolveSafeNextPath(args.returnTo, { fallback: '/timetable' }));
  }

  const pathname = args.mode === 'browse' ? '/offerings' : '/timetable/add';
  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}
