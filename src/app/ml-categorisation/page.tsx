import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { MLCategorisationPage } from './ml-categorisation-page';

export default async function Page() {
  const session = await getServerSession();

  if (!session?.access_token || session?.error === 'RefreshAccessTokenError') {
    redirect('/api/auth/signin');
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center p-8 bg-background text-muted-foreground">Loading...</div>}>
      <MLCategorisationPage />
    </Suspense>
  );
}
