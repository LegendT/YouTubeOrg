# Phase 10: UI Polish & Code Quality - Research

**Researched:** 2026-02-08
**Domain:** UI notifications (toasts, dialogs, inline feedback), British English consistency, TypeScript quality
**Confidence:** HIGH

## Summary

This phase covers four distinct workstreams: (1) replacing `alert()` with toast/inline feedback, (2) replacing `window.confirm()` with styled Radix Dialog modals, (3) sweeping all code for British English consistency (including DB schema/data), and (4) fixing any ML worker TypeScript issues.

The codebase has only 2 `alert()` calls and 2 `window.confirm()` calls -- a small, well-scoped task. The British English sweep is the largest workstream, touching 27+ files across UI strings, code comments, variable/function names, type definitions, file names, route paths, database table names, and database data values. TypeScript compilation currently shows zero errors (the worker uses `as any` casts that suppress errors) so this workstream may reduce to verifying correctness or optionally improving type safety.

For toasts, **sonner** is the clear choice. The original shadcn/ui toast component has been officially deprecated; shadcn/ui now integrates sonner directly as its toast solution. Sonner supports all user-specified requirements: bottom-right positioning, configurable visible toast count, colour-coded types (success/error/warning/info via `richColors`), action buttons, and configurable durations per toast.

**Primary recommendation:** Use sonner for toasts, reuse the existing Radix Dialog pattern for confirmations, create a standardised inline feedback component based on existing patterns, and treat British English as a comprehensive rename sweep with Drizzle migrations for DB changes.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sonner | latest | Toast notifications | Official shadcn/ui recommendation; old toast component deprecated |
| @radix-ui/react-dialog | 1.1.15 | Confirmation modals | Already in project via shadcn/ui dialog component |
| drizzle-kit | 0.31.8 | DB schema migrations | Already in project for all schema changes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui sonner wrapper | via CLI | Styled sonner integration | `npx shadcn@latest add sonner` for pre-styled wrapper |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sonner | shadcn/ui toast (old) | Deprecated by shadcn/ui team -- do not use |
| sonner | react-hot-toast | Less feature-rich, no shadcn integration |

**Installation:**
```bash
npx shadcn@latest add sonner
```

This installs the `sonner` npm package and creates `src/components/ui/sonner.tsx` wrapper.

## Architecture Patterns

### Pattern 1: Sonner Toaster Provider in Root Layout

**What:** Add the `<Toaster />` component once in the root layout so all pages can call `toast()`.
**When to use:** Always -- required for sonner to work.
**Example:**
```typescript
// Source: https://ui.shadcn.com/docs/components/sonner
// src/app/layout.tsx
import { Toaster } from "@/components/ui/sonner"

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="bottom-right"
          richColors
          expand
          visibleToasts={100}
          closeButton
          toastOptions={{
            duration: 3000,
          }}
        />
      </body>
    </html>
  )
}
```

**Configuration mapping to user decisions:**
- `position="bottom-right"` -- locked decision
- `richColors` -- enables green/red/amber/blue colour-coding for success/error/warning/info
- `expand` + `visibleToasts={100}` -- effectively unlimited visible toasts (no stacking cap)
- `closeButton` -- allows manual dismiss on all toasts
- `toastOptions.duration: 3000` -- 3-second default for auto-dismiss

### Pattern 2: Toast Usage for Errors (Persistent) and Success (Auto-dismiss)

**What:** Different toast types with different durations.
**When to use:** For error feedback where no contextual location exists, and for batch operation results.
**Example:**
```typescript
import { toast } from "sonner"

// Success: auto-dismisses after 3s (default)
toast.success("Videos moved successfully", {
  action: {
    label: "Undo",
    onClick: () => handleUndo(),
  },
})

// Error: persistent until manually dismissed
toast.error("Failed to move videos", {
  duration: Infinity,
  description: "Server returned an error. Please try again.",
})

// Warning
toast.warning("Approaching quota limit")

// Info
toast.info("Sync in progress")
```

### Pattern 3: Confirmation Dialog (Replacing window.confirm)

