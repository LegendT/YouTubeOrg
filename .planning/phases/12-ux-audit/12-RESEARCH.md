# Phase 12: UX Audit - Research

**Researched:** 2026-02-08
**Domain:** UX audit, design systems, accessibility, dark mode, icon libraries, spacing systems
**Confidence:** HIGH

## Summary

This phase is a comprehensive UX audit and polish pass across all user-facing pages. The codebase has 8 page routes (landing, dashboard, analysis, videos, ml-categorisation, ml-review, safety, sync), a top navbar, 13 shadcn/ui primitives, and ~65 custom components. The primary tech stack is Next.js 15 (App Router + Turbopack), React 19, Tailwind CSS v4, and shadcn/ui.

The current UI has significant inconsistency: a mix of hardcoded colours (`bg-gray-50`, `text-gray-900`, `bg-white`) alongside semantic tokens (`bg-card`, `text-muted-foreground`, `bg-background`). Dark mode CSS variables are defined in `globals.css` but never activated -- `next-themes` is installed but not wired up (no `ThemeProvider`). Page layouts use inconsistent containers (`max-w-6xl`, `max-w-4xl`, `max-w-2xl`, `container mx-auto`) and inconsistent heading sizes (`text-3xl` on some pages, `text-2xl` on others). Accessibility is minimal -- only 16 `aria-*`/`role=` attributes across 8 files. Empty states are plain text with no illustrations or CTAs. Loading states inconsistently use `Loader2` spinners.

**Primary recommendation:** Audit all pages systematically (document every issue first), then fix in priority order: (1) dark mode activation + semantic colour migration, (2) icon library swap, (3) spacing/typography system, (4) page layout standardisation, (5) accessibility pass, (6) empty states + loading states + error patterns, (7) responsive polish.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| next-themes | ^0.4.6 | Dark/light mode toggle with system detection | **Installed but NOT wired up**. Needs ThemeProvider in layout.tsx |
| tailwindcss | ^4.1.18 | Utility-first CSS framework | v4 with `@import "tailwindcss"` syntax |
| shadcn/ui | N/A (copy-paste) | Base component library | 13 primitives installed; needs expansion |
| react-hotkeys-hook | ^5.2.4 | Keyboard shortcuts | Used in analysis + ml-review pages |
| sonner | ^2.0.7 | Toast notifications | Configured in layout.tsx |
| lucide-react | ^0.563.0 | Icon library | **To be replaced** per user decision |

### New (To Install)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @phosphor-icons/react | latest | Icon library replacement | **Recommended.** 9,000+ icons in 6 weights (thin, light, regular, bold, fill, duotone). Weight system enables visual hierarchy -- e.g. `regular` for nav, `bold` for primary actions, `light` for secondary. Closest match to Linear's clean aesthetic. Tree-shakeable. IconContext.Provider for app-wide defaults. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Phosphor Icons | Heroicons | Only 450+ icons, 2 weights (outline/solid). Better Tailwind integration but far fewer icons and no weight variety. |
| Phosphor Icons | Lucide (keep) | Already installed. 1,500+ icons, consistent stroke style. But only 1 weight -- no hierarchy. Not as close to Linear aesthetic. |

**Installation:**
```bash
npm install @phosphor-icons/react
```

## Architecture Patterns

### Pattern 1: Dark Mode Activation with next-themes

**What:** Wire up ThemeProvider in root layout, add theme toggle to navigation.
**When to use:** Before any dark-mode-specific work begins -- everything depends on this.

