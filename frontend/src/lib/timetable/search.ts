import { sanitizeDisplayText } from '@/lib/text';
import { normalizeCourseText } from '@/lib/timetable/add';
import type {
  TimetableDuplicateCandidate,
  TimetableDuplicateCandidateKind,
  TimetableSearchResult,
  TimetableSlotDetail,
  TimetableStatus,
  TimetableWeekday,
} from '@/types/timetable';

type RawRpcRow = {
  offering_id: string;
  course_title: string | null;
  course_code: string | null;
  instructor: string | null;
  room: string | null;
  slot_labels: string[] | null;
  slot_details: unknown;
  slot_match: boolean | null;
  enrollment_count: number | null;
  my_status: TimetableStatus | null;
  created_at: string;
};

type RawDuplicateRow = RawRpcRow & {
  candidate_kind: string | null;
  reasons: string[] | null;
};

type RawSlot = {
  day_of_week?: number | null;
  dayOfWeek?: number | null;
  period?: number | null;
  room?: string | null;
};

function isWeekday(value: number | null | undefined): value is TimetableWeekday {
  return typeof value === 'number' && value >= 1 && value <= 7;
}

export function parseSlotDetails(value: unknown): TimetableSlotDetail[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const raw = entry as RawSlot;
    const dayOfWeek = raw.day_of_week ?? raw.dayOfWeek ?? null;
    const period = raw.period ?? null;
    if (!isWeekday(dayOfWeek) || typeof period !== 'number' || !Number.isInteger(period) || period < 1) {
      return [];
    }

    return [
      {
        dayOfWeek,
        period,
        room: raw.room ?? null,
      },
    ];
  });
}

export function mapSearchResultRow(row: RawRpcRow): TimetableSearchResult {
  return {
    offeringId: row.offering_id,
    courseTitle: sanitizeDisplayText(row.course_title) ?? '不明な授業',
    courseCode: row.course_code ?? null,
    instructorName: sanitizeDisplayText(row.instructor),
    room: sanitizeDisplayText(row.room),
    slotLabels: (row.slot_labels ?? [])
      .map((label) => sanitizeDisplayText(label) ?? '')
      .filter((label) => label.length > 0),
    slotDetails: parseSlotDetails(row.slot_details),
    slotMatch: Boolean(row.slot_match),
    enrollmentCount: Number(row.enrollment_count ?? 0),
    myStatus: row.my_status ?? null,
    createdAt: row.created_at,
  };
}

function classifyCandidateKind(args: {
  row: TimetableSearchResult;
  inputTitle: string;
  inputInstructor: string;
  dayOfWeek: TimetableWeekday;
  period: number;
}): TimetableDuplicateCandidateKind {
  const normalizedTitle = normalizeCourseText(args.inputTitle);
  const normalizedInstructor = normalizeCourseText(args.inputInstructor);
  const rowTitle = normalizeCourseText(args.row.courseTitle);
  const rowInstructor = normalizeCourseText(args.row.instructorName ?? '');
  const sameSlot = args.row.slotDetails.some(
    (slot) => slot.dayOfWeek === args.dayOfWeek && slot.period === args.period,
  );
  const sameTitle = rowTitle === normalizedTitle;
  const sameInstructor = normalizedInstructor.length > 0 && rowInstructor === normalizedInstructor;
  const titleIncludes = normalizedTitle.length > 0 && (rowTitle.includes(normalizedTitle) || normalizedTitle.includes(rowTitle));

  if (sameSlot && sameTitle && (sameInstructor || normalizedInstructor.length === 0)) {
    return 'exact';
  }

  if (sameSlot && (sameTitle || titleIncludes || sameInstructor)) {
    return 'strong';
  }

  return 'related';
}

export function mapDuplicateCandidateRow(
  row: RawDuplicateRow,
  args: {
    inputTitle: string;
    inputInstructor: string;
    dayOfWeek: TimetableWeekday;
    period: number;
  },
): TimetableDuplicateCandidate {
  const base = mapSearchResultRow(row);
  const clientCandidateKind = classifyCandidateKind({
    row: base,
    inputTitle: args.inputTitle,
    inputInstructor: args.inputInstructor,
    dayOfWeek: args.dayOfWeek,
    period: args.period,
  });
  const serverCandidateKind = row.candidate_kind as TimetableDuplicateCandidateKind | null;
  const rank: Record<TimetableDuplicateCandidateKind, number> = {
    related: 0,
    strong: 1,
    exact: 2,
  };
  const candidateKind =
    serverCandidateKind && rank[serverCandidateKind] > rank[clientCandidateKind]
      ? serverCandidateKind
      : clientCandidateKind;

  return {
    ...base,
    candidateKind,
    reasons: row.reasons ?? [],
  };
}
