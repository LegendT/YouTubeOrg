'use client';

import { useState } from 'react';
import { FolderPlus, ListVideo, Trash2, Info, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { SyncPreview } from '@/types/sync';

interface SyncPreviewProps {
  preview: SyncPreview;
  onStartSync: () => void;
  isStarting: boolean;
}

/**
 * Format a number with commas (e.g., 225600 -> "225,600").
 */
function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Collapsible list component for playlist/category names.
 * Shows the first 5 items, with an expandable "and N more" section.
 */
function CollapsibleList({ items, emptyMessage }: { items: string[]; emptyMessage: string }) {
  const [expanded, setExpanded] = useState(false);
  const VISIBLE_COUNT = 5;

  if (items.length === 0) {
    return <p className="text-sm text-gray-500 italic">{emptyMessage}</p>;
  }

  const visibleItems = expanded ? items : items.slice(0, VISIBLE_COUNT);
  const hiddenCount = items.length - VISIBLE_COUNT;

  return (
    <div className="mt-2">
      <ul className="space-y-1">
        {visibleItems.map((item) => (
          <li key={item} className="text-sm text-gray-600 pl-2 border-l-2 border-gray-200">
            {item}
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              and {hiddenCount} more
            </>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * SyncPreview displays the full scope of sync operations grouped by type,
 * with quota cost estimates and estimated completion timeline.
 *
 * This is the critical decision point where users see what will happen
 * before committing to a multi-day sync operation.
 */
export function SyncPreview({ preview, onStartSync, isStarting }: SyncPreviewProps) {
  const { stages, totalQuotaCost, estimatedDays, dailyQuotaLimit } = preview;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Sync Preview</h2>
        <p className="text-sm text-gray-500 mt-1">
          Review the changes that will be synchronised to YouTube
        </p>
      </div>

      {/* Quota Summary Card */}
      <div
        className={`rounded-lg border p-6 shadow-sm ${
          estimatedDays > 7
            ? 'border-amber-200 bg-amber-50'
            : 'border-gray-200 bg-white'
        }`}
      >
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
          Quota Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(totalQuotaCost)}
            </p>
            <p className="text-sm text-gray-500">Total API units</p>
          </div>
          <div>
            <p
              className={`text-2xl font-bold ${
                estimatedDays > 7 ? 'text-amber-700' : 'text-gray-900'
              }`}
            >
              ~{estimatedDays} days
            </p>
            <p className="text-sm text-gray-500">Estimated duration</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(dailyQuotaLimit)}
            </p>
            <p className="text-sm text-gray-500">Daily limit (units/day)</p>
          </div>
        </div>
        {estimatedDays > 7 && (
          <p className="mt-3 text-sm text-amber-700">
            This sync will span multiple weeks due to YouTube API quota limits.
            The operation can be paused and resumed at any time.
          </p>
        )}
      </div>

      {/* Stage Cards */}
      <div className="space-y-4">
        {/* Card 1: Create Playlists */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
              <FolderPlus className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium text-gray-900">Create Playlists</h3>
                <span className="text-sm text-gray-500">
                  {formatNumber(stages.createPlaylists.quotaCost)} units
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">
                {stages.createPlaylists.count} new playlist{stages.createPlaylists.count !== 1 ? 's' : ''} to create on YouTube
              </p>
              <CollapsibleList
                items={stages.createPlaylists.items.map((i) => i.categoryName)}
                emptyMessage="No playlists to create"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Add Videos to Playlists */}
        <div className="rounded-lg border border-blue-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <ListVideo className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium text-gray-900">Add Videos to Playlists</h3>
                <span className="text-sm text-gray-500">
                  {formatNumber(stages.addVideos.quotaCost)} units
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">
                {formatNumber(stages.addVideos.count)} video assignment{stages.addVideos.count !== 1 ? 's' : ''} across all categories
              </p>
              <p className="text-xs text-blue-600 font-medium mt-1">
                This is the largest stage and will use most of the quota
              </p>
              {/* Per-category breakdown */}
              <div className="mt-3 space-y-1.5">
                {stages.addVideos.byCategory
                  .sort((a, b) => b.videoCount - a.videoCount)
                  .slice(0, 10)
                  .map((cat) => (
                    <div
                      key={cat.categoryId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-600 truncate mr-2">{cat.categoryName}</span>
                      <span className="text-gray-400 flex-shrink-0">
                        {formatNumber(cat.videoCount)} video{cat.videoCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                {stages.addVideos.byCategory.length > 10 && (
                  <p className="text-sm text-gray-400 italic">
                    and {stages.addVideos.byCategory.length - 10} more categories
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Delete Old Playlists */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-red-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium text-gray-900">Delete Old Playlists</h3>
                <span className="text-sm text-gray-500">
                  {formatNumber(stages.deletePlaylists.quotaCost)} units
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">
                {stages.deletePlaylists.count} old playlist{stages.deletePlaylists.count !== 1 ? 's' : ''} to remove from YouTube
              </p>
              <CollapsibleList
                items={stages.deletePlaylists.items.map((i) => i.playlistName)}
                emptyMessage="No playlists to delete"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Watch Later Notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-800">Watch Later</h4>
            <p className="text-sm text-blue-700 mt-0.5">
              Watch Later videos cannot be removed via the YouTube API (deprecated since 2020).
              After sync completes, you can manually remove categorised videos from Watch Later
              through the YouTube interface.
            </p>
          </div>
        </div>
      </div>

      {/* Action Section */}
      <div className="border-t border-gray-200 pt-6">
        <button
          onClick={onStartSync}
          disabled={isStarting}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStarting && <Loader2 className="h-5 w-5 animate-spin" />}
          {isStarting ? 'Starting Sync...' : 'Start Sync'}
        </button>
        <p className="text-sm text-gray-500 mt-2 max-w-lg">
          This will create playlists, add videos, and delete old playlists on your YouTube
          account. New playlists will be created as Private.
        </p>
      </div>
    </div>
  );
}
