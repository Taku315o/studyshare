export type MeAssetsTabKey = 'notes' | 'reviews' | 'saved';

export type MeProfileViewModel = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  affiliation: string;
  universityId: string | null;
  universityName: string | null;
  gradeYear: number | null;
};

export type MeUniversityOption = {
  id: string;
  name: string;
};

export type MeNoteItemViewModel = {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  offeringTitle: string;
  instructorName: string;
};

export type MeReviewItemViewModel = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  offeringTitle: string;
  instructorName: string;
};

export type MeTodayClassItemViewModel = {
  offeringId: string;
  courseTitle: string;
  instructorName: string;
  period: number | null;
  startTime: string | null;
  status: 'enrolled' | 'planned';
};

export type MeTimetableSummaryViewModel = {
  termLabel: string;
  currentTermEnrollmentCount: number;
  todayClasses: MeTodayClassItemViewModel[];
};

export type MeVisibilityUiState = {
  selected: 'private' | 'match_only' | 'public';
  helpText: string;
};
