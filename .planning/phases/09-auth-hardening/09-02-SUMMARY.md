# Plan 09-02 Summary: Auth Guards for Server Actions (analysis, categories, ml-categorization)

## Approach Changed

Original plan called for inline `requireAuth()` guards on all 38 actions across 3 files.
Replaced with middleware-first architecture:

1. **Next.js middleware** (`src/middleware.ts`) protects all 7 authenticated routes — pages AND server action POSTs
2. **Selective inline guards** on critical destructive actions only: `deleteCategory`, `mergeCategories`, `finalizeConsolidation`
3. Non-destructive actions (reads, approvals, etc.) rely on middleware layer

## What Changed

- `src/middleware.ts` — New file, protects `/dashboard`, `/analysis`, `/ml-review`, `/ml-categorization`, `/safety`, `/videos`, `/sync`
- `src/lib/auth/guard.ts` — Added `withAuth()` HOF wrapper for future use
- `src/app/actions/analysis.ts` — Added `requireAuth()` to `finalizeConsolidation` only
- `src/app/actions/categories.ts` — Added `requireAuth()` to `deleteCategory` and `mergeCategories` only
- `src/app/analysis/page.tsx` — Removed redundant per-page auth check (middleware handles it)
- `src/app/ml-review/page.tsx` — Removed redundant per-page auth check
- `src/app/safety/page.tsx` — Removed redundant per-page auth check
- `src/app/videos/page.tsx` — Removed redundant per-page auth check

## Commits

- `5151895` feat(09): auth hardening via middleware + selective guards

## Duration

~5 min (manual orchestration, approach redesign)

## Decisions

- Middleware-first over per-action guards: 1 file vs 238 lines of repeated boilerplate
- Keep inline guards only on destructive/irreversible operations as defence-in-depth
- Removed per-page auth checks (09-01) since middleware makes them redundant
