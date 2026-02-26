'use client';

import { useState } from 'react';
import MyNotesList from '@/components/me/MyNotesList';
import MyReviewsList from '@/components/me/MyReviewsList';
import MySavedNotesList from '@/components/me/MySavedNotesList';
import type { MeAssetsTabKey, MeNoteItemViewModel, MeReviewItemViewModel, MeSavedNoteItemViewModel } from '@/types/me';

type MyAssetsTabsProps = {
  notes: MeNoteItemViewModel[];
  reviews: MeReviewItemViewModel[];
  savedNotes: MeSavedNoteItemViewModel[];
  isLoading: boolean;
};

export default function MyAssetsTabs({ notes, reviews, savedNotes, isLoading }: MyAssetsTabsProps) {
  const [activeTab, setActiveTab] = useState<MeAssetsTabKey>('notes');

  const tabs: Array<{ key: MeAssetsTabKey; label: string; count: number | null }> = [
    { key: 'notes', label: 'ノート', count: notes.length },
    { key: 'reviews', label: '口コミ', count: reviews.length },
    { key: 'saved', label: '保存', count: savedNotes.length },
  ];

  return (
    <section className="rounded-3xl border border-white/50 bg-white/75 p-6 shadow-sm backdrop-blur">
      <h2 className="text-xl font-bold text-slate-900">自分の資産</h2>
      <p className="mt-1 text-sm text-slate-600">自分が投稿したノート・口コミを確認できます。</p>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={[
              'rounded-full px-4 py-2 text-sm font-semibold transition',
              activeTab === tab.key
                ? 'bg-blue-500 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
            ].join(' ')}
          >
            {tab.label}
            {tab.count !== null ? ` (${tab.count})` : ''}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {activeTab === 'notes' ? <MyNotesList notes={notes} isLoading={isLoading} /> : null}
        {activeTab === 'reviews' ? <MyReviewsList reviews={reviews} isLoading={isLoading} /> : null}
        {activeTab === 'saved' ? <MySavedNotesList savedNotes={savedNotes} isLoading={isLoading} /> : null}
      </div>
    </section>
  );
}
