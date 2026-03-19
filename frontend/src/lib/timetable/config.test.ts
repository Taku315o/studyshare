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

const TEN_PERIODS = [
  { period: 1, label: '1限', start_time: '08:45', end_time: '09:30' },
  { period: 2, label: '2限', start_time: '09:30', end_time: '10:15' },
  { period: 3, label: '3限', start_time: '10:30', end_time: '11:15' },
  { period: 4, label: '4限', start_time: '11:15', end_time: '12:00' },
  { period: 5, label: '5限', start_time: '12:50', end_time: '13:35' },
  { period: 6, label: '6限', start_time: '13:35', end_time: '14:20' },
  { period: 7, label: '7限', start_time: '14:35', end_time: '15:20' },
  { period: 8, label: '8限', start_time: '15:20', end_time: '16:05' },
  { period: 9, label: '9限', start_time: '16:20', end_time: '17:05' },
  { period: 10, label: '10限', start_time: '17:05', end_time: '17:50' },
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

  it('keeps university presets with five periods as-is', async () => {
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
    expect(resolved.config.periods.map((period) => period.period)).toEqual([1, 2, 3, 4, 5]);
    expect(resolved.config.periods[4]).toMatchObject({
      period: 5,
      startTime: '17:10',
      endTime: '18:50',
    });
  });

  it('keeps university presets with ten periods as-is', async () => {
    const query = createSelectChain({
      data: {
        id: 'preset-hiroshima',
        weekdays: [1, 2, 3, 4, 5],
        periods: TEN_PERIODS,
      },
      error: null,
    });
    const supabase = {
      from: jest.fn(() => query),
    };

    const resolved = await loadUniversityDefaultPreset(supabase as never, 'uni-hiroshima');

    expect(resolved.source).toBe('university');
    expect(resolved.config.periods.map((period) => period.period)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(resolved.config.periods[9]).toMatchObject({
      period: 10,
      startTime: '17:05',
      endTime: '17:50',
    });
  });

  it('saves user timetable settings without adding missing periods', async () => {
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
        ],
      }),
      { onConflict: 'user_id' },
    );
  });
});
