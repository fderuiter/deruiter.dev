import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/security-headers";
import {
  generateClientConnectionHash,
  extractClientIp,
} from "@/lib/services/privacy-service";

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
 * Privacy-preserving client connection token for API telemetry/rate limiting,
 * plus the standard HTTP security headers. Applies to every request, whether
 * or not Clerk is in the chain.
 */
async function decorateRequest(req: NextRequest): Promise<NextResponse> {
  const requestHeaders = new Headers(req.headers);

  if (req.nextUrl.pathname.startsWith("/api")) {
    const ip = extractClientIp(req);
    const userAgent = req.headers.get("user-agent") || "";
    const connectionHash = await generateClientConnectionHash(
      `${ip}:${userAgent}`
    );
    requestHeaders.set("x-connection-hash", connectionHash);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return applySecurityHeaders(response, req);
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
 * Clerk runs only for the admin area. It used to wrap every route, which meant
 * a missing or non-resolvable publishable key took down the whole site: the
 * handshake fails and the middleware returns Clerk's error JSON as the page
 * body, or throws outright when the key is absent. Nothing outside `/admin`
 * reads Clerk state -- `ClerkProvider` is mounted in `app/admin/layout.tsx`
 * and `lib/auth/admin.ts` is admin-only -- so the rest of the site has no
 * reason to pay that cost or carry that risk.
 */
export function proxy(req: NextRequest, event: NextFetchEvent) {
  if (isClerkRoute(req)) {
    return authMiddleware(req, event);
  }

  return decorateRequest(req);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
