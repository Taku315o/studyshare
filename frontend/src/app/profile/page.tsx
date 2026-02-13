'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import { useAuth } from '@/context/AuthContext';
import supabase from '@/lib/supabase';

type Assignment = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  university: string | null;
  faculty: string | null;
  department: string | null;
  course_name: string | null;
  teacher_name: string | null;
  user_id: string;
};

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/');
    }
  }, [isLoading, user, router]);

  const fetchMyAssignments = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('id,title,description,image_url,created_at,updated_at,university,faculty,department,course_name,teacher_name,user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setAssignments(data ?? []);
    } catch (error) {
      console.error('マイページ課題取得エラー:', error);
      setErrorMessage('課題の取得に失敗しました。時間をおいて再度お試しください。');
      toast.error('課題の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchMyAssignments();
  }, [user, fetchMyAssignments]);

  const handleDelete = async (assignmentId: string) => {
    if (!user) return;
    if (!window.confirm('本当にこの課題を削除しますか？')) return;

    setDeletingId(assignmentId);

    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setAssignments((prev) => prev.filter((assignment) => assignment.id !== assignmentId));
      toast.success('課題を削除しました');
    } catch (error) {
      console.error('マイページ課題削除エラー:', error);
      toast.error('課題の削除に失敗しました');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading || (!user && !isLoading)) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-8 pt-24">
          <div className="mx-auto max-w-6xl">
            <span className="sr-only">読み込み中...</span>
            <div className="h-9 w-40 rounded-full bg-white/10" />
            <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`profile-skeleton-${index}`}
                  className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/30 backdrop-blur-md shadow-lg shadow-black/10"
                >
                  <div className="h-48 w-full bg-white/5" />
                  <div className="p-4">
                    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
                      <div className="h-5 w-3/4 rounded-full bg-white/10" />
                      <div className="mt-3 h-3 w-full rounded-full bg-white/10" />
                      <div className="mt-2 h-3 w-5/6 rounded-full bg-white/10" />
                      <div className="mt-4 h-6 w-32 rounded-full bg-white/10" />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <div className="h-8 w-20 rounded-full bg-white/10" />
                      <div className="h-8 w-20 rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-white">マイページ</h1>
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white/90">
              あなたの投稿 {assignments.length} 件
            </span>
          </header>

          {errorMessage && (
            <div className="mb-6 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {errorMessage}
            </div>
          )}

          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`assignment-loading-${index}`}
                  className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/30 backdrop-blur-md shadow-lg shadow-black/10"
                >
                  <div className="h-48 w-full bg-white/5" />
                  <div className="p-4">
                    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
                      <div className="h-5 w-3/4 rounded-full bg-white/10" />
                      <div className="mt-3 h-3 w-full rounded-full bg-white/10" />
                      <div className="mt-2 h-3 w-5/6 rounded-full bg-white/10" />
                      <div className="mt-4 h-6 w-32 rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : assignments.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/30 p-10 text-center text-white/90 backdrop-blur-md shadow-lg shadow-black/10">
              <p>まだ課題を投稿していません。</p>
              <Link
                href="/assignments/new"
                className="mt-6 inline-flex items-center rounded-full bg-blue-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                ノートを投稿する
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {assignments.map((assignment) => {
                const isDeleting = deletingId === assignment.id;

                return (
                  <article
                    key={assignment.id}
                    className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/30 backdrop-blur-md shadow-lg shadow-black/10"
                  >
                    {assignment.image_url && (
                      <div className="relative h-48 w-full overflow-hidden">
                        <Image
                          src={assignment.image_url}
                          alt={assignment.title}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-transparent" />
                      </div>
                    )}

                    <div className="p-4">
                      <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
                        <h2 className="text-xl font-semibold text-white">{assignment.title}</h2>
                        <p className="mt-2 line-clamp-3 text-sm text-blue-100/85">{assignment.description}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/85">
                          <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1">
                            {new Date(assignment.created_at).toLocaleString('ja-JP')}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/assignments/${assignment.id}/edit`}
                          className="inline-flex items-center rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
                        >
                          編集
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(assignment.id)}
                          disabled={isDeleting}
                          className="inline-flex items-center rounded-full border border-red-400/70 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeleting ? '削除中...' : '削除'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
