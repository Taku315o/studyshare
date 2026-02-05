// studyshare/frontend/src/components/AssignmentList.tsx
// 課題一覧を表示し、検索や削除機能を提供するコンポーネント
//課題の一覧を表示するコンポーネント。
// 検索クエリ（query）が渡された場合は、その条件でSupabaseのDB関数を呼び出して検索結果を表示し、クエリがない場合は最近の課題を一覧表示。
// 管理者（admin）権限を持つユーザーには削除ボタンが表示されます。
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { deleteAssignment, setAuthToken } from '@/lib/api';
import toast from 'react-hot-toast';

type Assignment = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  user_id: string;
  created_at: string;
  user?: {
    email: string;
  };
};

type AssignmentListProps = {
  query?: string;
};

/**
 * Displays a grid of assignments and optionally filters them using a search query.
 *
 * @param query - Optional search string used to filter assignments via Supabase RPC.
 * @returns JSX element rendering the assignment list, loading state, or empty state message.
 */
export default function AssignmentList({ query }: AssignmentListProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin, getAccessToken } = useAuth();
  const router = useRouter();

  // 課題一覧を取得する関数
  // useCallbackを使ってるのは、useEffectの無限ループを防ぐため！
  // 普通の関数だと再レンダリングのたびに新しい関数が作られちゃって、
  // useEffectが「あ、fetchAssignmentsが変わった！」って勘違いして
  // また実行 → 状態更新 → 再レンダリング → また実行... の無限ループになっちゃう
  // queryが変わった時だけ関数を作り直すようにしてるよ
  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      let data;
      
      if (query) {
        // 検索時はSupabaseの関数を使用
        const { data: searchData, error: searchError } = await supabase
          .rpc('search_assignments', { search_query: query });
          
        if (searchError) throw searchError;
        data = searchData;
      } else {
        // 通常の一覧表示
        const { data: assignData, error } = await supabase
          .from('assignments')
          .select(`
            *,
            user:user_id (
              email
            )
          `)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        data = assignData;
      }
      
      setAssignments(data || []);
    } catch (error) {
      console.error('課題取得エラー:', error);
      toast.error('課題の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [query]);

  // 削除処理
  const handleDelete = async (id: string) => {
    if (!window.confirm('本当にこの課題を削除しますか？')) return;
    
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('認証が必要です');
      // API呼び出し前に認証トークンをヘッダーへ設定
      // テスト環境などでモックされていない場合でも安全に動作するようにガード
      if (typeof setAuthToken === 'function') {
        setAuthToken(token);
      }
      
      await deleteAssignment(id);
      toast.success('課題を削除しました');
      // 一覧を更新
      fetchAssignments();
    } catch (error) {
      console.error('削除エラー:', error);
      toast.error('削除に失敗しました');
    }
  };

  const handleOpenAssignment = (id: string) => {
    router.push(`/assignments/${id}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpenAssignment(id);
    }
  };

  // クエリが変わったらデータを再取得
  // ここでfetchAssignmentsを依存配列に入れてるから、上でuseCallbackが必要なんだよね
  // fetchAssignmentsがuseCallbackじゃないと、無限ループの原因になっちゃう
  useEffect(() => {
    fetchAssignments();
  }, [query, fetchAssignments]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-900/30 p-10 text-center text-white/90 backdrop-blur-md shadow-lg shadow-black/10">
        読み込み中...
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-900/30 p-10 text-center text-white/90 backdrop-blur-md shadow-lg shadow-black/10">
        {query ? `"${query}" に一致する課題はありません` : '課題はまだ投稿されていません'}
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {assignments.map((assignment) => (
        <div
          key={assignment.id}
          className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/30 backdrop-blur-md shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/15 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/30"
          role="button"
          tabIndex={0}
          onClick={() => handleOpenAssignment(assignment.id)}
          onKeyDown={(event) => handleKeyDown(event, assignment.id)}
        >
          {assignment.image_url && (
            <div className="w-full h-48 overflow-hidden relative">
              <Image
                src={assignment.image_url}
                alt={assignment.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-transparent" />
            </div>
          )}
          <div className="p-4">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
              <h3 className="text-xl font-semibold text-white">
                {assignment.title}
              </h3>
              <p className="mt-2 text-sm text-blue-100/85 line-clamp-3">
                {assignment.description}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/85">
                <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1">
                  投稿者: {assignment.user?.email || '不明'}
                </span>
                <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1">
                  {new Date(assignment.created_at).toLocaleString('ja-JP')}
                </span>
              </div>
            </div>
            
            {/* 管理者のみ削除ボタンを表示 */}
            {isAdmin && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  handleDelete(assignment.id);
                }}
                className="mt-3 inline-flex items-center rounded-full border border-red-400/70 px-3 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/15"
              >
                削除
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
