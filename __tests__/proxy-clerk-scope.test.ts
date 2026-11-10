// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest, type NextFetchEvent } from "next/server";
import { fromPartial } from "@total-typescript/shoehorn";

const { clerkInvocations, protectedPaths } = vi.hoisted(() => ({
  clerkInvocations: [] as string[],
  protectedPaths: [] as string[],
}));

/**
 * Records whether the request reached Clerk at all. The real
 * `clerkMiddleware` performs a handshake against Clerk's API, so any route
 * that reaches it fails closed when the publishable key is missing or does
 * not resolve to a live instance -- which is exactly what took every public
 * route down in CI.
 */
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware:
    (
      handler: (
        auth: { protect: () => Promise<void> },
        req: NextRequest
      ) => Promise<Response>
    ) =>
    (req: NextRequest) => {
      clerkInvocations.push(req.nextUrl.pathname);
      return handler(
        {
          protect: async () => {
            protectedPaths.push(req.nextUrl.pathname);
          },
        },
        req
      );
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
    protectedPaths.length = 0;
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

  it("protects the admin area but not its login page", async () => {
    await call("/admin");
    await call("/api/admin/case-studies", "POST");
    await call("/admin/login");
    await call("/api/case-studies", "POST");
    expect(protectedPaths).toEqual(["/admin", "/api/admin/case-studies"]);
  });

  it("gives Clerk routes the security headers too", async () => {
    const res = await proxy(
      new NextRequest("http://localhost:3000/admin/login"),
      event
    );
    expect(res!.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("leaves the connection hash to the API handlers (#3205)", async () => {
    const res = await proxy(
      new NextRequest("http://localhost:3000/api/case-studies"),
      event
    );
    expect(res).toBeDefined();
    expect(
      res!.headers.get("x-middleware-request-x-connection-hash")
    ).toBeNull();
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
});
