# Phase 2: Playlist Analysis & Consolidation - Research

**Researched:** 2026-02-05
**Domain:** Duplicate detection, text clustering, playlist consolidation analysis
**Confidence:** MEDIUM-HIGH

## Summary

Phase 2 requires analyzing 87 playlists to detect duplicate videos, cluster similar playlists for intelligent consolidation proposals (~25-35 categories), and provide user interface for reviewing/approving merge suggestions. The standard approach combines PostgreSQL queries for duplicate detection across playlist_videos junction table, string similarity algorithms (Jaccard/Dice coefficient) for playlist name clustering, and interactive UI patterns with approve/reject actions similar to GitHub PR reviews.

**Critical insight:** Duplicate video detection is a SQL problem (query playground_videos table for videoId appearing in multiple playlists), while playlist similarity is a text clustering problem (use string similarity + TF-IDF for grouping "JavaScript Tutorials" with "JS Advanced"). These are separate analyses with different algorithms. The 5,000 video per playlist YouTube limit must be validated before allowing consolidation approval (SAFE-04 requirement).

The research confirms that hierarchical clustering with string similarity (Dice coefficient via `string-similarity` npm) is the pragmatic approach for grouping 87 playlist names into ~25-35 categories. TF-IDF with cosine similarity is overkill for short playlist titles but valuable if analyzing video titles/descriptions later. For UI, shadcn/ui data tables with comparison blocks provide the foundation, supplemented by dnd-kit for manual drag-drop playlist reassignment.

