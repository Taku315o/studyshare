import { parseArgs } from './importSenshuOfferings';

describe('importSenshuOfferings parseArgs', () => {
  it('accepts repeated department flags', () => {
    expect(
      parseArgs([
        '--academic-year',
        '2025',
        '--term',
        'first_half',
        '--department',
        '経済学部',
        '--department',
        '経営学部',
      ]),
    ).toMatchObject({
      academicYear: 2025,
      term: 'first_half',
      departmentLabels: ['経済学部', '経営学部'],
    });
  });

  it('rejects retire-missing for partial imports', () => {
    expect(() =>
      parseArgs([
        '--academic-year',
        '2025',
        '--department',
        '経済学部',
        '--retire-missing',
      ]),
    ).toThrow('--retire-missing is only allowed for full imports');
  });
});