**Setup in layout.tsx:**
```tsx
// Source: Context7 /pacocoursey/next-themes
import { ThemeProvider } from 'next-themes'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Navigation />
          {children}
          <Toaster ... />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Theme toggle component:**
```tsx
// Source: Context7 /pacocoursey/next-themes
'use client'
import { useTheme } from 'next-themes'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <button onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}>
      {/* Toggle icon */}
    </button>
  )
}
```

**Tailwind v4 integration:** The `@custom-variant dark (&:is(.dark *));` line in `globals.css` already defines how `dark:` classes work -- it targets descendants of `.dark` class on `<html>`. This is compatible with next-themes `attribute="class"`.

### Pattern 2: Semantic Colour Migration

**What:** Replace all hardcoded Tailwind colours (`bg-gray-50`, `text-gray-900`, `bg-white`, `text-blue-700`, etc.) with semantic tokens (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, etc.).
**When to use:** During the dark mode pass -- every hardcoded colour will break in dark mode.

**Current state audit:**
- 157 occurrences of `bg-gray-*` / `text-gray-*` / `border-gray-*` across 20 files
- 37 occurrences of `bg-white` / `bg-black` across 17 files
- 138 occurrences of hardcoded blue/red/green/yellow colours across 28 files
- 189 occurrences already using semantic tokens (good baseline)

**Migration mapping:**
| Hardcoded | Semantic Replacement |
|-----------|---------------------|
| `bg-white` | `bg-card` or `bg-background` |
| `bg-gray-50` | `bg-muted` or `bg-background` |
| `bg-gray-100` | `bg-muted` |
| `bg-gray-200` | `bg-border` or `bg-muted` |
| `text-gray-900` | `text-foreground` |
| `text-gray-600` | `text-muted-foreground` |
| `text-gray-500` | `text-muted-foreground` |
| `border-gray-200` | `border-border` |
| `bg-blue-600` | `bg-primary` |
| `text-blue-700` | `text-primary` |
| `bg-blue-50` | `bg-primary/10` or new semantic token |
| `bg-red-50` / `text-red-*` | `bg-destructive/10` / `text-destructive` |
| `bg-green-50` / `text-green-*` | Define new `--success` semantic token |

**New semantic tokens needed in globals.css:**
```css
:root {
  --success: oklch(0.55 0.15 145);       /* green for success states */
  --success-foreground: oklch(0.985 0 0);
  --warning: oklch(0.75 0.15 85);         /* amber for warnings */
  --warning-foreground: oklch(0.25 0 0);
  --info: oklch(0.6 0.15 250);            /* blue for info states */
  --info-foreground: oklch(0.985 0 0);
}
.dark {
  --success: oklch(0.65 0.15 145);
  --success-foreground: oklch(0.15 0 0);
  --warning: oklch(0.70 0.15 85);
  --warning-foreground: oklch(0.15 0 0);
  --info: oklch(0.55 0.15 250);
  --info-foreground: oklch(0.985 0 0);
}
```

### Pattern 3: Phosphor Icons Migration

**What:** Replace lucide-react imports with @phosphor-icons/react across all files.
**When to use:** After installing Phosphor, as a dedicated migration task.

**Setup with IconContext for app-wide defaults:**
```tsx
// Source: Context7 /phosphor-icons/react
import { IconContext } from "@phosphor-icons/react";

// In layout or provider:
<IconContext.Provider value={{ size: 20, weight: "regular" }}>
  {children}
</IconContext.Provider>
```

**Icon weight convention for Linear aesthetic:**
| Context | Weight | Size | Example |
|---------|--------|------|---------|
| Navigation icons | `regular` | 20px | Sidebar/navbar links |
| Button icons (primary) | `bold` | 16px | Primary action buttons |
| Button icons (secondary) | `regular` | 16px | Secondary/ghost buttons |
| Inline status icons | `regular` | 16px | Badges, status indicators |
| Page header icons | `regular` | 24px | Page title icons |
| Empty state illustrations | `light` or `thin` | 48-64px | Large illustrative icons |
| Fill/toggle state | `fill` | 16-20px | Active/selected states |

**Lucide-to-Phosphor mapping (common icons used in codebase):**
| Lucide | Phosphor Equivalent |
|--------|-------------------|
| `LayoutDashboard` | `SquaresFour` |
| `BarChart3` | `ChartBar` |
| `Video` | `VideoCamera` |
| `Brain` | `Brain` |
| `ClipboardCheck` | `ClipboardText` |
| `Shield` | `Shield` |
| `RefreshCw` | `ArrowsClockwise` |
| `LogOut` | `SignOut` |
| `Loader2` | `CircleNotch` (with animate-spin) |
| `Check` | `Check` |
| `X` | `X` |
| `Plus` | `Plus` |
| `Merge` | `GitMerge` |
| `Settings` | `GearSix` |
| `HardDrive` | `HardDrive` or `Database` |
| `ScrollText` | `Scroll` |
| `Clock` | `Clock` |
| `ChevronDown` | `CaretDown` |
| `Search` | `MagnifyingGlass` |

### Pattern 4: Standardised Page Layout

**What:** Consistent page structure across all authenticated pages.
**When to use:** During page-level audit pass.

**Standard template:**
```tsx
<main className="min-h-[calc(100vh-4rem)] bg-background">
  <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
    {/* Page header: title top-left, description below, primary action top-right */}
    <header className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Page Title
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Page description goes here
        </p>
      </div>
      <div className="flex items-center gap-3">
        {/* Primary action button(s) */}
      </div>
    </header>

    {/* Page content */}
    {children}
  </div>
