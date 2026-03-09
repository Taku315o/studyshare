import { buildTermLabel, resolveDefaultTerm, sortTermsForSelector } from './terms';
import type { TimetableTermOption } from '@/types/timetable';

const buildTerm = (overrides: Partial<TimetableTermOption>): TimetableTermOption => ({
  id: overrides.id ?? 'term-1',
  academicYear: overrides.academicYear ?? 2026,
  code: overrides.code ?? 'first_half',
  displayName: overrides.displayName ?? '前期',
  sortKey: overrides.sortKey ?? 10,
  startDate: overrides.startDate ?? null,
  endDate: overrides.endDate ?? null,
});

describe('timetable term helpers', () => {
  it('builds labels from academic year and display name', () => {
    expect(buildTermLabel(buildTerm({ academicYear: 2026, displayName: '通年' }))).toBe('2026 通年');
  });

  it('sorts terms by academic year desc then sort key desc', () => {
    const sorted = sortTermsForSelector([
      buildTerm({ id: 'term-a', academicYear: 2025, displayName: '後期', sortKey: 20 }),
      buildTerm({ id: 'term-b', academicYear: 2026, displayName: '1学期', sortKey: 10 }),
      buildTerm({ id: 'term-c', academicYear: 2026, displayName: '4学期', sortKey: 40 }),
    ]);

    expect(sorted.map((term) => term.id)).toEqual(['term-c', 'term-b', 'term-a']);
  });

  it('prefers active term and otherwise falls back to latest sort order', () => {
    const today = new Date('2026-05-01T12:00:00');

    const resolved = resolveDefaultTerm(
      [
        buildTerm({
          id: 'term-old',
          academicYear: 2025,
          displayName: '後期',
          sortKey: 20,
          startDate: new Date('2025-09-01T00:00:00'),
          endDate: new Date('2026-01-31T00:00:00'),
        }),
        buildTerm({
          id: 'term-active',
          academicYear: 2026,
          displayName: '前期',
          sortKey: 10,
          startDate: new Date('2026-04-01T00:00:00'),
          endDate: new Date('2026-08-01T00:00:00'),
        }),
      ],
      today,
    );

    expect(resolved?.id).toBe('term-active');
    expect(resolveDefaultTerm([buildTerm({ id: 'term-latest', academicYear: 2027, sortKey: 30 })], today)?.id).toBe(
      'term-latest',
    );
  });
});
