// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { NextRequest, type NextFetchEvent } from "next/server";
import { fromPartial } from "@total-typescript/shoehorn";

vi.mock("next/font/google", () => ({
  Lexend: () => ({ variable: "--font-lexend" }),
  Atkinson_Hyperlegible: () => ({ variable: "--font-atkinson" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

import { proxy } from "@/proxy";
import {
  generateNonce,
  buildContentSecurityPolicy,
  applySecurityHeaders,
} from "@/lib/security-headers";
import RootLayout from "@/app/layout";

// Mock next/headers for layout test
vi.mock("next/headers", () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Map([["x-nonce", "test-nonce-12345"]])),
}));

// Mock Clerk server
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

describe("Dynamic Nonce Generation & Strict CSP Hash Pinning Architecture", () => {
  const dummyEvent = fromPartial<NextFetchEvent>({});

  it("Requirement 1: Proxy middleware generates unique per-request SHA-256 base64 nonces in x-nonce header", async () => {
    const req1 = new NextRequest("http://localhost:3000/");
    const req2 = new NextRequest("http://localhost:3000/case-studies");

    const res1 = await proxy(req1, dummyEvent);
    const res2 = await proxy(req2, dummyEvent);

    expect(res1).toBeDefined();
    expect(res2).toBeDefined();

    const nonce1 = res1!.headers.get("x-nonce");
    const nonce2 = res2!.headers.get("x-nonce");

    expect(nonce1).toBeTruthy();
    expect(nonce2).toBeTruthy();
    expect(nonce1).not.toBe(nonce2);

    // Verify SHA-256 base64 string format (32 bytes = 44 base64 chars with =)
    expect(nonce1).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    expect(nonce2).toMatch(/^[A-Za-z0-9+/]{43}=$/);
  });

  it("Requirement 2: CSP script-src replaces unsafe-inline and unsafe-eval with nonce-{nonce} and strict-dynamic", () => {
    const sampleNonce = generateNonce();
    const csp = buildContentSecurityPolicy(false, sampleNonce);

    const directives = Object.fromEntries(
      csp
        .split(";")
        .filter(Boolean)
        .map((d) => {
          const [name, ...sources] = d.trim().split(/\s+/);
          return [name, sources];
        })
    );

    const scriptSrc = directives["script-src"];
    expect(scriptSrc).toContain(`'nonce-${sampleNonce}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("Requirement 3 & 4: RootLayout renders telemetry scripts with explicit SHA-384 integrity and crossorigin=anonymous attributes", async () => {
    const layoutJsx = await RootLayout({ children: "Test Child" });

    // Validate React element structure
    expect(layoutJsx).toBeDefined();
    expect(layoutJsx.type).toBe("html");

    // Extract head children
    const head = layoutJsx.props.children.find(
      (child: { type: string }) => child?.type === "head"
    );
    expect(head).toBeDefined();

    const headChildren = head.props.children.flat(Infinity);

    // Locate telemetry scripts
    const analyticsScript = headChildren.find(
      (c: { props?: { src?: string } }) =>
        c?.props?.src === "https://va.vercel-scripts.com/v1/script.js"
    );
    const speedInsightsScript = headChildren.find(
      (c: { props?: { src?: string } }) =>
        c?.props?.src ===
        "https://va.vercel-scripts.com/v1/speed-insights/script.js"
    );

    expect(analyticsScript).toBeDefined();
    expect(analyticsScript.props.integrity).toBe(
      "sha384-BZkUlnHxIcBvxJPoeKYfzzACTHqHtpUJ0qHirqeslo4I3k8wEaoSnJyPGyguandz"
    );
    expect(analyticsScript.props.crossOrigin).toBe("anonymous");
    expect(analyticsScript.props.nonce).toBe("test-nonce-12345");

    expect(speedInsightsScript).toBeDefined();
    expect(speedInsightsScript.props.integrity).toBe(
      "sha384-+0Qu2ywcjV4AEzNpfUDkt+pgMgvC6r5/Dv3PULLimAa3Jk5UCiQ0plSg53uQkjBn"
    );
    expect(speedInsightsScript.props.crossOrigin).toBe("anonymous");
    expect(speedInsightsScript.props.nonce).toBe("test-nonce-12345");
  });

  it("Acceptance Criteria 4: Requests lacking valid nonces fail CSP match evaluation", () => {
    const reqNonce = generateNonce();
    const wrongNonce = generateNonce();

    const response = applySecurityHeaders(
      new Response(null, {
        status: 200,
      }) as unknown as import("next/server").NextResponse,
      new NextRequest("http://localhost:3000/"),
      reqNonce
    );

    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toContain(`'nonce-${reqNonce}'`);
    expect(csp).not.toContain(`'nonce-${wrongNonce}'`);

    const scriptDirective = csp
      ?.split(";")
      .find((d) => d.trim().startsWith("script-src"));
    expect(scriptDirective).not.toContain("'unsafe-inline'");
    expect(scriptDirective).not.toContain("'unsafe-eval'");
  });
});
