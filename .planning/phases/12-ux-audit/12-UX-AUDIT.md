# Phase 12: UX Audit

**Audit Date:** 2026-02-08
**Auditor:** Claude (automated codebase analysis)
**Reference App:** Linear
**Codebase:** Next.js 15 / React 19 / Tailwind CSS v4 / shadcn/ui

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total issues identified | 78 |
| Critical | 8 |
| Major | 32 |
| Minor | 38 |
| Pages audited | 9 (landing, dashboard, analysis, videos, ml-categorisation, ml-review, safety, sync, navigation) |
| Hardcoded gray classes | 157 across 20 files |
| Hardcoded bg-white/bg-black | 37 across 17 files |
| Hardcoded colour classes (blue/red/green/yellow) | 144 across 29 files |
| ARIA/role attributes | 18 across 9 files |
| Loader2 (inconsistent spinner) occurrences | 18 files |
| Raw `<button>/<input>/<select>` elements | 53 across 25 files |

---

## Global Issues

### G-01: Dark mode not wired up (CRITICAL) -- IN PROGRESS
- **Category:** Colour
- **Severity:** Critical
- **Description:** `next-themes` is installed but ThemeProvider was not in layout.tsx. Dark mode CSS variables exist in globals.css but never activated.
- **Current state:** No ThemeProvider wrapping app. No toggle. No suppressHydrationWarning.
- **Target state:** ThemeProvider with attribute="class", defaultTheme="system", enableSystem. Theme toggle in navigation. suppressHydrationWarning on html.
- **Status:** In progress (Plan 01, Task 1)

### G-02: 157 hardcoded gray colour classes (CRITICAL)
- **Category:** Colour
- **Severity:** Critical
- **Description:** `bg-gray-*`, `text-gray-*`, `border-gray-*` used across 20 files. These will be invisible or wrong in dark mode.
- **Current state:** Hardcoded grays: bg-gray-50, bg-gray-100, bg-gray-200, text-gray-500, text-gray-600, text-gray-900, border-gray-200, etc.
- **Target state:** All migrated to semantic tokens: bg-muted, bg-background, text-foreground, text-muted-foreground, border-border, etc.
- **Status:** Pending

### G-03: 37 hardcoded bg-white/bg-black (CRITICAL)
- **Category:** Colour
- **Severity:** Critical
- **Description:** `bg-white` used in cards, containers, and navigation. Will be stark white in dark mode.
- **Current state:** bg-white on navigation, cards, modals, containers across 17 files.
- **Target state:** bg-card for cards/containers, bg-background for page backgrounds, bg-popover for popovers.
- **Status:** Pending

### G-04: 144 hardcoded blue/red/green/yellow colours (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** Semantic colours (blue for info, green for success, red for error, yellow for warning) hardcoded as Tailwind colour classes across 29 files. Need migration to semantic tokens.
- **Current state:** bg-blue-600, text-blue-700, bg-red-50, text-green-700, bg-yellow-50, etc.
- **Target state:** bg-primary, text-primary, bg-destructive, text-destructive, bg-success, text-success, bg-warning, text-warning, bg-info, text-info using new semantic tokens.
- **Status:** Pending (semantic tokens added in Plan 01 Task 1)

### G-05: Missing semantic colour tokens (MAJOR) -- IN PROGRESS
- **Category:** Colour
- **Severity:** Major
- **Description:** No --success, --warning, or --info tokens defined. Only destructive existed.
- **Current state:** Only --destructive token for status colours.
- **Target state:** --success, --success-foreground, --warning, --warning-foreground, --info, --info-foreground in both light and dark.
- **Status:** In progress (Plan 01, Task 1)

