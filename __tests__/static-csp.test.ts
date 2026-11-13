// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { fromPartial } from "@total-typescript/shoehorn";

vi.mock("next/font/google", () => ({
  Lexend: () => ({ variable: "--font-lexend" }),
  Atkinson_Hyperlegible: () => ({ variable: "--font-atkinson" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

const headersSpy = vi.fn();
vi.mock("next/headers", () => ({ headers: headersSpy }));

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: () => (_req: NextRequest) =>
    new Response(null, { status: 200 }),
  createRouteMatcher:
    (patterns: string[]) => (req: { nextUrl: { pathname: string } }) =>
      patterns.some((pattern) =>
        new RegExp("^" + pattern.replace(/\(\.\*\)/g, ".*") + "$").test(
          req.nextUrl.pathname
        )
      ),
}));

import { proxy, config } from "@/proxy";
import nextConfig from "@/next.config";
import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  securityHeaderRules,
  SECURITY_HEADERS,
  WASM_POLICY_SOURCES,
} from "@/lib/security-headers";
import { SITE_BASE_URL } from "@/lib/seo";
import RootLayout from "@/app/layout";

const OBSOLETE_VERCEL_TELEMETRY_HOST = "va.vercel-scripts.com";

/**
 * Returns `true` only when `src` resolves to the obsolete external Vercel
 * telemetry host (`va.vercel-scripts.com`) over HTTP(S). Returning `false`
 * for lookalike hosts or non-HTTP(S) schemes means the input is not that
 * specific forbidden host — it does not approve `src` under CSP.
 */
function isObsoleteVercelTelemetrySrc(
  src: unknown,
  baseUrl: string = SITE_BASE_URL
): boolean {
  if (typeof src !== "string") {
    return false;
  }
  const trimmed = src.trim();
  if (trimmed === "") {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed, baseUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return false;
  }
  return parsed.hostname === OBSOLETE_VERCEL_TELEMETRY_HOST;
}

function parseDirectives(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy
      .split(";")
      .filter(Boolean)
      .map((d) => {
        const [name, ...sources] = d.trim().split(/\s+/);
        return [name, sources];
      })
  );
}

/** Mirrors Next.js matching for the simple `/segment/:path*` sources the proxy uses. */
function matchesSource(source: string, pathname: string): boolean {
  const base = source.replace(/\/:path\*$/, "");
  return pathname === base || pathname.startsWith(`${base}/`);
}

