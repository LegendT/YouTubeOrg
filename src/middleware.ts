import { auth } from "@/lib/auth/config"
import { NextResponse } from "next/server"

/**
 * NextAuth v5 middleware — protects all authenticated routes.
 *
 * Unauthenticated or expired-session requests are redirected to sign-in.
 * This covers both page loads and server action POST requests on matched routes.
 */
export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL("/api/auth/signin", req.nextUrl.origin))
  }

  if (req.auth.error === "RefreshAccessTokenError") {
    return NextResponse.redirect(new URL("/api/auth/signin", req.nextUrl.origin))
  }
})

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/analysis/:path*",
    "/ml-review/:path*",
    "/ml-categorisation/:path*",
    "/safety/:path*",
    "/videos/:path*",
    "/sync/:path*",
  ],
}
