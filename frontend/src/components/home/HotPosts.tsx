import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { HotPost, MiniBoardPost } from '@/lib/mock/homeMock';

export type HotPostsProps = {
  posts: HotPost[];
};

export type MiniBoardProps = {
  posts: MiniBoardPost[];
};

export default function HotPosts({ posts }: HotPostsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ホットな掲示物</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {posts.map((post) => (
          <article key={post.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">{post.title}</p>
            <p className="mt-1 text-xs text-slate-500">投稿者: {post.userName}</p>
            <p className="mt-2 text-sm text-slate-700">{post.excerpt}</p>
          </article>
        ))}

        <button
          type="button"
          className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
        >
          新しい投稿を作成
        </button>
      </CardContent>
    </Card>
  );
}

export function MiniBoard({ posts }: MiniBoardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ミニ掲示板</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {posts.map((post) => (
          <article key={post.id} className="border-b border-slate-100 pb-3 last:border-none last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{post.userName}</p>
              <p className="text-xs text-slate-500">{post.courseTitle}</p>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-slate-700">{post.body}</p>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
