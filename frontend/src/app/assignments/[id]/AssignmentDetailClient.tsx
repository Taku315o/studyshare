"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import supabase from '@/lib/supabase';
import Header from '@/components/Header';
import toast from 'react-hot-toast';
import { Download, Share2 } from 'lucide-react';

type AssignmentDetail = {
    id: string;
    title: string;
    description: string;
    image_url: string | null;
    university?: string | null;
    faculty?: string | null;
    department?: string | null;
    course_name?: string | null;
    teacher_name?: string | null;
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



export default function AssignmentDetailClient({ id }: Props) {
    const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

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

    const handleShare = async () => {
        if (!assignment) return;

        try {
            setIsSharing(true);
            const shareUrl = window.location.href;
            const shareData = {
                title: assignment.title,
                text: assignment.description?.slice(0, 140) || 'StudyShareのノート',
                url: shareUrl,
            };

            if (navigator.share) {
                await navigator.share(shareData);
                toast.success('共有しました');
                return;
            }

            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareUrl);
                toast.success('リンクをコピーしました');
                return;
            }

            toast.error('共有に対応していないブラウザです');
        } catch (error) {
            console.error('共有に失敗しました:', error);
            toast.error('共有に失敗しました');
        } finally {
            setIsSharing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen">
                <Header />
                <div className="container mx-auto px-4 py-8 pt-24">
                    <div className="mx-auto max-w-5xl">
                        <header className="mb-8 flex items-center gap-3">
                            <div className="h-9 w-24 rounded-full bg-white/10" />
                            <div className="h-9 w-48 rounded-full bg-white/10" />
                        </header>
                    </div>
                    <main className="relative mx-auto max-w-5xl">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-blue-500/10 blur-[70px] rounded-full pointer-events-none" />
                        <div className="relative overflow-hidden rounded-[3rem] border border-white/12 bg-slate-900/35 backdrop-blur-md shadow-xl shadow-black/10">
                            <div className="h-72 w-full bg-white/5" />
                            <div className="p-6 md:p-10">
                                <div className="h-8 w-2/3 rounded-full bg-white/10" />
                                <div className="mt-4 h-4 w-full rounded-full bg-white/10" />
                                <div className="mt-3 h-4 w-5/6 rounded-full bg-white/10" />
                                <div className="mt-6 flex flex-wrap items-center gap-3">
                                    <div className="h-7 w-40 rounded-full bg-white/10" />
                                    <div className="h-7 w-52 rounded-full bg-white/10" />
                                </div>
                                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                                    <div className="h-16 rounded-2xl bg-white/10" />
                                    <div className="h-16 rounded-2xl bg-white/10" />
                                    <div className="h-16 rounded-2xl bg-white/10" />
                                    <div className="h-16 rounded-2xl bg-white/10" />
                                </div>
                            </div>
                            <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.6s_infinite]" />
                        </div>
                    </main>
                    <style jsx>{`
                        @keyframes shimmer {
                            100% {
                                transform: translateX(100%);
                            }
                        }
                    `}</style>
                </div>
            </div>
        );
    }

    if (!assignment) {
        return (
            <div className="min-h-screen">
                <Header />
                <div className="container mx-auto px-4 py-8 pt-24">
                    <header className="mb-6 flex items-center justify-between">
                        <Link href="/" className="text-blue-200/80 hover:text-white transition-colors">
                            ← 戻る
                        </Link>
                    </header>
                    <div className="text-center text-blue-100/70">
                        {errorMessage ?? '課題が見つかりませんでした'}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <Header />
            <div className="container mx-auto px-4 py-8 pt-24">
                <div className="mx-auto max-w-5xl">
                    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <Link
                                href="/"
                                className="text-base font-semibold text-white hover:text-white/95 transition-colors"
                            >
                                <span className="inline-flex items-center rounded-full bg-white/15 px-3.5 py-1.5">
                                    ← 戻る
                                </span>
                            </Link>
                            <span className="inline-flex items-center rounded-full bg-white/15 px-3.5 py-1.5 text-base font-semibold text-white">
                                {new Date(assignment.created_at).toLocaleString('ja-JP')}
                            </span>
                        </div>
                    </header>
                </div>

                <main className="relative mx-auto max-w-5xl">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-blue-500/10 blur-[70px] rounded-full pointer-events-none" />
                    <div className="relative overflow-hidden rounded-[3rem] border border-white/12 bg-slate-900/35 backdrop-blur-md shadow-xl shadow-black/10">
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
                                        className="relative w-full max-w-5xl h-[80vh] bg-black/90 rounded-2xl shadow-lg"
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setIsPreviewOpen(false)}
                                            className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-base font-semibold text-gray-900 shadow hover:bg-white"
                                        >
                                            ×
                                        </button>

                                        <div className="flex h-full w-full items-center justify-center px-10 py-12">
                                            <Image
                                                src={assignment.image_url}
                                                alt={`${assignment.title} プレビュー`}
                                                width={1600}
                                                height={1200}
                                                className="max-h-[70vh] w-auto object-contain"
                                                sizes="(max-width: 768px) 100vw, 80vw"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    <div className="p-6 md:p-10">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <h1 className="text-3xl font-bold tracking-tight text-white">
                                {assignment.title}
                            </h1>
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    disabled={isSharing}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 hover:-translate-y-0.5 disabled:opacity-60"
                                >
                                    <Share2 className="h-4 w-4" />
                                    共有
                                </button>
                                {assignment.image_url && (
                                    <button
                                        type="button"
                                        onClick={handleDownload}
                                        disabled={isDownloading}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2 text-sm font-semibold text-gray-900 shadow-lg shadow-black/15 transition hover:bg-white hover:-translate-y-0.5 disabled:opacity-60"
                                    >
                                        <Download className="h-4 w-4" />
                                        ダウンロード
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className="mt-4 whitespace-pre-wrap text-blue-100/80 leading-relaxed">
                            {assignment.description}
                        </p>

                        <div className="mt-6 text-sm text-blue-100/85 flex flex-col gap-1">
                            <span>投稿者: {assignment.user?.email || '不明'}</span>
                            <span>最終更新: {new Date(assignment.updated_at).toLocaleString('ja-JP')}</span>
                        </div>

                        {(assignment.university ||
                            assignment.faculty ||
                            assignment.department ||
                            assignment.course_name ||
                            assignment.teacher_name) && (
                            <div className="mt-8 grid gap-4 sm:grid-cols-2 text-sm text-blue-100/85">
                                {assignment.university && (
                                    <div>
                                        <span className="block text-xs uppercase tracking-wide text-blue-200/70">大学名</span>
                                        <span className="mt-1 block text-white/90">{assignment.university}</span>
                                    </div>
                                )}
                                {assignment.faculty && (
                                    <div>
                                        <span className="block text-xs uppercase tracking-wide text-blue-200/70">学部</span>
                                        <span className="mt-1 block text-white/90">{assignment.faculty}</span>
                                    </div>
                                )}
                                {assignment.department && (
                                    <div>
                                        <span className="block text-xs uppercase tracking-wide text-blue-200/70">学科</span>
                                        <span className="mt-1 block text-white/90">{assignment.department}</span>
                                    </div>
                                )}
                                {assignment.course_name && (
                                    <div>
                                        <span className="block text-xs uppercase tracking-wide text-blue-200/70">講義名</span>
                                        <span className="mt-1 block text-white/90">{assignment.course_name}</span>
                                    </div>
                                )}
                                {assignment.teacher_name && (
                                    <div>
                                        <span className="block text-xs uppercase tracking-wide text-blue-200/70">教員名</span>
                                        <span className="mt-1 block text-white/90">{assignment.teacher_name}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
