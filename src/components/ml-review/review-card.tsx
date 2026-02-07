'use client';

import { CheckCircle, XCircle } from 'lucide-react';
import type { ReviewResult } from '@/types/ml';
import type { ConfidenceLevel } from '@/lib/ml/confidence';
import { getThumbnailUrl } from '@/lib/videos/thumbnail-url';
import { formatDuration } from '@/lib/videos/format';

interface ReviewCardProps {
  result: ReviewResult;
  isFocused: boolean;
  onClick: (videoId: number) => void;
}

const confidenceBadgeStyles: Record<ConfidenceLevel, string> = {
  HIGH: 'bg-green-600 text-white',
  MEDIUM: 'bg-amber-500 text-white',
  LOW: 'bg-red-600 text-white',
};

const confidenceLabels: Record<ConfidenceLevel, string> = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export function ReviewCard({ result, isFocused, onClick }: ReviewCardProps) {
  // Prefer mqdefault (320x180) over DB-stored default (120x90)
  const thumbnailUrl =
    getThumbnailUrl(result.youtubeId) ?? result.thumbnailUrl;
  const isAccepted = result.acceptedAt !== null;
  const isRejected = result.rejectedAt !== null;

  return (
    <div
      className={`group relative flex flex-col rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${
        isFocused ? 'ring-2 ring-blue-500' : ''
      } ${isAccepted ? 'opacity-75' : ''} ${isRejected ? 'opacity-75' : ''}`}
      onClick={() => onClick(result.videoId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onClick(result.videoId);
        }
      }}
    >
      {/* Thumbnail area - fixed height prevents overlap on wide screens */}
      <div className="relative h-48 bg-muted">
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={result.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        )}

        {/* Duration overlay */}
        {result.duration && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-xs font-medium rounded">
            {formatDuration(result.duration)}
          </div>
        )}

        {/* Confidence badge overlay */}
        <div
          className={`absolute top-1 right-1 text-xs font-semibold px-2 py-1 rounded ${
            confidenceBadgeStyles[result.confidence]
          }`}
        >
          {confidenceLabels[result.confidence]}
        </div>

        {/* Review state indicator */}
        {isAccepted && (
          <div className="absolute top-1 left-1 bg-white rounded-full p-0.5">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
        )}
        {isRejected && (
          <div className="absolute top-1 left-1 bg-white rounded-full p-0.5">
            <XCircle className="h-5 w-5 text-red-600" />
          </div>
        )}
      </div>

      {/* Info area */}
      <div className="p-3 flex flex-col gap-1.5">
        {/* Title */}
        <h3 className="text-sm font-medium line-clamp-2 leading-tight">
          {result.title}
        </h3>

        {/* Suggested category */}
        <p className="text-xs text-muted-foreground truncate">
          Suggested: {result.suggestedCategoryName}
        </p>

        {/* Channel and similarity score */}
        <p className="text-xs text-muted-foreground truncate">
          {result.channelTitle && <>{result.channelTitle} &bull; </>}
          {result.similarityScore}% match
        </p>
      </div>
    </div>
  );
}
