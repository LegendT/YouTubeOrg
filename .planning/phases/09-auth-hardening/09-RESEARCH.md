# Phase 9: Auth Hardening - Research

**Researched:** 2026-02-07
**Domain:** NextAuth v5 authentication enforcement, defence-in-depth
**Confidence:** HIGH

## Summary

Phase 9 closes two HIGH-priority security gaps identified in the v1 milestone audit: (1) four pages missing explicit auth checks, and (2) server actions lacking internal auth validation. The codebase already has a well-established auth pattern -- three pages (dashboard, sync, ml-categorization) correctly check `session?.access_token` and `session?.error === 'RefreshAccessTokenError'` before proceeding. The four unprotected pages (analysis, ml-review, safety, videos) skip this check and call server actions directly. Similarly, most server actions (all of analysis, categories, videos, backup, operation-log, ml-categorization) perform no auth validation, relying entirely on page-level checks that may not exist.

The fix is mechanical and low-risk: replicate the existing auth pattern across the four pages and add a shared auth guard helper for server actions. No new libraries are needed. The existing `getServerSession()` helper and `auth()` function from `@/lib/auth/config` already provide everything required.

**Primary recommendation:** Add the existing 3-line auth check pattern to 4 pages and create a reusable `requireAuth()` helper function for all server actions, following the defence-in-depth principle.

## Standard Stack

No new libraries needed. This phase uses only what is already installed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | 5.0.0-beta.30 | Authentication framework | Already installed and configured |
| next | 15.5.12 | App Router with Server Components | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @/lib/auth/session | n/a | `getServerSession()` wrapper | Page-level auth checks |
| @/lib/auth/config | n/a | `auth()` export | Server action auth checks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-action auth checks | Next.js middleware only | Middleware alone is insufficient for defence-in-depth; CVE-2025-29927 demonstrated middleware-only auth is risky |
| `getServerSession()` in actions | `auth()` directly | `auth()` is lighter (no wrapper), already used in sync.ts actions; prefer `auth()` in actions for consistency |

**Installation:**
```bash
# No installation needed - all dependencies already present
```

## Architecture Patterns

### Existing Auth Check Pattern (Pages)

Three pages already implement the correct pattern. The exact code is:

```typescript
// From src/app/dashboard/page.tsx (lines 96-100) and src/app/sync/page.tsx (lines 18-21)
import { getServerSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

const session = await getServerSession()
if (!session?.access_token || session?.error === 'RefreshAccessTokenError') {
  redirect('/api/auth/signin')
}
```

This pattern checks both:
1. **Missing/expired token**: `!session?.access_token` catches unauthenticated users
2. **Revoked token**: `session?.error === 'RefreshAccessTokenError'` catches users with revoked/expired refresh tokens

### Existing Auth Check Pattern (Server Actions)

The sync.ts action file already has a reusable helper pattern:

```typescript
// From src/app/actions/sync.ts (lines 27-36)
async function getAccessToken(): Promise<
  | { success: true; accessToken: string }
  | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.access_token) {
    return { success: false, error: 'Not authenticated' };
  }
  return { success: true, accessToken: session.access_token };
}
```

### Recommended: Shared Auth Guard for Actions

Create a shared `requireAuth()` utility that can be imported by all server action files:

```typescript
// src/lib/auth/guard.ts
import { auth } from '@/lib/auth/config'

export type AuthResult =
  | { authenticated: true; accessToken: string }
  | { authenticated: false; error: string }

export async function requireAuth(): Promise<AuthResult> {
  const session = await auth()

  if (!session?.access_token) {
    return { authenticated: false, error: 'Not authenticated' }
  }

  if (session.error === 'RefreshAccessTokenError') {
    return { authenticated: false, error: 'Session expired. Please sign in again.' }
  }

  return { authenticated: true, accessToken: session.access_token }
}
```

### Usage in Server Actions

```typescript
// In any server action file
import { requireAuth } from '@/lib/auth/guard'

export async function someAction(): Promise<SomeResult> {
  const authResult = await requireAuth()
  if (!authResult.authenticated) {
    return { success: false, error: authResult.error }
  }

  // Proceed with action logic...
}
```

### Categorisation of Server Actions

**Actions that NEED auth checks (mutating or returning user-specific data):**

