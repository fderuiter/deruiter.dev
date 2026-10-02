// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

function parseDirectives(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy
      .split(";")
      .filter(Boolean)
      .map((directive) => {
        const [name, ...sources] = directive.trim().split(/\s+/);
        return [name, sources];
      })
  );
}

describe("Clerk browser resource policy", () => {
  it.each(["more-mustang-704.clerk.accounts.dev", "clerk.example.com"])(
    "permits the configured Clerk host %s on the admin surface without allowing arbitrary scripts",
    async (host) => {
      vi.stubEnv(
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        `pk_test_${btoa(`${host}$`)}`
      );
      vi.resetModules();
      const { applySecurityHeaders } = await import("@/lib/security-headers");
      const req = new NextRequest("http://localhost/admin");
      const response = applySecurityHeaders(NextResponse.next(), req);
      const directives = parseDirectives(
        response.headers.get("Content-Security-Policy")!
      );
      expect(directives["script-src"]).toContain(`https://${host}`);
      expect(directives["connect-src"]).toContain(`https://${host}`);
      expect(directives["frame-src"]).toContain(
        "https://challenges.cloudflare.com"
      );
      expect(directives["script-src"]).not.toContain("https:");
      expect(directives["script-src"]).not.toContain("*");
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    }
  );

  it("also permits the configured Clerk host on protected admin API routes", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      `pk_test_${btoa("clerk.example.com$")}`
    );
    vi.resetModules();
    const { applySecurityHeaders } = await import("@/lib/security-headers");
    const req = new NextRequest("http://localhost/api/admin/case-studies");
    const response = applySecurityHeaders(NextResponse.next(), req);
    const directives = parseDirectives(
      response.headers.get("Content-Security-Policy")!
    );
    expect(directives["script-src"]).toContain("https://clerk.example.com");
  });

  it("never sends Clerk script/connect/frame allowances to public visitor routes", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      `pk_test_${btoa("clerk.example.com$")}`
    );
    vi.resetModules();
    const { applySecurityHeaders } = await import("@/lib/security-headers");

    for (const path of ["/", "/case-studies/some-slug", "/api/case-studies"]) {
      const req = new NextRequest(`http://localhost${path}`);
      const response = applySecurityHeaders(NextResponse.next(), req);
      const directives = parseDirectives(
        response.headers.get("Content-Security-Policy")!
      );
      expect(directives["script-src"]).not.toContain(
        "https://clerk.example.com"
      );
      expect(directives["connect-src"]).not.toContain(
        "https://clerk.example.com"
      );
      expect(directives["frame-src"] ?? []).not.toContain(
        "https://challenges.cloudflare.com"
      );
      expect(directives["img-src"] ?? []).not.toContain(
        "https://img.clerk.com"
      );
    }
  });

  it("applies the same public policy when no request context is available", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      `pk_test_${btoa("clerk.example.com$")}`
    );
    vi.resetModules();
    const { applySecurityHeaders } = await import("@/lib/security-headers");
    const response = applySecurityHeaders(NextResponse.next());
    const directives = parseDirectives(
      response.headers.get("Content-Security-Policy")!
    );
    expect(directives["script-src"]).not.toContain("https://clerk.example.com");
  });
});
