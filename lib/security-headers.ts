import type { NextRequest, NextResponse } from "next/server";
// Relative so next.config.ts can load this module without path aliases.
import { getEnv } from "./env";

// A publishable key contains the instance hostname; never allow every Clerk tenant.
function clerkOrigin(): string {
  const key = getEnv().NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) return "";
  try {
    const encoded = key.match(/^pk_(?:test|live)_(.+)$/)?.[1];
    if (!encoded) return "";
    const hostname = atob(encoded).replace(/\$$/, "");
    return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(hostname)
      ? `https://${hostname}`
      : "";
  } catch {
    return "";
  }
}

const authOrigin = clerkOrigin();

// Public visitor journeys never load the Clerk browser SDK, so Clerk's script/connect/frame
// allowances are scoped to the admin surface only rather than widening every route's CSP.
const ADMIN_SURFACE_PATTERN = /^\/(?:admin|api\/admin)(?:\/|$)/;

function isAdminSurface(pathname: string): boolean {
  return ADMIN_SURFACE_PATTERN.test(pathname);
}

/**
 * Builds the Content-Security-Policy for the public or admin surface.
 *
 * The policy is identical for every request, so `next.config.ts` serves it in
 * front of static and ISR pages. A per-request nonce made the root layout read
 * request headers, which rendered every page on demand and spent Vercel
 * function CPU on each view (#1900). Without a nonce, the inline bootstrap
 * scripts Next.js emits need `'unsafe-inline'`; script sources stay limited to
 * this origin and the named hosts.
 */
export function buildContentSecurityPolicy(admin: boolean): string {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://va.vercel-scripts.com",
  ];
  const connectSrc = ["'self'", "https://vitals.vercel-insights.com"];
  const imgSrc = ["'self'", "data:"];
  const frameSrc = ["'self'"];

  if (admin && authOrigin) {
    scriptSrc.push(
      authOrigin,
      "https://challenges.cloudflare.com",
      "https://*.protect.clerk.com"
    );
    connectSrc.push(
      authOrigin,
      "https://clerk-telemetry.com",
      "https://*.clerk-telemetry.com",
      "https://*.protect.clerk.com:*"
    );
    imgSrc.push("https://img.clerk.com");
    frameSrc.push(
      "https://challenges.cloudflare.com",
      "https://*.protect.clerk.com"
    );
  }

  return (
    [
      "default-src 'self'",
      `script-src ${scriptSrc.join(" ")}`,
      `connect-src ${connectSrc.join(" ")}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src ${imgSrc.join(" ")}`,
      `frame-src ${frameSrc.join(" ")}`,
      "worker-src 'self' blob:",
    ].join("; ") + ";"
  );
}

/** Builds the standard security header set for the public or admin surface. */
export function buildSecurityHeaders(admin: boolean): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": buildContentSecurityPolicy(admin),
  };
}

/** Baseline security headers for public visitor routes; never grants Clerk resource access. */
export const SECURITY_HEADERS: Record<string, string> =
  buildSecurityHeaders(false);

/** Security headers for the `/admin` and `/api/admin` surface, additionally scoped to the configured Clerk origin. */
export const ADMIN_SECURITY_HEADERS: Record<string, string> =
  buildSecurityHeaders(true);

/** One `next.config.ts` header rule: a route source and the headers it receives. */
export interface SecurityHeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

function toHeaderList(
  headers: Record<string, string>
): SecurityHeaderRule["headers"] {
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}

/**
 * Header rules for `next.config.ts`, so every route, including static and ISR
 * pages the proxy never runs on, receives the security headers. The admin rules
 * come last because Next.js lets a later rule override the same header key.
 */
export function securityHeaderRules(): SecurityHeaderRule[] {
  const admin = toHeaderList(ADMIN_SECURITY_HEADERS);
  return [
    { source: "/:path*", headers: toHeaderList(SECURITY_HEADERS) },
    { source: "/admin/:path*", headers: admin },
    { source: "/api/admin/:path*", headers: admin },
  ];
}

/**
 * Applies standard HTTP security headers to a NextResponse. When `req` resolves to the admin
 * surface (`/admin`, `/api/admin`), the Content-Security-Policy additionally allows the
 * configured Clerk origin and its supporting resources; every other route — and any call
 * without a request context — receives the narrower public-surface policy.
 */
export function applySecurityHeaders(
  res: NextResponse,
  req?: NextRequest
): NextResponse {
  const admin = isAdminSurface(req?.nextUrl.pathname ?? "");
  const headers = admin ? ADMIN_SECURITY_HEADERS : SECURITY_HEADERS;
  Object.entries(headers).forEach(([key, value]) => {
    res.headers.set(key, value);
  });
  return res;
}
