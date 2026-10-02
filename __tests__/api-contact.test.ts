// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/contact/route";
import { NextRequest } from "next/server";
import { resetSubmissionAttemptRateLimit } from "@/lib/moderation";
import { EmailService } from "@/lib/services/email-service";

describe("API: /api/contact Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSubmissionAttemptRateLimit();
  });

  const createRequest = (
    body: unknown,
    headers: Record<string, string> = {}
  ) => {
    return new NextRequest("http://localhost:3000/api/contact", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-connection-hash": "test-client-hash-1",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  };

  it("should return 400 for invalid JSON body payload", async () => {
    const req = new NextRequest("http://localhost:3000/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json-string",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON body payload");
  });

  it("should return 400 if validation fails on mandatory fields", async () => {
    const req = createRequest({
      name: "A", // too short
      email: "not-an-email",
      subject: "hi", // too short
      message: "short", // too short
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
    expect(data.details).toBeDefined();
    expect(data.details.length).toBeGreaterThanOrEqual(3);
  });

  it("should return 400 with tone error if message violates community guidelines", async () => {
    const req = createRequest({
      name: "Troll User",
      email: "troll@example.com",
      intent: "general",
      subject: "Terrible Website",
      message:
        "This site is a complete piece of shit garbage code waste of time.",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("community tone standards");
  });

  it("should return 429 if rate limit is exceeded for the same connection hash", async () => {
    const validBody = {
      name: "John Doe",
      email: "john@example.com",
      intent: "consulting",
      subject: "Consulting Project Inquiry",
      message:
        "Hello, I would like to hire you for a clinical EDC consulting project.",
      _clientTimestamp: Date.now() - 5000,
    };

    // 5 allowed attempts
    for (let i = 0; i < 5; i++) {
      const res = await POST(createRequest(validBody));
      expect(res.status).toBe(201);
    }

    // 6th attempt should be rate limited
    const limitedRes = await POST(createRequest(validBody));
    expect(limitedRes.status).toBe(429);
    const data = await limitedRes.json();
    expect(data.error).toContain("Too many contact submission attempts");
  });

  it("should silently absorb honeypot submissions without dispatching email", async () => {
    const spy = vi.spyOn(EmailService, "sendContactInquiry");

    const req = createRequest({
      name: "Bot Spammer",
      email: "bot@spammer.com",
      intent: "recruiting",
      subject: "Crypto Investment Opportunity",
      message: "Check out this amazing cryptocurrency opportunity right now.",
      _gotcha: "http://spam-link.com", // honeypot filled
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
    const spy = vi.spyOn(EmailService, "sendContactInquiry");

    const req = createRequest({
      name: "Fast Bot",
      email: "fastbot@spammer.com",
      intent: "general",
      subject: "Instantaneous Submission",
      message: "This payload was submitted 200ms after page mount.",
      _clientTimestamp: Date.now() - 200, // < 2000ms
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.simulated).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it("should process valid submission and return 201", async () => {
    const spy = vi
      .spyOn(EmailService, "sendContactInquiry")
      .mockResolvedValueOnce({
        success: true,
        adminResult: {
          success: true,
          data: { id: "msg_contact_success" },
          simulated: true,
        },
        confirmationResult: {
          success: true,
          data: { id: "msg_confirm_success" },
        },
      });

    const req = createRequest({
      name: "Grace Hopper",
      email: "grace@navy.mil",
      intent: "collaboration",
      subject: "Compiler & Proof Architecture",
      message:
        "Let us discuss the deductive logic AST engine and nanosecond verification.",
      _clientTimestamp: Date.now() - 5000,
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.messageId).toBe("msg_contact_success");
    expect(spy).toHaveBeenCalled();
  });
});
