import OfferingFinderPage from '@/components/offerings/OfferingFinderPage';

export default async function OfferingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return <OfferingFinderPage mode="browse" searchParams={resolvedSearchParams} />;
}
