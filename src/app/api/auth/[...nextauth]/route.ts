import { handlers } from "@/lib/auth/config"

/**
 * NextAuth.js v5 API Route Handler
 *
 * This catch-all route handles all NextAuth endpoints:
 * - GET /api/auth/signin - Sign-in page
 * - GET /api/auth/signout - Sign-out page
 * - POST /api/auth/signin/google - Initiate Google OAuth flow
 * - GET /api/auth/callback/google - OAuth callback from Google
 * - GET /api/auth/session - Get current session
 * - GET /api/auth/csrf - CSRF token
 *
 * The handlers are exported from our NextAuth configuration
 * which includes Google provider and token refresh logic.
 */
export const { GET, POST } = handlers
