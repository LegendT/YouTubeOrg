import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

/**
 * NextAuth v5 configuration with Google OAuth provider
 * Implements automatic token refresh for YouTube API access
 *
 * Key features:
 * - Requests offline access to receive refresh_token
 * - Forces consent screen to guarantee refresh_token on every login
 * - Implements JWT callback with token refresh logic
 * - Handles revoked tokens gracefully (AUTH-04)
 * - Exposes access_token in session for YouTube API calls
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          // Request offline access to receive refresh_token
          access_type: "offline",
          // Force consent screen to guarantee refresh_token on every login
          // Without this, Google only provides refresh_token on first login
          prompt: "consent",
          // youtube.force-ssl grants read AND write access (required for Phase 8 sync operations).
          // User must re-authenticate to grant the new scope.
          scope: "openid email profile https://www.googleapis.com/auth/youtube.force-ssl",
        },
      },
    }),
  ],
  callbacks: {
    /**
     * JWT callback - runs on every token access
     * Handles three cases:
     * 1. First login: Save tokens from account
     * 2. Token still valid: Return unchanged
     * 3. Token expired: Refresh using refresh_token
     */
    async jwt({ token, account }) {
      // Case 1: First-time login - account object exists with fresh tokens
      if (account) {
        return {
          ...token,
          access_token: account.access_token,
          expires_at: account.expires_at, // Unix timestamp (seconds)
          refresh_token: account.refresh_token,
        }
      }

      // Case 2: Token still valid - return unchanged
      // expires_at is in seconds, Date.now() is in milliseconds
      if (Date.now() < (token.expires_at as number) * 1000) {
        return token
      }

      // Case 3: Token expired - refresh it
      if (!token.refresh_token) {
        console.error("Missing refresh_token - cannot refresh access token")
        token.error = "RefreshAccessTokenError"
        return token
      }

      try {
        console.log("Refreshing expired access token...")

        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refresh_token as string,
          }),
        })

        const newTokens = await response.json()

        if (!response.ok) {
          // Handle revoked token error (AUTH-04 requirement)
          if (newTokens.error === "invalid_grant") {
            console.error("Refresh token has been revoked or expired")
            token.error = "RefreshAccessTokenError"
            return token
          }

          throw newTokens
        }

        console.log("Access token refreshed successfully")

        return {
          ...token,
          access_token: newTokens.access_token,
          expires_at: Math.floor(Date.now() / 1000 + newTokens.expires_in),
          // Google may rotate refresh_token, preserve old one if not provided
          refresh_token: newTokens.refresh_token ?? token.refresh_token,
        }
      } catch (error) {
        console.error("Error refreshing access_token:", error)
        return {
          ...token,
          error: "RefreshAccessTokenError",
        }
      }
    },

    /**
     * Session callback - exposes access_token to client
     * Used by Server Components and API routes to access YouTube API
     */
    async session({ session, token }) {
      // Expose access_token for YouTube API calls
      session.access_token = token.access_token as string

      // Expose error state so UI can prompt re-authentication
      session.error = token.error as string | undefined

      return session
    },
  },
  // Use JWT strategy for session storage (serverless-friendly)
  session: {
    strategy: "jwt",
  },
  pages: {
    // Use default NextAuth sign-in page for now
    // Will customize in Plan 05 (Dashboard UI)
  },
})
