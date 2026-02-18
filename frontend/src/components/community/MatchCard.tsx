'use client';

import { MessageCircle } from 'lucide-react';
import type { MatchCandidateViewModel } from '@/types/community';

type MatchCardProps = {
  candidate: MatchCandidateViewModel;
  onSendMessage: (candidate: MatchCandidateViewModel) => void;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function affiliationLabel(candidate: MatchCandidateViewModel) {
  return [candidate.faculty, candidate.department].filter(Boolean).join(' / ') || '所属未設定';
}

export default function MatchCard({ candidate, onSendMessage }: MatchCardProps) {
  return (
    <article className="rounded-2xl border border-white/60 bg-white/75 p-4 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {candidate.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={candidate.avatarUrl}
              alt={candidate.displayName}
              className="h-11 w-11 rounded-full border border-white/60 object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500/15 text-sm font-bold text-blue-700">
              {initials(candidate.displayName)}
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{candidate.displayName}</p>
            <p className="truncate text-xs text-slate-500">{affiliationLabel(candidate)}</p>
            <p className="mt-1 text-xs text-slate-600">{candidate.summaryLabel}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSendMessage(candidate)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-400"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          メッセージを送る
        </button>
      </div>
    </article>
  );
}
