// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/newsletter/route";
import { NextRequest } from "next/server";
import { resetSubmissionAttemptRateLimit } from "@/lib/moderation";
import { NewsletterService } from "@/lib/services/newsletter-service";

describe("API: /api/newsletter Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSubmissionAttemptRateLimit();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createRequest = (
    body: unknown,
    headers: Record<string, string> = {}
  ) => {
    return new NextRequest("http://localhost:3000/api/newsletter", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-connection-hash": "test-newsletter-hash-1",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  };

  it("should return 400 for invalid JSON body payload", async () => {
    const req = new NextRequest("http://localhost:3000/api/newsletter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json-payload",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON body payload");
  });

  it("should return 400 if email is missing or malformed", async () => {
    const req = createRequest({ email: "invalid-email-format" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
    expect(data.details).toBeDefined();
  });

  it("should return 429 if rate limit is exceeded for the same connection hash", async () => {
    const validBody = {
      email: "subscriber@example.com",
      _clientTimestamp: Date.now() - 5000,
    };
    vi.spyOn(NewsletterService, "subscribe").mockResolvedValue({
      success: true,
      confirmationSent: true,
    });

    // 5 allowed attempts
    for (let i = 0; i < 5; i++) {
      const res = await POST(createRequest(validBody));
      expect(res.status).toBe(201);
    }

    // 6th attempt should be rate limited
    const limitedRes = await POST(createRequest(validBody));
    expect(limitedRes.status).toBe(429);
    const data = await limitedRes.json();
    expect(data.error).toContain("Too many subscription attempts");
  });

  it("should silently absorb honeypot submissions without dispatching email", async () => {
    const spy = vi.spyOn(NewsletterService, "subscribe");

    const req = createRequest({
      email: "bot@spammer.com",
      _gotcha: "http://spam-link.com",
      _clientTimestamp: Date.now() - 10000,
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.simulated).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it("should silently absorb submissions that arrive under 2000ms duration threshold", async () => {
    const spy = vi.spyOn(NewsletterService, "subscribe");

    const req = createRequest({
      email: "fastbot@spammer.com",
      _clientTimestamp: Date.now() - 200, // < 2000ms
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.simulated).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it("should process valid subscription and return 201 with success message", async () => {
    const spy = vi.spyOn(NewsletterService, "subscribe").mockResolvedValueOnce({
      success: true,
      confirmationSent: true,
      simulated: true,
    });

    const req = createRequest({
      email: "systems.architect@example.com",
      _clientTimestamp: Date.now() - 5000,
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    // Double opt-in (#841): the visitor is asked to confirm, and the address is
    // passed on alone.
    expect(data.message).toContain("confirm");
    expect(spy).toHaveBeenCalledWith("systems.architect@example.com");
  });
});
