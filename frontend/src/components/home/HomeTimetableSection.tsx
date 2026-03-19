'use client';

import { useMemo } from 'react';
import WeeklyTimetable from '@/components/home/WeeklyTimetable';
import { useTimetableGridData } from '@/components/timetable/useTimetableGridData';
import { createSupabaseClient } from '@/lib/supabase/client';
import { buildTermLabel } from '@/lib/timetable/terms';

export default function HomeTimetableSection() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const {
    enrollmentEntries,
    terms,
    timetableConfig,
    isLoading,
    errorMessage,
    resolvedTermId,
  } = useTimetableGridData({
    rawSelectedTermId: null,
    showDropped: false,
    supabase,
  });

  const resolvedTerm = terms.find((term) => term.id === resolvedTermId) ?? null;

  return (
    <WeeklyTimetable
      timetableConfig={timetableConfig}
      enrollmentEntries={enrollmentEntries}
      termLabel={resolvedTerm ? buildTermLabel(resolvedTerm) : null}
      isLoading={isLoading}
      errorMessage={errorMessage}
    />
  );
}
