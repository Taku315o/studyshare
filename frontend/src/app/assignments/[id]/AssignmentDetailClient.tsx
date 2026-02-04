"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import supabase from '@/lib/supabase';

type AssignmentDetail = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  user?: {
    email: string;
  };
};

type Props = {
  id: string;
};

function DownloadIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20V10" />
      <path d="M20 20V10" />
      <path d="M4 20H20" />
      <path d="M12 3V14" />
      <path d="M7.5 10.5L12 15l4.5-4.5" />
    </svg>
  );
}

export default function AssignmentDetailClient({ id }: Props) {
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const fetchAssignment = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const { data, error } = await supabase
          .from('assignments')
          .select(
            `
              *,
              user:user_id (
                email
              )
            `,
          )
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          setAssignment(null);
          setErrorMessage('課題が見つかりませんでした');
          return;
        }

        setAssignment(data);
      } catch (error) {
        console.error('課題詳細の取得エラー:', error);
        setErrorMessage('課題の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchAssignment();
  }, [id]);

  useEffect(() => {
    if (!isPreviewOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPreviewOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewOpen]);

  const handleDownload = async () => {
    if (!assignment?.image_url) return;

    try {
      setIsDownloading(true);
      const response = await fetch(assignment.image_url);
      if (!response.ok) {
        throw new Error('Failed to download image');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const safeTitle = `${assignment.title || 'assignment-image'}`.replace(/[\\/:*?"<>|]/g, '_');
      const urlPath = new URL(assignment.image_url).pathname;
      const extension = urlPath.includes('.') ? urlPath.split('.').pop() : 'png';
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${safeTitle}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('画像のダウンロードに失敗しました:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">読み込み中...</div>;
  }

  if (!assignment) {
    return (
      <div className="container mx-auto px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-blue-600 hover:underline">
            ← 戻る
          </Link>
        </header>
        <div className="text-center text-gray-600">{errorMessage ?? '課題が見つかりませんでした'}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-blue-600 hover:underline">
          ← 戻る
        </Link>
        <span className="text-sm text-gray-500">
          {new Date(assignment.created_at).toLocaleString('ja-JP')}
        </span>
      </header>

      <main className="max-w-3xl mx-auto">
        <div className="border rounded-lg overflow-hidden shadow-sm bg-white dark:bg-gray-800">
          {assignment.image_url && (
            <>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="w-full h-72 overflow-hidden relative cursor-zoom-in"
                aria-label="画像を拡大表示"
              >
                <Image
                  src={assignment.image_url}
                  alt={assignment.title}
                  fill
                  className="object-cover"
                />
              </button>

              {isPreviewOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
                  role="dialog"
                  aria-modal="true"
                  onClick={() => setIsPreviewOpen(false)}
                >
                  <div
                    className="relative w-full max-w-5xl h-[80vh] bg-black/90 rounded-lg overflow-hidden shadow-lg"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setIsPreviewOpen(false)}
                      className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-sm text-gray-900 shadow hover:bg-white"
                    >
                      ×
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={isDownloading}
                      aria-label="画像をダウンロード"
                      className="
                    absolute right-4 bottom-4 z-10
                    h-10 w-10
                    rounded-full bg-white/90
                    flex items-center justify-center
                    text-gray-900 shadow
                    hover:bg-white
                    disabled:opacity-60"
                    >
                      {isDownloading ? (
                        <span className="text-xs font-semibold">…</span>
                      ) : (
                        <DownloadIcon className="h-6 w-6" />
                      )}
                    </button>

                    <Image
                      src={assignment.image_url}
                      alt={`${assignment.title} プレビュー`}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 80vw"
                    />
                  </div>
                </div>
              )}
            </>
          )}
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {assignment.title}
            </h1>
            <p className="text-gray-700 dark:text-gray-300 mt-4 whitespace-pre-wrap">
              {assignment.description}
            </p>

            <div className="mt-6 text-sm text-gray-500 dark:text-gray-400 flex flex-col gap-1">
              <span>投稿者: {assignment.user?.email || '不明'}</span>
              <span>最終更新: {new Date(assignment.updated_at).toLocaleString('ja-JP')}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
