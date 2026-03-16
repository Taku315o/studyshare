import {
  DEFAULT_GLOBAL_TIMETABLE_CONFIG,
  loadUniversityDefaultPreset,
  upsertUserTimetableSettings,
} from './config';

const FIVE_PERIODS = [
  { period: 1, label: '1限', start_time: '09:00', end_time: '10:40' },
  { period: 2, label: '2限', start_time: '10:50', end_time: '12:30' },
  { period: 3, label: '3限', start_time: '13:30', end_time: '15:10' },
  { period: 4, label: '4限', start_time: '15:20', end_time: '17:00' },
  { period: 5, label: '5限', start_time: '17:10', end_time: '18:50' },
];

function createSelectChain(result: unknown) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    is: jest.fn(() => chain),
    maybeSingle: jest.fn().mockResolvedValue(result),
    upsert: jest.fn(),
  };

  return chain;
}

describe('timetable config', () => {
  it('uses seven periods in the global default config', () => {
    expect(DEFAULT_GLOBAL_TIMETABLE_CONFIG.periods.map((period) => period.period)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(DEFAULT_GLOBAL_TIMETABLE_CONFIG.periods[5]).toMatchObject({
      period: 6,
      label: '6限',
      startTime: '18:25',
      endTime: '20:05',
    });
    expect(DEFAULT_GLOBAL_TIMETABLE_CONFIG.periods[6]).toMatchObject({
      period: 7,
      label: '7限',
      startTime: '20:10',
      endTime: '21:50',
    });
  });

  it('expands university presets that still have five periods', async () => {
    const query = createSelectChain({
      data: {
        id: 'preset-1',
        weekdays: [1, 2, 3, 4, 5],
        periods: FIVE_PERIODS,
      },
      error: null,
    });
    const supabase = {
      from: jest.fn(() => query),
    };

    const resolved = await loadUniversityDefaultPreset(supabase as never, 'uni-1');

    expect(resolved.source).toBe('university');
    expect(resolved.config.periods.map((period) => period.period)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(resolved.config.periods[5]).toMatchObject({
      period: 6,
      startTime: '19:00',
      endTime: '20:40',
    });
    expect(resolved.config.periods[6]).toMatchObject({
      period: 7,
      startTime: '20:50',
      endTime: '22:30',
    });
  });

  it('persists missing periods 6 and 7 when saving user timetable settings', async () => {
    const query = createSelectChain(null);
    query.upsert.mockResolvedValue({ error: null });
    const supabase = {
      from: jest.fn(() => query),
    };

    await upsertUserTimetableSettings(supabase as never, {
      userId: 'user-1',
      presetId: 'preset-1',
      config: {
        weekdays: [1, 2, 3, 4, 5],
        periods: FIVE_PERIODS.map((period) => ({
          period: period.period,
          label: period.label,
          startTime: period.start_time,
          endTime: period.end_time,
        })),
      },
    });

    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        preset_id: 'preset-1',
        periods: [
          expect.objectContaining({ period: 1 }),
          expect.objectContaining({ period: 2 }),
          expect.objectContaining({ period: 3 }),
          expect.objectContaining({ period: 4 }),
          expect.objectContaining({ period: 5 }),
          expect.objectContaining({ period: 6, start_time: '19:00', end_time: '20:40' }),
          expect.objectContaining({ period: 7, start_time: '20:50', end_time: '22:30' }),
        ],
      }),
      { onConflict: 'user_id' },
    );
  });
});