### G-06: Inconsistent containers across pages (MAJOR)
- **Category:** Layout
- **Severity:** Major
- **Description:** Each page uses a different container strategy, creating inconsistent page widths and padding.
- **Current state:** Dashboard: max-w-6xl mx-auto. Analysis: container mx-auto. Videos: full-bleed. ML Categorisation: max-w-2xl mx-auto. ML Review: full-bleed. Safety: container mx-auto px-4. Sync: max-w-4xl mx-auto.
- **Target state:** Standard container: mx-auto max-w-7xl px-6 for normal pages. Full-bleed with internal padding for split-panel pages (Videos, Analysis, Review).
- **Status:** Pending

### G-07: Inconsistent heading sizes and weights (MAJOR)
- **Category:** Typography
- **Severity:** Major
- **Description:** Page titles use different sizes and weights across pages.
- **Current state:** Dashboard: text-3xl font-bold. Analysis: text-3xl font-bold tracking-tight. ML Categorisation: text-2xl font-bold text-gray-900. Safety: text-2xl font-bold text-gray-900. Sync: text-2xl font-bold text-gray-900.
- **Target state:** Standardised: text-2xl font-semibold tracking-tight text-foreground for all page titles.
- **Status:** Pending

### G-08: Only 18 ARIA/role attributes across 9 files (MAJOR)
- **Category:** Accessibility
- **Severity:** Major
- **Description:** Minimal accessibility attributes. Most interactive elements lack aria-labels. No skip-to-content link. Many buttons without accessible names.
- **Current state:** 18 aria-*/role= across 9 files. Most are in shadcn/ui primitives, not custom components.
- **Target state:** All interactive elements have aria-labels. Focus indicators visible. Skip-to-content link. Proper landmark roles.
- **Status:** Pending

### G-09: Lucide icons to be replaced with Phosphor (MAJOR) -- IN PROGRESS
- **Category:** Interaction
- **Severity:** Major
- **Description:** lucide-react used across the entire app. Phosphor Icons provides better weight system for visual hierarchy (thin/light/regular/bold/fill/duotone).
- **Current state:** lucide-react imported in ~20 files.
- **Target state:** All icons from @phosphor-icons/react with consistent weight conventions.
- **Status:** In progress (Phosphor installed in Plan 01 Task 1; migration planned for later)

### G-10: Inconsistent loading spinners (MAJOR) -- IN PROGRESS
- **Category:** Loading
- **Severity:** Major
- **Description:** Loader2 from lucide-react used inconsistently across 18 files. Some show text "Loading...", some show spinner, some show nothing.
- **Current state:** Loader2 with animate-spin in various sizes and colours. Some plain text loading indicators.
- **Target state:** Unified Spinner component using Phosphor CircleNotch.
- **Status:** In progress (Spinner component created in Plan 01 Task 2; adoption pending)

### G-11: Raw HTML elements instead of shadcn components (MAJOR)
- **Category:** Interaction
- **Severity:** Major
- **Description:** 53 raw `<button>`, `<input>`, and `<select>` elements across 25 files instead of shadcn/ui Button, Input, Select components.
- **Current state:** Manual styling on raw elements. Inconsistent focus rings, heights, padding.
- **Target state:** All interactive elements use shadcn/ui primitives for consistent styling and accessibility.
- **Status:** Pending

### G-12: No empty state illustrations (MINOR) -- IN PROGRESS
- **Category:** Empty State
- **Severity:** Minor
- **Description:** Empty states are plain text with no visual indication. Feels unfinished.
- **Current state:** "No videos found", "No playlists synced yet", "No consolidation proposals yet" as plain text.
- **Target state:** EmptyState component with large Phosphor icon (48px light weight), title, description, and CTA button.
- **Status:** In progress (EmptyState component created in Plan 01 Task 2; adoption pending)

---

## Per-Page Issues

---

### Landing Page (`/`)

#### LP-01: Hardcoded text colour (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** `text-gray-600` on description text. Will be invisible in dark mode.
- **Current state:** `<p className="text-xl text-gray-600">`
- **Target state:** `<p className="text-xl text-muted-foreground">`
- **Status:** Pending

