import { notFound } from 'next/navigation';
import OfferingHeader from '@/components/offerings/OfferingHeader';
import OfferingTabs from '@/components/offerings/OfferingTabs';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type {
  NoteListItem,
  OfferingCounts,
  OfferingMeta,
  OfferingTab,
  OfferingTabData,
  QuestionListItem,
  ReviewListItem,
} from '@/types/offering';

type OfferingRow = {
  id: string;
  instructor: string | null;
  courses:
    | { name: string | null; course_code: string | null }
    | Array<{ name: string | null; course_code: string | null }>
    | null;
  terms: { year: number; season: string } | Array<{ year: number; season: string }> | null;
  offering_slots: Array<{ day_of_week: number | null; period: number | null }> | null;
};

type OfferingRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

const PAGE_SIZE = 8;

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const SEASON_LABELS: Record<string, string> = {
  first_half: '前期',
  second_half: '後期',
};

function parseTab(value?: string): OfferingTab {
  if (value === 'reviews' || value === 'questions' || value === 'students') {
    return value;
  }
  return 'notes';
}

function parsePage(value?: string) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) return 1;
  return num;
}

function formatTimeslot(
  slots: Array<{ day_of_week: number | null; period: number | null }> | null | undefined,
): string {
  if (!slots || slots.length === 0) return '未設定';
  return slots
    .map((slot) => {
      const day = slot.day_of_week !== null ? DAY_LABELS[slot.day_of_week] ?? `(${slot.day_of_week})` : '?';
      const period = slot.period !== null ? `${slot.period}限` : '?限';
      return `${day}曜 ${period}`;
    })
    .join(', ');
}

async function fetchProfiles(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userIds: string[],
) {
  if (userIds.length === 0) return new Map<string, { display_name: string; avatar_url: string | null }>();
  const { data } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds);
  const profiles = (data ?? []) as Array<{ user_id: string; display_name: string; avatar_url: string | null }>;
  const map = new Map<string, { display_name: string; avatar_url: string | null }>();
  profiles.forEach((profile) => {
    map.set(profile.user_id, profile);
  });
  return map;
}