describe("Static CSP keeps public pages cacheable (#1900)", () => {
  const dummyEvent = fromPartial<NextFetchEvent>({});

  it("builds the same policy on every call, with no nonce or strict-dynamic", () => {
    const first = buildContentSecurityPolicy(false);
    expect(buildContentSecurityPolicy(false)).toBe(first);

    const scriptSrc = parseDirectives(first)["script-src"];
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("https://va.vercel-scripts.com");
    expect(scriptSrc).not.toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc.some((s) => s.startsWith("'nonce-"))).toBe(false);
    expect(scriptSrc).not.toContain("https:");
    expect(scriptSrc).not.toContain("*");
  });

  it("does not emit an x-nonce header", () => {
    expect(SECURITY_HEADERS).not.toHaveProperty("x-nonce");
    const res = applySecurityHeaders(
      NextResponse.next(),
      new NextRequest("http://localhost:3000/")
    );
    expect(res.headers.get("x-nonce")).toBeNull();
    expect(res.headers.get("Content-Security-Policy")).toBe(
      SECURITY_HEADERS["Content-Security-Policy"]
    );
  });

  it("serves headers for every route from next.config, with admin rules last", () => {
    const rules = securityHeaderRules();
    expect(rules[0].source).toBe("/:path*");
    expect(rules.slice(1).map((r) => r.source)).toEqual([
      ...WASM_POLICY_SOURCES,
      "/admin/:path*",
      "/api/admin/:path*",
    ]);
    const publicKeys = rules[0].headers.map((h) => h.key);
    expect(publicKeys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "Strict-Transport-Security",
        "X-Frame-Options",
        "X-Content-Type-Options",
        "Referrer-Policy",
      ])
    );
  });

  it("allows WebAssembly only on the SQL workbench and its engine worker (#2633)", () => {
    const csp = (source: string) =>
      securityHeaderRules()
        .find((rule) => rule.source === source)!
        .headers.find((h) => h.key === "Content-Security-Policy")!.value;

    expect(parseDirectives(csp("/:path*"))["script-src"]).not.toContain(
      "'wasm-unsafe-eval'"
    );
    expect(WASM_POLICY_SOURCES).toEqual([
      "/platform/sql",
      expect.stringMatching(
        /^\/_next\/static\/media\/:file\(duckdb-browser-eh/
      ),
    ]);
    for (const source of WASM_POLICY_SOURCES) {
      const policy = csp(source);
      const scriptSrc = parseDirectives(policy)["script-src"];
      expect(scriptSrc).toContain("'wasm-unsafe-eval'");
      // WebAssembly compilation only: JavaScript eval stays refused.
      expect(scriptSrc).not.toContain("'unsafe-eval'");
      // Otherwise the public policy, word for word.
      expect(policy.replace(" 'wasm-unsafe-eval'", "")).toBe(
        SECURITY_HEADERS["Content-Security-Policy"]
      );
    }
    expect(buildContentSecurityPolicy(true, true)).toContain(
      "'wasm-unsafe-eval'"
    );
  });

  it("runs the proxy only where it is needed, not on public pages", () => {
    const matcher = config.matcher;
    const matched = (path: string) =>
      matcher.some((source) => matchesSource(source, path));

    for (const path of [
      "/admin",
      "/admin/blog",
      "/api/admin/case-studies",
      "/api/case-studies",
      "/api/case-studies/x",
    ]) {
      expect(matched(path), path).toBe(true);
    }
    // Public API routes, and the studios whose phone redirects moved into
    // next.config.ts (#3204), no longer invoke the proxy (#3205).
    for (const path of [
      "/api/telemetry",
      "/api/contact",
      "/api/newsletter",
      "/api/blog/reactions",
      "/proof",
      "/crf",
      "/neuro/scan",
      "/patrol",
      "/",
      "/blog",
      "/blog/some-post",
      "/case-studies/x",
      "/arcade/laser-loon",
      "/m/proof",
      "/proofs",
    ]) {
      expect(matched(path), path).toBe(false);
    }
  });

  it("serves /api/telemetry its security headers from next.config.ts now that the proxy skips it (#3205)", async () => {
    expect(
      config.matcher.some((source) => matchesSource(source, "/api/telemetry"))
    ).toBe(false);
    const rules = await nextConfig.headers!();
    const forAll = rules.find((rule) => rule.source === "/:path*")!;
    const value = (key: string) =>
      forAll.headers.find((h) => h.key === key)?.value;
    expect(value("Content-Security-Policy")).toBe(
      SECURITY_HEADERS["Content-Security-Policy"]
    );
    expect(value("X-Content-Type-Options")).toBe("nosniff");
    expect(value("Strict-Transport-Security")).toBeTruthy();
  });

  it("still decorates API responses with security headers", async () => {
    const res = await proxy(
      new NextRequest("http://localhost:3000/api/case-studies"),
      dummyEvent
    );
    expect(res!.headers.get("Content-Security-Policy")).toBe(
      SECURITY_HEADERS["Content-Security-Policy"]
    );
    expect(res!.headers.get("x-nonce")).toBeNull();
  });

  it("renders the root layout without reading request headers or hand-written telemetry tags", async () => {
    const layoutJsx = await RootLayout({ children: "Test Child" });
    expect(headersSpy).not.toHaveBeenCalled();
    expect(layoutJsx.type).toBe("html");

    const head = layoutJsx.props.children.find(
      (child: { type: string }) => child?.type === "head"
    );
    const headChildren = head.props.children.flat(Infinity);

    // Analytics and Speed Insights load through <Analytics /> and
    // <SpeedInsights />, which serve their scripts from /_vercel on the site's
    // own origin. A hand-written tag for the unversioned va.vercel-scripts.com
    // URL with a pinned integrity hash broke when Vercel updated the file in
    // place (#2969), so none may come back.
    const vercelScriptTags = headChildren.filter(
      (c: { props?: { src?: unknown } }) =>
        isObsoleteVercelTelemetrySrc(c?.props?.src)
    );
    expect(vercelScriptTags).toEqual([]);
    for (const child of headChildren) {
      expect(child?.props?.nonce).toBeUndefined();
    }
  });

  it("detects obsolete Vercel telemetry URLs strictly by parsed hostname (#3845)", () => {
    for (const obsoleteSrc of [
      "https://va.vercel-scripts.com/v1/script.debug.js",
      "http://va.vercel-scripts.com/v1/script.js",
      "//va.vercel-scripts.com/v1/script.js",
      "https://VA.Vercel-Scripts.COM/v1/script.js",
      "https://va.vercel-scripts.com:443/v1/script.js?debug=1",
    ]) {
      expect(isObsoleteVercelTelemetrySrc(obsoleteSrc), obsoleteSrc).toBe(true);
    }

    // Same-origin /_vercel and local scripts are not the obsolete external host.
    for (const sameOriginSrc of [
      "/_vercel/insights/script.js",
      "/_vercel/speed-insights/script.js",
      "/scripts/app.js",
    ]) {
      expect(isObsoleteVercelTelemetrySrc(sameOriginSrc), sameOriginSrc).toBe(
        false
      );
    }

    // Lookalike hosts are not va.vercel-scripts.com; returning false only means
    // this negative-assertion helper did not match that host (not CSP approval).
    for (const lookalikeSrc of [
      "https://va.vercel-scripts.com.evil.invalid/v1/script.js",
      "https://evil-va.vercel-scripts.com/v1/script.js",
      "https://evil.invalid/https://va.vercel-scripts.com",
      "https://evil.invalid/?src=https://va.vercel-scripts.com",
    ]) {
      expect(isObsoleteVercelTelemetrySrc(lookalikeSrc), lookalikeSrc).toBe(
        false
      );
    }

    for (const invalidOrNonHttp of [
      "http://[::1",
      "",
      "   ",
      null,
      undefined,
      "javascript:alert(1)",
      "data:text/javascript,alert(1)",
    ]) {
      expect(
        isObsoleteVercelTelemetrySrc(invalidOrNonHttp),
        String(invalidOrNonHttp)
      ).toBe(false);
    }
  });
});
