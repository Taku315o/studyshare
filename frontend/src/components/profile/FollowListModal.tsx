'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';

const PAGE_SIZE = 20;

type FollowListModalProps = {
  targetUserId: string;
  mode: 'followers' | 'following';
  open: boolean;
  onClose: () => void;
  title: string;
};

type FollowListProfileRow = Database['public']['Functions']['list_follow_profiles']['Returns'][number];

function buildAffiliation(profile: FollowListProfileRow) {
  const academicLine = [profile.university_name, profile.grade_year ? `${profile.grade_year}年` : null]
    .filter(Boolean)
    .join(' / ');
  const orgLine = [profile.faculty, profile.department].filter(Boolean).join(' / ');

  return {
    academicLine: academicLine || '大学・学年未設定',
    orgLine: orgLine || '所属未設定',
  };
}

export default function FollowListModal({
  targetUserId,
  mode,
  open,
  onClose,
  title,
}: FollowListModalProps) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const typedSupabase = supabase as unknown as SupabaseClient<Database>;
  const [profiles, setProfiles] = useState<FollowListProfileRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProfiles = useCallback(
    async (nextOffset: number, replace: boolean) => {
      if (!targetUserId) {
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const { data, error } = await typedSupabase
          .rpc('list_follow_profiles', {
            _target_user_id: targetUserId,
            _direction: mode,
            _limit: PAGE_SIZE + 1,
            _offset: nextOffset,
          });

        if (error) {
          throw error;
        }

        const rows = (data ?? []) as FollowListProfileRow[];
        const nextRows = rows.slice(0, PAGE_SIZE);

        setProfiles((current) => (replace ? nextRows : [...current, ...nextRows]));
        setHasMore(rows.length > PAGE_SIZE);
        setOffset(nextOffset + nextRows.length);
      } catch (error) {
        console.error('フォロー一覧取得エラー:', error);
        setErrorMessage('一覧の取得に失敗しました。時間をおいて再度お試しください。');
      } finally {
        setIsLoading(false);
      }
    },
    [mode, targetUserId, typedSupabase],
  );

  useEffect(() => {
    if (!open) {
      setProfiles([]);
      setOffset(0);
      setHasMore(false);
      setErrorMessage(null);
      return;
    }

    void loadProfiles(0, true);
  }, [loadProfiles, open]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/45 p-4"
      data-testid={`follow-list-modal-overlay-${mode}`}
      onClick={(event) => {
        if (event.target !== event.currentTarget || isLoading) {
          return;
        }
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500">{mode === 'followers' ? 'あなたをフォローしているユーザー' : 'あなたがフォローしているユーザー'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            閉じる
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
          ) : null}

          {!errorMessage && profiles.length === 0 && isLoading ? (
            <p className="text-sm text-slate-500">読み込み中...</p>
          ) : null}

          {!errorMessage && profiles.length === 0 && !isLoading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              まだユーザーがいません。
            </div>
          ) : null}

          <div className="space-y-3">
            {profiles.map((profile) => {
              const { academicLine, orgLine } = buildAffiliation(profile);
              const avatarInitial = profile.display_name?.slice(0, 1) || 'U';

              return (
                <Link
                  key={`${mode}-${profile.user_id}-${profile.followed_at}`}
                  href={`/profile/${profile.user_id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/50"
                >
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt={`${profile.display_name}のアイコン`}
                      className="h-12 w-12 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                      {avatarInitial}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{profile.display_name}</p>
                    <p className="truncate text-xs text-slate-500">{academicLine}</p>
                    <p className="truncate text-xs text-slate-500">{orgLine}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-200 px-5 py-4">
          {hasMore ? (
            <button
              type="button"
              onClick={() => {
                if (isLoading) {
                  return;
                }
                void loadProfiles(offset, false);
              }}
              disabled={isLoading}
              className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? '読み込み中...' : 'もっと見る'}
            </button>
          ) : (
            <p className="text-center text-xs text-slate-400">以上です</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