**What:** Reuse the existing Radix Dialog pattern from `DeleteCategoryDialog` for confirmation modals.
**When to use:** Replacing `window.confirm()` calls in `backup-list.tsx`.
**Example:**
```typescript
// Follow the exact pattern from src/components/analysis/delete-category-dialog.tsx
// Key elements:
// 1. Dialog with open/onOpenChange state control
// 2. DialogHeader with title + description
// 3. Warning/info content area
// 4. DialogFooter with Cancel + destructive action button
// 5. Loading state on the action button
// 6. Error display inside the dialog
```

### Pattern 4: Inline Feedback Component

**What:** A standardised component for showing success/error messages near the triggering element.
**When to use:** Server action results, form submissions, CRUD operations -- anywhere feedback should appear contextually.
**Example:**
```typescript
// Based on existing pattern in backup-list.tsx
interface InlineFeedback {
  type: 'success' | 'error' | 'warning' | 'info'
  text: string
}

// Reusable component
function InlineMessage({ message }: { message: InlineFeedback | null }) {
  if (!message) return null

  const styles = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
  }

  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  }

  const Icon = icons[message.type]

  return (
    <div className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm border ${styles[message.type]}`}>
      <Icon className="h-4 w-4 flex-shrink-0" />
      {message.text}
    </div>
  )
}
```

### Pattern 5: Drizzle Table/Column Rename Migration

**What:** Use `drizzle-kit generate` to create migration for renamed table/columns, answering the interactive rename prompts.
**When to use:** Renaming `ml_categorizations` table and any affected columns.
**Example:**
```bash
# 1. Update schema.ts with new names
# 2. Generate migration (drizzle-kit will ask if renamed or new)
npx drizzle-kit generate

# When prompted: "Is ml_categorisations created or renamed from ml_categorizations?"
# Answer: renamed