export default async function OfferingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ offeringId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { offeringId } = await params;
  const query = await searchParams;
  const activeTab = parseTab(query.tab);
  const notesPage = parsePage(query.notesPage);
  const reviewsPage = parsePage(query.reviewsPage);
  const questionsPage = parsePage(query.questionsPage);

  const supabase = await createServerSupabaseClient();
  const rpcClient = supabase as unknown as OfferingRpcClient;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const offeringRes = await supabase
    .from('course_offerings')
    .select(
      `
      id,
      instructor,
      courses:course_id(name, course_code),
      terms:term_id(year, season),
      offering_slots(day_of_week, period)
    `,
    )
    .eq('id', offeringId)
    .maybeSingle();

  if (!offeringRes.data || offeringRes.error) {
    notFound();
  }

  const offering = offeringRes.data as OfferingRow;
  const term = Array.isArray(offering.terms) ? offering.terms[0] : offering.terms;
  const course = Array.isArray(offering.courses) ? offering.courses[0] : offering.courses;
  const slots = Array.isArray(offering.offering_slots) ? offering.offering_slots : [];

  const offeringMeta: OfferingMeta = {
    id: offering.id,
    courseTitle: course?.name ?? '不明な授業',
    courseCode: course?.course_code ?? null,
    instructorName: offering.instructor ?? null,
    termLabel: term ? `${term.year} ${SEASON_LABELS[term.season] ?? term.season}` : '未設定',
    timeslotLabel: formatTimeslot(slots),
  };

  const [notesCountRes, reviewsCountRes, questionsCountRes, enrollmentsCountRes, enrollmentRes] = await Promise.all([
    supabase.from('notes').select('id', { count: 'exact', head: true }).eq('offering_id', offeringId).is('deleted_at', null),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('offering_id', offeringId)
      .is('deleted_at', null),
    supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('offering_id', offeringId)
      .is('deleted_at', null),
    rpcClient.rpc('offering_enrollment_count', { _offering_id: offeringId }),
    user
      ? supabase
          .from('enrollments')
          .select('user_id', { count: 'exact', head: true })
          .eq('offering_id', offeringId)
          .eq('user_id', user.id)
      : Promise.resolve({ count: 0 } as { count: number | null }),
  ]);

  const counts: OfferingCounts = {
    notes: notesCountRes.count ?? 0,
    reviews: reviewsCountRes.count ?? 0,
    questions: Number((questionsCountRes as { count: number | null })?.count ?? 0),
    students: Number(enrollmentsCountRes.data ?? 0),
  };

  const isEnrolled = (enrollmentRes.count ?? 0) > 0;

  const notesFrom = (notesPage - 1) * PAGE_SIZE;
  const notesTo = notesFrom + PAGE_SIZE;
  const reviewsFrom = (reviewsPage - 1) * PAGE_SIZE;
  const reviewsTo = reviewsFrom + PAGE_SIZE;
  const questionsFrom = (questionsPage - 1) * PAGE_SIZE;
  const questionsTo = questionsFrom + PAGE_SIZE;

  const [notesRes, reviewsRes, questionsRes, reviewStatsRes] = await Promise.all([
    supabase
      .from('notes')
      .select('id, title, body_md, image_url, created_at, author_id')
      .eq('offering_id', offeringId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(notesFrom, notesTo),
    supabase
      .from('reviews')
      .select('id, rating_overall, comment, created_at, author_id')
      .eq('offering_id', offeringId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(reviewsFrom, reviewsTo),
    supabase
      .from('questions')
      .select('id, title, body, created_at, author_id')
      .eq('offering_id', offeringId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(questionsFrom, questionsTo),
    rpcClient.rpc('offering_review_stats', { _offering_id: offeringId }),
  ]);

  const rawNotes = (notesRes.data ?? []) as Array<{
    id: string;
    title: string;
    body_md: string | null;
    image_url: string | null;
    created_at: string;
    author_id: string;
  }>;
  const rawReviews = (reviewsRes.data ?? []) as Array<{
    id: string;
    rating_overall: number;
    comment: string | null;
    created_at: string;
    author_id: string;
  }>;
  const rawQuestions = (questionsRes.data ?? []) as Array<{
    id: string;
    title: string;
    body: string;
    created_at: string;
    author_id: string;
  }>;

  const hasMoreNotes = rawNotes.length > PAGE_SIZE;
  const hasMoreReviews = rawReviews.length > PAGE_SIZE;
  const hasMoreQuestions = rawQuestions.length > PAGE_SIZE;

  const trimmedNotes = rawNotes.slice(0, PAGE_SIZE);
  const trimmedReviews = rawReviews.slice(0, PAGE_SIZE);
  const trimmedQuestions = rawQuestions.slice(0, PAGE_SIZE);

  const profileMap = await fetchProfiles(
    supabase,
    Array.from(
      new Set([
        ...trimmedNotes.map((note) => note.author_id),
        ...trimmedReviews.map((review) => review.author_id),
        ...trimmedQuestions.map((question) => question.author_id),
      ]),
    ),
  );

  const noteIds = trimmedNotes.map((note) => note.id);
  const [noteReactionsRes, noteCommentsRes] =
    noteIds.length > 0
      ? await Promise.all([
          supabase.from('note_reactions').select('note_id, user_id, kind').in('note_id', noteIds).in('kind', ['like', 'bookmark']),
          supabase.from('note_comments').select('note_id').in('note_id', noteIds).is('deleted_at', null),
        ])
      : [
          { data: [] as Array<{ note_id: string; user_id: string; kind: string }> },
          { data: [] as Array<{ note_id: string }> },
        ];

  const likeCounts = new Map<string, number>();
  const bookmarkCounts = new Map<string, number>();
  const commentCounts = new Map<string, number>();
  const myLikeSet = new Set<string>();
  const myBookmarkSet = new Set<string>();

  (noteReactionsRes.data ?? []).forEach((reaction) => {
    if (reaction.kind === 'like') {
      likeCounts.set(reaction.note_id, (likeCounts.get(reaction.note_id) ?? 0) + 1);
      if (reaction.user_id === user?.id) myLikeSet.add(reaction.note_id);
    }
    if (reaction.kind === 'bookmark') {
      bookmarkCounts.set(reaction.note_id, (bookmarkCounts.get(reaction.note_id) ?? 0) + 1);
      if (reaction.user_id === user?.id) myBookmarkSet.add(reaction.note_id);
    }
  });

  (noteCommentsRes.data ?? []).forEach((comment) => {
    commentCounts.set(comment.note_id, (commentCounts.get(comment.note_id) ?? 0) + 1);
  });

  const notes: NoteListItem[] = trimmedNotes.map((note) => {
    const profile = profileMap.get(note.author_id);
    return {
      id: note.id,
      title: note.title,
      body: note.body_md,
      imageUrl: note.image_url,
      createdAt: note.created_at,
      authorId: note.author_id,
      authorName: profile?.display_name ?? '匿名ユーザー',
      authorAvatarUrl: profile?.avatar_url ?? null,
      likesCount: likeCounts.get(note.id) ?? 0,
      bookmarksCount: bookmarkCounts.get(note.id) ?? 0,
      commentsCount: commentCounts.get(note.id) ?? 0,
      isLikedByMe: myLikeSet.has(note.id),
      isBookmarkedByMe: myBookmarkSet.has(note.id),
    };
  });

  const reviews: ReviewListItem[] = trimmedReviews.map((review) => {
    const profile = profileMap.get(review.author_id);
    return {
      id: review.id,
      rating: review.rating_overall,
      comment: review.comment,
      createdAt: review.created_at,
      authorId: review.author_id,
      authorName: profile?.display_name ?? '匿名ユーザー',
      authorAvatarUrl: profile?.avatar_url ?? null,
    };
  });

  const questions: QuestionListItem[] = trimmedQuestions.map((question) => {
    const profile = profileMap.get(question.author_id);
    return {
      id: question.id,
      title: question.title,
      body: question.body,
      createdAt: question.created_at,
      authorId: question.author_id,
      authorName: profile?.display_name ?? '匿名ユーザー',
      authorAvatarUrl: profile?.avatar_url ?? null,
    };
  });

  const reviewStatsRow = Array.isArray(reviewStatsRes.data)
    ? (reviewStatsRes.data[0] as
        | {
            avg_rating: number | null;
            review_count: number | null;
            rating_5_count: number | null;
            rating_4_count: number | null;
            rating_3_count: number | null;
            rating_2_count: number | null;
            rating_1_count: number | null;
          }
        | undefined)
    : undefined;

  const tabData: OfferingTabData = {
    notes,
    reviews,
    questions,
    hasMoreNotes,
    hasMoreReviews,
    hasMoreQuestions,
    reviewStats: {
      avgRating: Number(reviewStatsRow?.avg_rating ?? 0),
      reviewCount: Number(reviewStatsRow?.review_count ?? counts.reviews),
      distribution: [
        Number(reviewStatsRow?.rating_5_count ?? 0),
        Number(reviewStatsRow?.rating_4_count ?? 0),
        Number(reviewStatsRow?.rating_3_count ?? 0),
        Number(reviewStatsRow?.rating_2_count ?? 0),
        Number(reviewStatsRow?.rating_1_count ?? 0),
      ],
    },
  };

  return (
    <div className="mx-auto max-w-6xl rounded-3xl border border-white/70 bg-white/70 shadow-sm backdrop-blur">
      <OfferingHeader offeringId={offeringId} offering={offeringMeta} canEnroll={Boolean(user)} isEnrolledInitial={isEnrolled} />
      <div className="border-t border-slate-100 bg-blue-50/80 px-6 py-3 text-xs text-blue-800">
        ノート・口コミ・質問は同大学スコープで表示されます。大学・学年が未設定だと他ユーザーの投稿が表示されない場合があります（
        <span className="font-mono">/me</span> のプロフィール編集で変更できます）。
      </div>
      <OfferingTabs
        offeringId={offeringId}
        activeTab={activeTab}
        counts={counts}
        data={tabData}
        notesPage={notesPage}
        reviewsPage={reviewsPage}
        questionsPage={questionsPage}
        canPost={Boolean(user)}
      />
    </div>
  );
}
