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

const call = async (pathname: string) => {
  clerkInvocations.length = 0;
  await proxy(new NextRequest(`http://localhost:3000${pathname}`), event);
  return clerkInvocations;
};

describe("Proxy Clerk Scope", () => {
  beforeEach(() => {
    clerkInvocations.length = 0;
  });

  const PUBLIC_ROUTES = [
    "/",
    "/arcade",
    "/arcade/working-with-duck",
    "/case-studies",
    "/proof",
    "/offline",
    "/api/telemetry",
  ];

  it.each(PUBLIC_ROUTES)(
    "public route %s never reaches Clerk",
    async (route) => {
      expect(await call(route)).toEqual([]);
    }
  );

  const ADMIN_ROUTES = [
    "/admin",
    "/admin/login",
    "/api/admin/case-studies",
    "/api/case-studies",
  ];

  it.each(ADMIN_ROUTES)(
    "admin or clerk_admin route %s reaches Clerk middleware",
    async (route) => {
      expect(await call(route)).toEqual([route]);
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
});
