export type TimetableWeekday = 1 | 2 | 3 | 4 | 5;

export type TimetablePeriod = 1 | 2 | 3 | 4 | 5;

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

export type TimetableCellModel = {
  dayOfWeek: TimetableWeekday;
  period: TimetablePeriod;
  items: TimetableOfferingItem[];
  primaryItem: TimetableOfferingItem | null;
};

export type TimetableGridViewModel = {
  cells: TimetableCellModel[];
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
