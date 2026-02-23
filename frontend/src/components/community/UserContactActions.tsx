'use client';

import Link from 'next/link';

type UserContactActionsProps = {
  targetUserId: string;
  targetDisplayName: string;
  currentUserId?: string | null;
  allowDm?: boolean | null;
  showProfileLink?: boolean;
  compact?: boolean;
  source?: 'profile' | 'review' | 'question' | 'assignment';
};

function buildCommunityDmHref(targetUserId: string, targetDisplayName: string, source?: string) {
  const params = new URLSearchParams({
    composeTo: targetUserId,
    composeName: targetDisplayName,
  });

  if (source) {
    params.set('dmSource', source);
  }

  return `/community?${params.toString()}`;
}

export default function UserContactActions({
  targetUserId,
  targetDisplayName,
  currentUserId = null,
  allowDm,
  showProfileLink = true,
  compact = false,
  source,
}: UserContactActionsProps) {
  const isSelf = Boolean(currentUserId && currentUserId === targetUserId);
  const isDmDisabled = isSelf || allowDm === false;
  const disabledReason = isSelf
    ? '自分自身にはDMを送れません。'
    : allowDm === false
      ? 'このユーザーはDM受信をオフにしているため、DMを送信できません。'
      : null;

  const buttonSize = compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showProfileLink ? (
        <Link
          href={`/profile/${targetUserId}`}
          className={`inline-flex items-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 ${buttonSize}`}
        >
          プロフィール
        </Link>
      ) : null}

      {isDmDisabled ? (
        <>
          <span
            aria-disabled="true"
            className={`inline-flex cursor-not-allowed items-center rounded-full border border-slate-200 bg-slate-100 text-slate-400 ${buttonSize}`}
          >
            DMを送る
          </span>
          {disabledReason ? <span className="text-xs text-slate-500">{disabledReason}</span> : null}
        </>
      ) : (
        <Link
          href={buildCommunityDmHref(targetUserId, targetDisplayName, source)}
          className={`inline-flex items-center rounded-full border border-blue-200 bg-blue-50 font-semibold text-blue-700 hover:bg-blue-100 ${buttonSize}`}
        >
          DMを送る
        </Link>
      )}
    </div>
  );
}
