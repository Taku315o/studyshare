import { redirect } from 'next/navigation';

export default function MyPageRedirectPage() {
  redirect('/me');
}