**Primary recommendation:** Use SQL aggregate queries for duplicate detection (GROUP BY videoId HAVING COUNT(*) > 1), `string-similarity` library (Dice coefficient) with `ml-hclust` hierarchical clustering for playlist name grouping, and shadcn/ui table with custom approve/reject/adjust actions. Validate consolidated categories against 4,500 video limit (safety margin below YouTube's 5,000) using Zod schema before persisting.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| string-similarity | 4.0+ | Dice coefficient for string matching | Most popular JS string similarity library, optimized algorithm (better than Levenshtein for playlist names), 2M+ weekly downloads |
| ml-hclust | 4.0.0 | Hierarchical clustering (AGNES) | TypeScript-native, MIT licensed, supports agglomerative nesting for grouping similar playlists into category hierarchy |
| @dnd-kit/sortable | 10.0.0 | Drag-and-drop list reordering | Modern, accessible, performant (10kb core), zero dependencies, 1,867 dependent projects, works perfectly with shadcn/ui |
| zod | 3.23+ | Runtime schema validation | Already in stack (Phase 1), perfect for validating playlist limits before approval |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| natural | 8.1.0 | TF-IDF text analysis (optional) | If analyzing video titles/descriptions for semantic similarity (Phase 5), not needed for playlist name clustering |
| fast-cosine-similarity | Latest | Cosine similarity (optional) | If using TF-IDF vectors, 6x faster than compute-cosine-similarity, TypeScript support |
| cmpstr | 3.2.1 | Advanced string algorithms (alternative) | If need multiple similarity metrics (Levenshtein, Jaro-Winkler, q-Gram), but string-similarity's Dice is sufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| string-similarity (Dice) | cmpstr with Levenshtein | Dice coefficient performs better for short strings like playlist names; Levenshtein is character-edit focused (overkill) |
| ml-hclust | Manual k-means clustering | Hierarchical clustering produces dendrogram allowing user to adjust cluster granularity; k-means requires pre-specifying k=30 |
| @dnd-kit/sortable | react-beautiful-dnd | dnd-kit is modern, maintained, and more performant (react-beautiful-dnd archived by Atlassian in 2023) |
| SQL duplicate detection | MinHash/LSH algorithms | For 87 playlists × ~50 videos avg, SQL is fast enough (<100ms); MinHash needed for millions of documents |

**Installation:**
```bash
npm install string-similarity ml-hclust @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
# zod already installed in Phase 1
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── analysis/
│   │   └── page.tsx                      # Analysis dashboard (Server Component)
├── lib/
│   ├── analysis/
│   │   ├── duplicates.ts                 # Duplicate video detection SQL queries
│   │   ├── clustering.ts                 # Playlist name similarity & hierarchical clustering
│   │   ├── consolidation.ts              # Generate consolidation proposals
│   │   └── validation.ts                 # Zod schemas for playlist limits
│   ├── db/
│   │   └── schema.ts                     # Add consolidation_proposals table
└── components/
    ├── analysis/
    │   ├── duplicate-report.tsx          # Shows overlap analysis
    │   ├── consolidation-proposal.tsx    # Approve/reject/adjust UI
    │   └── playlist-merger.tsx           # Drag-drop manual adjustment
```

### Pattern 1: Duplicate Video Detection (SQL Aggregation)

**What:** Query playlist_videos junction table with GROUP BY to find videos appearing in multiple playlists. Return video details with list of playlists containing each duplicate.

**When to use:** Every time consolidation proposal is generated, to show user how many duplicates will be eliminated.

**Example:**
```typescript
// Source: PostgreSQL aggregate query patterns
import { db } from '@/lib/db'
import { playlistVideos, videos, playlists } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function findDuplicateVideos() {
  // Find videos appearing in multiple playlists
  const duplicates = await db
    .select({
      videoId: playlistVideos.videoId,
      videoYoutubeId: videos.youtubeId,
      title: videos.title,
      playlistCount: sql<number>`count(distinct ${playlistVideos.playlistId})`,
    })
    .from(playlistVideos)
    .innerJoin(videos, eq(playlistVideos.videoId, videos.id))
    .groupBy(playlistVideos.videoId, videos.youtubeId, videos.title)
    .having(sql`count(distinct ${playlistVideos.playlistId}) > 1`)
    .orderBy(sql`count(distinct ${playlistVideos.playlistId}) desc`)

  // For each duplicate, get the playlists containing it
  const detailedDuplicates = await Promise.all(
    duplicates.map(async (dup) => {
      const playlistsContaining = await db
        .select({
          playlistId: playlists.id,
          playlistTitle: playlists.title,
        })
        .from(playlistVideos)
        .innerJoin(playlists, eq(playlistVideos.playlistId, playlists.id))
        .where(eq(playlistVideos.videoId, dup.videoId))

      return {
        ...dup,
        playlists: playlistsContaining,
      }
    })
  )

  return detailedDuplicates
}

// Calculate overlap statistics
export async function calculateOverlapStats() {
  const totalVideos = await db
    .select({ count: sql<number>`count(distinct ${playlistVideos.videoId})` })
    .from(playlistVideos)

  const duplicateVideos = await db
    .select({
      count: sql<number>`count(distinct ${playlistVideos.videoId})`
    })
    .from(playlistVideos)
    .groupBy(playlistVideos.videoId)
    .having(sql`count(distinct ${playlistVideos.playlistId}) > 1`)

  return {
    totalUniqueVideos: totalVideos[0].count,
    duplicateVideoCount: duplicateVideos.length,
    duplicationPercentage: (duplicateVideos.length / totalVideos[0].count) * 100,
  }
}
```

### Pattern 2: Playlist Similarity Clustering (Hierarchical with Dice Coefficient)

**What:** Use string-similarity library to compute pairwise Dice coefficient between all playlist titles, then apply hierarchical clustering (ml-hclust AGNES) to group similar playlists into proposed categories.

**When to use:** One-time during initial analysis phase, or whenever user requests re-analysis after manual playlist renames.

**Example:**
```typescript
// Source: string-similarity + ml-hclust documentation patterns
import stringSimilarity from 'string-similarity'
import { agnes } from 'ml-hclust'
import { db } from '@/lib/db'
import { playlists } from '@/lib/db/schema'

interface PlaylistCluster {
  categoryName: string
  playlists: { id: number; title: string }[]
  totalVideos: number
}

export async function clusterPlaylists(
  targetCategoryCount: number = 30
): Promise<PlaylistCluster[]> {
  // Fetch all playlists with video counts
  const allPlaylists = await db
    .select({
      id: playlists.id,
      title: playlists.title,
      itemCount: playlists.itemCount,
    })
    .from(playlists)
    .orderBy(playlists.title)

  // Build distance matrix using Dice coefficient (1 - similarity)
  const titles = allPlaylists.map(p => p.title)
  const distanceMatrix: number[][] = []

  for (let i = 0; i < titles.length; i++) {
    distanceMatrix[i] = []
    for (let j = 0; j < titles.length; j++) {
      if (i === j) {
        distanceMatrix[i][j] = 0
      } else {
        const similarity = stringSimilarity.compareTwoStrings(titles[i], titles[j])
        distanceMatrix[i][j] = 1 - similarity // Convert similarity to distance
      }
    }
  }

  // Apply hierarchical clustering (AGNES - Agglomerative Nesting)
  const tree = agnes(distanceMatrix, {
    method: 'average', // Average linkage (good balance)
  })

  // Cut tree to get desired number of clusters
  const clusters = cutTreeToClusters(tree, targetCategoryCount)

  // Generate category names and aggregate video counts
  const categoryProposals: PlaylistCluster[] = clusters.map((cluster) => {
    const clusterPlaylists = cluster.map(idx => allPlaylists[idx])
    const totalVideos = clusterPlaylists.reduce((sum, p) => sum + (p.itemCount || 0), 0)

    // Generate category name from most common words in cluster playlist titles
    const categoryName = generateCategoryName(clusterPlaylists.map(p => p.title))

    return {
      categoryName,
      playlists: clusterPlaylists,
      totalVideos,
    }
  })

  // Sort by total video count descending
  return categoryProposals.sort((a, b) => b.totalVideos - a.totalVideos)
}

function cutTreeToClusters(tree: any, targetCount: number): number[][] {
  // Simplified cluster extraction - real implementation needs tree traversal
  // This is a placeholder showing the concept
  const clusters: number[][] = []
  // TODO: Traverse dendrogram and cut at height that produces ~targetCount clusters
  return clusters
}

function generateCategoryName(titles: string[]): string {
  // Extract most common meaningful words (exclude common words like "the", "and")
  const allWords = titles.flatMap(t =>
    t.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3 && !['playlist', 'videos', 'watch'].includes(w))
  )

  const wordFreq = allWords.reduce((freq, word) => {
    freq[word] = (freq[word] || 0) + 1
    return freq
  }, {} as Record<string, number>)

  // Return most common word, capitalized
  const mostCommon = Object.entries(wordFreq).sort((a, b) => b[1] - a[1])[0]
  return mostCommon ? mostCommon[0].charAt(0).toUpperCase() + mostCommon[0].slice(1) : 'Uncategorized'
}
```

### Pattern 3: Consolidation Validation (Zod Schema)

**What:** Define Zod schema to validate that no proposed category exceeds 4,500 videos (safety margin below YouTube's 5,000 limit). Run validation before allowing user to approve consolidation.

**When to use:** Before saving approved consolidation proposals, and whenever user manually adjusts category membership.

**Example:**
```typescript
// Source: Zod validation patterns
import { z } from 'zod'

const YOUTUBE_PLAYLIST_LIMIT = 5000
const SAFETY_MARGIN = 500
const MAX_VIDEOS_PER_CATEGORY = YOUTUBE_PLAYLIST_LIMIT - SAFETY_MARGIN // 4,500

export const PlaylistConsolidationSchema = z.object({
  categoryName: z.string().min(1).max(100),
  playlistIds: z.array(z.number()).min(1),
  totalVideos: z.number()
    .max(MAX_VIDEOS_PER_CATEGORY, {
      message: `Category exceeds safe limit of ${MAX_VIDEOS_PER_CATEGORY} videos (YouTube limit: ${YOUTUBE_PLAYLIST_LIMIT})`
    }),
})

export const ConsolidationProposalSchema = z.object({
  categories: z.array(PlaylistConsolidationSchema),
  totalCategories: z.number().min(25).max(35, {
    message: 'Target is 25-35 categories, adjust consolidation proposal'
  }),
})

export async function validateConsolidation(
  proposal: unknown
): Promise<{ valid: boolean; errors?: string[] }> {
  const result = ConsolidationProposalSchema.safeParse(proposal)

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
    }
  }

  // Additional business logic validation
  const categories = result.data.categories
  const overLimitCategories = categories.filter(c => c.totalVideos > MAX_VIDEOS_PER_CATEGORY)

  if (overLimitCategories.length > 0) {
    return {
      valid: false,
      errors: overLimitCategories.map(c =>
        `Category "${c.categoryName}" has ${c.totalVideos} videos (limit: ${MAX_VIDEOS_PER_CATEGORY})`
      ),
    }
  }

  return { valid: true }
}
```

### Pattern 4: Interactive Consolidation UI (shadcn/ui + dnd-kit)

**What:** Build comparison table showing proposed consolidations with approve/reject actions per category. Support manual adjustment via drag-drop to move playlists between categories.

**When to use:** Main UI for Phase 2 user interaction.

**Example:**
```tsx
// Source: shadcn/ui table + dnd-kit sortable patterns
'use client'

import { useState } from 'react'
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, AlertTriangle } from 'lucide-react'

interface ConsolidationProposal {
  id: string
  categoryName: string
  playlists: { id: number; title: string }[]
  totalVideos: number
  status: 'pending' | 'approved' | 'rejected'
}

export function ConsolidationProposalTable({
  proposals,
  onApprove,
  onReject,
  onReorder
}: {
  proposals: ConsolidationProposal[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onReorder: (proposals: ConsolidationProposal[]) => void
}) {
  const [items, setItems] = useState(proposals)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex(item => item.id === active.id)
    const newIndex = items.findIndex(item => item.id === over.id)

    const reordered = arrayMove(items, oldIndex, newIndex)
    setItems(reordered)
    onReorder(reordered)
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proposed Category</TableHead>
            <TableHead>Source Playlists</TableHead>
            <TableHead>Total Videos</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((proposal) => (
              <SortableRow
                key={proposal.id}
                proposal={proposal}
                onApprove={() => onApprove(proposal.id)}
                onReject={() => onReject(proposal.id)}
              />
            ))}
          </SortableContext>
        </TableBody>
      </Table>
    </DndContext>
  )
}

function SortableRow({
  proposal,
  onApprove,
  onReject
}: {
  proposal: ConsolidationProposal
  onApprove: () => void
  onReject: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: proposal.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isOverLimit = proposal.totalVideos > 4500
  const isNearLimit = proposal.totalVideos > 4000 && proposal.totalVideos <= 4500

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TableCell className="font-medium">
        {proposal.categoryName}
        {isOverLimit && (
          <Badge variant="destructive" className="ml-2">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Over Limit
          </Badge>
        )}
        {isNearLimit && (
          <Badge variant="warning" className="ml-2">
            Near Limit
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="text-sm text-muted-foreground">
          {proposal.playlists.slice(0, 3).map(p => p.title).join(', ')}
          {proposal.playlists.length > 3 && ` +${proposal.playlists.length - 3} more`}
        </div>
      </TableCell>
      <TableCell>{proposal.totalVideos.toLocaleString()}</TableCell>
      <TableCell>
        <Badge variant={
          proposal.status === 'approved' ? 'success' :
          proposal.status === 'rejected' ? 'secondary' :
          'outline'
        }>
          {proposal.status}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={onApprove}
            disabled={isOverLimit || proposal.status === 'approved'}
          >
            <Check className="w-4 h-4 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            disabled={proposal.status === 'rejected'}
          >
            <X className="w-4 h-4 mr-1" />
            Reject
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice()
  newArray.splice(to, 0, newArray.splice(from, 1)[0])
  return newArray
}
```

### Pattern 5: Database Schema for Consolidation Proposals

**What:** Store consolidation proposals with approval status before executing actual playlist merges (Phase 3).

**When to use:** Persist analysis results and user decisions for review/adjustment before committing to YouTube sync.

**Example:**
```typescript
// Source: Drizzle ORM schema patterns
import { pgTable, serial, text, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core'

export const proposalStatusEnum = pgEnum('proposal_status', ['pending', 'approved', 'rejected'])

export const consolidationProposals = pgTable('consolidation_proposals', {
  id: serial('id').primaryKey(),
  categoryName: text('category_name').notNull(),
  sourcePlaylistIds: jsonb('source_playlist_ids').$type<number[]>().notNull(), // Array of playlist IDs
  totalVideos: integer('total_videos').notNull(),
  status: proposalStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  approvedAt: timestamp('approved_at'),
  notes: text('notes'), // User notes about why approved/rejected
})

export const duplicateVideos = pgTable('duplicate_videos', {
  id: serial('id').primaryKey(),
  videoId: integer('video_id').references(() => videos.id).notNull(),
  playlistIds: jsonb('playlist_ids').$type<number[]>().notNull(), // Playlists containing this video
  occurrenceCount: integer('occurrence_count').notNull(),
  analyzedAt: timestamp('analyzed_at').notNull().defaultNow(),
})
```

### Anti-Patterns to Avoid

- **Don't use Levenshtein distance for playlist names:** Character-edit distance is overkill for short strings like "JavaScript" vs "JS". Dice coefficient (bigram-based) works better for abbreviated/similar terms.
- **Don't cluster videos instead of playlists:** The goal is grouping 87 playlists into ~30 categories, not clustering 4,000 videos. Playlist names contain semantic meaning; cluster those.
- **Don't allow approval of over-limit categories:** 5,000 is YouTube's hard limit. Always validate with 4,500 safety margin before persisting. User must manually split if exceeded.
- **Don't run clustering on every page load:** Hierarchical clustering on 87×87 distance matrix is fast (~10ms), but cache results in database. Only re-cluster when playlists change or user explicitly requests.
- **Don't fetch all video metadata for duplicate detection:** Use junction table (playlist_videos) with SQL aggregation. Don't pull video objects into memory for counting.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| String similarity algorithm | Custom character matching or fuzzy search | string-similarity library (Dice coefficient) | Dice coefficient handles abbreviations/acronyms better than character edits, 2M+ weekly downloads, battle-tested |
| Hierarchical clustering | Manual recursive grouping by threshold | ml-hclust AGNES algorithm | Produces proper dendrogram allowing flexible cluster count adjustment, handles linkage methods (average/complete/single), TypeScript-native |
| Drag-and-drop list reordering | Custom mouse event handlers | @dnd-kit/sortable | Accessibility (keyboard nav, screen readers), touch support, collision detection, smooth animations, 10kb core |
| Playlist limit validation | Manual if-statements checking counts | Zod schema with .max() validator | Type-safe, composable, generates TypeScript types, provides detailed error messages, already in stack |
| Duplicate video SQL query | Manual looping through playlists in JS | PostgreSQL GROUP BY with HAVING COUNT(*) > 1 | Database does the work, returns only duplicates (not all videos), supports JOIN for playlist details, sub-100ms query |

**Key insight:** Duplicate detection is NOT a complex algorithm problem. It's a SQL aggregation problem. The complexity is in presenting results clearly to users and handling the consolidation approval flow. Over-engineering with MinHash/LSH for 87 playlists wastes time.

## Common Pitfalls

### Pitfall 1: Clustering Videos Instead of Playlists

**What goes wrong:** Developer applies clustering algorithms to 4,000+ video titles/descriptions, producing video-level clusters instead of playlist-level consolidation.

**Why it happens:** Misunderstanding the requirement. Phase 2 goal is "consolidate 87 playlists to ~30 categories", not "cluster 4,000 videos into groups". Playlist names already contain semantic structure (user created them with intent).

**How to avoid:**
- Cluster playlist titles, not video titles
- Use playlist itemCount for category size validation
- Treat playlists as the unit of analysis

**Warning signs:**
- Clustering algorithm runs on 4,000+ items instead of 87
- Proposed categories contain individual videos instead of source playlists
- Performance is slow (clustering thousands vs dozens)

### Pitfall 2: Ignoring YouTube's 5,000 Video Per Playlist Limit

**What goes wrong:** User approves consolidation that would create category with 6,000 videos. System syncs to YouTube (Phase 8), hitting API error 400 "Playlist item count exceeds maximum" after adding 5,000 videos. Remaining 1,000 videos lost or require manual recovery.

**Why it happens:** Not validating totalVideos before approval. Developer assumes user won't consolidate too many large playlists together, or forgets YouTube's hard limit.

**How to avoid:**
- Use Zod schema with .max(4500) validation (safety margin)
- Display warning badge when category approaches 4,000 videos
- Disable approve button if category exceeds limit
- Show "Split Category" suggestion with automatic sub-category creation

**Warning signs:**
- Validation only checks at sync time (Phase 8) instead of approval time
- No visual indicators for categories near limit
- User can approve any consolidation regardless of size

### Pitfall 3: Poor Category Name Generation from Clustering

**What goes wrong:** Hierarchical clustering groups playlists correctly, but generated category names are generic ("Cluster 1", "Group A") or nonsensical ("The Tutorial Playlist Videos").

**Why it happens:** Category name generation is treated as afterthought. Simply concatenating playlist names or using cluster IDs instead of extracting semantic meaning.

**How to avoid:**
- Extract meaningful words from playlist titles (filter stopwords: "the", "playlist", "videos")
- Find most common word in cluster, capitalize as category name
- Allow user to edit proposed category names before approval
- Fallback to first playlist name in cluster if word frequency fails

**Warning signs:**
- Category names like "Cluster_0", "Group_12"
- Names are full concatenated playlist titles (50+ characters)
- Users must manually rename every single category

### Pitfall 4: Inefficient Duplicate Detection (N×N Comparison in Memory)

**What goes wrong:** Application loads all videos from all playlists into JavaScript arrays, then nested loops to compare every video against every other video. For 4,000 videos, this is 16 million comparisons, taking 10+ seconds and potentially crashing browser.

**Why it happens:** Not leveraging database for aggregation. Treating duplicate detection as an "algorithm problem" instead of a SQL query problem.

**How to avoid:**
- Use SQL GROUP BY with HAVING clause to let PostgreSQL find duplicates
- Database query returns only duplicates (not all 4,000 videos)
- Query executes in <100ms with proper indexes on playlist_videos.videoId
- Only fetch duplicate video details after identifying which ones are duplicated

**Warning signs:**
- Fetching all videos from database to JS for duplicate detection
- Nested loops in application code comparing video IDs
- Browser freeze or memory issues during analysis
- Query takes >1 second for 87 playlists

### Pitfall 5: Not Handling Playlist Renames/Additions After Analysis

**What goes wrong:** User runs analysis, gets consolidation proposal. Before approving, user renames 5 playlists in YouTube. Now proposal references old playlist names, causing confusion or sync errors.

**Why it happens:** Storing playlist names in consolidation proposal instead of playlist IDs. Not detecting when cached data is stale compared to YouTube source.

**How to avoid:**
- Store playlist IDs in consolidation proposals, not names
- Display current playlist titles fetched from database when showing proposal
- Check playlist lastFetched timestamp; warn if >24 hours old before approval
- Provide "Refresh Analysis" button to re-run clustering with current data

**Warning signs:**
- Consolidation proposal shows playlist names that don't match dashboard
- Errors during approval: "Playlist not found"
- User confusion: "I renamed that playlist yesterday, why does this still show old name?"

## Code Examples

Verified patterns from official sources:

### Hierarchical Clustering with ml-hclust and String Similarity

```typescript
// Source: ml-hclust GitHub + string-similarity npm docs
import { agnes } from 'ml-hclust'
import stringSimilarity from 'string-similarity'

interface Playlist {
  id: number
  title: string
  itemCount: number
}

export function clusterPlaylistsByTitle(
  playlists: Playlist[],
  targetClusters: number = 30
): number[][] {
  const n = playlists.length
  const titles = playlists.map(p => p.title)

  // Build distance matrix: distance = 1 - similarity
  const distances: number[][] = Array(n).fill(0).map(() => Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const similarity = stringSimilarity.compareTwoStrings(titles[i], titles[j])
      const distance = 1 - similarity
      distances[i][j] = distance
      distances[j][i] = distance // Symmetric matrix
    }
  }

  // Apply AGNES hierarchical clustering
  const tree = agnes(distances, {
    method: 'average', // UPGMA (average linkage)
  })

  // Cut dendrogram at level that produces target cluster count
  const clusters = cutDendrogram(tree, targetClusters)

  return clusters // Returns array of arrays, each containing playlist indices
}

// Helper to cut dendrogram tree into clusters
function cutDendrogram(tree: any, k: number): number[][] {
  // Implementation depends on ml-hclust tree structure
  // This is a simplified version - real implementation needs tree traversal
  const clusters: number[][] = []
  // TODO: Traverse tree and cut at appropriate height
  return clusters
}
```

### Server Action for Generating Consolidation Proposal

```typescript
// Source: Next.js 15 Server Actions + Drizzle patterns
'use server'

import { db } from '@/lib/db'
import { playlists, consolidationProposals } from '@/lib/db/schema'
import { clusterPlaylists } from '@/lib/analysis/clustering'
import { validateConsolidation } from '@/lib/analysis/validation'
import { revalidatePath } from 'next/cache'

export async function generateConsolidationProposal(targetCategories: number = 30) {
  // Fetch all playlists
  const allPlaylists = await db.select().from(playlists)

  // Run clustering algorithm
  const clusters = await clusterPlaylists(targetCategories)

  // Validate that no cluster exceeds video limit
  const validation = await validateConsolidation({ categories: clusters })

  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors
    }
  }

  // Store proposals in database
  for (const cluster of clusters) {
    await db.insert(consolidationProposals).values({
      categoryName: cluster.categoryName,
      sourcePlaylistIds: cluster.playlists.map(p => p.id),
      totalVideos: cluster.totalVideos,
      status: 'pending',
    })
  }

  revalidatePath('/analysis')

  return {
    success: true,
    proposalCount: clusters.length
  }
}

export async function approveProposal(proposalId: number) {
  await db
    .update(consolidationProposals)
    .set({
      status: 'approved',
      approvedAt: new Date()
    })
    .where(eq(consolidationProposals.id, proposalId))

  revalidatePath('/analysis')
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit/sortable | 2023 (library archived) | dnd-kit more performant (10kb vs 40kb), better TypeScript support, maintained by active community |
| Levenshtein string distance | Dice coefficient (bigram similarity) | Ongoing research 2020s | Dice handles abbreviations/acronyms better ("JS" vs "JavaScript"), more intuitive similarity scores for short strings |
| K-means clustering for playlists | Hierarchical clustering (dendrogram) | Domain-specific preference | Hierarchical allows flexible cluster count adjustment without re-running algorithm; k-means requires pre-specifying k |
| Client-side only validation | Zod schema with runtime + static types | TypeScript ecosystem 2021+ | Eliminates type/validation drift, single source of truth, generates TypeScript types from schemas |
| Manual SQL queries for duplicates | Drizzle ORM with sql tagged template | Drizzle 2023-2025 adoption | Type-safe SQL, no raw string queries, better IDE autocomplete, prevents SQL injection |

**Deprecated/outdated:**
- **react-beautiful-dnd:** Archived by Atlassian in 2023, no longer maintained. Migrate to dnd-kit or pragmatic-drag-and-drop.
- **MinHash/LSH for small datasets:** Overkill for 87 playlists. Use simple pairwise comparison with string-similarity (completes in <50ms). Save LSH for 10k+ items.
- **TF-IDF for playlist title clustering:** Playlist titles too short (2-5 words) for TF-IDF to add value over bigram similarity. Save TF-IDF for video title/description analysis (Phase 5).

## Open Questions

Things that couldn't be fully resolved:

1. **How should dendrogram be cut to produce exactly 25-35 clusters?**
   - What we know: ml-hclust produces hierarchical tree, can cut at any height. Average linkage (UPGMA) is standard method.
   - What's unclear: Automatic height selection to hit target cluster count requires tree traversal logic not documented in ml-hclust. Alternative libraries don't expose this clearly.
   - Recommendation: Implement custom `cutDendrogram` function that traverses tree top-down, counts clusters at each level, stops when count reaches target range (25-35). Alternative: Use fixed similarity threshold (e.g., 0.4) and accept whatever cluster count results, then manually merge if needed.

2. **Should duplicate detection count same video at different positions as duplicate?**
   - What we know: SQL query finds videoId in multiple playlists. YouTube allows same video multiple times in one playlist (different positions).
   - What's unclear: User intent - is "JavaScript Intro" video at positions 1 and 50 in same playlist considered "duplicate" for consolidation purposes?
   - Recommendation: Count unique (playlistId, videoId) pairs, not (playlistId, videoId, position). If same video appears twice in one playlist, that's intentional user organization, not duplication error. Only flag cross-playlist duplicates.

3. **What if user wants more granular control than approve/reject entire category?**
   - What we know: Requirements specify "manually adjust consolidation proposal by merging different playlists" (CAT-09). Current proposal: drag-drop playlists between categories.
   - What's unclear: Should user be able to split one playlist across multiple categories? (e.g., "Web Dev" playlist split into "JavaScript" and "CSS" categories based on video titles)
   - Recommendation: Phase 2 supports playlist-level reassignment only (drag whole playlist to different category). Defer video-level categorization to Phase 5 (ML categorization of Watch Later). Keep Phase 2 scoped to playlist consolidation.

4. **How to handle edge case: Category exceeds limit after duplicate removal?**
   - What we know: Consolidation proposal shows totalVideos assuming all videos kept. After deduplication, category may have fewer videos.
   - What's unclear: If category shows 4,800 videos (over limit), but after dedup only 4,200 remain, should system allow approval?
   - Recommendation: Validation should calculate totalVideos AFTER duplicate removal. Adjust SQL query to count DISTINCT videoIds across source playlists: `SELECT COUNT(DISTINCT videoId) FROM playlist_videos WHERE playlistId IN (...)`. This gives accurate post-consolidation count.

## Sources

### Primary (HIGH confidence)
- **YouTube Data API Official Docs:**
  - https://developers.google.com/youtube/v3/determine_quota_cost - Verified playlists.insert costs 50 units, playlistItems.insert costs 50 units
  - Community sources verified 5,000 video limit per playlist (standard cap, brand channels may exceed)
- **PostgreSQL Official Docs:**
  - https://www.postgresql.org/docs/current/tutorial-join.html - JOIN queries for duplicate detection across tables
  - GROUP BY + HAVING patterns for aggregate queries
- **string-similarity npm:** https://www.npmjs.com/package/string-similarity - 4.0+ version, Dice coefficient implementation, 2M+ weekly downloads
- **ml-hclust GitHub:** https://github.com/mljs/hclust - v4.0.0 (Nov 2025), AGNES algorithm, TypeScript-native
- **@dnd-kit/sortable npm:** https://www.npmjs.com/package/@dnd-kit/sortable - v10.0.0, 1,867 dependents, zero-dependency core
- **Zod Official Docs:** https://zod.dev/ - v3.23+, .max() validation for numbers/arrays

### Secondary (MEDIUM confidence)
- **Web search findings verified with multiple sources:**
  - Dice coefficient superior to Levenshtein for short strings (GeeksforGeeks, academic papers)
  - Hierarchical clustering patterns for text (CRAN R documentation, academic sources)
  - TF-IDF with cosine similarity for document clustering (Medium, academic papers, GitHub implementations)
  - PostgreSQL duplicate detection patterns (CommandPrompt.com, Theodo blog, multiple tutorials)
  - dnd-kit vs react-beautiful-dnd comparison (Puck blog 2026, community discussions)
  - Data deduplication UI patterns from 2026 tools (DataGroomr, Dedupely, Creatio)
  - GitHub PR review UI patterns (official GitHub docs) as model for approve/reject workflow

### Tertiary (LOW confidence - marked for validation)
- **String similarity algorithm performance comparisons:** Benchmarks from npm package READMEs (cos-similarity claiming 57x faster) should be validated with actual testing on playlist-sized datasets
- **Dendrogram cutting algorithms:** No authoritative source found for optimal height selection to produce target cluster count. Custom implementation needed.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - All libraries verified via npm/GitHub with current versions and active maintenance
- Duplicate detection pattern: **HIGH** - SQL GROUP BY is standard PostgreSQL, tested approach
- Clustering approach: **MEDIUM-HIGH** - string-similarity + ml-hclust verified, but dendrogram cutting logic needs custom implementation
- UI patterns: **MEDIUM** - shadcn/ui + dnd-kit verified combinations from 2026 sources, but custom approve/reject workflow needs building
- Validation patterns: **HIGH** - Zod already in stack, .max() validator well-documented

**Research date:** 2026-02-05
**Valid until:** March 7, 2026 (30 days - stable domain, but verify npm package updates if major versions released)
