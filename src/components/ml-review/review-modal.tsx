'use client';

import { useState, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getVideoReviewDetail } from '@/app/actions/ml-categorization';
import type { ReviewResult, VideoReviewDetail } from '@/types/ml';
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
  const [modalData, setModalData] = useState<VideoReviewDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch video review detail when modal opens or videoId changes
  useEffect(() => {
    if (open && videoId) {
      setIsLoading(true);
      setModalData(null);
      getVideoReviewDetail(videoId)
        .then((data) => {
          setModalData(data);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (!open) {
      setModalData(null);
    }
  }, [open, videoId]);

  // Find current index in results list for navigation
  const currentIndex = videoId
    ? resultsList.findIndex((r) => r.videoId === videoId)
    : -1;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < resultsList.length - 1;

  // A key: Accept suggestion
  useHotkeys(
    'a',
    () => {
      if (videoId) {
        onAccept(videoId);
      }
    },
    { enabled: open && !isLoading && videoId !== null, preventDefault: true }
  );

  // R key: Reject suggestion
  useHotkeys(
    'r',
    () => {
      if (videoId) {
        onReject(videoId);
      }
    },
    { enabled: open && !isLoading && videoId !== null, preventDefault: true }
  );

  // Left arrow: Navigate to previous video
  useHotkeys(
    'arrowleft',
    () => {
      if (hasPrevious) {
        onNavigate(resultsList[currentIndex - 1].videoId);
      }
    },
    { enabled: open && !isLoading && hasPrevious, preventDefault: true }
  );

  // Right arrow: Navigate to next video
  useHotkeys(
    'arrowright',
    () => {
      if (hasNext) {
        onNavigate(resultsList[currentIndex + 1].videoId);
      }
    },
    { enabled: open && !isLoading && hasNext, preventDefault: true }
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

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">
              Loading video details...
            </span>
          </div>
        )}

        {/* Error state: video not found */}
        {!isLoading && !modalData && videoId && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <p>Could not load video details</p>
          </div>
        )}

        {/* Modal content */}
        {!isLoading && modalData && (
          <div className="flex flex-col gap-6">
            {/* Video player embed */}
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              <iframe
                src={`https://www.youtube.com/embed/${modalData.video.youtubeId}`}
                title={modalData.video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>

            {/* Video metadata */}
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold leading-tight">
                {modalData.video.title}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {modalData.video.channelTitle && (
                  <span>{modalData.video.channelTitle}</span>
                )}
                {modalData.video.channelTitle && modalData.video.duration && (
                  <span>&bull;</span>
                )}
                {modalData.video.duration && (
                  <span>{formatDuration(modalData.video.duration)}</span>
                )}
                {modalData.video.publishedAt && (
                  <>
                    <span>&bull;</span>
                    <span>
                      {formatRelativeDate(modalData.video.publishedAt)}
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
                    Suggested Category:{' '}
                    {modalData.suggestedCategory.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {modalData.categorization.similarityScore}% match
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-3 py-1.5 rounded ${
                    confidenceBadgeStyles[modalData.categorization.confidence]
                  }`}
                >
                  {confidenceLabels[modalData.categorization.confidence]}
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
