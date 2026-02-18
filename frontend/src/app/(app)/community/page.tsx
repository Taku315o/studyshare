'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
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

type ParticipantSnapshot = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  affiliation: string;
};

const MATCH_LIMIT = 30;

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

function mapMessageRow(row: Pick<MessageRow, 'id' | 'conversation_id' | 'sender_id' | 'body' | 'created_at'>): ChatMessageViewModel {
  return {
    id: row.id,
    threadId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    isLocal: false,
  };
}

export default function CommunityPage() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const typedSupabase = supabase as unknown as SupabaseClient<Database>;

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

  const fetchMatchingCandidates = useCallback(async () => {
    setIsMatchingLoading(true);
    setMatchingErrorMessage(null);

    try {
      const { data, error } = await typedSupabase.rpc('find_match_candidates', {
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
        summaryLabel: `共有Offering ${row.shared_offering_count}件`,
      }));

      setCandidates(mapped);
    } catch (error) {
      console.error('コミュニティ候補取得エラー:', error);
      setCandidates([]);
      setMatchingErrorMessage('マッチング候補の取得に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setIsMatchingLoading(false);
    }
  }, [supabase]);

  const fetchThreads = useCallback(
    async (userId: string) => {
      setIsThreadsLoading(true);

      try {
        const { data: ownMembersRaw, error: ownMembersError } = await supabase
          .from('conversation_members')
          .select('conversation_id, user_id')
          .eq('user_id', userId);

        if (ownMembersError) {
          throw ownMembersError;
        }

        const ownMembers = (ownMembersRaw ?? []) as Pick<ConversationMemberRow, 'conversation_id' | 'user_id'>[];
        const conversationIds = ownMembers.map((member) => member.conversation_id);

        if (conversationIds.length === 0) {
          setThreads((prev) => prev.filter((thread) => thread.isLocal));
          return;
        }

        const { data: allMembersRaw, error: allMembersError } = await supabase
          .from('conversation_members')
          .select('conversation_id, user_id')
          .in('conversation_id', conversationIds);

        if (allMembersError) {
          throw allMembersError;
        }

        const allMembers = (allMembersRaw ?? []) as Pick<ConversationMemberRow, 'conversation_id' | 'user_id'>[];
        const partnerByConversationId = new Map<string, string>();

        allMembers.forEach((member) => {
          if (member.user_id === userId) return;
          if (!partnerByConversationId.has(member.conversation_id)) {
            partnerByConversationId.set(member.conversation_id, member.user_id);
          }
        });

        const partnerIds = Array.from(new Set(Array.from(partnerByConversationId.values())));

        const { data: profilesRaw, error: profilesError } = partnerIds.length
          ? await supabase
              .from('profiles')
              .select('user_id, display_name, avatar_url, faculty, department')
              .in('user_id', partnerIds)
          : { data: [], error: null };

        if (profilesError) {
          throw profilesError;
        }

        const profiles = (profilesRaw ?? []) as ProfileRow[];
        const profileById = new Map<string, ProfileRow>();
        profiles.forEach((profile) => {
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

        const messages = (messagesRaw ?? []) as Pick<MessageRow, 'id' | 'conversation_id' | 'sender_id' | 'body' | 'created_at'>[];
        const latestMessageByConversation = new Map<string, Pick<MessageRow, 'id' | 'conversation_id' | 'sender_id' | 'body' | 'created_at'>>();

        messages.forEach((message) => {
          if (!latestMessageByConversation.has(message.conversation_id)) {
            latestMessageByConversation.set(message.conversation_id, message);
          }
        });

        const remoteThreads: ThreadSummaryViewModel[] = conversationIds.map((conversationId) => {
          const participantId = partnerByConversationId.get(conversationId) ?? 'unknown';
          const profile = profileById.get(participantId);
          const latestMessage = latestMessageByConversation.get(conversationId);

          return {
            threadId: conversationId,
            participantId,
            participantName: profile?.display_name ?? '不明なユーザー',
            participantAvatarUrl: profile?.avatar_url ?? null,
            participantAffiliation: buildAffiliation(profile?.faculty ?? null, profile?.department ?? null),
            lastMessagePreview: latestMessage?.body ?? '',
            lastMessageAt: latestMessage?.created_at ?? null,
            unreadCount: 0,
            isLocal: false,
          };
        });

        setThreads((prev) => {
          const localsOnly = prev.filter((thread) => thread.isLocal);
          const remoteParticipantIds = new Set(remoteThreads.map((thread) => thread.participantId));
          const merged = [...remoteThreads, ...localsOnly.filter((thread) => !remoteParticipantIds.has(thread.participantId))];
          return sortThreads(merged);
        });
      } catch (error) {
        console.error('スレッド取得エラー:', error);
      } finally {
        setIsThreadsLoading(false);
      }
    },
    [supabase],
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

    void initialize();

    return () => {
      cancelled = true;
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

    if (messagesByThreadId[selectedThread.threadId]) {
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

        const mapped = ((data ?? []) as Pick<MessageRow, 'id' | 'conversation_id' | 'sender_id' | 'body' | 'created_at'>[]).map(
          mapMessageRow,
        );

        setMessagesByThreadId((prev) => ({
          ...prev,
          [selectedThread.threadId]: mapped,
        }));
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
  }, [selectedThread, messagesByThreadId, supabase]);

  const ensureLocalThread = useCallback(
    (participant: ParticipantSnapshot, seedMessages: ChatMessageViewModel[] = []) => {
      const localThreadId = `local:${participant.userId}`;

      setThreads((prev) => {
        const existing = prev.find((thread) => thread.threadId === localThreadId);
        if (existing) {
          return prev;
        }

        const nextThread: ThreadSummaryViewModel = {
          threadId: localThreadId,
          participantId: participant.userId,
          participantName: participant.displayName,
          participantAvatarUrl: participant.avatarUrl,
          participantAffiliation: participant.affiliation,
          lastMessagePreview: seedMessages[seedMessages.length - 1]?.body ?? '',
          lastMessageAt: seedMessages[seedMessages.length - 1]?.createdAt ?? null,
          unreadCount: 0,
          isLocal: true,
        };

        const withoutLocalForParticipant = prev.filter(
          (thread) => !(thread.isLocal && thread.participantId === participant.userId),
        );

        return sortThreads([nextThread, ...withoutLocalForParticipant]);
      });

      setMessagesByThreadId((prev) => {
        if (prev[localThreadId]) {
          return prev;
        }

        return {
          ...prev,
          [localThreadId]: seedMessages,
        };
      });

      return localThreadId;
    },
    [],
  );

  const updateThreadLastMessage = useCallback((threadId: string, body: string, createdAt: string) => {
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
  }, []);

  const handleStartMessage = useCallback(
    async (candidate: MatchCandidateViewModel) => {
      setFallbackNotice(null);
      setIsMobileMessagesOpen(true);

      const existing = threads.find((thread) => thread.participantId === candidate.userId);
      if (existing) {
        setSelectedThreadId(existing.threadId);
        return;
      }

      try {
        const { data, error } = await typedSupabase.rpc('create_direct_conversation', {
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
          unreadCount: 0,
          isLocal: false,
        };

        setThreads((prev) => {
          const withoutParticipantLocal = prev.filter(
            (thread) => !(thread.isLocal && thread.participantId === candidate.userId),
          );
          const withoutSameId = withoutParticipantLocal.filter((thread) => thread.threadId !== remoteThreadId);
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
        const localThreadId = ensureLocalThread({
          userId: candidate.userId,
          displayName: candidate.displayName,
          avatarUrl: candidate.avatarUrl,
          affiliation: buildAffiliation(candidate.faculty, candidate.department),
        });
        setSelectedThreadId(localThreadId);
        setFallbackNotice('DM制約のためローカル会話モードで表示しています（保存されません）。');
      }
    },
    [currentUserId, ensureLocalThread, fetchThreads, supabase, threads],
  );

  const handleSelectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
    setIsMobileMessagesOpen(true);
    setFallbackNotice(null);
  }, []);

  const handleSendMessage = useCallback(
    async (body: string) => {
      if (!selectedThread || !currentUserId) return;

      const now = new Date().toISOString();

      if (selectedThread.isLocal) {
        const localMessage: ChatMessageViewModel = {
          id: `local-message:${Date.now()}`,
          threadId: selectedThread.threadId,
          senderId: currentUserId,
          body,
          createdAt: now,
          isLocal: true,
        };

        setMessagesByThreadId((prev) => ({
          ...prev,
          [selectedThread.threadId]: [...(prev[selectedThread.threadId] ?? []), localMessage],
        }));

        updateThreadLastMessage(selectedThread.threadId, body, now);
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

        const mapped = mapMessageRow(data as Pick<MessageRow, 'id' | 'conversation_id' | 'sender_id' | 'body' | 'created_at'>);

        setMessagesByThreadId((prev) => ({
          ...prev,
          [selectedThread.threadId]: [...(prev[selectedThread.threadId] ?? []), mapped],
        }));

        updateThreadLastMessage(selectedThread.threadId, mapped.body, mapped.createdAt);
        setMessagesErrorMessage(null);
      } catch (error) {
        console.error('メッセージ送信エラー:', error);

        const existingMessages = messagesByThreadId[selectedThread.threadId] ?? [];

        const localThreadId = ensureLocalThread(
          {
            userId: selectedThread.participantId,
            displayName: selectedThread.participantName,
            avatarUrl: selectedThread.participantAvatarUrl,
            affiliation: selectedThread.participantAffiliation,
          },
          existingMessages,
        );

        const fallbackMessage: ChatMessageViewModel = {
          id: `local-message:${Date.now()}`,
          threadId: localThreadId,
          senderId: currentUserId,
          body,
          createdAt: now,
          isLocal: true,
        };

        setMessagesByThreadId((prev) => ({
          ...prev,
          [localThreadId]: [...(prev[localThreadId] ?? []), fallbackMessage],
        }));

        updateThreadLastMessage(localThreadId, body, now);
        setSelectedThreadId(localThreadId);
        setFallbackNotice('DM制約のためローカル会話モードに切り替えました（保存されません）。');
      }
    },
    [currentUserId, ensureLocalThread, messagesByThreadId, selectedThread, supabase, updateThreadLastMessage],
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
          candidates={activeTab === 'matching' ? filteredCandidates : []}
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