#### LP-02: Hardcoded button styling (MAJOR)
- **Category:** Colour / Interaction
- **Severity:** Major
- **Description:** Sign-in link uses hardcoded `bg-blue-600 text-white` instead of Button component.
- **Current state:** `<Link className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition">`
- **Target state:** `<Button asChild><Link href="/api/auth/signin">Sign in with Google</Link></Button>`
- **Status:** Pending

#### LP-03: No branding/icon on landing page (MINOR)
- **Category:** Layout
- **Severity:** Minor
- **Description:** Landing page has no logo or visual branding. Just text and a button.
- **Current state:** Plain text heading + paragraph + link.
- **Target state:** Logo, description with value proposition, styled sign-in button.
- **Status:** Pending

#### LP-04: Excessive padding on mobile (MINOR)
- **Category:** Layout
- **Severity:** Minor
- **Description:** `p-24` is 6rem/96px padding on all sides. Too much on mobile.
- **Current state:** `<main className="flex min-h-screen flex-col items-center justify-center p-24">`
- **Target state:** Responsive padding: `px-6 py-16 md:p-24`
- **Status:** Pending

---

### Dashboard (`/dashboard`)

#### DB-01: Hardcoded background colour (CRITICAL)
- **Category:** Colour
- **Severity:** Critical
- **Description:** `bg-gray-50` page background. Will be light gray in dark mode instead of dark.
- **Current state:** `<main className="min-h-screen bg-gray-50 py-8 px-4">`
- **Target state:** `<main className="min-h-screen bg-background py-8 px-6">`
- **Status:** Pending

#### DB-02: Hardcoded card backgrounds (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** Multiple `bg-white` cards (QuotaDisplay, Data Sync, workflow cards, PlaylistList).
- **Current state:** `bg-white shadow`, `bg-white shadow-sm`
- **Target state:** `bg-card` or Card component.
- **Status:** Pending

#### DB-03: Hardcoded text colours throughout (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** `text-gray-600`, `text-gray-500`, `text-gray-900`, `text-blue-700`, `text-blue-600` throughout dashboard.
- **Current state:** 8+ hardcoded gray/blue text colours.
- **Target state:** Semantic: text-foreground, text-muted-foreground, text-primary.
- **Status:** Pending

#### DB-04: Oversized heading (MAJOR)
- **Category:** Typography
- **Severity:** Major
- **Description:** Dashboard title uses `text-3xl font-bold`. Inconsistent with other pages.
- **Current state:** `<h1 className="text-3xl font-bold">Dashboard</h1>`
- **Target state:** `<h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>`
- **Status:** Pending

#### DB-05: Container width inconsistency (MAJOR)
- **Category:** Layout
- **Severity:** Major
- **Description:** Uses `max-w-6xl` while other pages use `container`, `max-w-4xl`, `max-w-2xl`.
- **Current state:** `<div className="max-w-6xl mx-auto space-y-6">`
- **Target state:** `<div className="mx-auto max-w-7xl px-6 space-y-8">`
- **Status:** Pending

#### DB-06: Workflow step badges use hardcoded blue (MINOR)
- **Category:** Colour
- **Severity:** Minor
- **Description:** Step number badges use `bg-blue-100 text-blue-700`.
- **Current state:** Hardcoded blue badge colours.
- **Target state:** `bg-primary/10 text-primary` or similar semantic approach.
- **Status:** Pending

#### DB-07: Empty state for no playlists is plain text (MINOR)
- **Category:** Empty State
- **Severity:** Minor
- **Description:** When no playlists synced, shows plain text inside the Data Sync card.
- **Current state:** `"No playlists synced yet. Click below to fetch your YouTube data."`
- **Target state:** EmptyState component with icon, description, and SyncButton as CTA.
- **Status:** Pending

#### DB-08: QuotaDisplay progress bar uses hardcoded colours (MINOR)
- **Category:** Colour
- **Severity:** Minor
- **Description:** Progress bar uses `bg-gray-200` track and `bg-blue-600` fill.
- **Current state:** Hardcoded gray/blue progress bar.
- **Target state:** Use shadcn/ui Progress component or semantic colours.
- **Status:** Pending

