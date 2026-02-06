'use client';

import { VideoCardData } from '@/types/videos';
import { formatDuration, formatRelativeDate } from '@/lib/videos/format';
import { getCategoryColour } from '@/lib/videos/category-colours';
import { getThumbnailUrl } from '@/lib/videos/thumbnail-url';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface VideoCardProps {
  video: VideoCardData;
  isSelected: boolean;
  onToggleSelect: (videoId: number) => void;
  showCategoryBadge?: boolean;
}

export function VideoCard({
  video,
  isSelected,
  onToggleSelect,
  showCategoryBadge = false,
}: VideoCardProps) {
  const thumbnailUrl = getThumbnailUrl(video.youtubeId);
  const youtubeUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`;
  const primaryCategory = video.categoryNames[0] || 'Uncategorised';
  const additionalCategoryCount = video.categoryNames.length - 1;

  return (
    <div className="group rounded-xl border bg-card overflow-hidden hover:shadow-lg transition-shadow">
      {/* Thumbnail area with link and checkbox */}
      <div className="relative aspect-video bg-muted">
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full h-full cursor-pointer"
        >
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt={video.title}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          )}
          {/* Duration overlay */}
          {video.duration && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-xs font-medium rounded">
              {formatDuration(video.duration)}
            </div>
          )}
        </a>

        {/* Checkbox overlay - visible on hover or when selected */}
        <div
          className={`absolute top-2 left-2 transition-opacity ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(video.id);
          }}
        >
          <Checkbox checked={isSelected} className="bg-white/90 hover:bg-white" />
        </div>
      </div>

      {/* Info area */}
      <div className="p-3 flex flex-col gap-1.5">
        {/* Title */}
        <h3 className="text-sm font-medium line-clamp-2 leading-tight">
          {video.title}
        </h3>

        {/* Channel name */}
        {video.channelTitle && (
          <p className="text-xs text-muted-foreground truncate">
            {video.channelTitle}
          </p>
        )}

        {/* Publish date */}
        {video.publishedAt && (
          <p className="text-xs text-muted-foreground">
            {formatRelativeDate(video.publishedAt)}
          </p>
        )}

        {/* Category badges */}
        {showCategoryBadge && video.categoryNames.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {video.categoryNames.map((categoryName) => (
              <Badge
                key={categoryName}
                style={{
                  backgroundColor: getCategoryColour(categoryName),
                  color: 'white',
                  borderColor: 'transparent',
                }}
                className="text-xs px-2 py-0.5"
              >
                {categoryName}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