| File | Actions | Risk Level |
|------|---------|------------|
| `analysis.ts` | `generateConsolidationProposal`, `approveProposal`, `rejectProposal`, `splitProposal`, `updateProposalPlaylists`, `createCustomCategory`, `resolveDuplicates`, `bulkUpdateStatus`, `runAnalysis`, `finalizeConsolidation` | HIGH - mutations |
| `analysis.ts` | `getProposals`, `getDuplicateStats`, `getDuplicateVideos`, `getCategoryDetail`, `getAnalysisSummary`, `checkStaleness`, `getLatestSession`, `getAllPlaylistsForSelector` | MEDIUM - read-only but user data |
| `categories.ts` | `createCategory`, `renameCategory`, `deleteCategory`, `mergeCategories`, `assignVideosToCategory`, `undoDelete`, `undoMerge` | HIGH - mutations |
| `categories.ts` | `getCategories`, `searchVideosForAssignment`, `getCategoryDetailManagement` | MEDIUM - read-only but user data |
| `videos.ts` | `removeVideosFromCategory` | HIGH - mutation |
| `videos.ts` | `getVideosForCategory` | MEDIUM - read-only but user data |
| `ml-categorization.ts` | `saveCategorizationResults`, `acceptSuggestion`, `rejectSuggestion`, `recategorizeVideo` | HIGH - mutations |
| `ml-categorization.ts` | `getDataForCategorization`, `getMLCategorizationForVideo`, `getMLCategorizationResults`, `getReviewData`, `getVideoReviewDetail`, `getReviewStats` | MEDIUM - read-only but user data |
| `backup.ts` | `createManualBackup`, `restoreBackup`, `deleteBackup` | HIGH - mutations |
| `backup.ts` | `listBackups` | MEDIUM - read-only |
| `operation-log.ts` | `logOperation` | HIGH - mutation (but internal only) |
| `operation-log.ts` | `getOperationLog`, `getPendingChanges` | MEDIUM - read-only |
| `sync.ts` | All actions | ALREADY GUARDED via `getAccessToken()` |
| `sync-playlists.ts` | `syncAllData` | ALREADY GUARDED |

**Total server action files needing auth guards added: 6** (analysis, categories, videos, ml-categorization, backup, operation-log)

**Already guarded: 2** (sync.ts, sync-playlists.ts)

### Anti-Patterns to Avoid

- **Middleware-only auth:** Never rely solely on Next.js middleware for authentication. Always validate at the data access layer (server components and server actions). CVE-2025-29927 demonstrated this risk.
- **Inconsistent error shapes:** The existing sync.ts returns `{ success: false, error: string }`. All other action files should return the same shape for auth failures.
- **Auth check after data fetch:** Always check auth BEFORE any database queries or API calls, not after.
- **Throwing on auth failure:** Server actions should return error objects, not throw. Pages should `redirect()`, not throw.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session checking | Custom JWT parsing | `auth()` from NextAuth config | Already handles token refresh, expiry, error flags |
| Redirect on auth failure | Manual Response objects | `redirect('/api/auth/signin')` from next/navigation | Works correctly in Server Components |
| Auth error response | Custom error format | `{ success: false, error: string }` pattern | Matches existing convention in sync.ts |
| Token refresh | Manual refresh logic | NextAuth JWT callback | Already implemented in auth config.ts |
| CSRF protection | Manual token handling | NextAuth built-in CSRF | Already enabled by default |

**Key insight:** The entire auth infrastructure is already built. This phase is purely about applying existing patterns consistently, not building new auth functionality.

## Common Pitfalls

### Pitfall 1: Forgetting the RefreshAccessTokenError check
**What goes wrong:** Only checking `!session?.access_token` misses the case where a token exists but the refresh token is revoked/expired. The user has a session but cannot make API calls.
**Why it happens:** Developers only check for the presence of a token, not its validity state.
**How to avoid:** Always check BOTH conditions: `!session?.access_token || session?.error === 'RefreshAccessTokenError'`
**Warning signs:** Users see raw API errors instead of being redirected to sign-in.

### Pitfall 2: Different auth check patterns per file
**What goes wrong:** Each server action file implements its own auth check slightly differently, leading to maintenance burden and potential inconsistencies.
**Why it happens:** Copy-paste with modifications over time.
**How to avoid:** Extract a single `requireAuth()` utility and import it everywhere.
**Warning signs:** Grep shows multiple different auth check implementations.

