'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import type { NoteListItem, OfferingCounts, OfferingTab, OfferingTabData } from '@/types/offering';
import Link from 'next/link';
import NoteCard from '@/components/notes/NoteCard';
import ReviewCard from '@/components/reviews/ReviewCard';
import supabase from '@/lib/supabase';
import { uploadNoteImage } from '@/lib/api';

type OfferingTabsProps = {
  offeringId: string;
  activeTab: OfferingTab;
  counts: OfferingCounts;
  data: OfferingTabData;
  notesPage: number;
  reviewsPage: number;
  questionsPage: number;
  canPost: boolean;
};

type ModalType = 'none' | 'note' | 'review' | 'question';

type NoteReactionClient = {
  from: (table: 'note_reactions') => {
    delete: () => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => { eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }> };
      };
    };
    insert: (payload: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>;
  };
};

type OfferingWriteClient = {
  from: (table: 'notes' | 'reviews' | 'questions') => {
    insert: (payload: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>;
  };
};

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/60 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            閉じる
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function OfferingTabs({
  offeringId,
  activeTab,
  counts,
  data,
  notesPage,
  reviewsPage,
  questionsPage,
  canPost,
}: OfferingTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [modal, setModal] = useState<ModalType>('none');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [notes, setNotes] = useState<NoteListItem[]>(data.notes);
  const [userId, setUserId] = useState<string | null>(null);
  const reactionClient = supabase as unknown as NoteReactionClient;
  const writeClient = supabase as unknown as OfferingWriteClient;

  useEffect(() => {
    setNotes(data.notes);
  }, [data.notes]);

  useEffect(() => {
    let isMounted = true;
    const syncUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!isMounted) return;
      setUserId(user?.id ?? null);
    };

    void syncUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const resolveCurrentUserId = useCallback(async () => {
    if (userId) return userId;

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error('投稿前の認証確認に失敗しました', error);
      return null;
    }

    const nextUserId = user?.id ?? null;
    if (nextUserId) {
      setUserId(nextUserId);
    }
    return nextUserId;
  }, [userId]);

  const tabs = useMemo(
    () =>
      [
        { key: 'notes', label: 'ノート', count: counts.notes },
        { key: 'reviews', label: '口コミ', count: counts.reviews },
        { key: 'questions', label: '質問', count: counts.questions },
        { key: 'students', label: '受講者', count: counts.students },
      ] as const,
    [counts],
  );

  const pushQuery = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => next.set(key, value));
    router.push(`${pathname}?${next.toString()}`);
  };

  const handleToggleReaction = async (noteId: string, kind: 'like' | 'bookmark', active: boolean) => {
    const prev = notes;
    const next = notes.map((note) => {
      if (note.id !== noteId) return note;
      if (kind === 'like') {
        return {
          ...note,
          isLikedByMe: !active,
          likesCount: note.likesCount + (active ? -1 : 1),
        };
      }
      return {
        ...note,
        isBookmarkedByMe: !active,
        bookmarksCount: note.bookmarksCount + (active ? -1 : 1),
      };
    });

    setNotes(next);
    const currentUserId = await resolveCurrentUserId();
    if (!currentUserId) {
      setNotes(prev);
      toast.error('ログインが必要です');
      return;
    }

    const result = active
      ? await reactionClient.from('note_reactions').delete().eq('note_id', noteId).eq('user_id', currentUserId).eq('kind', kind)
      : await reactionClient.from('note_reactions').insert({ note_id: noteId, user_id: currentUserId, kind });

    if (result.error) {
      setNotes(prev);
      toast.error(result.error.message ?? '更新に失敗しました');
    }
  };

  const handleCreateNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canPost) return;
    if (submittingRef.current) return;
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get('title') ?? '').trim();
    const body = String(formData.get('body') ?? '').trim();
    const image = formData.get('image');
    if (!title || !body) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const currentUserId = await resolveCurrentUserId();
      if (!currentUserId) {
        toast.error('ログインが必要です');
        return;
      }

      let uploadedImageUrl: string | null = null;
      if (image instanceof File && image.size > 0) {
        try {
          const uploadResult = await uploadNoteImage(image);
          uploadedImageUrl = uploadResult.url;
        } catch {
          toast.error('ノート画像のアップロードに失敗しました');
          return;
        }
      }

      const result = await writeClient.from('notes').insert({
        offering_id: offeringId,
        author_id: currentUserId,
        title,
        body_md: body,
        image_url: uploadedImageUrl,
        visibility: 'university',
      });
      if (result.error) {
        toast.error(result.error.message ?? 'ノート投稿に失敗しました');
        return;
      }

      toast.success('ノートを投稿しました');
      setModal('none');
      router.refresh();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleCreateReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canPost) return;
    if (submittingRef.current) return;
    const formData = new FormData(event.currentTarget);
    const rating = Number(formData.get('rating'));
    const body = String(formData.get('body') ?? '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const currentUserId = await resolveCurrentUserId();
      if (!currentUserId) {
        toast.error('ログインが必要です');
        return;
      }

      const result = await writeClient.from('reviews').insert({
        offering_id: offeringId,
        author_id: currentUserId,
        rating_overall: rating,
        comment: body || null,
      });
      if (result.error) {
        toast.error(result.error.message ?? '口コミ投稿に失敗しました');
        return;
      }

      toast.success('口コミを投稿しました');
      setModal('none');
      router.refresh();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleCreateQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canPost) return;
    if (submittingRef.current) return;
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get('title') ?? '').trim();
    const body = String(formData.get('body') ?? '').trim();
    if (!title || !body) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const currentUserId = await resolveCurrentUserId();
      if (!currentUserId) {
        toast.error('ログインが必要です');
        return;
      }

      const result = await writeClient.from('questions').insert({
        offering_id: offeringId,
        author_id: currentUserId,
        title,
        body,
      });
      if (result.error) {
        toast.error(result.error.message ?? '質問投稿に失敗しました');
        return;
      }

      toast.success('質問を投稿しました');
      setModal('none');
      router.refresh();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-0">
      <div className="border-b border-slate-100 bg-white px-6 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => pushQuery({ tab: tab.key, notesPage: '1', reviewsPage: '1', questionsPage: '1' })}
            className={`mr-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label} {tab.count}
          </button>
        ))}
      </div>

      {activeTab === 'notes' && (
        <div className="rounded-b-3xl bg-white/85 px-6 pb-6 pt-5 shadow-sm backdrop-blur">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-4xl font-black tracking-tight text-slate-900">ノート {counts.notes}</h2>
            <button
              type="button"
              disabled={!canPost}
              onClick={() => setModal('note')}
              className="rounded-full border border-blue-100 bg-blue-50 px-5 py-2 text-sm font-semibold text-blue-600 disabled:bg-slate-200 disabled:text-slate-400"
            >
              ノートを投稿
            </button>
          </div>
          {notes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              まだノートは投稿されていません
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onToggleLike={(noteId, isLiked) => handleToggleReaction(noteId, 'like', isLiked)}
                  onToggleBookmark={(noteId, isBookmarked) =>
                    handleToggleReaction(noteId, 'bookmark', isBookmarked)
                  }
                />
              ))}
            </div>
          )}
          {data.hasMoreNotes && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => pushQuery({ notesPage: String(notesPage + 1), tab: 'notes' })}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                もっと見る
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="rounded-b-3xl bg-white/85 px-6 pb-6 pt-5 shadow-sm backdrop-blur">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-600">平均評価</p>
              <p className="text-3xl font-bold text-slate-900">{data.reviewStats.avgRating.toFixed(1)} ★</p>
              <p className="text-sm text-slate-500">{data.reviewStats.reviewCount} 件</p>
            </div>
            <button
              type="button"
              disabled={!canPost}
              onClick={() => setModal('review')}
              className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
            >
              口コミを書く
            </button>
          </div>
          <div className="mb-4 space-y-1">
            {data.reviewStats.distribution.map((count, index) => {
              const star = 5 - index;
              const ratio = data.reviewStats.reviewCount > 0 ? (count / data.reviewStats.reviewCount) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="w-8">{star}★</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${ratio}%` }} />
                  </div>
                  <span className="w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
          {data.reviews.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              まだ口コミは投稿されていません
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
          {data.hasMoreReviews && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => pushQuery({ reviewsPage: String(reviewsPage + 1), tab: 'reviews' })}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                もっと見る
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'questions' && (
        <div className="rounded-b-3xl bg-white/85 px-6 pb-6 pt-5 shadow-sm backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">質問 {counts.questions}</h2>
            <button
              type="button"
              disabled={!canPost}
              onClick={() => setModal('question')}
              className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
            >
              質問を投稿
            </button>
          </div>
          {data.questions.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              まだ質問は投稿されていません
            </p>
          ) : (
            <div className="space-y-3">
              {data.questions.map((question) => (
                <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-base font-semibold text-slate-900">{question.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{question.body}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Link href={`/profile/${question.authorId}`} className="shrink-0">
                      {question.authorAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={question.authorAvatarUrl}
                          alt={`${question.authorName}のアイコン`}
                          className="h-6 w-6 rounded-full border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {question.authorName.slice(0, 1)}
                        </div>
                      )}
                    </Link>
                    <p className="text-xs text-slate-500">
                      <Link href={`/profile/${question.authorId}`} className="hover:underline">
                        {question.authorName}
                      </Link>
                      {' / '}
                      {new Date(question.createdAt).toLocaleString('ja-JP')}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
          {data.hasMoreQuestions && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => pushQuery({ questionsPage: String(questionsPage + 1), tab: 'questions' })}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                もっと見る
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'students' && (
        <div className="rounded-b-3xl bg-white/85 p-8 text-center shadow-sm backdrop-blur">
          <p className="text-sm text-slate-500">受講者人数</p>
          <p className="mt-2 text-4xl font-bold text-slate-900">{counts.students}</p>
          <p className="mt-2 text-xs text-slate-500">受講者の詳細一覧は非公開設定です</p>
        </div>
      )}

      {modal === 'note' && (
        <ModalShell title="ノートを投稿" onClose={() => setModal('none')}>
          <form className="space-y-3" onSubmit={handleCreateNote}>
            <input
              name="title"
              placeholder="タイトル"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <textarea
              name="body"
              placeholder="本文"
              className="h-40 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <label className="block text-sm text-slate-700">
              画像（任意）
              <input
                type="file"
                name="image"
                accept="image/png,image/jpeg,image/webp"
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
            >
              投稿する
            </button>
          </form>
        </ModalShell>
      )}

      {modal === 'review' && (
        <ModalShell title="口コミを書く" onClose={() => setModal('none')}>
          <form className="space-y-3" onSubmit={handleCreateReview}>
            <select name="rating" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" defaultValue="5">
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} ★
                </option>
              ))}
            </select>
            <textarea
              name="body"
              placeholder="口コミコメント"
              className="h-40 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
            >
              投稿する
            </button>
          </form>
        </ModalShell>
      )}

      {modal === 'question' && (
        <ModalShell title="質問を投稿" onClose={() => setModal('none')}>
          <form className="space-y-3" onSubmit={handleCreateQuestion}>
            <input
              name="title"
              placeholder="質問タイトル"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <textarea
              name="body"
              placeholder="質問内容"
              className="h-40 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
            >
              投稿する
            </button>
          </form>
        </ModalShell>
      )}
    </section>
  );
}