</main>
```

**Current inconsistencies found:**
| Page | Container | Title Size | BG Colour | Description Colour |
|------|-----------|------------|-----------|-------------------|
| Dashboard | `max-w-6xl mx-auto` | `text-3xl font-bold` | `bg-gray-50` | `text-gray-600` |
| Analysis | `container mx-auto` | `text-3xl font-bold tracking-tight` | none | `text-muted-foreground` |
| Videos | none (full-bleed) | none (delegated) | none | none |
| ML Categorisation | `max-w-2xl mx-auto` | `text-2xl font-bold text-gray-900` | `bg-gray-50` | `text-sm text-gray-600` |
| ML Review | none (full-bleed) | `text-2xl font-bold` | none | `text-muted-foreground` |
| Safety | `container mx-auto px-4` | `text-2xl font-bold text-gray-900` | none | `text-sm text-gray-500` |
| Sync | `max-w-4xl mx-auto` | `text-2xl font-bold text-gray-900` | none | `text-sm text-gray-500` |

**Standardise to:**
- Container: `mx-auto max-w-7xl px-6` (for normal pages); full-bleed with internal padding for split-panel pages (Videos, Analysis, Review)
- Title: `text-2xl font-semibold tracking-tight` (Linear uses medium-weight headings, not bold)
- Description: `text-sm text-muted-foreground`
- Background: `bg-background` (semantic)
- Spacing: `py-8` page padding, `space-y-8` between major sections

### Pattern 5: Spacing System with clamp() and rems

**What:** Establish consistent spacing scale using rem units with optional fluid scaling via clamp().
**When to use:** Applied to all layout, padding, margin, and gap values.

**Spacing scale (8pt base with 4pt half-steps):**
| Token | Value | Use Case |
|-------|-------|----------|
| `space-1` | `0.25rem` (4px) | Icon gaps, tight inline spacing |
| `space-2` | `0.5rem` (8px) | Small gaps between related items |
| `space-3` | `0.75rem` (12px) | Compact card padding |
| `space-4` | `1rem` (16px) | Default element spacing |
| `space-6` | `1.5rem` (24px) | Section gaps, card content padding |
| `space-8` | `2rem` (32px) | Page section spacing |
| `space-12` | `3rem` (48px) | Major section breaks |
| `space-16` | `4rem` (64px) | Page top/bottom padding |

These are already available in Tailwind (`p-1` through `p-16`). The key is **consistent application**, not new tokens.

**Typography scale (Linear-inspired):**
| Element | Class | Font Size |
|---------|-------|-----------|
| Page title | `text-2xl font-semibold tracking-tight` | 1.5rem / 24px |
| Section heading | `text-lg font-semibold` | 1.125rem / 18px |
| Card title | `text-base font-medium` | 1rem / 16px |
| Body text | `text-sm` | 0.875rem / 14px |
| Caption/meta | `text-xs` | 0.75rem / 12px |

### Pattern 6: Empty State with Illustration + CTA

**What:** Consistent empty state component with large Phosphor icon, explanatory text, and CTA button.
**When to use:** Every page that can have an empty data state.

**Component pattern:**
```tsx
interface EmptyStateProps {
  icon: React.ComponentType<{ size?: number; weight?: string }>
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon size={48} weight="light" className="text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {action && (
        action.href ? (
          <Link href={action.href}>
            <Button>{action.label}</Button>
          </Link>
        ) : (
          <Button onClick={action.onClick}>{action.label}</Button>
        )
      )}
    </div>
  )
}
```

**Current empty states that need upgrading:**
| Location | Current | Needs |
|----------|---------|-------|
| Videos page (no videos) | "No videos found" text | Icon + description + CTA to sync |
| ML Review (no results) | Basic heading + link | Icon + description + Button to ML categorisation |
| Analysis (no proposals) | Inline text | Already decent, but needs icon |
| Dashboard (no playlists) | Inline text | Icon + description + sync CTA |

### Pattern 7: Button Hierarchy

**What:** Consistent application of button variants across the entire app.
**When to use:** Every button, link-styled-as-button, and action trigger.

**Hierarchy (using existing shadcn/ui Button variants):**
| Variant | Use Case | Example |
|---------|----------|---------|
| `default` (primary) | One primary action per view | "Start Sync", "Run Analysis", "Save" |
| `secondary` | Supporting actions | "Export", "Refresh" |
| `outline` | Alternative/neutral actions | "Cancel", "Clear", layout toggles |
| `ghost` | Tertiary/inline actions | Navigation items, icon-only actions |
| `destructive` | Dangerous actions | "Delete", "Remove" |
| `link` | Navigation-style text actions | "View all", "Go to page" |

**Current issues:**
- Navigation uses raw `<a>` tags instead of ghost Button
- Some pages use raw `<button>` elements with custom classes instead of Button component
- ML Review has `<button>` with inline `bg-secondary` instead of `<Button variant="secondary">`
- Landing page uses raw `<Link>` with manual blue styling instead of Button

### Anti-Patterns to Avoid

- **Hardcoded colours in dark mode:** Never use `bg-white`, `text-gray-900`, `bg-gray-50`, etc. These will be invisible/wrong in dark mode. Always use semantic tokens.
- **Inconsistent loading indicators:** Some components show `Loader2` spinner, some show text "Loading...", some show nothing. Standardise to one pattern.
- **Raw HTML elements for interactive UI:** Use shadcn/ui `Button`, `Input`, etc. instead of `<button>`, `<input>` with manual styles.
- **Mixing container strategies:** Don't use `container mx-auto` on one page and `max-w-6xl mx-auto` on another. Pick one approach per page type.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dark/light theme toggle | Custom localStorage + class toggle | next-themes ThemeProvider | Handles SSR hydration, system preference, flash-of-wrong-theme, localStorage sync |
| Icon system | Custom SVG components | @phosphor-icons/react with IconContext | Tree-shaking, consistent sizing, weight variants, accessibility (alt prop) |
| Focus management | Manual focus trap code | Radix UI primitives (already used via shadcn/ui Dialog, DropdownMenu) | Radix handles focus trapping, keyboard navigation, scroll lock |
| Toast notifications | Custom notification system | sonner (already installed) | Already configured, supports rich toasts, positioning, auto-dismiss |
| Responsive grid | Custom breakpoint logic | Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) + existing `useColumnCount` hook | Already proven in VideoGrid; extend pattern to other grids |
| Keyboard shortcut system | Custom event listeners | react-hotkeys-hook (already installed) | Already used in analysis/ml-review; extend to standardise across app |
| Accessible components | Manual aria attributes | shadcn/ui (Radix primitives) | Radix provides ARIA attributes, keyboard navigation, screen reader support out-of-the-box |
| Empty state illustrations | External illustration service or custom SVG art | Phosphor Icons at large size (48-64px, `light`/`thin` weight) | Simple, consistent, no external dependencies, matches icon set |

**Key insight:** The app already has most of the right libraries installed. The problem is inconsistent application, not missing tools. The audit is primarily about standardisation and gap-filling, not introducing new architectural patterns.

## Common Pitfalls

### Pitfall 1: Dark Mode Flash (FOUC)
**What goes wrong:** Page loads in light mode, then flashes to dark mode after JS hydrates.
**Why it happens:** Without `suppressHydrationWarning` on `<html>` and next-themes' injected script, the server-rendered HTML doesn't know the user's theme preference.
**How to avoid:** Add `suppressHydrationWarning` to `<html>` tag (mandatory for next-themes). The ThemeProvider injects a `<script>` tag that sets the class before first paint.
**Warning signs:** Visible colour flash on page load; user complaints about flickering.

### Pitfall 2: Hardcoded Colours Surviving Migration
**What goes wrong:** After "completing" the dark mode migration, some elements are invisible or wrong-coloured in dark mode.
**Why it happens:** Hardcoded colours like `bg-white`, `bg-gray-50`, `text-gray-900` are buried in component files and easy to miss.
**How to avoid:** Run a systematic grep for all hardcoded colour classes. The audit found 157 gray, 37 white/black, and 138 other hardcoded colours -- every one must be migrated.
**Warning signs:** Any Tailwind class with a colour name (not a semantic token) in a component file.

### Pitfall 3: Tailwind v4 Dark Mode Variant
**What goes wrong:** `dark:` classes don't apply.
**Why it happens:** Tailwind v4 uses `@custom-variant` instead of `darkMode: 'class'` in config. The project already has `@custom-variant dark (&:is(.dark *));` in globals.css -- this is correct. But `tailwind.config.ts` still exists (legacy v3 config) and may cause confusion.
**How to avoid:** Don't add `darkMode` to `tailwind.config.ts`. The v4 `@custom-variant` in CSS takes precedence. The existing config file is effectively unused by Tailwind v4 (which reads `globals.css` directly).
**Warning signs:** `dark:` utility classes not working; check that the `.dark` class is being added to `<html>` by next-themes.

### Pitfall 4: Accessibility Regression During Redesign
**What goes wrong:** Visual polish breaks keyboard navigation or screen reader support.
**Why it happens:** Changing button/link structure, adding decorative elements, or restructuring layouts can remove focus indicators, break tab order, or hide content from assistive technology.
**How to avoid:** Test keyboard navigation after every significant layout change. Ensure all interactive elements are focusable. Use `focus-visible:` for focus indicators (not `:focus`). Run axe DevTools after each page is updated.
**Warning signs:** Can't Tab to a button; focus ring is invisible; screen reader announces wrong content.

### Pitfall 5: Icon Library Migration Breaking Imports
**What goes wrong:** Build fails or runtime errors after swapping icon libraries.
**Why it happens:** Lucide and Phosphor have different import names. A find-and-replace can miss edge cases or create wrong mappings.
**How to avoid:** Map every Lucide import to its Phosphor equivalent before starting. Do the migration file-by-file, not with a global find-and-replace. Build after each file group to catch errors early.
**Warning signs:** `Module not found` errors; icons not rendering; wrong icon displayed.

### Pitfall 6: z-index Conflicts with Sticky/Fixed Elements
**What goes wrong:** Toasts, modals, or sticky toolbars overlap incorrectly after layout changes.
**Why it happens:** The app has sticky batch toolbars, fixed navigation, toast notifications, and modal dialogs -- all competing for z-index space.
**How to avoid:** Establish a z-index scale: navbar (40), sticky toolbars (30), toasts (50), modal overlay (50), modal content (50). sonner already uses z-index 999+ internally.
**Warning signs:** Elements appearing behind other elements; modals not covering the navbar.

### Pitfall 7: next-themes useTheme on Server Components
**What goes wrong:** `useTheme()` causes hydration errors or crashes when used in a Server Component.
**Why it happens:** `useTheme()` is a client-only hook. next-themes requires the toggle component to be a Client Component (`'use client'`).
**How to avoid:** Keep the theme toggle in a dedicated `'use client'` component. Never import `useTheme` in Server Components.
**Warning signs:** Hydration mismatch errors; "useContext is not a function" errors.

## Code Examples

### Theme Toggle (to add to Navigation)
```tsx
// Source: Context7 /pacocoursey/next-themes
'use client'
import { useTheme } from 'next-themes'
import { SunIcon, MoonIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
      aria-label="Toggle theme"
    >
      <SunIcon weight="regular" className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <MoonIcon weight="regular" className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
```

### Phosphor Icons with IconContext
```tsx
// Source: Context7 /phosphor-icons/react
import { IconContext } from "@phosphor-icons/react";

// Wrap in layout or provider
<IconContext.Provider value={{ size: 20, weight: "regular", mirrored: false }}>
  {children}
</IconContext.Provider>
```

### WCAG 2.2 Focus Indicator Pattern
```css
/* Focus indicator that meets WCAG 2.2 SC 2.4.13 */
/* At least 2px thick, 3:1 contrast ratio */
*:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

### Standardised Loading Spinner
```tsx
import { CircleNotchIcon } from '@phosphor-icons/react'

function Spinner({ className }: { className?: string }) {
  return (
    <CircleNotchIcon
      weight="bold"
      className={cn("animate-spin text-muted-foreground", className)}
      size={20}
    />
  )
}
```

### Keyboard Shortcut Help Overlay Pattern
```tsx
// ? key opens a help overlay showing all keyboard shortcuts
// Linear-inspired: command palette style, centered modal
// List shortcuts by page context, grouped by category
// Show key combos on left, description on right
// Only show if user presses ?, dismiss on Escape or click outside
```

## Current Codebase Analysis

### Pages Inventory (8 routes)
| Route | Type | Layout | Dark Mode Ready | Accessibility |
|-------|------|--------|----------------|---------------|
| `/` (Landing) | Server | Centred, full-screen | No (hardcoded colours) | Minimal |
| `/dashboard` | Server | `max-w-6xl`, grid | No (bg-gray-50, bg-white) | Minimal |
| `/analysis` | Server+Client | `container`, split-panel | Partial (mix of semantic + hardcoded) | Keyboard nav (j/k/Enter) |
| `/videos` | Server+Client | Full-bleed, sidebar+grid | Partial (some semantic) | Selection via checkbox |
| `/ml-categorisation` | Client | `max-w-2xl`, cards | No (heavy hardcoded) | Minimal |
| `/ml-review` | Server+Client | Full-bleed, grid+modal | Mostly semantic | Keyboard nav (Tab/Shift+Tab/Enter/A/R) |
| `/safety` | Server+Client | `container`, tabbed | No (bg-white, border-gray-200) | Minimal |
| `/sync` | Server+Client | `max-w-4xl`, cards | No (text-gray-900/500) | Minimal |

### Component Inventory (shadcn/ui)
Currently installed: Badge, Button, Card, Checkbox, Dialog, DropdownMenu, Progress, Resizable, ScrollArea, Separator, Sonner, Table, Tabs

**Potentially needed additions:**
- **Input** (standardised form input -- currently using raw `<input>` with manual classes)
- **Select** (for dropdown selections -- some pages use raw `<select>`)
- **Tooltip** (for icon-only buttons and keyboard shortcut hints)
- **Sheet** (for mobile navigation drawer if sidebar approach is chosen)
- **Command** (for keyboard shortcut overlay / command palette)

### Navigation Assessment
Current: Top horizontal navbar with 7 links + sign out.
Issues: Hard to fit 7 items on mobile; icons hidden on small screens; no dark mode support (hardcoded `bg-white`, `text-gray-600`); sign out is a raw `<a>` tag.

**Recommendation (Claude's Discretion area):** Keep the **top navbar** approach. Linear uses a sidebar, but this app has only 7 pages -- a sidebar would waste horizontal space on a content-heavy app with split panels. Instead, improve the navbar:
- Compact nav items with icons only on mobile (tooltip for labels)
- Group related items (e.g., Analysis/Videos/ML under "Organise" dropdown on small screens)
- Add theme toggle
- Use semantic colours
- Replace raw `<a>` sign-out with Button variant="ghost"

### Keyboard Shortcuts Inventory
| Page | Shortcuts | Standardised |
|------|-----------|-------------|
| Analysis | Arrow Up/k, Arrow Down/j, Enter | Yes (via useCategoryKeyboardNav) |
| ML Review | Tab, Shift+Tab, Enter, A (accept), R (reject) | Yes (via useHotkeys) |
| Videos | Ctrl+Z (undo) | Partial (via undo-banner) |
| Other pages | None | N/A |

**Recommendation (Claude's Discretion area):** Add a `?` keyboard shortcut help overlay. Linear has this as a key discoverability feature. Implementation: `useHotkeys('shift+/', ...)` (since `?` is Shift+`/`), opening a Dialog/Command-style overlay listing all shortcuts grouped by page context. This adds significant value for keyboard-first users.

### Colour Palette Assessment (Claude's Discretion area)
Current palette uses oklch neutral greys with no accent colour. The current `--primary` in light mode is near-black (`oklch(0.205 0 0)`) -- this works but is very neutral.

**Recommendation:** The current neutral palette is fine for a Linear-style aesthetic. Linear itself uses a nearly-achromatic palette with subtle blue accents. The existing oklch-based colour system is well-structured. Add the semantic `--success`, `--warning`, and `--info` tokens mentioned above, but don't change the core neutral scale. The current palette is already close to the Linear aesthetic.

### Confirmation Pattern Assessment (Claude's Discretion area)
| Action Type | Recommended Pattern | Rationale |
|-------------|-------------------|-----------|
| Delete category | Confirm dialog | Destructive, hard to undo |
| Merge categories | Confirm dialog | Destructive, complex undo |
| Sync to YouTube | Confirm dialog | External side effects, irreversible |
| Move/copy videos | No confirmation (undo available) | Quick action, easily undone via Ctrl+Z |
| Accept/reject ML suggestion | No confirmation | Rapid-fire workflow, auto-advances |
| Bulk approve/reject proposals | Undo toast | Batch action, needs quick reversal option |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HSL colour space | oklch colour space | 2024 | Better perceptual uniformity; project already uses oklch |
| Tailwind v3 `darkMode: 'class'` | Tailwind v4 `@custom-variant dark` | 2025 | CSS-native dark mode variant; project already configured |
| Static breakpoint media queries | CSS clamp() for fluid spacing | 2024-2025 | Single expression replaces multiple breakpoints |
| Manual ARIA management | Radix UI primitives | 2023+ | shadcn/ui components handle ARIA automatically |
| Icon fonts (Font Awesome) | Individual SVG components (Phosphor/Lucide) | 2023+ | Tree-shakeable, accessible, no font loading |

**Deprecated/outdated:**
- `tailwind.config.ts` -- Tailwind v4 reads config from CSS `@theme` blocks. The existing config file is likely unused but should be verified before removal.

## Open Questions

1. **Tailwind v4 config file role**
   - What we know: Project has both `tailwind.config.ts` and CSS-based `@theme inline` config. Tailwind v4 primarily uses CSS config.
   - What's unclear: Whether `tailwind.config.ts` `content` paths are still needed for Tailwind v4 scanning, or if v4 auto-detects content files.
   - Recommendation: Test removing `tailwind.config.ts` in a branch; verify all styles still apply. If content scanning breaks, keep only the `content` field.

2. **Mobile sidebar for Videos page**
   - What we know: Videos page uses a fixed left sidebar (`CategorySidebar`) + main content area. On mobile, the sidebar may be too narrow or unusable.
   - What's unclear: Whether to use a Sheet (slide-out drawer) on mobile or collapse the sidebar into a dropdown.
   - Recommendation: Use Sheet component on mobile (< `md` breakpoint). The sidebar content is a category list -- perfect for a drawer pattern.

3. **Virtualized grid mobile adaptation**
   - What we know: `VideoGrid` uses `@tanstack/react-virtual` with a `useColumnCount` hook that already adapts columns (min 1, max 4). `MIN_CARD_WIDTH` is 300px.
   - What's unclear: Whether 300px min-width is appropriate for mobile (375px iPhone viewport minus padding = ~327px usable).
   - Recommendation: Reduce `MIN_CARD_WIDTH` to 280px for mobile and adjust card layout to be more compact (smaller thumbnails, truncated text).

## Sources

### Primary (HIGH confidence)
- Context7 `/phosphor-icons/react` - Installation, usage, IconContext, weight system, props API
- Context7 `/pacocoursey/next-themes` - ThemeProvider setup, App Router integration, Tailwind CSS dark mode, useTheme hook, system preference detection
- Direct codebase analysis - All page routes, component inventory, colour usage audit, accessibility audit

### Secondary (MEDIUM confidence)
- [Linear UI Redesign blog post](https://linear.app/now/how-we-redesigned-the-linear-ui) - Inter Display typography, LCH colour space, visual density approach
- [WCAG 2.2 specification](https://www.w3.org/TR/WCAG22/) - Focus appearance criteria (SC 2.4.13), focus not obscured (SC 2.4.11)
- [Sara Soueidan's focus indicator guide](https://www.sarasoueidan.com/blog/focus-indicators/) - Practical WCAG 2.2 focus indicator design
- [LogRocket Linear design analysis](https://blog.logrocket.com/ux-design/linear-design/) - Linear design patterns and philosophy
- [Shortcuts.design - Linear shortcuts](https://shortcuts.design/tools/toolspage-linear/) - Linear keyboard shortcuts reference

### Tertiary (LOW confidence)
- Web search comparisons of icon libraries - Phosphor vs Heroicons vs Lucide (general consensus, not authoritative)
- CSS clamp() spacing guides from multiple sources - Best practices for fluid spacing (well-established pattern)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - next-themes and Phosphor verified via Context7; shadcn/ui already in codebase
- Architecture: HIGH - All patterns derived from official documentation + direct codebase analysis
- Pitfalls: HIGH - Based on verified library documentation + known project-specific issues from MEMORY.md
- Codebase analysis: HIGH - Direct grep/read of every relevant file

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable -- no fast-moving dependencies)