#### DB-09: Lucide icons in workflow cards (MINOR)
- **Category:** Interaction
- **Severity:** Minor
- **Description:** Workflow cards use Lucide icons (BarChart3, Video, Brain, etc.).
- **Current state:** Lucide icon imports.
- **Target state:** Phosphor equivalents (ChartBar, VideoCamera, Brain, etc.).
- **Status:** Pending

---

### Analysis (`/analysis`)

#### AN-01: Heading size inconsistency (MAJOR)
- **Category:** Typography
- **Severity:** Major
- **Description:** Uses `text-3xl font-bold tracking-tight` while other pages use text-2xl.
- **Current state:** `<h1 className="text-3xl font-bold tracking-tight">`
- **Target state:** `<h1 className="text-2xl font-semibold tracking-tight">`
- **Status:** Pending

#### AN-02: Container uses generic `container mx-auto` (MAJOR)
- **Category:** Layout
- **Severity:** Major
- **Description:** Uses Tailwind `container` class which has responsive max-widths, different from other pages.
- **Current state:** `<div className="container mx-auto py-8 space-y-6">`
- **Target state:** Standardised container or full-bleed for split-panel layout.
- **Status:** Pending

#### AN-03: Empty state lacks illustration (MINOR)
- **Category:** Empty State
- **Severity:** Minor
- **Description:** No proposals state shows text in a centred flex column but no icon/illustration.
- **Current state:** Text-only empty state with AnalysisRunner below.
- **Target state:** EmptyState component with ChartBar icon and description.
- **Status:** Pending

#### AN-04: Multiple hardcoded colours in analysis components (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** staleness-banner.tsx has 6 hardcoded blue/yellow/red colours. validation-badge.tsx has 8. confidence-badge.tsx has 3. final-review.tsx has 5. category-list.tsx has 3.
- **Current state:** Hardcoded status colours across analysis components.
- **Target state:** Semantic success/warning/info/destructive tokens.
- **Status:** Pending

#### AN-05: Loader2 spinners in analysis components (MINOR)
- **Category:** Loading
- **Severity:** Minor
- **Description:** analysis-dashboard.tsx, analysis-loading.tsx, undo-banner.tsx, and others use Loader2.
- **Current state:** Inconsistent Loader2 usage.
- **Target state:** Unified Spinner component.
- **Status:** Pending

#### AN-06: Raw buttons and inputs in analysis components (MAJOR)
- **Category:** Interaction
- **Severity:** Major
- **Description:** run-analysis-button.tsx, category-list.tsx, video-list-paginated.tsx, manual-adjustments.tsx, split-wizard.tsx all use raw `<button>` or `<input>` elements with manual styling.
- **Current state:** Raw HTML elements with inconsistent styling.
- **Target state:** shadcn/ui Button, Input components.
- **Status:** Pending

#### AN-07: Sort select styling inconsistency (MINOR)
- **Category:** Interaction
- **Severity:** Minor
- **Description:** Sort/filter dropdowns use raw `<select>` elements with manual classes.
- **Current state:** Raw select with manual border/padding styling.
- **Target state:** shadcn/ui Select component or styled wrapper.
- **Status:** Pending

---

### Videos (`/videos`)

#### VD-01: Loader2 import in video-browse-page.tsx (MINOR)
- **Category:** Loading
- **Severity:** Minor
- **Description:** Uses Loader2 from lucide-react for loading state.
- **Current state:** `import { Loader2 } from 'lucide-react'`
- **Target state:** Spinner component.
- **Status:** Pending

#### VD-02: Raw input and select in video-toolbar.tsx (MAJOR)
- **Category:** Interaction
- **Severity:** Major
- **Description:** Search input and sort select use raw HTML elements.
- **Current state:** Raw `<input>` with manual classes, raw `<select>` with manual classes.
- **Target state:** shadcn/ui Input and Select components.
- **Status:** Pending

