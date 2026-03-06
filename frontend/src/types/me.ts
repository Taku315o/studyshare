export type MeAssetsTabKey = 'notes' | 'reviews' | 'saved';

export type MeProfileViewModel = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  faculty: string | null;
  universityId: string | null;
  universityName: string | null;
  gradeYear: number | null;
  followersCount: number;
  followingCount: number;
};

export type MeUniversityOption = {
  id: string;
  name: string;
};

// ユーザーが作成したノートの情報を表すViewModel
export type MeNoteItemViewModel = {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  offeringTitle: string;
  instructorName: string;
};

// ユーザーが作成したレビューの情報を表すViewModel
export type MeReviewItemViewModel = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  offeringTitle: string;
  instructorName: string;
};

// ユーザーが保存したノートの情報を表すViewModel
export type MeSavedNoteItemViewModel = {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  offeringTitle: string;
  instructorName: string;
  savedAt: string;
  savedByLike: boolean;
  savedByBookmark: boolean;
};

// 今日の授業の情報を表すViewModel
export type MeTodayClassItemViewModel = {
  offeringId: string;
  courseTitle: string;
  instructorName: string;
  period: number | null;
  startTime: string | null;
  status: 'enrolled' | 'planned';
};

// マイページの時間割サマリーの情報を表すViewModel
export type MeTimetableSummaryViewModel = {
  termLabel: string;
  currentTermEnrollmentCount: number;
  todayClasses: MeTodayClassItemViewModel[];
};

export type MeVisibilityUiState = {
  selected: 'private' | 'match_only' | 'public';
  helpText: string;
};
