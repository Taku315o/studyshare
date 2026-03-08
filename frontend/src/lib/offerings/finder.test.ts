import { buildOfferingFinderHref, readOfferingFinderContext } from './finder';

describe('finder helpers', () => {
  it('builds browse mode href without timetable params', () => {
    expect(
      buildOfferingFinderHref({
        mode: 'browse',
        termId: 'term-1',
        q: 'マーケ',
        day: 'mon',
        period: 1,
        returnTo: '/timetable',
      }),
    ).toBe('/offerings?termId=term-1&q=%E3%83%9E%E3%83%BC%E3%82%B1');
  });

  it('builds timetable-add mode href with slot context and return path', () => {
    expect(
      buildOfferingFinderHref({
        mode: 'timetable-add',
        termId: 'term-1',
        q: '線形',
        day: 'tue',
        period: 3,
        returnTo: '/timetable',
      }),
    ).toBe('/timetable/add?termId=term-1&q=%E7%B7%9A%E5%BD%A2&day=tue&period=3&returnTo=%2Ftimetable');
  });

  it('ignores timetable-only params in browse mode context', () => {
    expect(
      readOfferingFinderContext(
        new URLSearchParams('termId=term-1&q=%E7%B7%9A%E5%BD%A2&day=mon&period=2&returnTo=%2Ftimetable'),
        'browse',
      ),
    ).toEqual({
      mode: 'browse',
      termId: 'term-1',
      q: '線形',
      day: null,
      dayOfWeek: null,
      period: null,
      returnTo: null,
    });
  });

  it('keeps returnTo and parsed slot params in timetable-add mode', () => {
    expect(
      readOfferingFinderContext(
        new URLSearchParams('termId=term-1&q=%E7%B7%9A%E5%BD%A2&day=wed&period=4&returnTo=%2Ftimetable'),
        'timetable-add',
      ),
    ).toEqual({
      mode: 'timetable-add',
      termId: 'term-1',
      q: '線形',
      day: 'wed',
      dayOfWeek: 3,
      period: 4,
      returnTo: '/timetable',
    });
  });

  it('falls back to safe returnTo in timetable-add mode', () => {
    expect(
      readOfferingFinderContext(new URLSearchParams('returnTo=https://example.com'), 'timetable-add'),
    ).toMatchObject({
      returnTo: '/timetable',
    });
  });
});
