import Link from 'next/link';
import { notFound } from 'next/navigation';
import ThreadPanel from '@/components/thread/ThreadPanel';
import { fetchProfiles } from '@/lib/supabase/fetchProfiles';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { ThreadNodeBase } from '@/types/offering';

type QuestionRow = {
  id: string;
  offering_id: string;
  title: string;
  body: string;
  created_at: string;
  author_id: string;
};

type OfferingSummaryRow = {
  id: string;
  courses: { name: string | null } | Array<{ name: string | null }> | null;
};

type QuestionAnswerRow = {
  id: string;
  question_id: string;
  parent_answer_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
};

type QuestionAnswerReadClient = {
  from: (table: 'question_answers') => {
    select: (columns: string) => {
      eq: (column: 'question_id', value: string) => {
        order: (column: 'created_at', params: { ascending: boolean }) => Promise<{ data: QuestionAnswerRow[] | null }>;
      };
    };
  };
};

function formatDate(date: string) {
  return new Date(date).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function OfferingQuestionDetailPage({
  params,
}: {
  params: Promise<{ offeringId: string; questionId: string }>;
}) {
  const { offeringId, questionId } = await params;
  const supabase = await createServerSupabaseClient();
  const questionAnswerClient = supabase as unknown as QuestionAnswerReadClient;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [offeringRes, questionRes, answersRes] = await Promise.all([
    supabase
      .from('course_offerings')
      .select('id, courses:course_id(name)')
      .eq('id', offeringId)
      .maybeSingle(),
    supabase
      .from('questions')
      .select('id, offering_id, title, body, created_at, author_id')
      .eq('id', questionId)
      .eq('offering_id', offeringId)
      .is('deleted_at', null)
      .maybeSingle(),
    questionAnswerClient
      .from('question_answers')
      .select('id, question_id, parent_answer_id, author_id, body, created_at, deleted_at')
      .eq('question_id', questionId)
      .order('created_at', { ascending: true }),
  ]);

  if (!offeringRes.data || !questionRes.data || offeringRes.error || questionRes.error) {
    notFound();
  }

  const question = questionRes.data as QuestionRow;
  const offering = offeringRes.data as OfferingSummaryRow;
  const questionAnswers = (answersRes.data ?? []) as QuestionAnswerRow[];

  const profileMap = await fetchProfiles(
    supabase,
    Array.from(new Set([question.author_id, ...questionAnswers.map((answer) => answer.author_id)])),
  );

  const questionAuthor = profileMap.get(question.author_id);
  const answerNodes: ThreadNodeBase[] = questionAnswers.map((answer) => {
    const author = profileMap.get(answer.author_id);
    return {
      id: answer.id,
      parentId: answer.parent_answer_id,
      body: answer.body,
      createdAt: answer.created_at,
      deletedAt: answer.deleted_at,
      author: {
        id: answer.author_id,
        name: author?.display_name ?? '匿名ユーザー',
        avatarUrl: author?.avatar_url ?? null,
      },
    };
  });

  const visibleAnswerCount = questionAnswers.filter((answer) => !answer.deleted_at).length;
  const courseNameSource = Array.isArray(offering.courses) ? offering.courses[0] : offering.courses;
  const courseName = courseNameSource?.name ?? '授業詳細';

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur">
        <Link href={`/offerings/${offeringId}?tab=questions`} className="text-sm font-semibold text-blue-600 hover:text-blue-500">
          ← {courseName} に戻る
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">質問詳細</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{question.title}</h1>
        <p className="mt-2 text-xs text-slate-500">
          {questionAuthor?.display_name ?? '匿名ユーザー'} / {formatDate(question.created_at)}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{question.body}</p>
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur">
        <h2 className="text-lg font-semibold text-slate-900">回答 {visibleAnswerCount}</h2>
        <p className="mt-1 text-xs text-slate-500">回答と返信は時系列（古い順）で表示されます。</p>
        <div className="mt-4">
          <ThreadPanel
            nodes={answerNodes}
            initialUserId={user?.id ?? null}
            table="question_answers"
            targetColumn="question_id"
            parentColumn="parent_answer_id"
            targetId={question.id}
            emptyMessage="まだ回答はありません"
            rootPlaceholder="回答を入力"
            replyPlaceholder="返信を入力"
            submitLabel="回答する"
            submitSuccessMessage="回答を投稿しました"
            submitFailureMessage="回答投稿に失敗しました"
          />
        </div>
      </div>
    </div>
  );
}