#### VD-03: Category sidebar uses raw buttons (MAJOR)
- **Category:** Interaction
- **Severity:** Major
- **Description:** category-sidebar.tsx uses raw `<button>` elements for category items.
- **Current state:** Raw buttons with manual hover/active styling.
- **Target state:** Button variant="ghost" or styled list items.
- **Status:** Pending

#### VD-04: Video cards use hardcoded bg-white (MINOR)
- **Category:** Colour
- **Severity:** Minor
- **Description:** video-card.tsx uses `bg-white` for card background.
- **Current state:** Hardcoded bg-white.
- **Target state:** bg-card.
- **Status:** Pending

#### VD-05: No empty state for "no videos" (MINOR)
- **Category:** Empty State
- **Severity:** Minor
- **Description:** When no videos match a filter or category, shows minimal text.
- **Current state:** Plain text "no videos found".
- **Target state:** EmptyState with VideoCamera icon, description, and CTA.
- **Status:** Pending

#### VD-06: Move/Copy dialog uses raw input (MINOR)
- **Category:** Interaction
- **Severity:** Minor
- **Description:** move-copy-dialog.tsx has raw `<input>` for search.
- **Current state:** Raw input with manual styling.
- **Target state:** shadcn/ui Input.
- **Status:** Pending

---

### ML Categorisation (`/ml-categorisation`)

#### MC-01: Hardcoded bg-gray-50 page background (CRITICAL)
- **Category:** Colour
- **Severity:** Critical
- **Description:** Full page background is `bg-gray-50`. Breaks dark mode completely.
- **Current state:** `<div className="min-h-screen bg-gray-50">`
- **Target state:** `<div className="min-h-screen bg-background">`
- **Status:** Pending

#### MC-02: Hardcoded header with bg-white and border-gray-200 (CRITICAL)
- **Category:** Colour
- **Severity:** Critical
- **Description:** Page header section uses `bg-white border-b border-gray-200`.
- **Current state:** `<div className="bg-white border-b border-gray-200 px-8 py-6">`
- **Target state:** `<div className="border-b border-border px-8 py-6">`
- **Status:** Pending

#### MC-03: 11 hardcoded gray colour classes (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** text-gray-900 (headings), text-gray-600 (descriptions), border-gray-200, bg-gray-50 throughout the page.
- **Current state:** Extensive hardcoded grays across the entire component.
- **Target state:** text-foreground, text-muted-foreground, border-border, bg-muted.
- **Status:** Pending

#### MC-04: 13 hardcoded blue/green/red colour classes (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** Info card uses bg-blue-50, text-blue-900, text-blue-800. Results use bg-green-50, text-green-900, text-green-700. Errors use bg-red-50, text-red-900, text-red-800. All with matching borders.
- **Current state:** Hardcoded status colours.
- **Target state:** bg-info/10, text-info, bg-success/10, text-success, bg-destructive/10, text-destructive.
- **Status:** Pending

#### MC-05: Container too narrow (MINOR)
- **Category:** Layout
- **Severity:** Minor
- **Description:** Uses `max-w-2xl mx-auto` which is 672px. Page feels cramped.
- **Current state:** `max-w-2xl` container.
- **Target state:** `max-w-7xl` standardised container, or at least `max-w-3xl` for this focused workflow.
- **Status:** Pending

#### MC-06: Raw button in categorisation-trigger.tsx (MINOR)
- **Category:** Interaction
- **Severity:** Minor
- **Description:** Uses raw `<button>` for the trigger action.
- **Current state:** Raw button with manual styling.
- **Target state:** shadcn/ui Button.
- **Status:** Pending

#### MC-07: No Suspense fallback styling (MINOR)
- **Category:** Loading
- **Severity:** Minor
- **Description:** Suspense fallback is plain `<div className="p-8">Loading ML categorisation...</div>`.
- **Current state:** Unstyled text fallback.
- **Target state:** Centred Spinner component.
- **Status:** Pending

