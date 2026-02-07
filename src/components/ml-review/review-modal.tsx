'use client';

import { useHotkeys } from 'react-hotkeys-hook';
import { ExternalLink } from 'lucide-react';
import { getThumbnailUrl } from '@/lib/videos/thumbnail-url';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { ReviewResult } from '@/types/ml';
import type { ConfidenceLevel } from '@/lib/ml/confidence';
import { formatDuration, formatRelativeDate } from '@/lib/videos/format';

interface ReviewModalProps {
  open: boolean;
  videoId: number | null;
  resultsList: ReviewResult[];
  onClose: () => void;
  onNavigate: (videoId: number) => void;
  onAccept: (videoId: number) => void;
  onReject: (videoId: number) => void;
}

const confidenceBadgeStyles: Record<ConfidenceLevel, string> = {
  HIGH: 'bg-green-600 text-white',
  MEDIUM: 'bg-amber-500 text-white',
  LOW: 'bg-red-600 text-white',
};

const confidenceLabels: Record<ConfidenceLevel, string> = {
  HIGH: 'High Confidence',
  MEDIUM: 'Medium Confidence',
  LOW: 'Low Confidence',
};

export function ReviewModal({
  open,
  videoId,
  resultsList,
  onClose,
  onNavigate,
  onAccept,
  onReject,
}: ReviewModalProps) {
  // Use data directly from resultsList — no server action needed
  const currentIndex = videoId
    ? resultsList.findIndex((r) => r.videoId === videoId)
    : -1;
  const currentResult = currentIndex >= 0 ? resultsList[currentIndex] : null;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < resultsList.length - 1;

  // A key: Accept suggestion
  useHotkeys(
    'a',
    () => {
      if (videoId) onAccept(videoId);
    },
    { enabled: open && videoId !== null, preventDefault: true }
  );

  // R key: Reject suggestion
  useHotkeys(
    'r',
    () => {
      if (videoId) onReject(videoId);
    },
    { enabled: open && videoId !== null, preventDefault: true }
  );

  // Left arrow: Navigate to previous video
  useHotkeys(
    'arrowleft',
    () => {
      if (hasPrevious) {
        onNavigate(resultsList[currentIndex - 1].videoId);
      }
    },
    { enabled: open && hasPrevious, preventDefault: true }
  );

  // Right arrow: Navigate to next video
  useHotkeys(
    'arrowright',
    () => {
      if (hasNext) {
        onNavigate(resultsList[currentIndex + 1].videoId);
      }
    },
    { enabled: open && hasNext, preventDefault: true }
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Video Categorisation</DialogTitle>
          <DialogDescription>
            Press A to accept, R to reject, or arrow keys to navigate
          </DialogDescription>
        </DialogHeader>

        {/* No video found */}
        {!currentResult && videoId && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <p>Could not load video details</p>
          </div>
        )}

        {/* Modal content — uses ReviewResult data directly, no server fetch */}
        {currentResult && (
          <div className="flex flex-col gap-6">
            {/* Video thumbnail with YouTube link */}
            <a
              href={`https://www.youtube.com/watch?v=${currentResult.youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block aspect-video rounded-lg overflow-hidden bg-muted group/thumb"
            >
              <img
                src={getThumbnailUrl(currentResult.youtubeId) ?? ''}
                alt={currentResult.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                <div className="flex items-center gap-2 bg-white/90 text-black px-4 py-2 rounded-lg text-sm font-medium">
                  <ExternalLink className="h-4 w-4" />
                  Watch on YouTube
                </div>
              </div>
            </a>

            {/* Video metadata */}
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold leading-tight">
                {currentResult.title}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {currentResult.channelTitle && (
                  <span>{currentResult.channelTitle}</span>
                )}
                {currentResult.channelTitle && currentResult.duration && (
                  <span>&bull;</span>
                )}
                {currentResult.duration && (
                  <span>{formatDuration(currentResult.duration)}</span>
                )}
                {currentResult.publishedAt && (
                  <>
                    <span>&bull;</span>
                    <span>
                      {formatRelativeDate(currentResult.publishedAt)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* ML suggestion card */}
            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-lg font-medium">
                    Suggested Category: {currentResult.suggestedCategoryName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {currentResult.similarityScore}% match
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-3 py-1.5 rounded ${
                    confidenceBadgeStyles[currentResult.confidence]
                  }`}
                >
                  {confidenceLabels[currentResult.confidence]}
                </span>
              </div>
            </div>

            {/* Navigation indicator */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {hasPrevious
                  ? `\u2190 ${resultsList[currentIndex - 1].title.slice(0, 30)}...`
                  : ''}
              </span>
              <span>
                {currentIndex + 1} of {resultsList.length}
              </span>
              <span>
                {hasNext
                  ? `${resultsList[currentIndex + 1].title.slice(0, 30)}... \u2192`
                  : ''}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => videoId && onAccept(videoId)}
                disabled={!videoId}
                className="px-6 py-2.5 rounded-lg text-sm font-medium transition-colors bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Accept (A)
              </button>
              <button
                onClick={() => videoId && onReject(videoId)}
                disabled={!videoId}
                className="px-6 py-2.5 rounded-lg text-sm font-medium transition-colors bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject (R)
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
