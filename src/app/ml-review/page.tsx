import { ClipboardText } from '@phosphor-icons/react/dist/ssr';
import { getReviewData, getReviewStats } from '@/app/actions/ml-categorisation';
import { ReviewPage } from '@/components/ml-review/review-page';
import { EmptyState } from '@/components/ui/empty-state';

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
      <div className="flex items-center justify-center h-screen bg-background">
        <EmptyState
          icon={ClipboardText}
          title="No ML categorisations to review"
          description="Run ML categorisation first to generate suggestions for your videos."
          action={{ label: "Run Categorisation", href: "/ml-categorisation" }}
        />
      </div>
    );
  }

  return <ReviewPage initialResults={results} initialStats={stats} />;
}
