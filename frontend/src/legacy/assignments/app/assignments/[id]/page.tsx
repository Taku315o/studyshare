// studyshare/frontend/src/app/assignments/[id]/page.tsx

import AssignmentDetailClient from './AssignmentDetailClient';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssignmentDetailClient id={id} />;
}
