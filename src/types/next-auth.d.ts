import "next-auth"
import { JWT } from "next-auth/jwt"

/**
 * Extend NextAuth types to include custom properties
 * for YouTube OAuth access tokens
 */
declare module "next-auth" {
  interface Session {
    access_token?: string
    error?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    access_token?: string
    expires_at?: number
    refresh_token?: string
    error?: string
  }
}
