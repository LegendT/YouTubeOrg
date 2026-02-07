import { getServerSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getCategories } from '@/app/actions/categories';
import { getVideosForCategory } from '@/app/actions/videos';
import { VideoBrowsePage } from '@/components/videos/video-browse-page';

/**
 * Video browsing page (Server Component).
 *
 * Loads initial categories and "All Videos" data, then delegates to
 * VideoBrowsePage client component for interactive state management.
 */
export default async function VideosPage() {
  // Check authentication
  const session = await getServerSession();

  if (!session?.access_token || session?.error === 'RefreshAccessTokenError') {
    redirect('/api/auth/signin');
  }

  const categories = await getCategories();
  // Load "All Videos" initially (null = all categories)
  const initialVideos = await getVideosForCategory(null);
  const totalVideoCount = initialVideos.length;

  return (
    <VideoBrowsePage
      initialCategories={categories}
      initialVideos={initialVideos}
      totalVideoCount={totalVideoCount}
    />
  );
}
