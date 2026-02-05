import { auth } from "@/lib/auth/config"

/**
 * Server-side session helper for Next.js App Router
 *
 * This function provides a clean way to access the current session
 * in Server Components, Server Actions, and API Route Handlers.
 *
 * Usage:
 * ```typescript
 * const session = await getServerSession()
 * if (!session?.access_token) {
 *   redirect('/api/auth/signin')
 * }
 * // Use session.access_token for YouTube API calls
 * ```
 *
 * @returns Session object with access_token and error fields
 */
export async function getServerSession() {
  return await auth()
}
