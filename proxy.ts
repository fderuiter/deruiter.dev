import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/security-headers";
import {
  generateClientConnectionHash,
  extractClientIp,
} from "@/lib/services/privacy-service";
import { isMobileUserAgent } from "@/lib/is-mobile";

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
 * plus the standard HTTP security headers. Rewrites incoming requests to
 * parallel (mobile) or (desktop) route groups based on user-agent detection.
 */
async function decorateRequest(req: NextRequest): Promise<NextResponse> {
  const requestHeaders = new Headers(req.headers);
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith("/api")) {
    const ip = extractClientIp(req);
    const userAgent = req.headers.get("user-agent") || "";
    const connectionHash = await generateClientConnectionHash(
      `${ip}:${userAgent}`
    );
    requestHeaders.set("x-connection-hash", connectionHash);
  }

  const isSkipRewrite =
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/desktop") ||
    pathname.startsWith("/mobile") ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/feed.xml" ||
    /\.(svg|png|ico|jpg|jpeg|css|js|json|xml|webmanifest)$/.test(pathname);

  let response: NextResponse;

  if (!isSkipRewrite) {
    const userAgent = req.headers.get("user-agent") || "";
    const isMobile = isMobileUserAgent(userAgent);
    const group = isMobile ? "mobile" : "desktop";
    const targetPath = `/${group}${pathname === "/" ? "" : pathname}`;
    const rewriteUrl = new URL(targetPath, req.url);

    response = NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      },
    });
  } else {
    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

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
const MOBILE_DECOUPLED_ROUTES = ["/proof", "/crf", "/neuro", "/patrol"];

export function proxy(req: NextRequest, event: NextFetchEvent) {
  if (isClerkRoute(req)) {
    return authMiddleware(req, event);
  }

  const pathname = req.nextUrl.pathname;
  if (
    MOBILE_DECOUPLED_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    )
  ) {
    const userAgentHeader = req.headers.get("user-agent") || "";
    const isMobileUa =
      /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(
        userAgentHeader
      ) || req.headers.get("sec-ch-ua-mobile") === "?1";

    if (isMobileUa) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = `/m${pathname}`;
      const response = NextResponse.redirect(redirectUrl);
      return applySecurityHeaders(response, req);
    }
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
