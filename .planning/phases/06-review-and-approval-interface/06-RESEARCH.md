# Phase 6: Review & Approval Interface - Research

**Researched:** 2026-02-07
**Domain:** Keyboard-driven review workflow with modal overlays and virtualized grid
**Confidence:** HIGH

## Summary

This phase builds a review interface for 4,000 ML-categorized videos using a keyboard-first workflow. The standard approach uses existing project libraries: @radix-ui/react-dialog for accessible modals, react-hotkeys-hook for keyboard shortcuts, @tanstack/react-virtual for grid virtualization, and React's useOptimistic for instant UI feedback.

The CONTEXT.md decisions lock in a grid-with-modal pattern where users Tab through cards, Enter to open modal, A/R keys to accept/reject suggestions with auto-advance, and Escape to close. This matches the "flashcard review" UX pattern where the modal auto-advances after each decision, enabling rapid batch processing without mouse interaction.

The architecture separates concerns: virtualized grid for browsing (Phase 4 patterns), modal for focused decision-making (Radix UI Dialog), server actions for state persistence (existing ml-categorization.ts), and optimistic updates for perceived performance. Common pitfalls include keyboard shortcut conflicts with browser shortcuts, focus trap issues when modal is open, and performance degradation from re-rendering all grid items on state changes.

**Primary recommendation:** Extend existing VideoGrid/VideoCard components from Phase 4 with modal overlay state management, use react-hotkeys-hook's `enabled` option to disable grid shortcuts when modal is open, implement useOptimistic for accept/reject actions, and add new server actions to update mlCategorizations.acceptedAt/rejectedAt timestamps.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-dialog | ^1.1.15 | Modal overlay system | Already in project, handles focus trapping, Escape key, accessibility (ARIA) automatically |
| react-hotkeys-hook | ^5.2.4 | Keyboard shortcut handling | Already in project (Phase 2), supports conditional enabling, scope management, preventDefault |
| @tanstack/react-virtual | ^3.13.18 | Grid virtualization | Already in project (Phase 4), handles 4,000 videos efficiently with row-based virtualization |
| React useOptimistic | Built-in (React 19) | Optimistic UI updates | Standard for instant feedback with server actions, auto-rollback on error |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-dropdown-menu | ^2.1.16 | Category picker for rejected items | Manual recategorization flow (user picks new category) |
| lucide-react | ^0.563.0 | Icons (CheckCircle, XCircle, AlertCircle) | Visual feedback for confidence badges and review state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix Dialog | focus-trap-react + custom modal | More control but reinvents focus management Radix provides |
| useOptimistic | Manual optimistic state | More code, must handle rollback manually |
| react-hotkeys-hook | Native onKeyDown handlers | No scope management, harder to disable contextually |

**Installation:**
All dependencies already installed in Phase 1-5. No new packages required.

## Architecture Patterns

### Recommended Component Structure
```
src/
├── app/
│   └── ml-review/                    # New review interface route
│       └── page.tsx                  # Server Component (data loading)
├── components/
│   └── ml-review/                    # New component directory
│       ├── review-page.tsx           # Client orchestrator
│       ├── review-grid.tsx           # Virtualized grid (extends Phase 4 VideoGrid)
│       ├── review-card.tsx           # Card with confidence badge (extends VideoCard)
│       ├── review-modal.tsx          # Modal for accept/reject decisions
│       ├── category-picker.tsx       # Dropdown for manual categorization
│       ├── review-progress.tsx       # Progress tracker (X reviewed, Y pending, Z low-confidence)
│       └── keyboard-hints.tsx        # Shortcut legend overlay
└── app/actions/
    └── ml-categorization.ts          # Extend with accept/reject/recategorize actions
```

### Pattern 1: Grid-to-Modal Navigation State
**What:** Single state machine manages grid focus vs modal focus with conditional keyboard shortcuts
**When to use:** When keyboard shortcuts need different behavior depending on UI context

