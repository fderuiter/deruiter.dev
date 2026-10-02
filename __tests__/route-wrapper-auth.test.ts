// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/route-wrapper";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { validateSyncRequest } from "@/lib/security";
import { SECURITY_HEADERS } from "@/lib/security-headers";

vi.mock("@/lib/auth/admin", () => ({
  isCurrentUserAdmin: vi.fn(),
}));

vi.mock("@/lib/security", () => ({
  validateSyncRequest: vi.fn(),
  validateRouteInitialization: vi.fn(),
}));

describe("createApiHandler Inline Authentication Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("clerk_admin Requirement", () => {
    it("rejects unauthenticated or non-admin requests with 403 Forbidden and security headers", async () => {
      vi.mocked(isCurrentUserAdmin).mockResolvedValue(false);

      const handler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ success: true }));
      const wrapped = createApiHandler(handler, { auth: "clerk_admin" });

      const req = new NextRequest("http://localhost:3000/api/admin/test", {
        method: "POST",
      });
      const res = await wrapped(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("Administrator access required");
      expect(handler).not.toHaveBeenCalled();

      // Check security headers
      Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
        if (header === "Content-Security-Policy" || header === "x-nonce") {
          expect(res.headers.get(header)).toBeTruthy();
        } else {
          expect(res.headers.get(header)).toBe(value);
        }
      });
      const csp1 = res.headers.get("Content-Security-Policy");
      const scriptDirective1 = csp1
        ?.split(";")
        .find((d) => d.trim().startsWith("script-src"));
      expect(scriptDirective1).toContain("'strict-dynamic'");
      expect(scriptDirective1).not.toContain("'unsafe-inline'");
      expect(scriptDirective1).not.toContain("'unsafe-eval'");
    });

    it("allows authorized admin requests to proceed to handler execution", async () => {
      vi.mocked(isCurrentUserAdmin).mockResolvedValue(true);

      const handler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ data: "ok" }));
      const wrapped = createApiHandler(handler, { auth: "clerk_admin" });

      const req = new NextRequest("http://localhost:3000/api/admin/test", {
        method: "POST",
      });
      const res = await wrapped(req);

      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });

    it("evaluates clerk_admin BEFORE schema validation or request body parsing", async () => {
      vi.mocked(isCurrentUserAdmin).mockResolvedValue(false);

      const handler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ data: "ok" }));
      const schema = z.object({ title: z.string().min(5) });
      const wrapped = createApiHandler(handler, {
        schema,
        type: "body",
        auth: "clerk_admin",
      });

      // Send invalid JSON body + unauthenticated user
      const req = new NextRequest("http://localhost:3000/api/admin/test", {
        method: "POST",
        body: "{ malformed json",
      });
      const res = await wrapped(req);

      // Should be blocked by 403 Forbidden (auth check) rather than 400 Bad Request (JSON parse error)
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("Administrator access required");
    });
  });

  describe("cron_secret Requirement", () => {
    it("rejects requests missing valid cron secret with 401 Unauthorized and security headers", async () => {
      vi.mocked(validateSyncRequest).mockReturnValue({
        isValid: false,
        errorResponse: NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        ),
      });

      const handler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ processed: 10 }));
      const wrapped = createApiHandler(handler, { auth: "cron_secret" });

      const req = new NextRequest("http://localhost:3000/api/cron/maintenance");
      const res = await wrapped(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
      expect(handler).not.toHaveBeenCalled();

      // Check security headers
      Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
        if (header === "Content-Security-Policy" || header === "x-nonce") {
          expect(res.headers.get(header)).toBeTruthy();
        } else {
          expect(res.headers.get(header)).toBe(value);
        }
      });
      const csp2 = res.headers.get("Content-Security-Policy");
      const scriptDirective2 = csp2
        ?.split(";")
        .find((d) => d.trim().startsWith("script-src"));
      expect(scriptDirective2).toContain("'strict-dynamic'");
      expect(scriptDirective2).not.toContain("'unsafe-inline'");
      expect(scriptDirective2).not.toContain("'unsafe-eval'");
    });

    it("allows requests with valid cron secret to proceed", async () => {
      vi.mocked(validateSyncRequest).mockReturnValue({ isValid: true });

      const handler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ processed: 10 }));
      const wrapped = createApiHandler(handler, { auth: "cron_secret" });

      const req = new NextRequest(
        "http://localhost:3000/api/cron/maintenance",
        {
          headers: { authorization: "Bearer secret" },
        }
      );
      const res = await wrapped(req);

      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("public Requirement or Default", () => {
    it("bypasses authentication checks for public endpoints", async () => {
      const handler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ public: true }));
      const wrapped = createApiHandler(handler, { auth: "public" });

      const req = new NextRequest("http://localhost:3000/api/public-route");
      const res = await wrapped(req);

      expect(res.status).toBe(200);
      expect(isCurrentUserAdmin).not.toHaveBeenCalled();
      expect(validateSyncRequest).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });

    it("defaults to public auth when auth option is omitted", async () => {
      const handler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ default: true }));
      const wrapped = createApiHandler(handler);

      const req = new NextRequest("http://localhost:3000/api/default-route");
      const res = await wrapped(req);

      expect(res.status).toBe(200);
      expect(wrapped.auth).toBe("public");
      expect(isCurrentUserAdmin).not.toHaveBeenCalled();
      expect(validateSyncRequest).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });
  });
});
