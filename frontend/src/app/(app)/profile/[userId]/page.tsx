import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import UserContactActions from '@/components/community/UserContactActions';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type ProfilePageProps = {
  params: Promise<{ userId: string }>;
};

type ProfileRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  faculty: string | null;
  department: string | null;
  bio: string | null;
  grade_year: number | null;
  university_id: string | null;
  allow_dm: boolean;
  dm_scope: 'any' | 'shared_offering' | 'connections';
};

type UniversityNameRow = {
  name: string;
};

export default async function UserProfilePage({ params }: ProfilePageProps) {
  const { userId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  if (user.id === userId) {
    redirect('/me');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url, faculty, department, bio, grade_year, university_id, allow_dm, dm_scope')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    notFound();
  }

  const profile = data as ProfileRow;
  let universityName: string | null = null;

  if (profile.university_id) {
    const universityResult = await supabase
      .from('universities')
      .select('name')
      .eq('id', profile.university_id)
      .maybeSingle();

    const university = universityResult.data as UniversityNameRow | null;
    universityName = university?.name ?? null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Link
        href="/community"
        className="inline-flex items-center rounded-full border border-white/60 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur hover:bg-white"
      >
        ← コミュニティに戻る
      </Link>

      <section className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={`${profile.display_name}のアイコン`}
                className="h-16 w-16 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
                {profile.display_name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-slate-900">{profile.display_name}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {[universityName, profile.grade_year ? `${profile.grade_year}年` : null]
                  .filter(Boolean)
                  .join(' / ') || '大学・学年未設定'}
              </p>
              <p className="text-sm text-slate-500">
                {[profile.faculty, profile.department].filter(Boolean).join(' / ') || '所属未設定'}
              </p>
            </div>
          </div>

          <div className="sm:max-w-xs">
            <UserContactActions
              targetUserId={profile.user_id}
              targetDisplayName={profile.display_name}
              currentUserId={user.id}
              allowDm={profile.allow_dm}
              showProfileLink={false}
              source="profile"
            />
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-800">自己紹介</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {profile.bio?.trim() ? profile.bio : 'まだ自己紹介は設定されていません。'}
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">DM受信</p>
            <p className={`mt-1 text-sm font-semibold ${profile.allow_dm ? 'text-emerald-700' : 'text-rose-700'}`}>
              {profile.allow_dm ? '受け付ける' : '受け付けない'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">DM範囲 (dm_scope)</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{profile.dm_scope}</p>
            <p className="mt-1 text-xs text-amber-700">MVP中は未反映です（現在は allow_dm のみ判定に使います）。</p>
          </div>
        </div>
      </section>
    </div>
  );
}