**Example:**
```typescript
// src/components/ml-review/review-page.tsx
'use client';

import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { ReviewGrid } from './review-grid';
import { ReviewModal } from './review-modal';

export function ReviewPage({ initialResults }) {
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);
  const [gridFocusIndex, setGridFocusIndex] = useState(0);
  const isModalOpen = selectedVideoId !== null;

  // Tab: Navigate grid (only when modal closed)
  useHotkeys('tab', (e) => {
    e.preventDefault();
    setGridFocusIndex((prev) => (prev + 1) % results.length);
  }, { enabled: !isModalOpen });

  // Shift+Tab: Navigate backward
  useHotkeys('shift+tab', (e) => {
    e.preventDefault();
    setGridFocusIndex((prev) => (prev - 1 + results.length) % results.length);
  }, { enabled: !isModalOpen });

  // Enter: Open modal for focused card
  useHotkeys('enter', (e) => {
    e.preventDefault();
    setSelectedVideoId(results[gridFocusIndex].videoId);
  }, { enabled: !isModalOpen });

  return (
    <>
      <ReviewGrid
        results={results}
        focusedIndex={gridFocusIndex}
        onCardClick={setSelectedVideoId}
      />

      <ReviewModal
        open={isModalOpen}
        videoId={selectedVideoId}
        onClose={() => setSelectedVideoId(null)}
        onAccept={(videoId) => {
          // Auto-advance to next
          setSelectedVideoId(results[gridFocusIndex + 1]?.videoId || null);
        }}
        onReject={(videoId) => {
          // Auto-advance to next
          setSelectedVideoId(results[gridFocusIndex + 1]?.videoId || null);
        }}
      />
    </>
  );
}
```

### Pattern 2: Auto-Advance After Decision
**What:** After A (accept) or R (reject), modal automatically loads next video without closing
**When to use:** Flashcard-style review workflows where rapid decision-making is the goal

**Example:**
```typescript
// src/components/ml-review/review-modal.tsx
'use client';

import { useHotkeys } from 'react-hotkeys-hook';
import { useOptimistic, useTransition } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { acceptSuggestion, rejectSuggestion } from '@/app/actions/ml-categorization';

interface ReviewModalProps {
  open: boolean;
  videoId: number | null;
  onClose: () => void;
  onAccept: (videoId: number) => void;
  onReject: (videoId: number) => void;
}

export function ReviewModal({ open, videoId, onClose, onAccept, onReject }: ReviewModalProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticState, setOptimisticState] = useOptimistic<'idle' | 'accepted' | 'rejected'>('idle');

  // A key: Accept suggestion
  useHotkeys('a', async (e) => {
    e.preventDefault();
    if (!videoId || isPending) return;

    startTransition(async () => {
      setOptimisticState('accepted');
      const result = await acceptSuggestion(videoId);
      if (result.success) {
        onAccept(videoId); // Trigger auto-advance
      }
    });
  }, { enabled: open });

  // R key: Reject suggestion
  useHotkeys('r', async (e) => {
    e.preventDefault();
    if (!videoId || isPending) return;

    startTransition(async () => {
      setOptimisticState('rejected');
      const result = await rejectSuggestion(videoId);
      if (result.success) {
        onReject(videoId); // Trigger auto-advance
      }
    });
  }, { enabled: open });

  // Escape: Close modal (handled by Radix Dialog automatically)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl">
        {/* Video player/preview */}
        {/* Suggested category display */}
        {/* Accept/Reject buttons (also clickable, not just keyboard) */}
        {optimisticState === 'accepted' && <div className="text-green-600">Accepted...</div>}
        {optimisticState === 'rejected' && <div className="text-red-600">Rejected...</div>}
      </DialogContent>
    </Dialog>
  );
}
```

### Pattern 3: Conditional Shortcuts with Radix Dialog Open State
**What:** Detect when any Radix Dialog is open to suppress grid keyboard shortcuts
**When to use:** Preventing keyboard conflicts between grid navigation and modal actions

**Example:**
```typescript
// Helper function to check if modal is open
function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null;
}

// In ReviewPage component
useHotkeys('tab', handleTabNavigation, {
  enabled: !isDialogOpen(),
});
```

### Pattern 4: Optimistic UI with Server Action Rollback
**What:** Immediately update UI when user accepts/rejects, show pending state, auto-rollback on error
**When to use:** All review actions to provide instant feedback without waiting for server

**Example:**
```typescript
// src/app/actions/ml-categorization.ts
'use server';

export async function acceptSuggestion(videoId: number) {
  try {
    const result = await db
      .update(mlCategorizations)
      .set({ acceptedAt: new Date() })
      .where(eq(mlCategorizations.videoId, videoId));

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to accept suggestion' };
  }
}

// In component
const [optimisticResults, updateOptimistic] = useOptimistic(
  results,
  (state, { videoId, action }: { videoId: number; action: 'accept' | 'reject' }) => {
    return state.map((r) =>
      r.videoId === videoId
        ? { ...r, status: action === 'accept' ? 'accepted' : 'rejected' }
        : r
    );
  }
);

// On accept click
startTransition(async () => {
  updateOptimistic({ videoId, action: 'accept' });
  const result = await acceptSuggestion(videoId);
  // If result.success === false, React auto-reverts optimistic state
});
```

