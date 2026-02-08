---
phase: 12-ux-audit
plan: 01
subsystem: ui
tags: [dark-mode, next-themes, phosphor-icons, tailwind-css-v4, design-system, accessibility-audit]

# Dependency graph
requires:
  - phase: 11-ux-refinements
    provides: Polished UI baseline (checkbox/approval separation, visual refinements)
provides:
  - ThemeProvider wrapping app with system preference detection and class-based dark mode
  - Semantic colour tokens (success, warning, info) in both light and dark modes
  - Phosphor Icons installed with app-wide IconContext defaults
  - ThemeToggle component for light/dark switching
  - Reusable Spinner component (replaces Loader2 pattern)
  - Reusable EmptyState component (icon + title + description + optional CTA)
  - Comprehensive UX audit document cataloguing 78 issues across 9 pages
affects: [12-02 through 12-06, all subsequent Phase 12 plans depend on these foundations]

# Tech tracking
tech-stack:
  added: ["@phosphor-icons/react ^2.1.10"]
  patterns: ["ThemeProvider + class-based dark mode via next-themes", "IconContext.Provider for app-wide Phosphor defaults", "Semantic colour tokens (success/warning/info) in oklch", "Spinner component pattern (CircleNotch + animate-spin)", "EmptyState component pattern (icon 48px light + title + description + CTA)"]

key-files:
  created:
    - src/components/theme-toggle.tsx
    - src/components/icon-provider.tsx
    - src/components/ui/empty-state.tsx
    - src/components/ui/spinner.tsx
    - .planning/phases/12-ux-audit/12-UX-AUDIT.md
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
    - package.json

key-decisions:
  - "IconContext.Provider wrapped in client component (icon-provider.tsx) because Phosphor uses createContext which fails in Server Components"
  - "ThemeToggle uses mounted state pattern to avoid SSR hydration mismatch"
  - "EmptyState accepts generic icon prop for flexibility across all Phosphor icons"

patterns-established:
  - "Pattern: Client wrapper for React Context providers that need to be used in Server Component layout"
  - "Pattern: Mounted guard for client-only hooks (useTheme) to prevent hydration mismatch"
  - "Pattern: Semantic colour tokens follow existing oklch format with --name and --name-foreground pairs"

# Metrics
duration: 12min
completed: 2026-02-08
---

# Phase 12 Plan 01: UX Audit Foundation Summary

**Dark mode infrastructure (ThemeProvider + semantic tokens + toggle), Phosphor Icons installed with app-wide defaults, reusable EmptyState/Spinner components, and 78-issue UX audit document**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-08T15:47:41Z
- **Completed:** 2026-02-08T15:59:26Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- ThemeProvider wraps entire app with attribute="class", defaultTheme="system", and suppressHydrationWarning to prevent FOUC
- Semantic colour tokens (success, warning, info) added in both light and dark modes using oklch colour space
- Phosphor Icons installed and IconContext.Provider sets app-wide defaults (size: 20, weight: "regular")
- ThemeToggle component created with Sun/Moon icons, CSS transitions, and mounted state hydration guard
- Reusable Spinner component replaces inconsistent Loader2 pattern across the app
- Reusable EmptyState component with large icon, title, description, and optional CTA (href or onClick)
- Comprehensive UX audit document catalogues 78 issues: 8 critical, 32 major, 38 minor across 9 pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Phosphor Icons, wire ThemeProvider, add semantic colour tokens** - `3465850` (feat)
2. **Task 2: Create shared EmptyState and Spinner components** - `7e16ed0` (feat)
3. **Task 3: Create formal UX audit document** - `2888477` (docs)

## Files Created/Modified
- `src/app/globals.css` - Added success/warning/info semantic tokens to :root, .dark, and @theme inline blocks
- `src/app/layout.tsx` - ThemeProvider wrapping, IconProvider wrapping, suppressHydrationWarning on html
- `src/components/theme-toggle.tsx` - Client component with useTheme, Sun/Moon toggle, mounted guard
- `src/components/icon-provider.tsx` - Client wrapper for Phosphor IconContext.Provider
- `src/components/ui/spinner.tsx` - Reusable spinner using Phosphor CircleNotch with animate-spin
- `src/components/ui/empty-state.tsx` - Reusable empty state with icon, title, description, optional CTA
- `package.json` - Added @phosphor-icons/react dependency
- `.planning/phases/12-ux-audit/12-UX-AUDIT.md` - Comprehensive 691-line UX audit document

## Decisions Made
- **IconContext.Provider requires client wrapper:** Phosphor's IconContext uses React.createContext which fails in Server Components. Created a dedicated `icon-provider.tsx` client component to wrap it. This is the standard pattern for React Context providers in Next.js App Router.
- **Mounted state guard for ThemeToggle:** useTheme returns undefined on server. Using useState + useEffect mounted pattern prevents hydration mismatch and renders a placeholder button until client hydration completes.
- **EmptyState icon prop is generic:** Accepts any component matching `{ size?: number; weight?: string; className?: string }` interface, making it compatible with all Phosphor icons without tight coupling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created IconProvider client component wrapper**
- **Found during:** Task 1 (wiring IconContext.Provider in layout.tsx)
- **Issue:** Build failed with `(0, c(...).createContext) is not a function` because Phosphor's IconContext uses createContext which cannot run in Server Components (layout.tsx is a Server Component)
- **Fix:** Created `src/components/icon-provider.tsx` as a 'use client' wrapper that imports and renders IconContext.Provider
- **Files modified:** src/components/icon-provider.tsx (created), src/app/layout.tsx (import updated)
- **Verification:** `npm run build` succeeds with zero errors
- **Committed in:** 3465850 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Standard Next.js pattern for Context providers in App Router. No scope creep. Build would have failed without this fix.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dark mode infrastructure is fully wired and ready for per-page colour migration
- Phosphor Icons installed and ready for Lucide-to-Phosphor icon migration across all components
- EmptyState and Spinner components ready for adoption across all pages
- UX audit document provides the complete issue backlog for subsequent plans to work through
- All 78 issues are tracked with severity, status, and target state

---
*Phase: 12-ux-audit*
*Completed: 2026-02-08*
