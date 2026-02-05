# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Videos must be findable when needed. If you can't locate a video when you need it, the collection is worthless.

**Current focus:** Phase 1 - Foundation & API Integration

## Current Position

Phase: 1 of 8 (Foundation & API Integration)
Plan: 3 of TBD in current phase
Status: In progress
Last activity: 2026-02-05 — Completed 01-02-PLAN.md

Progress: [██░░░░░░░░] ~30%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 4.3 min
- Total execution time: 0.2 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Foundation & API Integration | 3 | 13 min | 4.3 min |

**Recent Trend:**
- Last 5 plans: 01-01 (7min), 01-03 (3min), 01-02 (3min)
- Trend: Stable (OAuth setup similar to infrastructure tasks)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- AI-first categorization: 4,000 videos makes manual categorization impractical
- Consolidate categories before Watch Later: Cleaner target structure improves ML accuracy
- System proposes consolidation, user approves: Balance automation with user control
- Web app deployment: Simpler maintenance vs desktop application
- YouTube as source of truth: Tool assists reorganization, YouTube is primary interface
- Preview capability during review: User needs to watch snippets to remember old videos

**From 01-01 execution (2026-02-05):**
- Use serial() for primary keys instead of generatedAlwaysAsIdentity() for simplicity
- Use Drizzle push command for rapid development (switch to migrations for production)
- PostgreSQL via Docker (youtube-org-db container) with max: 1 connection pooling
- Store full API responses in jsonb for 304 Not Modified handling

**From 01-03 execution (2026-02-05):**
- Separate concerns: Bottleneck handles real-time rate limiting, database tracks persistent quota history
- 304 Not Modified responses return cached data from database (0 quota cost vs 1 for fresh fetch)
- Retry on 429 Rate Limit with exponential backoff, no retry on 403 quotaExceeded
- Cache key generation from resource type + JSON.stringify(params) for unique identification

**From 01-02 execution (2026-02-05):**
- Force consent screen (prompt: "consent") to guarantee refresh_token on every login
- Store access_token in JWT session (encrypted) rather than database for serverless compatibility
- Implement token refresh in JWT callback using oauth2.googleapis.com/token endpoint
- Handle revoked tokens (invalid_grant) by setting error flag to trigger re-authentication
- Preserve refresh_token during rotation (newTokens.refresh_token ?? token.refresh_token)

### Pending Todos

None yet.

### Blockers/Concerns

**Identified during roadmap creation:**

- **Phase 5 (ML Engine):** Model selection (all-MiniLM-L6-v2) assumed but needs validation during planning — accuracy on YouTube titles/descriptions unknown
- **Phase 8 (Sync):** Conflict resolution strategy not specified in research — last-write-wins vs user prompt depends on actual conflict frequency
- **Phase 8 (Sync):** YouTube API quota increase request timeline unclear — may need to submit early in Phase 1 if 10k units/day insufficient for testing

**From 01-03 execution (2026-02-05):**

- **Tailwind CSS v4 PostCSS configuration:** Pre-existing issue from Plan 01-01 preventing full `npm run build`. Needs `@tailwindcss/postcss` package and postcss.config.mjs update. TypeScript compilation works fine (`npx tsc --noEmit` passes cleanly).
- **Bottleneck reservoir timezone:** 24-hour refresh uses JavaScript Date, YouTube quota resets at midnight Pacific Time. May need timezone adjustment if running in different timezone.
- **ETag If-None-Match header:** Current implementation documents need for ETags in request headers. googleapis library handling needs validation in Plan 04 with actual API calls.

**From 01-02 execution (2026-02-05):**

- **Google Cloud OAuth testing mode:** OAuth consent screen currently in "Testing" mode with limited test users. Will need Google verification process for production deployment with >100 users.
- **OAuth flow end-to-end testing:** Full OAuth flow (sign-in button → Google → callback → session) deferred to Plan 05 when Dashboard UI is built. Current verification only confirms configuration and dev server startup.
- **Refresh token rotation edge case:** Google may stop providing refresh_token in some refresh responses. Mitigated by preserving old refresh_token, but may need monitoring in production.

## Session Continuity

Last session: 2026-02-05T16:25:23Z
Stopped at: Completed 01-02-PLAN.md (NextAuth OAuth with token refresh)
Resume file: None

---

**Next step:** Continue Phase 1 with Plan 04 (YouTube API operations) or Plan 05 (Dashboard UI)