### Pattern 5: Lazy Loading Modal Content
**What:** Only fetch video details and category alternatives when modal opens, not upfront for all 4,000 videos
**When to use:** Reducing initial page load time and memory usage

**Example:**
```typescript
// src/app/actions/ml-categorization.ts
'use server';

export async function getVideoReviewDetail(videoId: number) {
  const video = await db.query.videos.findFirst({
    where: eq(videos.id, videoId),
  });

  const categorization = await db.query.mlCategorizations.findFirst({
    where: eq(mlCategorizations.videoId, videoId),
    with: {
      suggestedCategory: true, // Join to get category name
    },
  });

  const allCategories = await db.query.categories.findMany({
    where: eq(categories.isProtected, false),
  });

  return { video, categorization, allCategories };
}

// In ReviewModal component
useEffect(() => {
  if (open && videoId) {
    // Fetch details only when modal opens
    getVideoReviewDetail(videoId).then(setModalData);
  }
}, [open, videoId]);
```

### Pattern 6: Progress Tracking with Confidence Filtering
**What:** Show count of total/reviewed/pending videos, with ability to filter by confidence level
**When to use:** User needs to prioritize low-confidence reviews or track completion

**Example:**
```typescript
// src/components/ml-review/review-progress.tsx
interface ReviewProgressProps {
  totalVideos: number;
  reviewedCount: number;
  lowConfidenceCount: number;
  mediumConfidenceCount: number;
  highConfidenceCount: number;
  currentFilter: 'all' | 'LOW' | 'MEDIUM' | 'HIGH';
  onFilterChange: (filter: string) => void;
}

export function ReviewProgress({ totalVideos, reviewedCount, ...props }: ReviewProgressProps) {
  const percentage = Math.round((reviewedCount / totalVideos) * 100);

  return (
    <div className="flex items-center gap-4 p-4 bg-card border-b">
      <div className="text-sm">
        <span className="font-semibold">{reviewedCount}</span> / {totalVideos} reviewed
        <span className="text-muted-foreground ml-2">({percentage}%)</span>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2">
        <button onClick={() => props.onFilterChange('LOW')} className="badge-low">
          Low: {props.lowConfidenceCount}
        </button>
        <button onClick={() => props.onFilterChange('MEDIUM')} className="badge-medium">
          Medium: {props.mediumConfidenceCount}
        </button>
        <button onClick={() => props.onFilterChange('HIGH')} className="badge-high">
          High: {props.highConfidenceCount}
        </button>
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Refetching all 4,000 videos after each action:** Use optimistic updates and only revalidate on page refresh
- **Global keyboard shortcuts without scoping:** Use `enabled` option to disable grid shortcuts when modal is open
- **Rendering all 4,000 cards in DOM:** Use @tanstack/react-virtual (already done in Phase 4)
- **Loading full video metadata upfront:** Lazy-load modal content when user opens modal
- **Blocking UI during server action:** Use useTransition and show pending state, never disable keyboard shortcuts

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trapping in modal | Custom focus cycle logic with refs | @radix-ui/react-dialog | Handles Tab cycling, screen readers, Escape key, focus restoration automatically |
| Keyboard shortcut conflicts | Manual event.key checks with stopPropagation | react-hotkeys-hook with `enabled` option | Supports conditional enabling, scope management, better maintainability |
| Optimistic UI rollback | Manual state snapshots + try/catch | React useOptimistic | Auto-reverts on error, works seamlessly with useTransition |
| Grid virtualization | IntersectionObserver + manual positioning | @tanstack/react-virtual | Handles dynamic row heights, scrolling performance, overscan |
| Accessible modal announcements | Custom aria-live regions | Radix Dialog Title/Description | WAI-ARIA compliant, screen reader tested |

**Key insight:** Radix UI primitives (Dialog, DropdownMenu) provide production-grade accessibility that takes weeks to implement correctly. React 19's useOptimistic eliminates the need for manual optimistic state management with rollback logic.

## Common Pitfalls

### Pitfall 1: Keyboard Shortcuts Fire When Modal is Open
**What goes wrong:** User presses Tab to navigate modal content, but grid focus changes in background
**Why it happens:** useHotkeys registers shortcuts globally by default, doesn't know about modal state
**How to avoid:** Use `enabled: !isModalOpen` option in useHotkeys for all grid-scoped shortcuts
**Warning signs:** Focus jumps unexpectedly, Tab doesn't cycle through modal elements

### Pitfall 2: Optimistic State Doesn't Revert on Error
**What goes wrong:** User accepts suggestion, server fails, but UI still shows "Accepted" state
**Why it happens:** Forgot to use `startTransition` wrapper, or not returning error from server action
**How to avoid:** Always wrap optimistic updates in `startTransition(() => { ... })` and return `{ success: boolean }` from server actions
**Warning signs:** UI state diverges from database after errors, no visual indication of failure

### Pitfall 3: Re-rendering All 4,000 Cards After Each Action
**What goes wrong:** Accepting one suggestion causes all VideoCard components to re-render, UI feels sluggish
**Why it happens:** Parent state change triggers full React reconciliation, virtualizer recalculates all items
**How to avoid:** Use React.memo on VideoCard, stable key props (video.id), memoize callbacks with useCallback
**Warning signs:** Performance profiler shows thousands of components updating, review feels laggy

### Pitfall 4: Focus Lost After Auto-Advance
**What goes wrong:** After accepting suggestion, modal advances to next video but focus is on body, keyboard shortcuts stop working
**Why it happens:** Radix Dialog restores focus to trigger element on close, but we're not closing the modal
**How to avoid:** Don't close/reopen modal for auto-advance, just update videoId prop and Radix maintains focus trap
**Warning signs:** User must click modal after auto-advance to resume keyboard navigation

### Pitfall 5: Arrow Keys Scroll Page Instead of Navigating Modal
**What goes wrong:** User presses Left/Right arrows in modal to navigate between videos, but page scrolls instead
**Why it happens:** Forgot `preventDefault: true` in useHotkeys options for modal shortcuts
**How to avoid:** Always set `preventDefault: true` for navigation keys that override browser defaults
**Warning signs:** Page scrolls when using arrow keys, modal navigation unreliable

### Pitfall 6: Modal Doesn't Close on Escape
**What goes wrong:** Radix Dialog's built-in Escape handler doesn't work, user is trapped in modal
**Why it happens:** Custom keyboard shortcut for 'escape' key overrides Radix's built-in handler
**How to avoid:** Don't register custom 'escape' handler, let Radix Dialog handle it via `onOpenChange`
**Warning signs:** Escape key does nothing, only clicking X button closes modal

### Pitfall 7: Stale Grid Focus Index After Filtering
**What goes wrong:** User filters to LOW confidence only (500 videos), but gridFocusIndex is still 2000, Enter key does nothing
**Why it happens:** Focus index not reset when results array changes
**How to avoid:** Reset focus index to 0 whenever filter changes: `useEffect(() => { setGridFocusIndex(0); }, [confidenceFilter]);`
**Warning signs:** Enter key stops working after filtering, Tab navigation skips to end of list

## Code Examples

Verified patterns from official sources:

### Radix Dialog with Controlled State
```typescript
// Source: https://www.radix-ui.com/primitives/docs/components/dialog
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export function ReviewModal({ open, onOpenChange, videoData }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Review Video Categorization</DialogTitle>
        <DialogDescription>
          Accept or reject the suggested category
        </DialogDescription>
        {/* Modal body */}
      </DialogContent>
    </Dialog>
  );
}
```

### react-hotkeys-hook with Conditional Enabling
```typescript
// Source: https://react-hotkeys-hook.vercel.app/docs/api/use-hotkeys
import { useHotkeys } from 'react-hotkeys-hook';

