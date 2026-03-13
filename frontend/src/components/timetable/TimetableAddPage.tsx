'use client';

import OfferingFinderClient from '@/components/offerings/OfferingFinderClient';
import type { OfferingFinderContext } from '@/lib/offerings/finder';

type TimetableAddPageProps = {
  initialContext: OfferingFinderContext;
};

export default function TimetableAddPage({ initialContext }: TimetableAddPageProps) {
  return <OfferingFinderClient mode="timetable-add" initialContext={initialContext} />;
}
