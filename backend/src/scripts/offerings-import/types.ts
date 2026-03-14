export const SENSHU_SOURCE_CODE = 'senshu_syllabus';
export const SENSYU_UNIVERSITY_NAME = '専修大学';

export const TERM_CODES = ['first_half', 'second_half', 'full_year'] as const;
export type CanonicalTermCode = (typeof TERM_CODES)[number];

export const SLOT_KINDS = ['weekly_structured', 'intensive', 'on_demand', 'unscheduled'] as const;
export type OfferingSlotKind = (typeof SLOT_KINDS)[number];

export type ImportEntityType = 'course' | 'course_offering' | 'offering_slot';
export type MappingType = 'primary' | 'derived' | 'manual';

export type ImportScope = {
  academicYear: number;
  term: CanonicalTermCode | 'all';
  departmentLabels?: string[];
  dryRun: boolean;
  retireMissing: boolean;
};

export type CanonicalSlotInput = {
  externalId: string;
  slotKind: OfferingSlotKind;
  dayOfWeek: number | null;
  period: number | null;
  room: string | null;
  rawText: string | null;
};

export type CanonicalOfferingImportItem = {
  externalId: string;
  academicYear: number;
  termCode: CanonicalTermCode;
  courseTitle: string;
  courseCode: string | null;
  instructor: string | null;
  credits: number | null;
  canonicalUrl: string;
  sourceUpdatedAt: string | null;
  rawPayload: Record<string, unknown>;
  slots: CanonicalSlotInput[];
};

export type ImportStats = {
  rawSeen: number;
  skipped: number;
  coursesCreated: number;
  coursesReused: number;
  offeringsCreated: number;
  offeringsUpdated: number;
  slotsCreated: number;
  slotsUpdated: number;
  slotsDeleted: number;
  retired: number;
  manualMappingsPreserved: number;
};

export const EMPTY_STATS: ImportStats = {
  rawSeen: 0,
  skipped: 0,
  coursesCreated: 0,
  coursesReused: 0,
  offeringsCreated: 0,
  offeringsUpdated: 0,
  slotsCreated: 0,
  slotsUpdated: 0,
  slotsDeleted: 0,
  retired: 0,
  manualMappingsPreserved: 0,
};
