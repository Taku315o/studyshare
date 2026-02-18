export type OfferingTab = 'notes' | 'reviews' | 'questions' | 'students';

export type OfferingMeta = {
  id: string;
  courseTitle: string;
  courseCode: string | null;
  instructorName: string | null;
  termLabel: string;
  timeslotLabel: string;
};

export type OfferingCounts = {
  notes: number;
  reviews: number;
  questions: number;
  students: number;
};

export type NoteListItem = {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  likesCount: number;
  bookmarksCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
  isBookmarkedByMe: boolean;
};

export type ReviewListItem = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
};

export type QuestionListItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
};

export type ReviewStats = {
  avgRating: number;
  reviewCount: number;
  distribution: [number, number, number, number, number];
};

export type OfferingTabData = {
  notes: NoteListItem[];
  reviews: ReviewListItem[];
  questions: QuestionListItem[];
  hasMoreNotes: boolean;
  hasMoreReviews: boolean;
  hasMoreQuestions: boolean;
  reviewStats: ReviewStats;
};
