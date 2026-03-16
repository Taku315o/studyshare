export type TimetableWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type TimetableDayParam = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type TimetablePeriod = number;

export type TimetablePeriodConfig = {
  period: TimetablePeriod;
  label: string;
  startTime: string;
  endTime: string;
};

export type TimetableConfig = {
  weekdays: TimetableWeekday[];
  periods: TimetablePeriodConfig[];
};

export type TimetableStatus = 'enrolled' | 'planned' | 'dropped';

export type TimetableColorToken = 'sky' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'teal';

export type TimetableOfferingItem = {
  offeringId: string;
  courseTitle: string;
  instructorName: string;
  startTime: string;
  dayOfWeek: TimetableWeekday;
  period: TimetablePeriod;
  status: TimetableStatus;
  colorToken: TimetableColorToken;
  createdAt: string;
};

export type TimetableSlotDetail = {
  dayOfWeek: TimetableWeekday;
  period: TimetablePeriod;
  room: string | null;
};

export type TimetableCellModel = {
  dayOfWeek: TimetableWeekday;
  period: TimetablePeriod;
  items: TimetableOfferingItem[];
  primaryItem: TimetableOfferingItem | null;
};

export type TimetableGridViewModel = {
  cells: TimetableCellModel[];
};

export type TimetableTermOption = {
  id: string;
  academicYear: number;
  code: string;
  displayName: string;
  sortKey: number;
  startDate: string | null;
  endDate: string | null;
};

export type TimetableResolvedTerm = TimetableTermOption | null;

export type TimetableAddContext = {
  termId: string | null;
  dayParam: TimetableDayParam | null;
  dayOfWeek: TimetableWeekday | null;
  period: TimetablePeriod | null;
  query: string;
  returnTo: string;
};

export type TimetableSearchResult = {
  offeringId: string;
  courseTitle: string;
  courseCode: string | null;
  instructorName: string | null;
  room: string | null;
  slotLabels: string[];
  slotDetails: TimetableSlotDetail[];
  slotMatch: boolean;
  enrollmentCount: number;
  myStatus: TimetableStatus | null;
  createdAt: string;
};

export type OfferingCatalogCoverage = {
  coverageKind: 'partial' | 'full';
  sourceScopeLabels: string[];
};

export type TimetableDuplicateCandidateKind = 'exact' | 'strong' | 'related';

export type TimetableDuplicateCandidate = {
  offeringId: string;
  courseTitle: string;
  courseCode: string | null;
  instructorName: string | null;
  room: string | null;
  slotLabels: string[];
  slotDetails: TimetableSlotDetail[];
  candidateKind: TimetableDuplicateCandidateKind;
  reasons: string[];
  myStatus: TimetableStatus | null;
  enrollmentCount: number;
  createdAt: string;
};

export type TimetableReturnHighlight = {
  offeringId: string;
  dayOfWeek: TimetableWeekday | null;
  period: TimetablePeriod | null;
  location: 'grid' | 'out_of_config' | 'unslotted';
};

export type TimetableSearchModalSource = 'page-search' | 'empty-cell' | 'matching-cta';

export type TimetableSearchModalState =
  | { isOpen: false }
  | {
      isOpen: true;
      source: TimetableSearchModalSource;
      dayOfWeek?: TimetableWeekday;
      period?: TimetablePeriod;
      keyword?: string;
    };