### Pitfall 3: Not handling auth failure in read-only actions
**What goes wrong:** Read-only actions like `getCategories()` return empty arrays on error, which looks like "no data" rather than "not authenticated." Users see empty screens.
**Why it happens:** These actions catch errors and return empty results, masking auth failures.
**How to avoid:** Check auth first, return explicit auth error before any DB query.
**Warning signs:** Pages show "no data" state instead of redirecting to login.

### Pitfall 4: Breaking the return type contract
**What goes wrong:** Adding an auth error return to an action that previously returned a simple array (like `getCategories(): Promise<CategoryListItem[]>`) breaks the calling component.
**Why it happens:** The function signature cannot accommodate both "success data" and "auth error" without a type change.
**How to avoid:** For actions that return simple types (arrays, objects), either: (a) have the PAGE do the auth check and trust it, or (b) change the return type to a discriminated union `{ success: true, data: T } | { success: false, error: string }`. Given this is a single-user app, option (a) is acceptable if page-level checks are thorough.
**Warning signs:** TypeScript compilation errors after adding auth checks to existing actions.

### Pitfall 5: Double session fetching
**What goes wrong:** A page checks auth, then calls a server action that also checks auth, resulting in two `auth()` calls per request.
**Why it happens:** Defence-in-depth naturally creates redundant checks.
**How to avoid:** This is acceptable and intended. The `auth()` function is lightweight (JWT decode from cookie, not a DB call) and the redundancy is the point of defence-in-depth. Do NOT optimise this away.
**Warning signs:** None -- this is the correct behaviour.

## Code Examples

### Example 1: Adding auth to a page (analysis)

```typescript
// src/app/analysis/page.tsx - BEFORE
export default async function AnalysisPage() {
  const [proposalsResult, summary, ...] = await Promise.all([
    getProposals(),
    // ...
  ])
  // No auth check!
}

// src/app/analysis/page.tsx - AFTER
import { getServerSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export default async function AnalysisPage() {
  const session = await getServerSession()
  if (!session?.access_token || session?.error === 'RefreshAccessTokenError') {
    redirect('/api/auth/signin')
  }

  const [proposalsResult, summary, ...] = await Promise.all([
    getProposals(),
    // ...
  ])
}
```

### Example 2: Adding auth to a server action (mutation)

```typescript
// src/app/actions/categories.ts - BEFORE
export async function createCategory(name: string): Promise<CategoryActionResult> {
  try {
    // Directly hits DB without auth check
    const trimmed = name.trim()
    // ...
  }
}

// src/app/actions/categories.ts - AFTER
import { requireAuth } from '@/lib/auth/guard'

export async function createCategory(name: string): Promise<CategoryActionResult> {
  const auth = await requireAuth()
  if (!auth.authenticated) {
    return { success: false, error: auth.error }
  }

  try {
    const trimmed = name.trim()
    // ...
  }
}
```

### Example 3: Handling read-only actions that return arrays

For actions like `getCategories()` that return `CategoryListItem[]`, adding a discriminated union return type would break all callers. Two approaches:

**Approach A: Keep simple return type, rely on page-level auth (pragmatic)**
```typescript
// Page does the auth check, action trusts it
// This is acceptable for a single-user app where page and action run in same request
export async function getCategories(): Promise<CategoryListItem[]> {
  // No auth check needed if page always checks first
  // But add one anyway for defence-in-depth:
  const session = await auth()
  if (!session?.access_token) {
    return [] // Safe fallback - page would have redirected
  }
  // ... existing logic
}
```

**Approach B: Change return type to discriminated union (thorough)**
```typescript
export async function getCategories(): Promise<
  { success: true; categories: CategoryListItem[] } | { success: false; error: string }
> {
  const authResult = await requireAuth()
  if (!authResult.authenticated) {
    return { success: false, error: authResult.error }
  }
  // ... wrap existing return
}
```

**Recommendation:** Use Approach A for read-only actions and Approach B for mutating actions. Mutating actions already return `{ success: boolean; error?: string }` shapes, so adding auth is seamless. Read-only actions returning arrays can silently guard without type changes since the page-level redirect is the primary protection.

### Example 4: The requireAuth() helper