// Only active when modal is closed
useHotkeys('tab', handleTabNavigation, {
  enabled: !isModalOpen,
  preventDefault: true,
});

// Only active when modal is open
useHotkeys('a', handleAccept, {
  enabled: isModalOpen,
  preventDefault: true,
});
```

### useOptimistic with Server Actions
```typescript
// Source: https://react.dev/reference/react/useOptimistic
import { useOptimistic, useTransition } from 'react';

export function ReviewList({ results }) {
  const [isPending, startTransition] = useTransition();
  const [optimisticResults, updateOptimistic] = useOptimistic(
    results,
    (state, updatedResult) => {
      return state.map((r) =>
        r.id === updatedResult.id ? updatedResult : r
      );
    }
  );

  const handleAccept = (videoId) => {
    startTransition(async () => {
      const updated = { ...results.find(r => r.videoId === videoId), status: 'accepted' };
      updateOptimistic(updated);

      const result = await acceptSuggestion(videoId);
      // If result.success === false, React auto-reverts
    });
  };

  return (
    <div>
      {optimisticResults.map((result) => (
        <ReviewCard key={result.id} result={result} onAccept={handleAccept} />
      ))}
    </div>
  );
}
```

### TanStack Virtual Grid Pattern (from existing Phase 4 code)
```typescript
// Source: Existing codebase - src/components/videos/video-grid.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

