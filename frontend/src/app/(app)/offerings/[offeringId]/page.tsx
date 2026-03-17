import { notFound } from 'next/navigation';
import OfferingHeader from '@/components/offerings/OfferingHeader';
import OfferingTabs from '@/components/offerings/OfferingTabs';
import { fetchProfiles } from '@/lib/supabase/fetchProfiles';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sanitizeDisplayText } from '@/lib/text';
import { buildTermLabel } from '@/lib/timetable/terms';
import type {
  NoteListItem,
  OfferingCounts,
  OfferingMeta,
  OfferingTab,
  OfferingTabData,
  QuestionListItem,
  ReviewListItem,
} from '@/types/offering';
//授業の詳細ページコンポーネント。授業の基本情報を表示するヘッダーと、ノート・質問・口コミのタブを含む。
// URLの offeringId をもとにdbから授業の情報を取得し、存在しない場合は 404 ページを表示する。
type OfferingRow = {
  id: string;
  instructor: string | null;
  courses:
    | { name: string | null; course_code: string | null }
    | Array<{ name: string | null; course_code: string | null }>
    | null;
  terms:
    | { academic_year: number; display_name: string }
    | Array<{ academic_year: number; display_name: string }>
    | null;
  offering_slots: Array<{ day_of_week: number | null; period: number | null }> | null;
};

type OfferingRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

type OfferingQuestionAnswersReadClient = {
  from: (table: 'question_answers') => {
    select: (columns: string) => {
      in: (column: 'question_id', values: string[]) => {
        is: (column: 'deleted_at', value: null) => Promise<{ data: Array<{ question_id: string }> | null }>;
      };
    };
  };
};

const PAGE_SIZE = 8;

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
/**
 * 指定された値をもとにアクティブなタブを解析する。
 * @param value - クエリパラメータから取得したタブ名
 * @returns 解析されたタブ名
 */
function parseTab(value?: string): OfferingTab {
  if (value === 'reviews' || value === 'questions' || value === 'students') {
    return value;
  }
  return 'notes';
}
//クエリパラメータからページ番号を解析する。整数でない場合や1未満の場合は1を返す。
function parsePage(value?: string) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) return 1;
  return num;
}
//1, 1 という無機質な数字を、月曜 1限 という親切な表示に変える役割
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

//このページコンポーネントは、授業の詳細情報を表示する。
// URLから offeringId を取得し、その ID に対応する授業の情報を Supabase から取得する。
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
  const questionAnswersClient = supabase as unknown as OfferingQuestionAnswersReadClient;

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
      terms:term_id(academic_year, display_name),
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
    courseTitle: sanitizeDisplayText(course?.name) ?? '不明な授業',
    courseCode: course?.course_code ?? null,
    instructorName: sanitizeDisplayText(offering.instructor),
    termLabel: term ? buildTermLabel({ academicYear: term.academic_year, displayName: term.display_name }) : '未設定',
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
          .select('status')
          .eq('offering_id', offeringId)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as { data: { status: string } | null; error: null }),
  ]);

  const counts: OfferingCounts = {
    notes: notesCountRes.count ?? 0,
    reviews: reviewsCountRes.count ?? 0,
    questions: Number((questionsCountRes as { count: number | null })?.count ?? 0),
    students: Number(enrollmentsCountRes.data ?? 0),
  };

  const initialEnrollmentStatus =
    user && 'data' in enrollmentRes && enrollmentRes.data && typeof enrollmentRes.data === 'object' && 'status' in enrollmentRes.data
      ? ((enrollmentRes.data.status as string | null) ?? null)
      : null;

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
    { includeAllowDm: true },
  );

  const noteIds = trimmedNotes.map((note) => note.id);
  const questionIds = trimmedQuestions.map((question) => question.id);
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
  const questionAnswersRes =
    questionIds.length > 0
      ? await questionAnswersClient.from('question_answers').select('question_id').in('question_id', questionIds).is('deleted_at', null)
      : { data: [] as Array<{ question_id: string }> };

  const likeCounts = new Map<string, number>();
  const bookmarkCounts = new Map<string, number>();
  const commentCounts = new Map<string, number>();
  const answerCounts = new Map<string, number>();
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

  (questionAnswersRes.data ?? []).forEach((answer) => {
    answerCounts.set(answer.question_id, (answerCounts.get(answer.question_id) ?? 0) + 1);
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
      authorAllowDm: profile?.allow_dm ?? null,
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
      authorAllowDm: profile?.allow_dm ?? null,
      answersCount: answerCounts.get(question.id) ?? 0,
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
      <OfferingHeader
        offeringId={offeringId}
        offering={offeringMeta}
        canEnroll={Boolean(user)}
        initialEnrollmentStatus={
          initialEnrollmentStatus === 'enrolled' || initialEnrollmentStatus === 'planned' || initialEnrollmentStatus === 'dropped'
            ? initialEnrollmentStatus
            : null
        }
      />
      <div className="border-t border-slate-100 bg-blue-50/80 px-6 py-3 text-xs text-blue-800">
        ノート・口コミ・質問は同大学スコープで表示されます。大学・学年が未設定だと他ユーザーの投稿が表示されない場合があります（
        マイページのプロフィール編集で変更できます）。
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


//このコードの賢いところは、.in() による一括取得で N + 1 クエリ問題を回避している点。
// notes や questions の作者情報を取得する際、個別にクエリを投げるのではなく、
// 必要なユーザーIDをまとめて取得し、一度のクエリで全てのプロフィール情報を取得している。
// これにより、表示するノートや質問の数に関わらず、常に一定のクエリ数で済むようになっている。
// さらに、取得したプロフィール情報を Map に格納することで、各ノートや質問の作者情報を高速に参照できるようになっている。
//また、メインロジック側でsetやmapを駆使して、ユーザーIDの重複排除やカウント集計を効率的に行っている点も賢い。