# 3. Apply migration
npx drizzle-kit migrate
```

### Pattern 6: Route Renaming (Next.js App Router)

**What:** Rename the `/ml-categorization` route directory to `/ml-categorisation`.
**When to use:** British English sweep for URL paths.
**Important:** Must update ALL references:
- `src/app/ml-categorization/` directory name
- `src/middleware.ts` matcher pattern
- `src/components/navigation.tsx` href
- `src/app/dashboard/page.tsx` href
- `src/app/ml-review/page.tsx` link href
- Any imports referencing the old path

### Anti-Patterns to Avoid
- **Mixing toast and inline feedback for the same action:** The CONTEXT.md is clear -- server action failures and success confirmations use inline feedback, NOT toasts. Toasts are only for situations without a clear contextual location.
- **Partial British English sweep:** Do not convert UI strings but leave code identifiers or comments in American English. The scope is comprehensive.
- **Renaming shadcn/ui generated code variables:** The `color` references in UI components (button.tsx, badge.tsx, etc.) are CSS/Tailwind tokens, not user-facing text. CSS property names like `color`, `backgroundColor` are part of the web platform and should NOT be renamed.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast system | sonner via shadcn/ui | Handles stacking, animation, auto-dismiss, action buttons, accessibility |
| Confirmation modals | Custom modal from scratch | Existing shadcn/ui Dialog component | Already styled, accessible, animated; matches existing dialogs in codebase |
| Inline feedback | Bespoke per-component patterns | Single reusable InlineMessage component | 6+ components already use ad-hoc versions of this pattern; standardise once |

**Key insight:** The codebase already has all the building blocks. This phase is about replacing native browser APIs with existing styled components and standardising patterns that are already partially implemented.

## Common Pitfalls

### Pitfall 1: Breaking Drizzle ORM References When Renaming DB Table

**What goes wrong:** Renaming the PostgreSQL table `ml_categorizations` to `ml_categorisations` requires updating EVERY reference to both the table name (in `pgTable()`) and the TypeScript export name (`mlCategorizations` -> `mlCategorisations`).
**Why it happens:** Drizzle maps the TypeScript export to the SQL table name. Missing even one reference causes a runtime crash.
**How to avoid:** Use grep to find ALL references to `mlCategorizations` and `ml_categorizations` across the entire codebase before renaming. There are at least 15 references across schema.ts, actions/ml-categorization.ts, backup/restore.ts, backup/snapshot.ts, and the relations file.
**Warning signs:** TypeScript compilation errors after rename (good -- they catch missed references). Runtime errors about missing tables (bad -- means migration wasn't applied).

### Pitfall 2: Route Rename Breaking Bookmarks/History

**What goes wrong:** Renaming `/ml-categorization` to `/ml-categorisation` breaks any existing bookmarks or browser history.
**Why it happens:** Next.js App Router routes are based on directory names.
**How to avoid:** This is a single-user local app, so the impact is minimal. But if desired, a redirect from the old URL can be added in `next.config.js` or as a simple redirect page.
**Warning signs:** 404 when navigating to old URL.

### Pitfall 3: Database Data Migration for "Uncategorized" -> "Uncategorised"

**What goes wrong:** The protected category has `name = 'Uncategorized'` stored as data in the `categories` table. Code references check `isProtected` flag, but some also reference the name string directly.
**Why it happens:** The name is both a display value AND sometimes used as a string comparison.
**How to avoid:** Write a migration that does `UPDATE categories SET name = 'Uncategorised' WHERE is_protected = true AND name = 'Uncategorized'`. Verify all code paths that reference the string "Uncategorized" are updated. The `isProtected` boolean flag is the primary check, but comments and UI text reference the name.
**Warning signs:** Grep for the literal string "Uncategorized" across all code files.

### Pitfall 4: Sonner Duration for Error Toasts

**What goes wrong:** Setting `duration: Infinity` for error toasts but forgetting to add `closeButton` means errors cannot be dismissed.
**Why it happens:** The global `Toaster` config sets duration: 3000 for all toasts. Error toasts need to override per-call.
**How to avoid:** Set `closeButton` on the `<Toaster>` component globally. For error toasts, pass `duration: Infinity` as a per-toast option.
**Warning signs:** Error toasts that never go away and have no close button.

### Pitfall 5: CSS "color" vs British "colour" Scope

**What goes wrong:** Renaming CSS properties or Tailwind class references from "color" to "colour".
**Why it happens:** Overzealous British English sweep.
**How to avoid:** CSS/HTML/Tailwind tokens (`color`, `backgroundColor`, `text-color-*`) are web platform standards and MUST NOT be renamed. Only rename: (a) user-facing UI text, (b) code comments/docs, (c) application-domain variable names that use "color" in a non-CSS context. The 28 files matching "color" are almost entirely Tailwind/CSS -- leave them alone.
**Warning signs:** Broken styles, Tailwind class not found errors.

### Pitfall 6: File/Directory Rename in Next.js App Router

**What goes wrong:** Renaming the `src/app/ml-categorization` directory causes import path breaks.
**Why it happens:** Multiple files import from `@/app/ml-categorization/...` or `./ml-categorization-page`.
**How to avoid:** Rename directory, then fix all imports. TypeScript will catch missing imports at compile time. Also rename the inner file `ml-categorization-page.tsx` to `ml-categorisation-page.tsx`.
**Warning signs:** TypeScript import resolution errors after rename.

## Code Examples

Verified patterns from official sources:

### Sonner Toast - Success with Action Button
```typescript
// Source: https://sonner.emilkowal.ski/toast
import { toast } from "sonner"

// After a successful move/copy operation (replacing alert())
toast.success("Videos moved successfully", {
  action: {
    label: "Undo",
    onClick: () => handleUndo(),
  },
})
```

### Sonner Toast - Persistent Error
```typescript
// Source: https://sonner.emilkowal.ski/toast
import { toast } from "sonner"

// After a failed operation (replacing alert())
toast.error(result.error || "Failed to move/copy videos", {
  duration: Infinity,
})
```

### Confirmation Dialog (Reusing Existing Pattern)
```typescript
// Based on: src/components/analysis/delete-category-dialog.tsx
// For backup-list.tsx restore/delete confirmations

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  warning?: string
  confirmLabel: string
  variant?: 'default' | 'destructive'
  onConfirm: () => Promise<void>
}

