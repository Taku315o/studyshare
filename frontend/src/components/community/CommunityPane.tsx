'use client';

import { Search } from 'lucide-react';
import MatchCard from '@/components/community/MatchCard';
import type {
  CommunityFilterChipKey,
  CommunityTabKey,
  MatchCandidateViewModel,
} from '@/types/community';

type CommunityPaneProps = {
  activeTab: CommunityTabKey;
  onTabChange: (tab: CommunityTabKey) => void;
  searchKeyword: string;
  onSearchKeywordChange: (value: string) => void;
  activeChip: CommunityFilterChipKey;
  onChipChange: (chip: CommunityFilterChipKey) => void;
  candidates: MatchCandidateViewModel[];
  isLoading: boolean;
  errorMessage: string | null;
  onSendMessage: (candidate: MatchCandidateViewModel) => void;
  onOpenMessagesMobile: () => void;
};

const TAB_ITEMS: Array<{ key: CommunityTabKey; label: string }> = [
  { key: 'matching', label: 'マッチング' },
  { key: 'reviews', label: '口コミ' },
  { key: 'more', label: '…' },
];

const FILTER_CHIPS: Array<{ key: CommunityFilterChipKey; label: string }> = [
  { key: 'time-near', label: '時間割が近い' },
  { key: 'same-class', label: '同じ授業' },
  { key: 'same-task', label: '同じ課題' },
];

export default function CommunityPane({
  activeTab,
  onTabChange,
  searchKeyword,
  onSearchKeywordChange,
  activeChip,
  onChipChange,
  candidates,
  isLoading,
  errorMessage,
  onSendMessage,
  onOpenMessagesMobile,
}: CommunityPaneProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-900">コミュニティ</h1>
          <button
            type="button"
            onClick={onOpenMessagesMobile}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 lg:hidden"
          >
            メッセージ
          </button>
        </div>
        <p className="text-sm text-slate-600">
          一緒に授業を受けている人を見つけて、気軽に情報交換をしましょう。
        </p>
      </header>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {TAB_ITEMS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={[
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                isActive ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'matching' ? (
        <>
          <label className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(event) => onSearchKeywordChange(event.target.value)}
              placeholder="授業名で検索（MVPは候補表示のみ）"
              className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {FILTER_CHIPS.map((chip) => {
              const isActive = activeChip === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => onChipChange(chip.key)}
                  className={[
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    isActive
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">読み込み中...</p>
            ) : errorMessage ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
            ) : candidates.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                マッチング候補がまだいません。
              </p>
            ) : (
              candidates.map((candidate) => (
                <MatchCard key={candidate.userId} candidate={candidate} onSendMessage={onSendMessage} />
              ))
            )}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-10 text-center text-sm text-slate-500">
          このタブは準備中です。次のフェーズで拡張します。
        </div>
      )}
    </section>
  );
}
