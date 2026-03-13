'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import MyAssetsTabs from '@/components/me/MyAssetsTabs';
import ProfileCard from '@/components/me/ProfileCard';
import SettingsPanel from '@/components/me/SettingsPanel';
import TimetableSummary from '@/components/me/TimetableSummary';
import { isUploadApiError, uploadAvatarImage } from '@/lib/api';
import { buildTermLabel, parseDateOnly, resolveDefaultTerm } from '@/lib/timetable/terms';
import { getValidationErrorMessage, profileEditSchema } from '@/lib/validation/profile';
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
import type { TimetableTermOption } from '@/types/timetable';

type ProfileRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  faculty: string | null;
  department: string | null;
  university_id: string | null;
  grade_year: number | null;
  university: { name: string | null } | Array<{ name: string | null }> | null;
};

type UserStatsRow = {
  followers_count: number;
  following_count: number;
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

type SavedReactionQueryRow = {
  kind: string;
  created_at: string;
  note:
    | {
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
      }
    | Array<{
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
      }>
    | null;
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
              academic_year: number;
              code: string;
              display_name: string;
              sort_key: number;
              start_date: string | null;
              end_date: string | null;
            }
          | Array<{
              id: string;
              academic_year: number;
              code: string;
              display_name: string;
              sort_key: number;
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
               academic_year: number;
               code: string;
               display_name: string;
               sort_key: number;
               start_date: string | null;
               end_date: string | null;
             }
           | Array<{
               id: string;
               academic_year: number;
               code: string;
               display_name: string;
               sort_key: number;
               start_date: string | null;
               end_date: string | null;
             }>
           | null;
         offering_slots: Array<{ day_of_week: number | null; period: number | null; start_time: string | null }> | null;
      }>
    | null;
};

const ENROLLMENT_STATUSES = ['enrolled', 'planned'] as const;

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