---

### ML Review (`/ml-review`)

#### MR-01: Empty state lacks proper component (MAJOR)
- **Category:** Empty State
- **Severity:** Major
- **Description:** Empty state uses heading + paragraph + raw `<a>` link instead of EmptyState component.
- **Current state:** `<h1 className="text-2xl font-bold">No Videos to Review</h1>` with raw `<a>` link.
- **Target state:** EmptyState component with ClipboardText icon, description, and Button linking to /ml-categorisation.
- **Status:** Pending

#### MR-02: Raw `<a>` tag for navigation (MINOR)
- **Category:** Interaction
- **Severity:** Minor
- **Description:** "Go to ML Categorisation" uses raw `<a>` tag.
- **Current state:** `<a href="/ml-categorisation" className="text-primary hover:underline text-sm">`
- **Target state:** `<Button variant="link" asChild><Link href="/ml-categorisation">...</Link></Button>`
- **Status:** Pending

#### MR-03: Review cards use hardcoded colours (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** review-card.tsx uses 4 hardcoded colour occurrences (bg-white, text colours). review-modal.tsx uses 4 hardcoded colours.
- **Current state:** Mix of semantic and hardcoded colours.
- **Target state:** All semantic tokens.
- **Status:** Pending

#### MR-04: Raw buttons in review-page.tsx (MINOR)
- **Category:** Interaction
- **Severity:** Minor
- **Description:** Filter buttons in review-page.tsx use raw `<button>` with `bg-secondary` class.
- **Current state:** `<button className="... bg-secondary ...">`
- **Target state:** `<Button variant="secondary">` or `<Button variant="outline">`.
- **Status:** Pending

#### MR-05: Category picker uses raw inputs (MINOR)
- **Category:** Interaction
- **Severity:** Minor
- **Description:** category-picker-dialog.tsx has raw `<input>` and `<button>` elements.
- **Current state:** Raw elements with manual styling.
- **Target state:** shadcn/ui Input, Button.
- **Status:** Pending

#### MR-06: Settings icon from Lucide (MINOR)
- **Category:** Interaction
- **Severity:** Minor
- **Description:** review-page.tsx imports Settings from lucide-react.
- **Current state:** Lucide Settings icon.
- **Target state:** Phosphor GearSix icon.
- **Status:** Pending

---

### Safety (`/safety`)

#### SF-01: Page header uses hardcoded colours (CRITICAL)
- **Category:** Colour
- **Severity:** Critical
- **Description:** `text-gray-900` for heading and `text-gray-500` for description. Will be invisible in dark mode on dark background.
- **Current state:** `<h1 className="text-2xl font-bold text-gray-900">` and `<p className="text-sm text-gray-500 mt-1">`
- **Target state:** `text-foreground` and `text-muted-foreground`.
- **Status:** Pending

#### SF-02: Tab content panels use bg-white with border-gray-200 (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** All three tab content panels use `bg-white` with `border-gray-200`.
- **Current state:** `<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">`
- **Target state:** `<div className="rounded-lg border border-border bg-card p-6 shadow-sm">`
- **Status:** Pending

#### SF-03: Lucide icons in tabs (MINOR)
- **Category:** Interaction
- **Severity:** Minor
- **Description:** HardDrive, ScrollText, Clock from lucide-react in tab triggers.
- **Current state:** Lucide icon imports.
- **Target state:** Phosphor equivalents (HardDrive/Database, Scroll, Clock).
- **Status:** Pending

#### SF-04: 18 hardcoded colours in backup-list.tsx (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** Extensive hardcoded grays and status colours in backup list.
- **Current state:** bg-gray-*, text-gray-*, bg-green-*, bg-red-*, bg-blue-* throughout.
- **Target state:** Semantic tokens.
- **Status:** Pending