export function ReviewGrid({ results }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const columnCount = 3; // Fixed for review interface

  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(results.length / columnCount),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 380, // ROW_HEIGHT from Phase 4
    overscan: 3,
  });

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * columnCount;
          const rowResults = results.slice(startIdx, startIdx + columnCount);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="grid grid-cols-3 gap-6 px-12">
                {rowResults.map((result) => (
                  <ReviewCard key={result.id} result={result} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| focus-trap-react library | Radix Dialog built-in focus trapping | Radix v1.0 (2023) | No external dependency, better accessibility |
| Manual optimistic state | React useOptimistic hook | React 19 (2024) | Auto-rollback on error, less boilerplate |
| react-virtualized | @tanstack/react-virtual | 2022-2023 | Actively maintained, smaller bundle, framework-agnostic |
| Global keyboard shortcuts | react-hotkeys-hook with scopes | v4 (2022) | Conditional enabling, better TypeScript support |

**Deprecated/outdated:**
- react-virtualized: No longer maintained, use @tanstack/react-virtual instead
- focus-trap-react for modals: Radix Dialog has built-in focus management, no need for separate library
- Manual focus restoration after modal close: Radix Dialog handles this automatically

## Open Questions

Things that couldn't be fully resolved:

1. **Batch accept/reject shortcuts**
   - What we know: User may want to bulk-accept all HIGH confidence suggestions
   - What's unclear: Should this be Shift+A for "accept all visible" or require explicit checkbox selection?
   - Recommendation: Start without batch operations (per CONTEXT.md deferred decisions), add if users request it

2. **Undo granularity**
   - What we know: User might accidentally press A instead of R
   - What's unclear: Should undo reverse last action only, or support full history stack like Phase 3?
   - Recommendation: Implement Cmd/Ctrl+Z for last action only (simpler MVP), can extend to full stack later

3. **Video preview in modal**
   - What we know: CONTEXT.md mentions "preview capability" from Phase 1 decisions
   - What's unclear: Does "preview" mean embedded YouTube player, or just thumbnail + metadata?
   - Recommendation: Start with thumbnail + metadata (no YouTube API calls), add player if users need to watch videos to decide

4. **Recategorization flow timing**
   - What we know: CONTEXT.md says "rejected items accumulate for later manual assignment"
   - What's unclear: How does user access rejected items? Post-review prompt, or filter button available during review?
   - Recommendation: Show filter button in toolbar (Category: Rejected) so user can address rejections whenever convenient

## Sources

### Primary (HIGH confidence)
- Radix UI Dialog documentation: https://www.radix-ui.com/primitives/docs/components/dialog - Verified API reference for modal handling, focus trapping, keyboard navigation
- react-hotkeys-hook documentation: https://react-hotkeys-hook.vercel.app/docs/api/use-hotkeys - Verified enabled option, preventDefault, scopes
- React useOptimistic documentation: https://react.dev/reference/react/useOptimistic - Verified API signature, rollback behavior, Server Action integration
- TanStack Virtual documentation: https://tanstack.com/virtual/latest/docs/introduction - Verified grid virtualization patterns, performance recommendations
- Existing codebase (Phase 4 VideoGrid): /Users/anthonygeorge/Projects/YouTubeOrg/src/components/videos/video-grid.tsx - Verified row-based virtualization pattern already established

### Secondary (MEDIUM confidence)
- WebSearch: Modal accessibility best practices (2024-2025 sources) - Focus trap patterns, keyboard navigation, screen reader support
- WebSearch: Optimistic UI patterns with React Server Actions - Error handling, rollback strategies, useTransition integration
- WebSearch: Flashcard keyboard shortcuts UX - Auto-advance patterns, rapid review workflows (Anki, flashcard apps)

### Tertiary (LOW confidence)
- WebSearch: Review/approval interface patterns - General UX guidance, not specific to React implementation
- WebSearch: Card UI design best practices - Visual design recommendations, not technical implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project (package.json verified), official documentation available
- Architecture: HIGH - Patterns verified from existing Phase 4 code (VideoGrid) and official library docs (Radix Dialog, react-hotkeys-hook, useOptimistic)
- Pitfalls: HIGH - Derived from official documentation warnings (Radix Dialog focus behavior, react-hotkeys-hook enabled option, useOptimistic rollback requirements) and common React performance pitfalls (memo, useCallback for large lists)

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (30 days - stable ecosystem, no fast-moving dependencies)