// ユーザープロフィールの情報を表すViewModel
function buildProfileViewModel(user: User, profileRow: ProfileRow | null, userStatsRow: UserStatsRow | null): MeProfileViewModel {
  const metadataName = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : null;
  const fallbackName = metadataName ?? user.email ?? 'ユーザー';
  const displayName = profileRow?.display_name?.trim() || fallbackName;
  const university = normalizeOne(profileRow?.university ?? null);

  return {
    userId: user.id,
    displayName,
    avatarUrl: profileRow?.avatar_url ?? null,
    bio: profileRow?.bio ?? null,
    faculty: profileRow?.faculty ?? null,
    universityId: profileRow?.university_id ?? null,
    universityName: university?.name ?? null,
    gradeYear: profileRow?.grade_year ?? null,
    followersCount: userStatsRow?.followers_count ?? 0,
    followingCount: userStatsRow?.following_count ?? 0,
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

function buildSavedNoteItems(rows: SavedReactionQueryRow[]): MeSavedNoteItemViewModel[] {
  const byNoteId = new Map<string, MeSavedNoteItemViewModel>();
  //
  rows.forEach((row) => {
    if (row.kind !== 'like' && row.kind !== 'bookmark') return;

    const note = normalizeOne(row.note);
    if (!note) return;

    const offering = normalizeOne(note.offering);
    const course = normalizeOne(offering?.courses ?? null);
    const existing = byNoteId.get(note.id);

    if (!existing) {
      byNoteId.set(note.id, {
        id: note.id,
        title: note.title,
        body: note.body_md,
        createdAt: note.created_at,
        offeringTitle: course?.name ?? '不明な授業',
        instructorName: offering?.instructor ?? '教員未設定',
        savedAt: row.created_at,
        savedByLike: row.kind === 'like',
        savedByBookmark: row.kind === 'bookmark',
      });
      return;
    }
    //
    byNoteId.set(note.id, {
      ...existing,
      savedAt: row.created_at > existing.savedAt ? row.created_at : existing.savedAt,
      savedByLike: existing.savedByLike || row.kind === 'like',
      savedByBookmark: existing.savedByBookmark || row.kind === 'bookmark',
    });
  });

  return Array.from(byNoteId.values()).sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}

function isEnrollmentStatus(value: string): value is (typeof ENROLLMENT_STATUSES)[number] {
  return value === 'enrolled' || value === 'planned';
}

function formatStartTime(value: string | null) {
  if (!value) return null;
  const [hour, minute] = value.split(':');
  if (!hour || !minute) return value;
  return `${hour}:${minute}`;
}

function buildTimetableSummary(rows: EnrollmentQueryRow[]): MeTimetableSummaryViewModel {
  const termMap = new Map<string, TimetableTermOption>();
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
        academicYear: term.academic_year,
        code: term.code,
        displayName: term.display_name,
        sortKey: term.sort_key,
        startDate: parseDateOnly(term.start_date),
        endDate: parseDateOnly(term.end_date),
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
  const currentTerm = resolveDefaultTerm(Array.from(termMap.values()), today);
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
    termLabel: currentTerm ? buildTermLabel(currentTerm) : '未設定',
    currentTermEnrollmentCount: scopedEntries.length,
    todayClasses,
  };
}

function resolveAvatarUploadErrorMessage(error: unknown): string | null {
  if (!isUploadApiError(error)) {
    return null;
  }

  if (error.kind === 'FILE_TOO_LARGE') {
    return 'アバター画像のサイズが大きすぎます（5MBまで）';
  }

  if (error.kind === 'STORAGE_ERROR') {
    return 'アバター画像の保存先ストレージで障害が発生しています。時間をおいて再度お試しください。';
  }

  return 'アバター画像のアップロードに失敗しました';
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

      const [profileRes, userStatsRes, universitiesRes, notesRes, reviewsRes, savedReactionsRes, enrollmentsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url, bio, faculty, department, university_id, grade_year, university:university_id(name)')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_stats')
          .select('followers_count, following_count')
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
          .from('note_reactions')
          .select(
            `
            kind,
            created_at,
            note:notes!inner(
              id,
              title,
              body_md,
              created_at,
              offering:course_offerings(
                id,
                instructor,
                courses:course_id(name)
              )
            )
          `,
          )
          .eq('user_id', user.id)
          .in('kind', ['like', 'bookmark'])
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
              terms:term_id(id, academic_year, code, display_name, sort_key, start_date, end_date),
              offering_slots(day_of_week, period, start_time)
            )
          `,
          )
          .eq('user_id', user.id)
          .in('status', [...ENROLLMENT_STATUSES]),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (userStatsRes.error) throw userStatsRes.error;
      if (universitiesRes.error) throw universitiesRes.error;
      if (notesRes.error) throw notesRes.error;
      if (reviewsRes.error) throw reviewsRes.error;
      if (savedReactionsRes.error) throw savedReactionsRes.error;
      if (enrollmentsRes.error) throw enrollmentsRes.error;

      const profileRow = (profileRes.data ?? null) as ProfileRow | null;
      const userStatsRow = (userStatsRes.data ?? null) as UserStatsRow | null;
      const universityRows = (universitiesRes.data ?? []) as MeUniversityOption[];
      const notesRows = (notesRes.data ?? []) as NoteQueryRow[];
      const reviewsRows = (reviewsRes.data ?? []) as ReviewQueryRow[];
      const savedReactionRows = (savedReactionsRes.data ?? []) as SavedReactionQueryRow[];
      const enrollmentRows = (enrollmentsRes.data ?? []) as EnrollmentQueryRow[];

      setProfile(buildProfileViewModel(user, profileRow, userStatsRow));
      setUniversities(universityRows);
      setNotes(buildNoteItems(notesRows));
      setReviews(buildReviewItems(reviewsRows));
      setSavedNotes(buildSavedNoteItems(savedReactionRows));
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
      faculty,
      bio,
      avatarFile,
    }: {
      displayName: string;
      universityId: string;
      gradeYear: number;
      faculty: string;
      bio: string;
      avatarFile: File | null;
    }) => {
      if (!currentUserId) {
        throw new Error('ログインユーザーを取得できませんでした');
      }

      const validation = profileEditSchema.safeParse({
        displayName,
        universityId,
        gradeYear,
        faculty,
        bio,
      });
      if (!validation.success) {
        toast.error(getValidationErrorMessage(validation.error, 'プロフィールの入力内容を確認してください。'));
        throw new Error('profile input is invalid');
      }

      const {
        displayName: normalizedDisplayName,
        universityId: normalizedUniversityId,
        gradeYear: normalizedGradeYear,
        faculty: normalizedFaculty,
        bio: normalizedBio,
      } = validation.data;

      setIsSavingProfile(true);

      try {
        let uploadedAvatarUrl: string | null = null;
        if (avatarFile) {
          const uploadResult = await uploadAvatarImage(avatarFile, {
            previousUrl: profile?.avatarUrl ?? null,
          });
          uploadedAvatarUrl = uploadResult.url;
        }

        const { data, error } = await typedSupabase
          .from('profiles')
          .upsert(
            {
              user_id: currentUserId,
              display_name: normalizedDisplayName,
              university_id: normalizedUniversityId,
              grade_year: normalizedGradeYear,
              faculty: normalizedFaculty || null,
              bio: normalizedBio || null,
              ...(uploadedAvatarUrl ? { avatar_url: uploadedAvatarUrl } : {}),
            },
            { onConflict: 'user_id' },
          )
          .select('user_id, display_name, avatar_url, bio, faculty, department, university_id, grade_year')
          .single();

        if (error) throw error;

        const row = data as ProfileRow;
        const selectedUniversity = universities.find((university) => university.id === row.university_id);
        setProfile({
          userId: row.user_id,
          displayName: row.display_name,
          avatarUrl: row.avatar_url ?? null,
          bio: row.bio ?? null,
          faculty: row.faculty ?? null,
          universityId: row.university_id ?? null,
          universityName: selectedUniversity?.name ?? null,
          gradeYear: row.grade_year ?? null,
          followersCount: profile?.followersCount ?? 0,
          followingCount: profile?.followingCount ?? 0,
        });
        toast.success('プロフィールを更新しました');
      } catch (error) {
        console.error('プロフィール更新エラー:', error);
        const avatarUploadErrorMessage = resolveAvatarUploadErrorMessage(error);
        if (avatarUploadErrorMessage) {
          toast.error(avatarUploadErrorMessage);
        } else {
          toast.error('プロフィールの更新に失敗しました');
        }
        throw error;
      } finally {
        setIsSavingProfile(false);
      }
    },
    [currentUserId, profile?.avatarUrl, profile?.followersCount, profile?.followingCount, typedSupabase, universities],
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
