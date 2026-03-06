'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import FollowListModal from '@/components/profile/FollowListModal';
import { createSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';

type ProfileFollowPanelProps = {
  targetUserId: string;
  currentUserId?: string | null;
  targetDisplayName: string;
  initialFollowersCount: number;
  initialFollowingCount: number;
  initialIsFollowing: boolean;
  showFollowButton: boolean;
};

type FollowSummaryRow = Database['public']['Functions']['follow_user']['Returns'][number];

export default function ProfileFollowPanel({
  targetUserId,
  currentUserId = null,
  targetDisplayName,
  initialFollowersCount,
  initialFollowingCount,
  initialIsFollowing,
  showFollowButton,
}: ProfileFollowPanelProps) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const typedSupabase = supabase as unknown as SupabaseClient<Database>;
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [followingCount, setFollowingCount] = useState(initialFollowingCount);
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [openModal, setOpenModal] = useState<'followers' | 'following' | null>(null);
  const [isPending, setIsPending] = useState(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    setFollowersCount(initialFollowersCount);
    setFollowingCount(initialFollowingCount);
    setIsFollowing(initialIsFollowing);
    setOpenModal(null);
    setIsPending(false);
    pendingRef.current = false;
  }, [initialFollowersCount, initialFollowingCount, initialIsFollowing, targetUserId]);

  const isSelf = Boolean(currentUserId && currentUserId === targetUserId);
  const canToggleFollow = showFollowButton && !isSelf;

  const applySummary = (summary: FollowSummaryRow) => {
    setFollowersCount(summary.followers_count);
    setFollowingCount(summary.following_count);
    setIsFollowing(summary.is_following);
  };

  const handleToggleFollow = async () => {
    if (!canToggleFollow || pendingRef.current) {
      return;
    }

    pendingRef.current = true;
    setIsPending(true);

    const nextIsFollowing = !isFollowing;
    const previousState = {
      followersCount,
      followingCount,
      isFollowing,
    };

    setIsFollowing(nextIsFollowing);
    setFollowersCount((current) => Math.max(0, current + (nextIsFollowing ? 1 : -1)));

    try {
      const operation = nextIsFollowing ? 'follow_user' : 'unfollow_user';
      const { data, error } = await typedSupabase
        .rpc(operation, { _following_user_id: targetUserId })
        .single();

      if (error) {
        throw error;
      }

      applySummary(data as FollowSummaryRow);
    } catch (error) {
      console.error('フォロー操作エラー:', error);
      setFollowersCount(previousState.followersCount);
      setFollowingCount(previousState.followingCount);
      setIsFollowing(previousState.isFollowing);
      toast.error(nextIsFollowing ? 'このユーザーはフォローできません' : 'フォロー解除に失敗しました');
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  };

  return (
    <>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        {canToggleFollow ? (
          <button
            type="button"
            onClick={() => {
              void handleToggleFollow();
            }}
            disabled={isPending}
            className={[
              'w-full rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
              isFollowing
                ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                : 'bg-blue-500 text-white hover:bg-blue-400',
            ].join(' ')}
          >
            {isPending ? '更新中...' : isFollowing ? 'フォロー中' : 'フォローする'}
          </button>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOpenModal('followers')}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/60"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">フォロワー</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{followersCount}</p>
          </button>
          <button
            type="button"
            onClick={() => setOpenModal('following')}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/60"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">フォロー中</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{followingCount}</p>
          </button>
        </div>
      </div>

      <FollowListModal
        targetUserId={targetUserId}
        mode="followers"
        open={openModal === 'followers'}
        onClose={() => setOpenModal(null)}
        title={`${targetDisplayName}のフォロワー`}
      />
      <FollowListModal
        targetUserId={targetUserId}
        mode="following"
        open={openModal === 'following'}
        onClose={() => setOpenModal(null)}
        title={`${targetDisplayName}のフォロー中`}
      />
    </>
  );
}
