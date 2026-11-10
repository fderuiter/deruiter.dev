import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/security-headers";

/** Matchers for routes that require Clerk middleware protection or hydration. */
const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"]);
const isProtectedAdminRoute = createRouteMatcher([
  "/admin(.*)",
  "/api/admin(.*)",
]);
const isPublicAuthRoute = createRouteMatcher(["/admin/login(.*)"]);

/**
 * Determines whether a request requires Clerk session hydration.
 * Method-aware:
 * - Admin routes (/admin, /api/admin) always require Clerk.
 * - Non-admin endpoints requiring clerk_admin auth (e.g. POST /api/case-studies)
 *   hydrate Clerk on mutating methods (POST, PUT, DELETE, PATCH) while keeping public
 *   read requests (GET) independent of Clerk middleware.
 */
export function isClerkRoute(req: NextRequest): boolean {
  if (isAdminRoute(req)) {
    return true;
  }
  if (
    req.nextUrl.pathname.startsWith("/api/case-studies") &&
    req.method !== "GET" &&
    req.method !== "HEAD" &&
    req.method !== "OPTIONS"
  ) {
    return true;
  }
  return false;
}

/**
 * Passes the request on with the standard HTTP security headers. The admin
 * surface gets the policy that allows Clerk. `next.config.ts` serves the same
 * headers to every route the proxy does not match.
 */
function decorateRequest(req: NextRequest): NextResponse {
  return applySecurityHeaders(NextResponse.next(), req);
}

const authMiddleware = clerkMiddleware(async (auth, req: NextRequest) => {
  if (isProtectedAdminRoute(req) && !isPublicAuthRoute(req)) {
    await auth.protect();
  }

  return decorateRequest(req);
});

/**
 * Next.js 16 Node.js Proxy
 *
 * Clerk runs only for the admin area and for mutating requests to the case
 * study API. It used to wrap every route, which meant a missing or
 * non-resolvable publishable key took down the whole site: the handshake
 * fails and the middleware returns Clerk's error JSON as the page body, or
 * throws outright when the key is absent. Nothing outside those routes reads
 * Clerk state -- `ClerkProvider` is mounted in `app/admin/layout.tsx` and
 * `lib/auth/admin.ts` is admin-only -- so the rest of the site has no reason
 * to pay that cost or carry that risk.
 */
export function proxy(req: NextRequest, event: NextFetchEvent) {
  if (isClerkRoute(req)) {
    return authMiddleware(req, event);
  }
  return decorateRequest(req);
}

/**
 * The proxy runs as a Vercel function, so it matches only the routes Clerk
 * guards (#3205). The phone redirects for the desktop studios are
 * `redirects()` in `next.config.ts` (#3204), security headers for every route
 * come from `headers()` there (#1900), and API handlers hash the client
 * connection themselves through `getConnectionHashFromRequest`. A matcher
 * cannot filter on method, so read requests to the case study API still pass
 * through the proxy without reaching Clerk.
 */
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/case-studies/:path*"],
};