#### SF-05: 17 hardcoded colours in operation-log-table.tsx (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** Operation log uses hardcoded colours for status badges and text.
- **Current state:** bg-gray-*, text-gray-*, status-specific colours.
- **Target state:** Semantic tokens with Badge component.
- **Status:** Pending

#### SF-06: 8 hardcoded colours in pending-changes.tsx (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** Pending changes summary uses hardcoded colours.
- **Current state:** bg-gray-*, text-gray-*, status colours.
- **Target state:** Semantic tokens.
- **Status:** Pending

#### SF-07: Raw buttons in backup-list.tsx (MINOR)
- **Category:** Interaction
- **Severity:** Minor
- **Description:** Backup list uses raw `<button>` elements for restore/download actions.
- **Current state:** Raw buttons with manual styling.
- **Target state:** shadcn/ui Button.
- **Status:** Pending

#### SF-08: Container uses `container mx-auto px-4` (MINOR)
- **Category:** Layout
- **Severity:** Minor
- **Description:** Inconsistent with standardised container approach.
- **Current state:** `container mx-auto px-4`
- **Target state:** `mx-auto max-w-7xl px-6`
- **Status:** Pending

---

### Sync (`/sync`)

#### SY-01: Page header uses hardcoded colours (CRITICAL)
- **Category:** Colour
- **Severity:** Critical
- **Description:** `text-gray-900` heading and `text-gray-500` description.
- **Current state:** `<h1 className="text-2xl font-bold text-gray-900">` and `<p className="text-sm text-gray-500 mt-1">`
- **Target state:** `text-foreground` and `text-muted-foreground`.
- **Status:** Pending

#### SY-02: Container uses max-w-4xl (MINOR)
- **Category:** Layout
- **Severity:** Minor
- **Description:** Uses `max-w-4xl` while standard is `max-w-7xl`.
- **Current state:** `<div className="max-w-4xl mx-auto py-8 px-4">`
- **Target state:** Standardised container.
- **Status:** Pending

#### SY-03: sync-preview.tsx -- 28 hardcoded gray classes (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** sync-preview.tsx alone has 28 hardcoded gray classes and 14 coloured classes. Most hardcoded file in the codebase.
- **Current state:** Extensive bg-white, bg-gray-*, text-gray-*, border-gray-*, bg-blue-*, text-blue-*, bg-green-*, text-green-*.
- **Target state:** All semantic tokens.
- **Status:** Pending

#### SY-04: sync-progress.tsx -- 15 hardcoded gray + 21 colour classes (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** Progress display has extensive hardcoded colours.
- **Current state:** bg-white, bg-gray-*, text-gray-*, status colours.
- **Target state:** Semantic tokens, Spinner component.
- **Status:** Pending

#### SY-05: sync-report.tsx -- 30 hardcoded gray + 15 colour classes (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** Sync report is the most colour-heavy component. 30 gray + 15 coloured classes.
- **Current state:** Extensive hardcoded colours for stats, badges, progress indicators.
- **Target state:** Semantic tokens.
- **Status:** Pending

#### SY-06: Raw buttons and inputs in sync components (MAJOR)
- **Category:** Interaction
- **Severity:** Major
- **Description:** sync-preview, sync-progress, sync-report all use raw `<button>` elements. sync-page-client.tsx has raw elements.
- **Current state:** Raw interactive elements with manual styling.
- **Target state:** shadcn/ui Button.
- **Status:** Pending

#### SY-07: Loader2 in sync components (MINOR)
- **Category:** Loading
- **Severity:** Minor
- **Description:** sync-progress.tsx and sync-preview.tsx use Loader2.
- **Current state:** Loader2 with animate-spin.
- **Target state:** Spinner component.
- **Status:** Pending

---

### Navigation

#### NV-01: Hardcoded bg-white (CRITICAL)
- **Category:** Colour
- **Severity:** Critical
- **Description:** Navigation bar uses `bg-white shadow-sm`. Will be stark white in dark mode.
- **Current state:** `<nav className="border-b bg-white shadow-sm">`
- **Target state:** `<nav className="border-b bg-card shadow-sm">` or `bg-background`.
- **Status:** Pending