function ConfirmDialog({
  open, onOpenChange, title, description, warning,
  confirmLabel, variant = 'default', onConfirm,
}: ConfirmDialogProps) {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setIsPending(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {warning && (
          <div className="flex items-start gap-2 text-sm px-3 py-2 rounded-md bg-amber-50 text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{warning}</span>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant={variant} onClick={handleConfirm} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Drizzle Migration for Table Rename
```sql
-- Generated by drizzle-kit (interactive prompt: "renamed from ml_categorizations")
ALTER TABLE "ml_categorizations" RENAME TO "ml_categorisations";
```

### Drizzle Migration for Data Update
```sql
-- Custom migration for protected category name
UPDATE categories SET name = 'Uncategorised'
WHERE is_protected = true AND name = 'Uncategorized';
```

## Codebase Audit: Scope of Changes

### alert() Calls (2 total)
| File | Line | Current Text | Replacement |
|------|------|-------------|-------------|
| `src/components/videos/video-browse-page.tsx` | 242 | `alert(result.error \|\| 'Failed to move/copy videos')` | `toast.error(...)` with duration: Infinity |
| `src/components/videos/video-browse-page.tsx` | 260 | `alert(result.error \|\| 'Failed to undo')` | `toast.error(...)` with duration: Infinity |

### window.confirm() Calls (2 total)
| File | Line | Context | Replacement |
|------|------|---------|-------------|
| `src/components/safety/backup-list.tsx` | 98 | Restore backup confirmation | Styled Radix Dialog with warning |
| `src/components/safety/backup-list.tsx` | 123 | Delete backup confirmation | Styled Radix Dialog with destructive variant |

### TypeScript Errors in ML Worker
**Finding:** Zero TypeScript errors currently. The worker compiles cleanly with `tsc --noEmit`. The file uses `as any` type assertions (lines 61, 63-64, 66, 171-172) to work around complex Transformers.js types. These are functional but could optionally be improved for type safety.

### British English Sweep: American Spellings Found

**Database table name:**
- `ml_categorizations` -> `ml_categorisations` (requires Drizzle migration)

**Database data:**
- `categories.name = 'Uncategorized'` (protected category) -> `'Uncategorised'` (requires data migration)

**Route/directory:**
- `src/app/ml-categorization/` -> `src/app/ml-categorisation/`

**File names (4 files):**
- `ml-categorization-page.tsx` -> `ml-categorisation-page.tsx`
- `categorization-trigger.tsx` -> `categorisation-trigger.tsx`
- `categorization-engine.ts` -> `categorisation-engine.ts`
- `ml-categorization.ts` (action) -> `ml-categorisation.ts`

**TypeScript identifiers (extensive -- 27+ files):**
Key patterns to rename:
- `categorize` -> `categorise` (function names, variable names)
- `categorized` -> `categorised` (variable names, interface fields)
- `categorization` -> `categorisation` (type names, imports, function names)
- `Uncategorized` -> `Uncategorised` (string literals in code/comments)
- `Organizer` -> `Organiser` (UI text on landing page)
- `categorization` -> `categorisation` (in URLs, import paths)
- `Categorize` -> `Categorise` (UI button text)
- `Denormalized` -> `Denormalised` (comments only -- already mixed, line 127 vs 218)
- `recategorize` -> `recategorise` (function names, action names)

**CSS/Tailwind "color" references: DO NOT RENAME.**
The 28 files matching "color" are CSS/Tailwind tokens (e.g., `text-blue-600`, `bg-green-50`, `color:`, CSS custom properties). These are web standards and must not be converted to "colour".

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn/ui Toast component | sonner (via shadcn/ui integration) | 2024 | Old toast component officially deprecated |
| window.confirm() | Radix Dialog modals | Ongoing best practice | Accessible, styled, consistent UX |
| alert() | Toast notifications | Ongoing best practice | Non-blocking, dismissible, actionable |

**Deprecated/outdated:**
- shadcn/ui `@/components/ui/toast`: Deprecated. Use `@/components/ui/sonner` instead. Source: https://ui.shadcn.com/docs/components/toast

## Discretionary Decisions (Recommendations)

### Toast Library: Use Sonner

**Recommendation:** sonner (via `npx shadcn@latest add sonner`)

**Rationale:**
- shadcn/ui's own toast component is officially deprecated in favour of sonner
- Sonner has a simpler API (`toast.success("msg")` vs. the old useToast hook pattern)
- Built-in support for all user requirements: position, stacking, action buttons, richColors
- Trusted by OpenAI, Adobe, Sonos
- Direct shadcn/ui integration via CLI

### Batch Operation Feedback: Use Toasts

**Recommendation:** Use toast notifications for batch operations.

**Rationale:**
- Batch operations (move/copy videos) affect multiple items across the interface
- There is no single contextual location where inline feedback makes sense
- The existing `alert()` calls in `video-browse-page.tsx` are already in a "no obvious inline location" context
- Toast with an Undo action button is the natural pattern for batch operations
- The only 2 `alert()` calls in the codebase are both for batch move/copy/undo errors, making toast the right fit

### ML Worker TypeScript: Verify and Optionally Improve

**Recommendation:** Since zero TS errors exist, treat this as "verify and optionally improve type safety."

**Rationale:**
- The worker uses `as any` casts on lines 61, 63-64, 66, 171-172 to work around `@huggingface/transformers` complex overload types
- These casts are functional and the file compiles cleanly
- Optionally: add proper type narrowing for the pipeline output (Tensor vs Array) to reduce reliance on `as any`
- The scope can be minimal (verify) or enhanced (improve types) at planner's discretion

### Inline Feedback Component: Create Reusable InlineMessage

**Recommendation:** Extract a reusable `InlineMessage` component.

**Rationale:**
- At least 6 components already implement ad-hoc `{ type: 'success' | 'error'; text: string }` message patterns
- `backup-list.tsx`, `analysis-dashboard.tsx`, `batch-operations.tsx`, `duplicate-resolver.tsx`, `final-review.tsx` all use the same pattern
- A single reusable component eliminates duplication and ensures consistent styling
- Gradual adoption: new code uses it, existing code can be migrated opportunistically

## Open Questions

1. **Route rename scope: should `/ml-categorization` become `/ml-categorisation`?**
   - What we know: The CONTEXT.md says "everything -- UI strings, code comments, AND code identifiers." Route paths are code identifiers.
   - What's unclear: URLs are often treated as stable API contracts. This is a single-user app, so the impact is negligible.
   - Recommendation: Rename the route. It is a single-user app with no external consumers of the URL.

2. **Drizzle migration approach: single migration or multiple?**
   - What we know: Need to rename table `ml_categorizations` -> `ml_categorisations` AND update data `'Uncategorized'` -> `'Uncategorised'`. The CONTEXT says "rename column/table names to British spelling where applicable."
   - What's unclear: Whether drizzle-kit can handle table rename + data update in one migration, or if custom SQL is needed.
   - Recommendation: Use `drizzle-kit generate` for the schema rename (it handles table renames interactively), then add a custom migration for the data update, or combine both in one custom migration.

3. **Scope of "color" in non-CSS contexts**
   - What we know: 28 files match "color" but are almost entirely CSS/Tailwind tokens.
   - What's unclear: Whether any application-domain variable uses "color" in a non-CSS context (e.g., `badgeColor` meaning a semantic colour choice).
   - Recommendation: Audit the 28 files during implementation. If a variable like `triggerBadgeStyles` uses colour semantically, the variable name and comments could be updated, but the actual CSS values (`bg-blue-100`) must stay.

## Sources

### Primary (HIGH confidence)
- shadcn/ui Sonner docs: https://ui.shadcn.com/docs/components/sonner -- installation, setup, API
- shadcn/ui Toast deprecation notice: https://ui.shadcn.com/docs/components/toast -- confirmed deprecated
- Sonner official docs: https://sonner.emilkowal.ski/toast -- toast API, options, types
- Sonner Toaster docs: https://sonner.emilkowal.ski/toaster -- Toaster component props
- Codebase audit: direct file reads and grep searches across all source files

### Secondary (MEDIUM confidence)
- Drizzle ORM rename support: https://orm.drizzle.team/docs/drizzle-kit-generate -- interactive rename prompts during generation
- Multiple community sources confirming sonner as the standard React toast library

### Tertiary (LOW confidence)
- None -- all findings verified against primary sources or codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- sonner confirmed via official shadcn/ui deprecation of toast + official sonner integration docs
- Architecture: HIGH -- patterns derived from existing codebase (dialog pattern, inline feedback pattern) and official sonner docs
- Pitfalls: HIGH -- derived from direct codebase audit (exact file/line references for all changes)
- British English scope: HIGH -- comprehensive grep audit of all American spellings in codebase

**Research date:** 2026-02-08
**Valid until:** 2026-03-10 (30 days -- stable domain, no fast-moving dependencies)
