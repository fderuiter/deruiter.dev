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
import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  securityHeaderRules,
  SECURITY_HEADERS,
} from "@/lib/security-headers";
import RootLayout from "@/app/layout";

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

  it("runs the proxy only where it is needed, not on public pages", () => {
    const matcher = config.matcher;
    const matched = (path: string) =>
      matcher.some((source) => matchesSource(source, path));

    for (const path of [
      "/admin",
      "/admin/blog",
      "/api/telemetry",
      "/proof",
      "/crf",
      "/neuro/scan",
      "/patrol",
    ]) {
      expect(matched(path), path).toBe(true);
    }
    for (const path of [
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

  it("renders the root layout without reading request headers, keeping SRI on telemetry scripts", async () => {
    const layoutJsx = await RootLayout({ children: "Test Child" });
    expect(headersSpy).not.toHaveBeenCalled();
    expect(layoutJsx.type).toBe("html");

    const head = layoutJsx.props.children.find(
      (child: { type: string }) => child?.type === "head"
    );
    const headChildren = head.props.children.flat(Infinity);

    const analyticsScript = headChildren.find(
      (c: { props?: { src?: string } }) =>
        c?.props?.src === "https://va.vercel-scripts.com/v1/script.js"
    );
    const speedInsightsScript = headChildren.find(
      (c: { props?: { src?: string } }) =>
        c?.props?.src ===
        "https://va.vercel-scripts.com/v1/speed-insights/script.js"
    );

    expect(analyticsScript.props.integrity).toBe(
      "sha384-BZkUlnHxIcBvxJPoeKYfzzACTHqHtpUJ0qHirqeslo4I3k8wEaoSnJyPGyguandz"
    );
    expect(analyticsScript.props.crossOrigin).toBe("anonymous");
    expect(speedInsightsScript.props.integrity).toBe(
      "sha384-+0Qu2ywcjV4AEzNpfUDkt+pgMgvC6r5/Dv3PULLimAa3Jk5UCiQ0plSg53uQkjBn"
    );
    expect(speedInsightsScript.props.crossOrigin).toBe("anonymous");
    for (const child of headChildren) {
      expect(child?.props?.nonce).toBeUndefined();
    }
  });
});
