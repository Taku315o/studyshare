export type CommunityTabKey = 'matching' | 'reviews' | 'more';

export type CommunityFilterChipKey = 'time-near' | 'same-class' | 'same-task';

export type MatchCandidateViewModel = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  faculty: string | null;
  department: string | null;
  sharedOfferingCount: number;
  summaryLabel: string;
  hasExistingThread?: boolean;
};

export type ThreadSummaryViewModel = {
  threadId: string;
  participantId: string;
  participantName: string;
  participantAvatarUrl: string | null;
  participantAffiliation: string;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unreadCount: number;
  isLocal: boolean;
};

export type ChatMessageViewModel = {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
  isLocal: boolean;
};
