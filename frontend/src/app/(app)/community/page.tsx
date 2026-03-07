'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import { useSearchParams } from 'next/navigation';
import CommunityPane from '@/components/community/CommunityPane';
import MessagesPane from '@/components/community/MessagesPane';
import { createSupabaseClient } from '@/lib/supabase/client';
import type {
  ChatMessageViewModel,
  CommunityFilterChipKey,
  CommunityTabKey,
  MatchCandidateViewModel,
  ThreadSummaryViewModel,
} from '@/types/community';
import type { Database } from '@/types/supabase';

type MatchCandidateRpcRow = Database['public']['Functions']['find_match_candidates']['Returns'][number];
type ConversationMemberRow = Database['public']['Tables']['conversation_members']['Row'];
type MessageRow = Database['public']['Tables']['messages']['Row'];
type ProfileRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'user_id' | 'display_name' | 'avatar_url' | 'faculty' | 'department'
>;
type DmTargetProfileRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'user_id' | 'display_name' | 'avatar_url' | 'faculty' | 'department' | 'allow_dm'
>;
type ConversationMemberSummary = Pick<ConversationMemberRow, 'conversation_id' | 'user_id' | 'last_read_at'>;
type MessageSummary = Pick<MessageRow, 'id' | 'conversation_id' | 'sender_id' | 'body' | 'created_at'>;

const MATCH_LIMIT = 30;
const DM_UNLOCK_NOTICE =
  'DM送信条件を満たしていません。2年生以上はノート/口コミの投稿を2件以上するとDMを送信できます。';

function buildAffiliation(faculty: string | null, department: string | null) {
  return [faculty, department].filter(Boolean).join(' / ') || '所属未設定';
}

function sortThreads(threads: ThreadSummaryViewModel[]) {
  return [...threads].sort((left, right) => {
    if (!left.lastMessageAt && !right.lastMessageAt) {
      return left.participantName.localeCompare(right.participantName, 'ja-JP');
    }
    if (!left.lastMessageAt) return 1;
    if (!right.lastMessageAt) return -1;
    return right.lastMessageAt.localeCompare(left.lastMessageAt);
  });
}

function isReadAtOrAfter(readAt: string | null, createdAt: string) {
  if (!readAt) return false;
  return readAt.localeCompare(createdAt) >= 0;
}

function mapMessageRow(row: MessageSummary, participantLastReadAt: string | null): ChatMessageViewModel {
  return {
    id: row.id,
    threadId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    readAt: isReadAtOrAfter(participantLastReadAt, row.created_at) ? participantLastReadAt : null,
    isLocal: false,
  };
}

function applyParticipantReadState(messages: ChatMessageViewModel[], participantLastReadAt: string | null) {
  return messages.map((message) => ({
    ...message,
    readAt: isReadAtOrAfter(participantLastReadAt, message.createdAt) ? participantLastReadAt : null,
  }));
}

function getLatestIncomingMessageAt(messages: ChatMessageViewModel[], currentUserId: string | null) {
  if (!currentUserId) return null;

  const latestIncoming = [...messages]
    .reverse()
    .find((message) => !message.isLocal && message.senderId !== currentUserId);

  return latestIncoming?.createdAt ?? null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return null;
}

