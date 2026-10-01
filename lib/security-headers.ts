import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getEnv } from "@/lib/env";

/** Generates a cryptographically random SHA-256 base64-encoded nonce string. */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return createHash("sha256").update(bytes).digest("base64");
}

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

export function buildContentSecurityPolicy(
  admin: boolean,
  nonce?: string
): string {
  const currentNonce = nonce || generateNonce();
  const scriptSrc = [
    "'self'",
    `'nonce-${currentNonce}'`,
    "'strict-dynamic'",
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

export function buildSecurityHeaders(
  admin: boolean,
  nonce?: string
): Record<string, string> {
  const currentNonce = nonce || generateNonce();
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": buildContentSecurityPolicy(admin, currentNonce),
    "x-nonce": currentNonce,
  };
}

/** Baseline security headers for public visitor routes; never grants Clerk resource access. */
export const SECURITY_HEADERS: Record<string, string> =
  buildSecurityHeaders(false);

/** Security headers for the `/admin` and `/api/admin` surface, additionally scoped to the configured Clerk origin. */
export const ADMIN_SECURITY_HEADERS: Record<string, string> =
  buildSecurityHeaders(true);

/**
 * Applies standard HTTP security headers to a NextResponse. When `req` resolves to the admin
 * surface (`/admin`, `/api/admin`), the Content-Security-Policy additionally allows the
 * configured Clerk origin and its supporting resources; every other route — and any call
 * without a request context — receives the narrower public-surface policy.
 */
export function applySecurityHeaders(
  res: NextResponse,
  req?: NextRequest,
  explicitNonce?: string
): NextResponse {
  const nonce =
    explicitNonce ||
    req?.headers.get("x-nonce") ||
    res.headers.get("x-nonce") ||
    generateNonce();

  const admin = isAdminSurface(req?.nextUrl.pathname ?? "");
  const headers = buildSecurityHeaders(admin, nonce);
  Object.entries(headers).forEach(([key, value]) => {
    res.headers.set(key, value);
  });
  return res;
}
