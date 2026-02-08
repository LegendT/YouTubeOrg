# Phase 12: UX Audit - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Comprehensive UX review and polish across all user-facing pages (landing, login, dashboard, analysis, videos, ML categorisation, ML review, sync, safety) plus navigation. Evaluate layout, interactions, feedback patterns, empty states, loading states, responsive behaviour, accessibility, dark mode, and overall consistency. Fix all identified issues — no deferral. This phase does NOT add new features or capabilities; it polishes and standardises what exists.

</domain>

<decisions>
## Implementation Decisions

### Audit Scope & Priority
- All pages get equal review depth — no shortcuts for lower-traffic pages
- Includes: landing page, login flow, navbar, and all 7 authenticated pages
- Full responsive design: phone to ultrawide (virtualized grids adapt to 1-2 columns on mobile with touch-friendly cards)
- Dark mode: dark/light toggle with system preference detection; audit both themes simultaneously per page
- Accessibility: target WCAG 2.2 compliance (contrast ratios, focus indicators, aria labels, semantic HTML)
- Standardise keyboard shortcuts across all pages; define consistent shortcut scheme

### Quality Bar & References
- Reference app: **Linear** — clean, fast, keyboard-first, minimal chrome
- Polish level: **Production-grade** — pixel-perfect spacing, refined typography, subtle micro-interactions
- Motion: **Minimal** — only essential animations (loading spinners, progress bars); no page transitions or spring physics
- Design system: **Mix and match** — use shadcn/ui as base, build custom components where shadcn falls short
- Colour palette: Claude's discretion on whether current palette needs refinement
- Typography: fix inconsistencies in sizes/weights across pages; don't change font family
- Content density: **Spacious** — generous whitespace, Linear-style, less cognitive load
- Icon set: switch from Lucide — Claude evaluates best match for Linear-inspired aesthetic (Phosphor, Heroicons, or other)

### Issue Handling
- **Audit then fix** — first pass documents all issues across all pages; second pass fixes in priority order
- Fix everything — no deferral, no matter how large the issue
- **Formal audit document** — create UX audit markdown listing every issue found per page with severity/status
- **Review major only** — Claude fixes small issues autonomously; checks with user on anything that changes behaviour or layout significantly

### Consistency Patterns
- Loading states: **Spinners** (not skeletons) — simple spinner/loading indicator for all loading contexts
- Empty states: **Illustrated + CTA** — friendly illustration, explanatory text, and clear call-to-action button
- Error feedback: **Context-dependent** — toasts for action errors (save failed), inline messages for form validation or page-level errors
- Spacing: **Strict system using best practices** — clamp() and rems; establish and apply consistently
- Confirmations: Claude's discretion per action (confirm dialog, undo toast, or no confirmation)
- Button hierarchy: **Standardise** — define clear primary, secondary, destructive, ghost hierarchy; apply consistently
- Navigation: **Review and improve** — evaluate whether navbar, sidebar, or hybrid would serve the app better
- Tables/lists: **Per-context** — each page can have its own list style suited to its content; ensure minimum quality
- Keyboard shortcut help overlay: Claude's discretion on whether ? overlay adds value
- Page headers: **Standardise** — every page: title top-left, description below, primary action top-right
- Form inputs: **Standardise** — consistent input heights, border styles, focus rings, placeholder text
- Icon sizes: standardise per context (inline, buttons, headers) once new icon set is chosen

### Claude's Discretion
- Colour palette refinement scope
- Confirmation pattern per action (dialog, undo toast, or none)
- Keyboard shortcut help overlay (? key)
- Icon set selection (evaluate Phosphor, Heroicons, or alternative for Linear aesthetic)
- Navigation structure recommendation (navbar, sidebar, or hybrid)

</decisions>

<specifics>
## Specific Ideas

- "I want it to feel like Linear" — clean, fast, keyboard-first, minimal chrome aesthetic
- Production-grade polish: pixel-perfect spacing, refined micro-interactions
- Spacious layouts with generous whitespace
- Dark mode toggle (not just system preference — explicit toggle available)
- WCAG 2.2 accessibility compliance
- Strict spacing system using modern CSS (clamp, rems)
- Virtualized grids should adapt to mobile with 1-2 columns and touch-friendly cards

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-ux-audit*
*Context gathered: 2026-02-08*