#### NV-02: Hardcoded gray text colours (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** Nav links use `text-gray-600`, `hover:bg-gray-50`, `hover:text-gray-900`.
- **Current state:** Hardcoded grays for inactive/hover states.
- **Target state:** text-muted-foreground, hover:bg-accent, hover:text-accent-foreground.
- **Status:** Pending

#### NV-03: Active link uses hardcoded blue (MAJOR)
- **Category:** Colour
- **Severity:** Major
- **Description:** Active nav link uses `bg-blue-50 text-blue-700`.
- **Current state:** Hardcoded blue for active state.
- **Target state:** `bg-accent text-accent-foreground` or `bg-primary/10 text-primary`.
- **Status:** Pending

#### NV-04: Sign out uses raw `<a>` tag (MINOR)
- **Category:** Interaction
- **Severity:** Minor
- **Description:** Sign out link is a raw `<a>` tag instead of Button component.
- **Current state:** `<a href="/api/auth/signout" className="...">`
- **Target state:** Button variant="ghost" or proper link component.
- **Status:** Pending

#### NV-05: Logo gradient uses hardcoded blue-purple (MINOR)
- **Category:** Colour
- **Severity:** Minor
- **Description:** Logo badge uses `bg-gradient-to-br from-blue-600 to-purple-600`.
- **Current state:** Hardcoded gradient.
- **Target state:** Logo remains branded (intentional hardcoded colour is acceptable for brand) or migrate to primary gradient.
- **Status:** Pending

#### NV-06: Lucide icons throughout navigation (MINOR)
- **Category:** Interaction
- **Severity:** Minor
- **Description:** All 8 nav icons from lucide-react.
- **Current state:** LayoutDashboard, BarChart3, Video, Brain, ClipboardCheck, Shield, RefreshCw, LogOut.
- **Target state:** Phosphor equivalents.
- **Status:** Pending

#### NV-07: No theme toggle in navigation (MINOR) -- IN PROGRESS
- **Category:** Interaction
- **Severity:** Minor
- **Description:** No way for user to toggle between light and dark mode.
- **Current state:** No toggle. ThemeToggle component created but not placed in nav.
- **Target state:** ThemeToggle component added next to sign-out button.
- **Status:** In progress (ThemeToggle created; placement planned for later)

#### NV-08: Mobile nav items overflow on small screens (MINOR)
- **Category:** Layout
- **Severity:** Minor
- **Description:** 7 nav items + sign out may overflow on narrow screens. Icons are hidden on mobile but text labels still show.
- **Current state:** `hidden sm:block` on labels, but space may still be tight.
- **Target state:** Compact layout with icons only on mobile, tooltip for labels, or responsive grouping.
- **Status:** Pending

---

## Status Legend

| Status | Meaning |
|--------|---------|
| **Pending** | Issue identified, not yet addressed |
| **In progress** | Work underway in current or upcoming plan |
| **Fixed** | Issue resolved and committed |

---

## Fix Priority Order

1. **Dark mode activation + semantic colour tokens** (G-01, G-05) -- Plan 01
2. **Reusable components** (G-10, G-12) -- Plan 01
3. **Phosphor Icons installation** (G-09) -- Plan 01
4. **Navigation dark mode + icons + theme toggle** (NV-01 through NV-08)
5. **Per-page colour migration** (G-02, G-03, G-04 and all page-specific colour issues)
6. **Container/layout standardisation** (G-06, G-07)
7. **Raw element replacement** (G-11)
8. **Empty state adoption** (all *-05 empty state issues)
9. **Spinner adoption** (all loading issues)
10. **Accessibility pass** (G-08)
11. **Responsive polish** (LP-04, NV-08)

---

*Last updated: 2026-02-08*
*Next update: After each plan completion*