```typescript
// src/lib/auth/guard.ts
'use server'

import { auth } from '@/lib/auth/config'

export type AuthResult =
  | { authenticated: true; accessToken: string }
  | { authenticated: false; error: string }

/**
 * Require authentication for server actions.
 *
 * Checks both token presence and refresh token validity.
 * Returns a discriminated union for easy guard-clause usage.
 *
 * Usage:
 * ```typescript
 * const authResult = await requireAuth()
 * if (!authResult.authenticated) {
 *   return { success: false, error: authResult.error }
 * }
 * ```
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await auth()

  if (!session?.access_token) {
    return { authenticated: false, error: 'Not authenticated' }
  }

  if (session.error === 'RefreshAccessTokenError') {
    return {
      authenticated: false,
      error: 'Session expired. Please sign in again.',
    }
  }

  return { authenticated: true, accessToken: session.access_token }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` only | Defence-in-depth (middleware + page + action) | Post-CVE-2025-29927 (March 2025) | Middleware alone is insufficient |
| `getSession()` (v4) | `auth()` (v5) | NextAuth v5 | Simpler API, no separate import |
| `getServerSession(authOptions)` (v4) | `auth()` (v5) | NextAuth v5 | No need to pass config object |
| Separate auth.config.ts for edge | Single config file | Next.js 15+ | Edge middleware can use same config if no adapter |

**Deprecated/outdated:**
- `next-auth/middleware` import: Replaced by exporting `auth` as middleware from your config
- `getSession()`: Replaced by `auth()` in v5
- Passing `authOptions` to `getServerSession()`: Not needed in v5; `auth()` already has config

## Open Questions

1. **Should `logOperation()` have its own auth guard?**
   - What we know: `logOperation()` is called internally by other server actions (like `deleteCategory`, `restoreBackup`), not directly by client components
   - What's unclear: Whether it's ever exposed as a callable action from the client
   - Recommendation: Add auth guard anyway -- it has `'use server'` directive making it technically callable from client. Low cost, high safety.

2. **Should middleware.ts be added as an additional layer?**
   - What we know: Next.js 15.5.12 is not affected by CVE-2025-29927. Middleware can provide session keep-alive and route-level redirects.
   - What's unclear: Whether the overhead is justified for a single-user app
   - Recommendation: Out of scope for Phase 9. Page-level + action-level checks are sufficient. Middleware can be added later if needed.

3. **Should read-only action return types change?**
   - What we know: Changing return types of `getCategories()`, `getProposals()`, etc. would require updating all calling components
   - What's unclear: Whether the refactor effort is proportional to the risk for a single-user app
   - Recommendation: Use the silent guard approach (return empty on auth failure) for read-only actions; change types only for mutating actions where `{ success, error }` is already the return shape.

## Sources

### Primary (HIGH confidence)
- Codebase analysis of all 8 page files: `src/app/*/page.tsx`
- Codebase analysis of all 8 server action files: `src/app/actions/*.ts`
- Auth configuration: `src/lib/auth/config.ts`, `src/lib/auth/session.ts`
- Session types: `src/types/next-auth.d.ts`
- Package versions: next@15.5.12, next-auth@5.0.0-beta.30

### Secondary (MEDIUM confidence)
- [Auth.js v5 Protecting Routes](https://authjs.dev/getting-started/session-management/protecting) - official documentation on defence-in-depth
- [Auth.js v5 Migration Guide](https://authjs.dev/getting-started/migrating-to-v5) - middleware/proxy pattern
- [Auth.js Next.js Reference](https://authjs.dev/reference/nextjs) - auth() and middleware usage

### Tertiary (LOW confidence)
- [CVE-2025-29927 analysis](https://securitylabs.datadoghq.com/articles/nextjs-middleware-auth-bypass/) - middleware bypass vulnerability context (not directly applicable to this version but informs defence-in-depth principle)
- [Next.js Authentication Best Practices 2025](https://www.franciscomoretti.com/blog/modern-nextjs-authentication-best-practices) - community best practices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, using exact existing patterns from codebase
- Architecture: HIGH - three reference implementations already exist in codebase (dashboard, sync, ml-categorization pages + sync.ts actions)
- Pitfalls: HIGH - derived from direct codebase analysis of actual code patterns and type signatures
- Code examples: HIGH - based on actual existing code, verified line-by-line

**Research date:** 2026-02-07
**Valid until:** 2026-06-07 (stable - auth patterns unlikely to change)
