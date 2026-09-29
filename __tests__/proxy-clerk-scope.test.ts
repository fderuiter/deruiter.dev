import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest, type NextFetchEvent } from "next/server";
import { fromPartial } from "@total-typescript/shoehorn";

const { clerkInvocations } = vi.hoisted(() => ({
  clerkInvocations: [] as string[],
}));

/**
 * Records whether the request reached Clerk at all. The real
 * `clerkMiddleware` performs a handshake against Clerk's API, so any route
 * that reaches it fails closed when the publishable key is missing or does
 * not resolve to a live instance -- which is exactly what took every public
 * route down in CI.
 */
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: () => (req: NextRequest) => {
    clerkInvocations.push(req.nextUrl.pathname);
    return new Response(null, { status: 200 });
  },
  createRouteMatcher:
    (patterns: string[]) => (req: { nextUrl: { pathname: string } }) =>
      patterns.some((pattern) =>
        new RegExp("^" + pattern.replace(/\(\.\*\)/g, ".*") + "$").test(
          req.nextUrl.pathname
        )
      ),
}));

const { proxy } = await import("@/proxy");

const event = fromPartial<NextFetchEvent>({});

const call = async (pathname: string, method = "GET") => {
  clerkInvocations.length = 0;
  await proxy(
    new NextRequest(`http://localhost:3000${pathname}`, { method }),
    event
  );
  return clerkInvocations;
};

describe("Proxy Clerk Scope", () => {
  beforeEach(() => {
    clerkInvocations.length = 0;
  });

  const PUBLIC_GET_ROUTES = [
    "/",
    "/arcade",
    "/arcade/working-with-duck",
    "/case-studies",
    "/proof",
    "/offline",
    "/api/telemetry",
    "/api/case-studies",
  ];

  it.each(PUBLIC_GET_ROUTES)(
    "public GET route %s never reaches Clerk",
    async (route) => {
      expect(await call(route, "GET")).toEqual([]);
    }
  );

  const MUTATING_CASE_STUDIES_METHODS = ["POST", "PUT", "DELETE", "PATCH"];

  it.each(MUTATING_CASE_STUDIES_METHODS)(
    "method-aware route /api/case-studies with %s reaches Clerk middleware",
    async (method) => {
      expect(await call("/api/case-studies", method)).toEqual([
        "/api/case-studies",
      ]);
    }
  );

  const ADMIN_ROUTES = ["/admin", "/admin/login", "/api/admin/case-studies"];

  it.each(ADMIN_ROUTES)(
    "admin route %s reaches Clerk middleware for GET and POST",
    async (route) => {
      expect(await call(route, "GET")).toEqual([route]);
      expect(await call(route, "POST")).toEqual([route]);
    }
  );

  it("still attaches a connection hash to public API requests", async () => {
    const res = await proxy(
      new NextRequest("http://localhost:3000/api/telemetry"),
      event
    );
    expect(res).toBeDefined();
    const headers = res!.headers;
    expect(
      headers.get("x-middleware-request-x-connection-hash") ??
        headers.get("x-connection-hash")
    ).toBeTruthy();
  });

  it("attaches security headers to public responses", async () => {
    const res = await proxy(
      new NextRequest("http://localhost:3000/api/case-studies"),
      event
    );
    expect(res).toBeDefined();
    expect(res!.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res!.headers.get("content-security-policy")).toBeTruthy();
  });

  it("handles mobile user agent routing and security headers without redirect loops", async () => {
    const mobileReq = new NextRequest("http://localhost:3000/proof?mode=demo", {
      headers: {
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      },
    });
    const redirectRes = await proxy(mobileReq, event);
    expect(redirectRes).toBeDefined();
    expect(redirectRes!.status).toBe(307);
    expect(redirectRes!.headers.get("location")).toBe(
      "http://localhost:3000/m/proof?mode=demo"
    );
    expect(redirectRes!.headers.get("x-content-type-options")).toBe("nosniff");

    const decoupledReq = new NextRequest(
      "http://localhost:3000/m/proof?mode=demo",
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        },
      }
    );
    const passRes = await proxy(decoupledReq, event);
    expect(passRes).toBeDefined();
    expect(passRes!.status).toBe(200);
    expect(passRes!.headers.get("location")).toBeNull();
    expect(passRes!.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