export default function CommunityPage() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const typedSupabase = supabase as unknown as SupabaseClient<Database>;
  const searchParams = useSearchParams();
  const lastDeepLinkAttemptRef = useRef<string | null>(null);
  const markingThreadIdsRef = useRef<Set<string>>(new Set());

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<CommunityTabKey>('matching');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeChip, setActiveChip] = useState<CommunityFilterChipKey>('same-class');

  const [candidates, setCandidates] = useState<MatchCandidateViewModel[]>([]);
  const [isMatchingLoading, setIsMatchingLoading] = useState(true);
  const [matchingErrorMessage, setMatchingErrorMessage] = useState<string | null>(null);

  const [threads, setThreads] = useState<ThreadSummaryViewModel[]>([]);
  const [isThreadsLoading, setIsThreadsLoading] = useState(true);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messagesByThreadId, setMessagesByThreadId] = useState<Record<string, ChatMessageViewModel[]>>({});
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [messagesErrorMessage, setMessagesErrorMessage] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  const [isMobileMessagesOpen, setIsMobileMessagesOpen] = useState(false);

  const isThreadPaneVisible = useCallback(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.innerWidth >= 1024 || isMobileMessagesOpen;
  }, [isMobileMessagesOpen]);

  const updateMessagesReadState = useCallback((threadId: string, participantLastReadAt: string | null) => {
    setMessagesByThreadId((prev) => {
      const threadMessages = prev[threadId];
      if (!threadMessages) {
        return prev;
      }

      return {
        ...prev,
        [threadId]: applyParticipantReadState(threadMessages, participantLastReadAt),
      };
    });
  }, []);

  const syncOwnReadState = useCallback((threadId: string, lastReadAt: string) => {
    setThreads((prev) =>
      sortThreads(
        prev.map((thread) => {
          if (thread.threadId !== threadId) {
            return thread;
          }

          return {
            ...thread,
            lastReadAt,
            unreadCount: 0,
          };
        }),
      ),
    );
  }, []);

  const syncParticipantReadState = useCallback(
    (threadId: string, participantLastReadAt: string | null) => {
      setThreads((prev) =>
        sortThreads(
          prev.map((thread) =>
            thread.threadId === threadId
              ? {
                  ...thread,
                  participantLastReadAt,
                }
              : thread,
          ),
        ),
      );
      updateMessagesReadState(threadId, participantLastReadAt);
    },
    [updateMessagesReadState],
  );

  const fetchDmTargetProfile = useCallback(
    async (userId: string) => {
      const { data, error } = await typedSupabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, faculty, department, allow_dm')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data ?? null) as DmTargetProfileRow | null;
    },
    [typedSupabase],
  );

  const canCurrentUserStartDm = useCallback(async () => {
    if (!currentUserId) {
      return false;
    }

    const rpcClient = typedSupabase as unknown as {
      rpc: (
        fn: 'can_send_message',
        args: { _uid: string },
      ) => Promise<{ data: boolean | null; error: { message?: string } | null }>;
    };

    const { data, error } = await rpcClient.rpc('can_send_message', {
      _uid: currentUserId,
    });

    if (error) {
      throw error;
    }

    return Boolean(data);
  }, [currentUserId, typedSupabase]);

  const fetchMatchingCandidates = useCallback(async () => {
    setIsMatchingLoading(true);
    setMatchingErrorMessage(null);

    try {
      const rpcClient = typedSupabase as unknown as {
        rpc: (
          fn: 'find_match_candidates',
          args: { _limit: number; _min_shared: number },
        ) => Promise<{ data: MatchCandidateRpcRow[] | null; error: { message?: string } | null }>;
      };

      const { data, error } = await rpcClient.rpc('find_match_candidates', {
        _limit: MATCH_LIMIT,
        _min_shared: 1,
      });

      if (error) {
        throw error;
      }

      const mapped = ((data ?? []) as MatchCandidateRpcRow[]).map((row) => ({
        userId: row.matched_user_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url ?? null,
        faculty: row.faculty ?? null,
        department: row.department ?? null,
        sharedOfferingCount: row.shared_offering_count,
        summaryLabel: `同じ授業 ${row.shared_offering_count}件`,
      }));

      setCandidates(mapped);
    } catch (error) {
      console.error('コミュニティ候補取得エラー:', error);
      setCandidates([]);
      setMatchingErrorMessage('マッチング候補の取得に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setIsMatchingLoading(false);
    }
  }, [typedSupabase]);

  const fetchThreads = useCallback(
    async (userId: string) => {
      setIsThreadsLoading(true);

      try {
        const { data: ownMembersRaw, error: ownMembersError } = await supabase
          .from('conversation_members')
          .select('conversation_id, user_id, last_read_at')
          .eq('user_id', userId);

        if (ownMembersError) {
          throw ownMembersError;
        }

        const ownMembers = (ownMembersRaw ?? []) as ConversationMemberSummary[];
        const conversationIds = ownMembers.map((member) => member.conversation_id);

        if (conversationIds.length === 0) {
          setThreads((prev) => prev.filter((thread) => thread.isLocal));
          return;
        }

        const { data: allMembersRaw, error: allMembersError } = await supabase
          .from('conversation_members')
          .select('conversation_id, user_id, last_read_at')
          .in('conversation_id', conversationIds);

        if (allMembersError) {
          throw allMembersError;
        }

        const allMembers = (allMembersRaw ?? []) as ConversationMemberSummary[];
        const membersByConversationId = new Map<string, ConversationMemberSummary[]>();
        allMembers.forEach((member) => {
          const members = membersByConversationId.get(member.conversation_id) ?? [];
          members.push(member);
          membersByConversationId.set(member.conversation_id, members);
        });

        const partnerByConversationId = new Map<string, ConversationMemberSummary>();
        ownMembers.forEach((ownMember) => {
          const members = membersByConversationId.get(ownMember.conversation_id) ?? [];
          const partner = members.find((member) => member.user_id !== userId) ?? null;
          if (partner) {
            partnerByConversationId.set(ownMember.conversation_id, partner);
          }
        });

        const partnerIds = Array.from(new Set(Array.from(partnerByConversationId.values()).map((member) => member.user_id)));

        const { data: profilesRaw, error: profilesError } = partnerIds.length
          ? await supabase
              .from('profiles')
              .select('user_id, display_name, avatar_url, faculty, department')
              .in('user_id', partnerIds)
          : { data: [], error: null };

        if (profilesError) {
          throw profilesError;
        }

        const profileById = new Map<string, ProfileRow>();
        ((profilesRaw ?? []) as ProfileRow[]).forEach((profile) => {
          profileById.set(profile.user_id, profile);
        });

        const { data: messagesRaw, error: messagesError } = await supabase
          .from('messages')
          .select('id, conversation_id, sender_id, body, created_at')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false })
          .limit(500);

        if (messagesError) {
          throw messagesError;
        }

        const messages = (messagesRaw ?? []) as MessageSummary[];
        const messagesByConversationId = new Map<string, MessageSummary[]>();
        messages.forEach((message) => {
          const threadMessages = messagesByConversationId.get(message.conversation_id) ?? [];
          threadMessages.push(message);
          messagesByConversationId.set(message.conversation_id, threadMessages);
        });

        const remoteThreads: ThreadSummaryViewModel[] = ownMembers.map((ownMember) => {
          const conversationId = ownMember.conversation_id;
          const participant = partnerByConversationId.get(conversationId);
          const participantId = participant?.user_id ?? 'unknown';
          const profile = profileById.get(participantId);
          const conversationMessages = messagesByConversationId.get(conversationId) ?? [];
          const latestMessage = conversationMessages[0] ?? null;
          const lastIncomingMessage = conversationMessages.find((message) => message.sender_id !== userId) ?? null;
          const unreadCount = conversationMessages.filter(
            (message) => message.sender_id !== userId && !isReadAtOrAfter(ownMember.last_read_at, message.created_at),
          ).length;

          return {
            threadId: conversationId,
            participantId,
            participantName: profile?.display_name ?? '不明なユーザー',
            participantAvatarUrl: profile?.avatar_url ?? null,
            participantAffiliation: buildAffiliation(profile?.faculty ?? null, profile?.department ?? null),
            lastMessagePreview: latestMessage?.body ?? '',
            lastMessageAt: latestMessage?.created_at ?? null,
            lastReadAt: ownMember.last_read_at,
            lastIncomingMessageAt: lastIncomingMessage?.created_at ?? null,
            participantLastReadAt: participant?.last_read_at ?? null,
            unreadCount,
            isLocal: false,
          };
        });

        setThreads((prev) => {
          const localsOnly = prev.filter((thread) => thread.isLocal);
          const remoteParticipantIds = new Set(remoteThreads.map((thread) => thread.participantId));
          const merged = [...remoteThreads, ...localsOnly.filter((thread) => !remoteParticipantIds.has(thread.participantId))];
          const sorted = sortThreads(merged);
          const seenParticipantIds = new Set<string>();
          return sorted.filter((thread) => {
            if (seenParticipantIds.has(thread.participantId)) {
              return false;
            }
            seenParticipantIds.add(thread.participantId);
            return true;
          });
        });

        setMessagesByThreadId((prev) => {
          const next = { ...prev };
          remoteThreads.forEach((thread) => {
            if (next[thread.threadId]) {
              next[thread.threadId] = applyParticipantReadState(next[thread.threadId], thread.participantLastReadAt);
            }
          });
          return next;
        });
      } catch (error) {
        console.error('スレッド取得エラー:', error);
      } finally {
        setIsThreadsLoading(false);
      }
    },
    [supabase],
  );

  const markThreadAsRead = useCallback(
    async (threadId: string, messages: ChatMessageViewModel[]) => {
      if (!currentUserId) {
        return;
      }

      if (!isThreadPaneVisible()) {
        return;
      }

      const thread = threads.find((candidate) => candidate.threadId === threadId);
      if (!thread || thread.isLocal) {
        return;
      }

      const latestIncomingCreatedAt = getLatestIncomingMessageAt(messages, currentUserId);
      if (!latestIncomingCreatedAt) {
        return;
      }

      if (isReadAtOrAfter(thread.lastReadAt, latestIncomingCreatedAt)) {
        return;
      }

      if (markingThreadIdsRef.current.has(threadId)) {
        return;
      }

      markingThreadIdsRef.current.add(threadId);

      try {
        const { error } = await typedSupabase
          .from('conversation_members')
          .update({
            last_read_at: latestIncomingCreatedAt,
          })
          .eq('conversation_id', threadId)
          .eq('user_id', currentUserId);

        if (error) {
          throw error;
        }

        syncOwnReadState(threadId, latestIncomingCreatedAt);
      } catch (error) {
        console.error('既読更新エラー:', error);
      } finally {
        markingThreadIdsRef.current.delete(threadId);
      }
    },
    [currentUserId, isThreadPaneVisible, syncOwnReadState, threads, typedSupabase],
  );

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          throw error;
        }

        if (cancelled) return;
        setCurrentUserId(user?.id ?? null);
      } catch (error) {
        console.error('ユーザー取得エラー:', error);
        if (!cancelled) {
          setCurrentUserId(null);
          setIsMatchingLoading(false);
          setIsThreadsLoading(false);
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setCurrentUserId(session?.user?.id ?? null);
    });

    void initialize();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!currentUserId) {
      setCandidates([]);
      setThreads([]);
      setMessagesByThreadId({});
      setSelectedThreadId(null);
      setIsMatchingLoading(false);
      setIsThreadsLoading(false);
      return;
    }

    void fetchMatchingCandidates();
    void fetchThreads(currentUserId);
  }, [currentUserId, fetchMatchingCandidates, fetchThreads]);

  useEffect(() => {
    if (threads.length === 0) {
      setSelectedThreadId(null);
      return;
    }

    if (!selectedThreadId) {
      setSelectedThreadId(threads[0].threadId);
      return;
    }

    const exists = threads.some((thread) => thread.threadId === selectedThreadId);
    if (!exists) {
      setSelectedThreadId(threads[0].threadId);
    }
  }, [threads, selectedThreadId]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.threadId === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  useEffect(() => {
    if (!selectedThread || selectedThread.isLocal) {
      setMessagesErrorMessage(null);
      return;
    }

    const cachedMessages = messagesByThreadId[selectedThread.threadId];
    if (cachedMessages) {
      void markThreadAsRead(selectedThread.threadId, cachedMessages);
      return;
    }

    let cancelled = false;

    const fetchMessages = async () => {
      setIsMessagesLoading(true);
      setMessagesErrorMessage(null);

      try {
        const { data, error } = await supabase
          .from('messages')
          .select('id, conversation_id, sender_id, body, created_at')
          .eq('conversation_id', selectedThread.threadId)
          .order('created_at', { ascending: true });

        if (error) {
          throw error;
        }

        if (cancelled) return;

        const mapped = ((data ?? []) as MessageSummary[]).map((row) =>
          mapMessageRow(row, selectedThread.participantLastReadAt),
        );

        setMessagesByThreadId((prev) => ({
          ...prev,
          [selectedThread.threadId]: mapped,
        }));

        await markThreadAsRead(selectedThread.threadId, mapped);
      } catch (error) {
        console.error('メッセージ取得エラー:', error);
        if (!cancelled) {
          setMessagesErrorMessage('会話の取得に失敗しました。');
        }
      } finally {
        if (!cancelled) {
          setIsMessagesLoading(false);
        }
      }
    };

    void fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [markThreadAsRead, messagesByThreadId, selectedThread, supabase]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const handleMessageInsert = async (payload: RealtimePostgresChangesPayload<MessageRow>) => {
      const message = payload.new as MessageRow | null;
      if (!message || !message.conversation_id || !message.created_at) {
        return;
      }

      let shouldFetchThreads = false;

      setThreads((prev) => {
        const existingThread = prev.find((thread) => thread.threadId === message.conversation_id);
        if (!existingThread) {
          shouldFetchThreads = true;
          return prev;
        }

        const isIncoming = message.sender_id !== currentUserId;
        const nextThread = {
          ...existingThread,
          lastMessagePreview: message.body,
          lastMessageAt: message.created_at,
          lastIncomingMessageAt: isIncoming ? message.created_at : existingThread.lastIncomingMessageAt,
          unreadCount: isIncoming ? existingThread.unreadCount + 1 : existingThread.unreadCount,
        };

        return sortThreads(prev.map((thread) => (thread.threadId === message.conversation_id ? nextThread : thread)));
      });

      if (shouldFetchThreads) {
        await fetchThreads(currentUserId);
        return;
      }

      const participantLastReadAt =
        threads.find((thread) => thread.threadId === message.conversation_id)?.participantLastReadAt ?? null;

      setMessagesByThreadId((prev) => {
        const existingMessages = prev[message.conversation_id];
        if (!existingMessages) {
          return prev;
        }

        if (existingMessages.some((entry) => entry.id === message.id)) {
          return prev;
        }

        return {
          ...prev,
          [message.conversation_id]: [...existingMessages, mapMessageRow(message, participantLastReadAt)],
        };
      });

      if (message.sender_id !== currentUserId && selectedThreadId === message.conversation_id && isThreadPaneVisible()) {
        const nextMessages = [
          ...(messagesByThreadId[message.conversation_id] ?? []),
          mapMessageRow(message, participantLastReadAt),
        ];
        await markThreadAsRead(message.conversation_id, nextMessages);
      }
    };

    const handleConversationMemberUpdate = async (payload: RealtimePostgresChangesPayload<ConversationMemberRow>) => {
      const member = payload.new as ConversationMemberRow | null;
      if (!member || !member.conversation_id) {
        return;
      }

      const existingThread = threads.find((thread) => thread.threadId === member.conversation_id);
      if (!existingThread) {
        return;
      }

      if (member.user_id === currentUserId) {
        if (member.last_read_at) {
          syncOwnReadState(member.conversation_id, member.last_read_at);
        }
        return;
      }

      syncParticipantReadState(member.conversation_id, member.last_read_at);
    };

    const channel = supabase
      .channel(`community:${currentUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        void handleMessageInsert(payload as RealtimePostgresChangesPayload<MessageRow>);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members' }, (payload) => {
        void handleConversationMemberUpdate(payload as RealtimePostgresChangesPayload<ConversationMemberRow>);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    currentUserId,
    fetchThreads,
    isThreadPaneVisible,
    markThreadAsRead,
    messagesByThreadId,
    selectedThreadId,
    supabase,
    syncOwnReadState,
    syncParticipantReadState,
    threads,
  ]);

  const updateThreadLastMessage = useCallback(
    (threadId: string, body: string, createdAt: string) => {
      setThreads((prev) =>
        sortThreads(
          prev.map((thread) =>
            thread.threadId === threadId
              ? {
                  ...thread,
                  lastMessagePreview: body,
                  lastMessageAt: createdAt,
                }
              : thread,
          ),
        ),
      );
    },
    [],
  );

  const handleStartMessage = useCallback(
    async (candidate: MatchCandidateViewModel) => {
      setFallbackNotice(null);
      setIsMobileMessagesOpen(true);

      const existing = threads.find((thread) => thread.participantId === candidate.userId);
      if (existing) {
        setSelectedThreadId(existing.threadId);
        return;
      }

      const canStartDm = await canCurrentUserStartDm();
      if (!canStartDm) {
        setFallbackNotice(DM_UNLOCK_NOTICE);
        return;
      }

      try {
        const rpcClient = typedSupabase as unknown as {
          rpc: (
            fn: 'create_direct_conversation',
            args: { _other_user_id: string },
          ) => Promise<{ data: string | null; error: { message?: string } | null }>;
        };

        const { data, error } = await rpcClient.rpc('create_direct_conversation', {
          _other_user_id: candidate.userId,
        });

        if (error || !data) {
          throw error ?? new Error('会話作成に失敗しました');
        }

        const remoteThreadId = data;
        const newThread: ThreadSummaryViewModel = {
          threadId: remoteThreadId,
          participantId: candidate.userId,
          participantName: candidate.displayName,
          participantAvatarUrl: candidate.avatarUrl,
          participantAffiliation: buildAffiliation(candidate.faculty, candidate.department),
          lastMessagePreview: '',
          lastMessageAt: null,
          lastReadAt: null,
          lastIncomingMessageAt: null,
          participantLastReadAt: null,
          unreadCount: 0,
          isLocal: false,
        };

        setThreads((prev) => {
          const withoutSameParticipant = prev.filter((thread) => thread.participantId !== candidate.userId);
          const withoutSameId = withoutSameParticipant.filter((thread) => thread.threadId !== remoteThreadId);
          return sortThreads([newThread, ...withoutSameId]);
        });

        setMessagesByThreadId((prev) => ({
          ...prev,
          [remoteThreadId]: prev[remoteThreadId] ?? [],
        }));

        setSelectedThreadId(remoteThreadId);

        if (currentUserId) {
          void fetchThreads(currentUserId);
        }
      } catch (error) {
        console.error('新規DM開始エラー:', error);

        try {
          const targetProfile = await fetchDmTargetProfile(candidate.userId);
          if (targetProfile?.allow_dm === false) {
            setFallbackNotice('このユーザーはDM受信をオフにしているため、DMを開始できません。');
            return;
          }
        } catch (profileError) {
          console.error('DM相手プロフィール確認エラー:', profileError);
        }

        const errorMessage = getErrorMessage(error);
        setFallbackNotice(
          errorMessage?.toLowerCase().includes('row-level security')
            ? DM_UNLOCK_NOTICE
            : 'DMを開始できませんでした。時間をおいて再度お試しください。',
        );
      }
    },
    [canCurrentUserStartDm, currentUserId, fetchDmTargetProfile, fetchThreads, threads, typedSupabase],
  );

  useEffect(() => {
    const composeTo = searchParams?.get('composeTo');
    const composeName = searchParams?.get('composeName');

    if (!composeTo || !currentUserId) {
      return;
    }

    if (isThreadsLoading) {
      return;
    }

    if (composeTo === currentUserId) {
      if (lastDeepLinkAttemptRef.current !== composeTo) {
        lastDeepLinkAttemptRef.current = composeTo;
        setFallbackNotice('自分自身にはDMを送れません。');
        setIsMobileMessagesOpen(true);
      }
      return;
    }

    if (lastDeepLinkAttemptRef.current === composeTo) {
      return;
    }

    const existing = threads.find((thread) => thread.participantId === composeTo);
    if (existing) {
      lastDeepLinkAttemptRef.current = composeTo;
      setActiveTab('matching');
      setSelectedThreadId(existing.threadId);
      setIsMobileMessagesOpen(true);
      setFallbackNotice(null);
      return;
    }

    lastDeepLinkAttemptRef.current = composeTo;

    let cancelled = false;

    const startFromDeepLink = async () => {
      setActiveTab('matching');
      setFallbackNotice(null);
      setIsMobileMessagesOpen(true);

      try {
        const profile = await fetchDmTargetProfile(composeTo);

        if (cancelled) return;

        if (profile?.allow_dm === false) {
          setFallbackNotice('このユーザーはDM受信をオフにしているため、DMを開始できません。');
          return;
        }

        await handleStartMessage({
          userId: composeTo,
          displayName: profile?.display_name ?? composeName ?? 'ユーザー',
          avatarUrl: profile?.avatar_url ?? null,
          faculty: profile?.faculty ?? null,
          department: profile?.department ?? null,
          sharedOfferingCount: 0,
          summaryLabel: 'プロフィールからのDM',
        });
      } catch (error) {
        console.error('プロフィール経由DM開始エラー:', error);
        if (!cancelled) {
          setFallbackNotice('DM開始の準備に失敗しました。時間をおいて再度お試しください。');
        }
      }
    };

    void startFromDeepLink();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, fetchDmTargetProfile, handleStartMessage, isThreadsLoading, searchParams, threads]);

  const handleSelectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
    setIsMobileMessagesOpen(true);
    setFallbackNotice(null);
  }, []);

  const handleSendMessage = useCallback(
    async (body: string) => {
      if (!selectedThread || !currentUserId) return;

      const {
        data: { user: sessionUser },
        error: sessionError,
      } = await supabase.auth.getUser();

      if (sessionError) {
        console.error('送信前セッション確認エラー:', sessionError);
        setMessagesErrorMessage('ログインセッションの確認に失敗しました。時間をおいて再度お試しください。');
        setFallbackNotice('メッセージ送信を中断しました。ログイン状態を確認してください。');
        return;
      }

      if (!sessionUser) {
        setCurrentUserId(null);
        setMessagesErrorMessage('ログインセッションが切れました。再ログインしてから再度お試しください。');
        setFallbackNotice('メッセージ送信を中断しました。ログイン状態を確認してください。');
        return;
      }

      if (sessionUser.id !== currentUserId) {
        console.warn('コミュニティ画面のユーザーIDとセッションが不一致です', {
          currentUserId,
          sessionUserId: sessionUser.id,
        });
        setCurrentUserId(sessionUser.id);
        setMessagesErrorMessage(
          '別アカウントのセッションに切り替わっています。画面を開き直して、送信元アカウントを確認してください。',
        );
        setFallbackNotice('セッション不一致を検出したため、ローカル送信へはフォールバックしませんでした。');
        return;
      }

      try {
        const { data, error } = await typedSupabase
          .from('messages')
          .insert({
            conversation_id: selectedThread.threadId,
            sender_id: currentUserId,
            body,
          })
          .select('id, conversation_id, sender_id, body, created_at')
          .single();

        if (error || !data) {
          throw error ?? new Error('メッセージ送信に失敗しました');
        }

        const mapped = mapMessageRow(data as MessageSummary, selectedThread.participantLastReadAt);

        setMessagesByThreadId((prev) => ({
          ...prev,
          [selectedThread.threadId]: [...(prev[selectedThread.threadId] ?? []), mapped],
        }));

        updateThreadLastMessage(selectedThread.threadId, mapped.body, mapped.createdAt);
        setMessagesErrorMessage(null);
      } catch (error) {
        console.error('メッセージ送信エラー:', error);
        const errorMessage = getErrorMessage(error);
        setMessagesErrorMessage('メッセージ送信に失敗しました。時間をおいて再度お試しください。');
        if (errorMessage?.toLowerCase().includes('row-level security')) {
          setFallbackNotice(DM_UNLOCK_NOTICE);
        }
      }
    },
    [currentUserId, selectedThread, supabase.auth, typedSupabase, updateThreadLastMessage],
  );

  const filteredCandidates = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return candidates;
    return candidates.filter((candidate) => {
      return (
        candidate.displayName.toLowerCase().includes(keyword) ||
        (candidate.faculty ?? '').toLowerCase().includes(keyword) ||
        (candidate.department ?? '').toLowerCase().includes(keyword)
      );
    });
  }, [candidates, searchKeyword]);

  const enrichedCandidates = useMemo(
    () =>
      filteredCandidates.map((candidate) => ({
        ...candidate,
        hasExistingThread: threads.some((thread) => thread.participantId === candidate.userId),
      })),
    [filteredCandidates, threads],
  );

  const selectedMessages = selectedThreadId ? messagesByThreadId[selectedThreadId] ?? [] : [];

  const unreadCount = useMemo(
    () => threads.reduce((sum, thread) => sum + thread.unreadCount, 0),
    [threads],
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
        <CommunityPane
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchKeyword={searchKeyword}
          onSearchKeywordChange={setSearchKeyword}
          activeChip={activeChip}
          onChipChange={setActiveChip}
          candidates={activeTab === 'matching' ? enrichedCandidates : []}
          isLoading={isMatchingLoading}
          errorMessage={matchingErrorMessage}
          onSendMessage={handleStartMessage}
          onOpenMessagesMobile={() => setIsMobileMessagesOpen(true)}
        />

        <div className="hidden lg:block">
          <MessagesPane
            unreadCount={unreadCount}
            threads={threads}
            selectedThreadId={selectedThreadId}
            selectedThread={selectedThread}
            messages={selectedMessages}
            currentUserId={currentUserId}
            threadsLoading={isThreadsLoading}
            messagesLoading={isMessagesLoading}
            messagesError={messagesErrorMessage}
            fallbackNotice={fallbackNotice}
            onSelectThread={handleSelectThread}
            onSendMessage={handleSendMessage}
          />
        </div>
      </div>

      {isMobileMessagesOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40 p-3 lg:hidden">
          <MessagesPane
            unreadCount={unreadCount}
            threads={threads}
            selectedThreadId={selectedThreadId}
            selectedThread={selectedThread}
            messages={selectedMessages}
            currentUserId={currentUserId}
            threadsLoading={isThreadsLoading}
            messagesLoading={isMessagesLoading}
            messagesError={messagesErrorMessage}
            fallbackNotice={fallbackNotice}
            onSelectThread={handleSelectThread}
            onSendMessage={handleSendMessage}
            onRequestCloseMobile={() => setIsMobileMessagesOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
