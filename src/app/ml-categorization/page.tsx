import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { MLCategorizationPage } from './ml-categorization-page';

export default async function Page() {
  const session = await getServerSession();

  if (!session?.access_token || session?.error === 'RefreshAccessTokenError') {
    redirect('/api/auth/signin');
  }

  return (
    <Suspense fallback={<div className="p-8">Loading ML categorization...</div>}>
      <MLCategorizationPage />
    </Suspense>
  );
}
