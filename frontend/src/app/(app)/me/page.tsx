'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import MyAssetsTabs from '@/components/me/MyAssetsTabs';
import ProfileCard from '@/components/me/ProfileCard';
import SettingsPanel from '@/components/me/SettingsPanel';
import TimetableSummary from '@/components/me/TimetableSummary';
import { createSupabaseClient } from '@/lib/supabase/client';
import type {
  MeNoteItemViewModel,
  MeProfileViewModel,
  MeReviewItemViewModel,
  MeSavedNoteItemViewModel,
  MeTimetableSummaryViewModel,
  MeUniversityOption,
} from '@/types/me';
import type { Database } from '@/types/supabase';

type ProfileRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  faculty: string | null;
  department: string | null;
  university_id: string | null;
  grade_year: number | null;
  university: { name: string | null } | Array<{ name: string | null }> | null;
};

type NoteQueryRow = {
  id: string;
  title: string;
  body_md: string | null;
  created_at: string;
  offering:
    | {
        id: string;
        instructor: string | null;
        courses: { name: string | null } | Array<{ name: string | null }> | null;
      }
    | Array<{
        id: string;
        instructor: string | null;
        courses: { name: string | null } | Array<{ name: string | null }> | null;
      }>
    | null;
};

type ReviewQueryRow = {
  id: string;
  rating_overall: number;
  comment: string | null;
  created_at: string;
  offering:
    | {
        id: string;
        instructor: string | null;
        courses: { name: string | null } | Array<{ name: string | null }> | null;
      }
    | Array<{
        id: string;
        instructor: string | null;
        courses: { name: string | null } | Array<{ name: string | null }> | null;
      }>
    | null;
};

type SavedNoteQueryRow = {
  note_id: string;
  kind: string;
  notes: {
    id: string;
    title: string;
    body_md: string | null;
    created_at: string;
    offering:
      | {
          id: string;
          instructor: string | null;
          courses: { name: string | null } | Array<{ name: string | null }> | null;
        }
      | Array<{
          id: string;
          instructor: string | null;
          courses: { name: string | null } | Array<{ name: string | null }> | null;
        }>
      | null;
    profiles: { display_name: string | null } | null;
  } | null;
};

type EnrollmentQueryRow = {
  created_at: string;
  status: string;
  offering:
    | {
        id: string;
        instructor: string | null;
        courses: { name: string | null } | Array<{ name: string | null }> | null;
        terms:
          | {
              id: string;
              year: number;
              season: string;
              start_date: string | null;
              end_date: string | null;
            }
          | Array<{
              id: string;
              year: number;
              season: string;
              start_date: string | null;
              end_date: string | null;
            }>
          | null;
        offering_slots: Array<{ day_of_week: number | null; period: number | null; start_time: string | null }> | null;
      }
    | Array<{
        id: string;
        instructor: string | null;
        courses: { name: string | null } | Array<{ name: string | null }> | null;
        terms:
          | {
              id: string;
              year: number;
              season: string;
              start_date: string | null;
              end_date: string | null;
            }
          | Array<{
              id: string;
              year: number;
              season: string;
              start_date: string | null;
              end_date: string | null;
            }>
          | null;
        offering_slots: Array<{ day_of_week: number | null; period: number | null; start_time: string | null }> | null;
      }>
    | null;
};

type TermSnapshot = {
  id: string;
  label: string;
  year: number;
  season: string;
  startDate: Date | null;
  endDate: Date | null;
};

const ENROLLMENT_STATUSES = ['enrolled', 'planned'] as const;

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function buildAffiliation(faculty: string | null | undefined, department: string | null | undefined) {
  return [faculty, department].filter(Boolean).join(' / ') || '所属未設定';
}

function formatSeasonLabel(season: string) {
  if (season === 'first_half') return '前期';
  if (season === 'second_half') return '後期';
  return season;
}

