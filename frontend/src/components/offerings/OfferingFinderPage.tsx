import OfferingFinderClient from '@/components/offerings/OfferingFinderClient';
import TimetableAddPage from '@/components/timetable/TimetableAddPage';
import { readOfferingFinderContext, type OfferingFinderMode } from '@/lib/offerings/finder';

type OfferingFinderPageProps = {
  mode: OfferingFinderMode;
  searchParams: Record<string, string | string[] | undefined>;
};

export default function OfferingFinderPage({ mode, searchParams }: OfferingFinderPageProps) {
  const initialContext = readOfferingFinderContext(searchParams, mode);
  if (mode === 'timetable-add') {
    return <TimetableAddPage initialContext={initialContext} />;
  }

  return <OfferingFinderClient mode={mode} initialContext={initialContext} />;
}
