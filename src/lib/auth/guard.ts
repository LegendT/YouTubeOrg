import { auth } from '@/lib/auth/config'

/**
 * Discriminated union type for authentication results.
 *
 * Used by server actions to check auth before performing mutations:
 * - `authenticated: true` — session is valid, `accessToken` is available
 * - `authenticated: false` — session is missing or expired, `error` describes why
 */
export type AuthResult =
  | { authenticated: true; accessToken: string }
  | { authenticated: false; error: string }

/**
 * Server action auth guard. Returns a typed result instead of redirecting,
 * allowing server actions to return error responses to the client.
 *
 * Usage (guard-clause pattern):
 * ```typescript
 * 'use server'
 * import { requireAuth } from '@/lib/auth/guard'
 *
 * export async function myServerAction() {
 *   const authResult = await requireAuth()
 *   if (!authResult.authenticated) {
 *     return { success: false, error: authResult.error }
 *   }
 *   // authResult.accessToken is available here
 *   const data = await fetchFromYouTube(authResult.accessToken)
 *   return { success: true, data }
 * }
 * ```
 */
/**
 * Higher-order wrapper for critical mutating server actions.
 * Checks auth before executing and returns `{ success: false, error }` on failure.
 *
 * Usage:
 * ```typescript
 * async function _deleteCategory(id: number) { ... }
 * export const deleteCategory = withAuth(_deleteCategory)
 * ```
 */
export function withAuth<
  Args extends unknown[],
  R extends { success: boolean; error?: string },
>(fn: (...args: Args) => Promise<R>): (...args: Args) => Promise<R> {
  return async (...args: Args): Promise<R> => {
    const result = await requireAuth()
    if (!result.authenticated) {
      return { success: false, error: result.error } as R
    }
    return fn(...args)
  }
}

export async function requireAuth(): Promise<AuthResult> {
  const session = await auth()

  if (!session?.access_token) {
    return { authenticated: false, error: 'Not authenticated' }
  }

  if (session.error === 'RefreshAccessTokenError') {
    return { authenticated: false, error: 'Session expired. Please sign in again.' }
  }

  return { authenticated: true, accessToken: session.access_token }
}