function parseDateAtStartOfDay(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildProfileViewModel(user: User, profileRow: ProfileRow | null): MeProfileViewModel {
  const metadataName = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : null;
  const fallbackName = metadataName ?? user.email ?? 'ユーザー';
  const displayName = profileRow?.display_name?.trim() || fallbackName;
  const university = normalizeOne(profileRow?.university ?? null);

  return {
    userId: user.id,
    displayName,
    avatarUrl: profileRow?.avatar_url ?? null,
    affiliation: buildAffiliation(profileRow?.faculty, profileRow?.department),
    universityId: profileRow?.university_id ?? null,
    universityName: university?.name ?? null,
    gradeYear: profileRow?.grade_year ?? null,
  };
}

function buildNoteItems(rows: NoteQueryRow[]): MeNoteItemViewModel[] {
  return rows.map((row) => {
    const offering = normalizeOne(row.offering);
    const course = normalizeOne(offering?.courses ?? null);
    return {
      id: row.id,
      title: row.title,
      body: row.body_md,
      createdAt: row.created_at,
      offeringTitle: course?.name ?? '不明な授業',
      instructorName: offering?.instructor ?? '教員未設定',
    };
  });
}

function buildReviewItems(rows: ReviewQueryRow[]): MeReviewItemViewModel[] {
  return rows.map((row) => {
    const offering = normalizeOne(row.offering);
    const course = normalizeOne(offering?.courses ?? null);
    return {
      id: row.id,
      rating: row.rating_overall,
      comment: row.comment,
      createdAt: row.created_at,
      offeringTitle: course?.name ?? '不明な授業',
      instructorName: offering?.instructor ?? '教員未設定',
    };
  });
}

function buildSavedNoteItems(rows: SavedNoteQueryRow[]): MeSavedNoteItemViewModel[] {
  const noteMap = new Map<string, MeSavedNoteItemViewModel>();

  rows.forEach((row) => {
    const note = row.notes;
    if (!note) return;
    const existing = noteMap.get(note.id);
    if (existing) {
      noteMap.set(note.id, {
        ...existing,
        isLikedByMe: existing.isLikedByMe || row.kind === 'like',
        isBookmarkedByMe: existing.isBookmarkedByMe || row.kind === 'bookmark',
      });
      return;
    }
    const offering = normalizeOne(note.offering);
    const course = normalizeOne(offering?.courses ?? null);
    noteMap.set(note.id, {
      id: note.id,
      title: note.title,
      body: note.body_md,
      createdAt: note.created_at,
      offeringId: offering?.id ?? '',
      offeringTitle: course?.name ?? '不明な授業',
      instructorName: offering?.instructor ?? '教員未設定',
      authorName: note.profiles?.display_name ?? '匿名ユーザー',
      isLikedByMe: row.kind === 'like',
      isBookmarkedByMe: row.kind === 'bookmark',
    });
  });

  return Array.from(noteMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function isEnrollmentStatus(value: string): value is (typeof ENROLLMENT_STATUSES)[number] {
  return value === 'enrolled' || value === 'planned';
}

function resolveCurrentTerm(terms: TermSnapshot[], today: Date) {
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const active = terms
    .filter((term) => term.startDate && term.endDate)
    .filter((term) => {
      if (!term.startDate || !term.endDate) return false;
      const endDate = new Date(term.endDate);
      endDate.setHours(23, 59, 59, 999);
      return term.startDate <= todayDate && todayDate <= endDate;
    })
    .sort((left, right) => {
      if (!left.startDate || !right.startDate) return 0;
      return right.startDate.getTime() - left.startDate.getTime();
    });

  if (active.length > 0) return active[0];

  const seasonRank = (season: string) => (season === 'second_half' ? 2 : 1);
  return [...terms].sort((left, right) => {
    if (left.year !== right.year) return right.year - left.year;
    return seasonRank(right.season) - seasonRank(left.season);
  })[0] ?? null;
}

function formatStartTime(value: string | null) {
  if (!value) return null;
  const [hour, minute] = value.split(':');
  if (!hour || !minute) return value;
  return `${hour}:${minute}`;
}

function buildTimetableSummary(rows: EnrollmentQueryRow[]): MeTimetableSummaryViewModel {
  const termMap = new Map<string, TermSnapshot>();
  const entries: Array<{
    offeringId: string;
    courseTitle: string;
    instructorName: string;
    status: 'enrolled' | 'planned';
    termId: string | null;
    slots: Array<{ dayOfWeek: number | null; period: number | null; startTime: string | null }>;
  }> = [];

  rows.forEach((row) => {
    if (!isEnrollmentStatus(row.status)) return;
    const offering = normalizeOne(row.offering);
    if (!offering) return;

    const course = normalizeOne(offering.courses);
    const term = normalizeOne(offering.terms);
    const slots = Array.isArray(offering.offering_slots) ? offering.offering_slots : [];

    if (term) {
      termMap.set(term.id, {
        id: term.id,
        label: `${term.year} ${formatSeasonLabel(term.season)}`,
        year: term.year,
        season: term.season,
        startDate: parseDateAtStartOfDay(term.start_date),
        endDate: parseDateAtStartOfDay(term.end_date),
      });
    }

    entries.push({
      offeringId: offering.id,
      courseTitle: course?.name ?? '不明な授業',
      instructorName: offering.instructor ?? '教員未設定',
      status: row.status,
      termId: term?.id ?? null,
      slots: slots.map((slot) => ({
        dayOfWeek: slot.day_of_week,
        period: slot.period,
        startTime: formatStartTime(slot.start_time),
      })),
    });
  });

  if (entries.length === 0) {
    return {
      termLabel: '未設定',
      currentTermEnrollmentCount: 0,
      todayClasses: [],
    };
  }

  const today = new Date();
  const currentTerm = resolveCurrentTerm(Array.from(termMap.values()), today);
  const scopedEntries = currentTerm ? entries.filter((entry) => entry.termId === currentTerm.id) : entries;

  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
  const todayClasses = scopedEntries
    .flatMap((entry) =>
      entry.slots
        .filter((slot) => slot.dayOfWeek === dayOfWeek)
        .map((slot) => ({
          offeringId: entry.offeringId,
          courseTitle: entry.courseTitle,
          instructorName: entry.instructorName,
          period: slot.period,
          startTime: slot.startTime,
          status: entry.status,
        })),
    )
    .sort((left, right) => {
      if (left.period === null && right.period === null) return 0;
      if (left.period === null) return 1;
      if (right.period === null) return -1;
      return left.period - right.period;
    });

  return {
    termLabel: currentTerm?.label ?? '未設定',
    currentTermEnrollmentCount: scopedEntries.length,
    todayClasses,
  };
}

export default function MePage() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const typedSupabase = supabase as unknown as SupabaseClient<Database>;
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<MeProfileViewModel | null>(null);
  const [universities, setUniversities] = useState<MeUniversityOption[]>([]);
  const [notes, setNotes] = useState<MeNoteItemViewModel[]>([]);
  const [reviews, setReviews] = useState<MeReviewItemViewModel[]>([]);
  const [savedNotes, setSavedNotes] = useState<MeSavedNoteItemViewModel[]>([]);
  const [timetableSummary, setTimetableSummary] = useState<MeTimetableSummaryViewModel | null>(null);

  const fetchMeData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        setCurrentUserId(null);
        setProfile(null);
        setNotes([]);
        setReviews([]);
        setSavedNotes([]);
        setTimetableSummary(null);
        return;
      }

      setCurrentUserId(user.id);

      const [profileRes, universitiesRes, notesRes, reviewsRes, enrollmentsRes, savedNoteReactionsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url, faculty, department, university_id, grade_year, university:university_id(name)')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.from('universities').select('id, name').order('name'),
        supabase
          .from('notes')
          .select(
            `
            id,
            title,
            body_md,
            created_at,
            offering:course_offerings(
              id,
              instructor,
              courses:course_id(name)
            )
          `,
          )
          .eq('author_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('reviews')
          .select(
            `
            id,
            rating_overall,
            comment,
            created_at,
            offering:course_offerings(
              id,
              instructor,
              courses:course_id(name)
            )
          `,
          )
          .eq('author_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('enrollments')
          .select(
            `
            created_at,
            status,
            offering:course_offerings(
              id,
              instructor,
              courses:course_id(name),
              terms:term_id(id, year, season, start_date, end_date),
              offering_slots(day_of_week, period, start_time)
            )
          `,
          )
          .eq('user_id', user.id)
          .in('status', [...ENROLLMENT_STATUSES]),
        supabase
          .from('note_reactions')
          .select(
            `
            note_id,
            kind,
            notes:note_id(
              id,
              title,
              body_md,
              created_at,
              offering:course_offerings(
                id,
                instructor,
                courses:course_id(name)
              ),
              profiles:author_id(display_name)
            )
          `,
          )
          .eq('user_id', user.id)
          .in('kind', ['like', 'bookmark']),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (universitiesRes.error) throw universitiesRes.error;
      if (notesRes.error) throw notesRes.error;
      if (reviewsRes.error) throw reviewsRes.error;
      if (enrollmentsRes.error) throw enrollmentsRes.error;
      if (savedNoteReactionsRes.error) throw savedNoteReactionsRes.error;

      const profileRow = (profileRes.data ?? null) as ProfileRow | null;
      const universityRows = (universitiesRes.data ?? []) as MeUniversityOption[];
      const notesRows = (notesRes.data ?? []) as NoteQueryRow[];
      const reviewsRows = (reviewsRes.data ?? []) as ReviewQueryRow[];
      const enrollmentRows = (enrollmentsRes.data ?? []) as EnrollmentQueryRow[];
      const savedNoteRows = (savedNoteReactionsRes.data ?? []) as SavedNoteQueryRow[];

      setProfile(buildProfileViewModel(user, profileRow));
      setUniversities(universityRows);
      setNotes(buildNoteItems(notesRows));
      setReviews(buildReviewItems(reviewsRows));
      setSavedNotes(buildSavedNoteItems(savedNoteRows));
      setTimetableSummary(buildTimetableSummary(enrollmentRows));
    } catch (error) {
      console.error('マイページ取得エラー:', error);
      setErrorMessage('マイページ情報の取得に失敗しました。時間をおいて再度お試しください。');
      setProfile(null);
      setUniversities([]);
      setNotes([]);
      setReviews([]);
      setSavedNotes([]);
      setTimetableSummary(null);
      toast.error('マイページ情報の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void fetchMeData();
  }, [fetchMeData]);

  const handleSaveProfile = useCallback(
    async ({
      displayName,
      universityId,
      gradeYear,
    }: {
      displayName: string;
      universityId: string;
      gradeYear: number;
    }) => {
      if (!currentUserId) {
        throw new Error('ログインユーザーを取得できませんでした');
      }

      const trimmed = displayName.trim();
      if (!trimmed) {
        toast.error('表示名を入力してください');
        throw new Error('display_name is empty');
      }
      if (!universityId) {
        toast.error('大学を選択してください');
        throw new Error('university_id is empty');
      }
      if (!Number.isInteger(gradeYear) || gradeYear < 1 || gradeYear > 8) {
        toast.error('学年を選択してください');
        throw new Error('grade_year is invalid');
      }

      setIsSavingProfile(true);

      try {
        const { data, error } = await typedSupabase
          .from('profiles')
          .upsert(
            {
              user_id: currentUserId,
              display_name: trimmed,
              university_id: universityId,
              grade_year: gradeYear,
            },
            { onConflict: 'user_id' },
          )
          .select('user_id, display_name, avatar_url, faculty, department, university_id, grade_year')
          .single();

        if (error) throw error;

        const row = data as ProfileRow;
        const selectedUniversity = universities.find((university) => university.id === row.university_id);
        setProfile({
          userId: row.user_id,
          displayName: row.display_name,
          avatarUrl: row.avatar_url ?? null,
          affiliation: buildAffiliation(row.faculty, row.department),
          universityId: row.university_id ?? null,
          universityName: selectedUniversity?.name ?? null,
          gradeYear: row.grade_year ?? null,
        });
        toast.success('プロフィールを更新しました');
      } catch (error) {
        console.error('プロフィール更新エラー:', error);
        toast.error('プロフィールの更新に失敗しました');
        throw error;
      } finally {
        setIsSavingProfile(false);
      }
    },
    [currentUserId, typedSupabase, universities],
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <section className="rounded-3xl border border-white/50 bg-white/75 p-6 shadow-sm backdrop-blur">
        <h1 className="text-2xl font-bold text-slate-900">マイページ</h1>
        <p className="mt-2 text-sm text-slate-600">プロフィール・投稿資産・時間割・設定をまとめて管理できます。</p>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <ProfileCard
        profile={profile}
        universities={universities}
        isLoading={isLoading}
        isSaving={isSavingProfile}
        onSaveProfile={handleSaveProfile}
      />
      <MyAssetsTabs notes={notes} reviews={reviews} savedNotes={savedNotes} isLoading={isLoading} />
      <TimetableSummary summary={timetableSummary} isLoading={isLoading} />
      <SettingsPanel />
    </div>
  );
}
