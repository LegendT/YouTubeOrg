import { getReviewData, getReviewStats } from '@/app/actions/ml-categorisation';
import { ReviewPage } from '@/components/ml-review/review-page';

export const metadata = {
  title: 'ML Review - YouTube Playlist Organiser',
};

/**
 * ML Review page (Server Component).
 *
 * Loads initial review data and statistics, then delegates to
 * ReviewPage client component for interactive review workflow.
 */
export default async function MLReviewPage() {
  const [results, stats] = await Promise.all([
    getReviewData(),
    getReviewStats(),
  ]);

  // Empty state: no videos to review
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h1 className="text-2xl font-bold">No Videos to Review</h1>
        <p className="text-muted-foreground text-center max-w-md">
          There are no ML categorisation results to review yet. Run ML
          categorisation first to generate suggestions for your videos.
        </p>
        <a
          href="/ml-categorisation"
          className="text-primary hover:underline text-sm"
        >
          Go to ML Categorisation
        </a>
      </div>
    );
  }

  return <ReviewPage initialResults={results} initialStats={stats} />;
}
