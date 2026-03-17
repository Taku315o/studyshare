import { resolveCatalogCoverage, selectRetiredOfferingIds, stableJsonHash } from './db';
import { buildSenshuExternalId, parseSenshuDetailText, parseSenshuSlots, parseTermCode, selectDepartmentLabels } from './senshu';

describe('Senshu importer helpers', () => {
  it('builds a stable external id from detail url params', () => {
    expect(
      buildSenshuExternalId(
        'https://syllabus.acc.senshu-u.ac.jp/syllsenshu/slbssbdr.do?value(risyunen)=2025&value(semekikn)=1&value(kougicd)=12345',
      ),
    ).toBe('2025:12345:1');
  });

  it('derives the term code from period text', () => {
    expect(parseTermCode('前期 月曜日 2時限', 'full_year')).toBe('first_half');
    expect(parseTermCode('後期 水曜日 3時限', 'first_half')).toBe('second_half');
    expect(parseTermCode('通年 金曜日 4時限', 'first_half')).toBe('full_year');
  });

  it('parses structured and non-structured slots', () => {
    expect(parseSenshuSlots('2025:12345:1', '前期 月曜日 2時限')).toEqual([
      {
        externalId: '2025:12345:1::weekly_structured:1:2',
        slotKind: 'weekly_structured',
        dayOfWeek: 1,
        period: 2,
        room: null,
        rawText: '前期 月曜日 2時限',
      },
    ]);

    expect(parseSenshuSlots('2025:12345:1', '集中講義')).toEqual([
      {
        externalId: '2025:12345:1::intensive',
        slotKind: 'intensive',
        dayOfWeek: null,
        period: null,
        room: null,
        rawText: '集中講義',
      },
    ]);
  });

  it('selects requested departments and rejects unknown labels', () => {
    expect(selectDepartmentLabels(['経済学部', '経営学部'], ['経営学部', '経済学部'])).toEqual([
      '経営学部',
      '経済学部',
    ]);

    expect(() => selectDepartmentLabels(['経済学部', '経営学部'], ['法学部'])).toThrow(
      'unknown departments: 法学部',
    );
  });

  it('parses a detail text payload into canonical fields', () => {
    const detailText = `
開講年度
2025
科目名
プログラミング基礎
職名／担当教員
教授 山田 太郎
期間／曜日／時限
前期 月曜日 2時限
開講区分／校舎
一部生田
単　位
2
コースコード
ICT101
授業形態
講義
更新日付
2025/03/31
    `;

    expect(
      parseSenshuDetailText(
        detailText,
        'https://syllabus.acc.senshu-u.ac.jp/syllsenshu/slbssbdr.do?value(risyunen)=2025&value(semekikn)=1&value(kougicd)=12345',
        'first_half',
      ),
    ).toMatchObject({
      externalId: '2025:12345:1',
      academicYear: 2025,
      termCode: 'first_half',
      courseTitle: 'プログラミング基礎',
      courseCode: 'ICT101',
      instructor: '教授 山田 太郎',
      credits: 2,
      sourceUpdatedAt: '2025-03-31',
    });
  });

  it('decodes nbsp entities in imported detail text', () => {
    const detailText = `
開講年度
2025
科目名
論理学１０１&nbsp;
職名／担当教員
文学部 兼任講師 岩本 敦&nbsp;
期間／曜日／時限
前期 月曜日 4時限
開講区分／校舎
一部生田
単　位
2
コースコード
PHL101
授業形態
講義
更新日付
2025/03/31
    `;

    expect(
      parseSenshuDetailText(
        detailText,
        'https://syllabus.acc.senshu-u.ac.jp/syllsenshu/slbssbdr.do?value(risyunen)=2025&value(semekikn)=1&value(kougicd)=12345',
        'first_half',
      ),
    ).toMatchObject({
      courseTitle: '論理学１０１',
      instructor: '文学部 兼任講師 岩本 敦',
    });
  });

  it('retains a stable hash regardless of object key order', () => {
    const left = stableJsonHash({ b: 1, a: { d: 2, c: 3 } });
    const right = stableJsonHash({ a: { c: 3, d: 2 }, b: 1 });
    expect(left).toBe(right);
  });

  it('selects stale offering ids within the requested slice only', () => {
    expect(
      selectRetiredOfferingIds({
        mappings: [
          { external_id: '2025:100:1', entity_id: 'offering-1', mapping_type: 'primary' },
          { external_id: '2025:200:1', entity_id: 'offering-2', mapping_type: 'primary' },
          { external_id: '2025:300:1', entity_id: 'offering-3', mapping_type: 'manual' },
        ],
        offerings: [
          { id: 'offering-1', term_id: 'term-1' },
          { id: 'offering-2', term_id: 'term-2' },
          { id: 'offering-3', term_id: 'term-1' },
        ],
        terms: [
          { id: 'term-1', university_id: 'senshu', academic_year: 2025, code: 'first_half' },
          { id: 'term-2', university_id: 'senshu', academic_year: 2025, code: 'second_half' },
        ],
        universityId: 'senshu',
        academicYear: 2025,
        termCode: 'first_half',
        seenExternalIds: ['2025:100:1'],
      }),
    ).toEqual([]);

    expect(
      selectRetiredOfferingIds({
        mappings: [
          { external_id: '2025:100:1', entity_id: 'offering-1', mapping_type: 'primary' },
          { external_id: '2025:200:1', entity_id: 'offering-2', mapping_type: 'primary' },
        ],
        offerings: [
          { id: 'offering-1', term_id: 'term-1' },
          { id: 'offering-2', term_id: 'term-1' },
        ],
        terms: [{ id: 'term-1', university_id: 'senshu', academic_year: 2025, code: 'first_half' }],
        universityId: 'senshu',
        academicYear: 2025,
        termCode: 'first_half',
        seenExternalIds: ['2025:100:1'],
      }),
    ).toEqual(['offering-2']);
  });

  it('resolves catalog coverage for full and partial runs', () => {
    expect(
      resolveCatalogCoverage({
        existing: null,
        departmentLabels: [],
      }),
    ).toEqual({
      coverageKind: 'full',
      sourceScopeLabels: [],
    });

    expect(
      resolveCatalogCoverage({
        existing: {
          coverage_kind: 'partial',
          source_scope_labels: ['経済学部'],
        },
        departmentLabels: ['経営学部', '経済学部'],
      }),
    ).toEqual({
      coverageKind: 'partial',
      sourceScopeLabels: ['経営学部', '経済学部'],
    });

    expect(
      resolveCatalogCoverage({
        existing: {
          coverage_kind: 'full',
          source_scope_labels: [],
        },
        departmentLabels: ['経済学部'],
      }),
    ).toEqual({
      coverageKind: 'full',
      sourceScopeLabels: [],
    });
  });
});
