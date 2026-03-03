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
  imageUrl: string | null;
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
  authorAllowDm: boolean | null;
};

export type QuestionListItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorAllowDm: boolean | null;
  answersCount: number;
};

export type ThreadAuthor = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type ThreadNodeBase = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  deletedAt: string | null;
  author: ThreadAuthor;
};

export type NoteCommentNode = ThreadNodeBase & {
  noteId: string;
};

export type QuestionAnswerNode = ThreadNodeBase & {
  questionId: string;
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
