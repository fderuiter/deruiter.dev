// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import { POST } from "@/app/api/webhooks/resend/route";
import { EmailService } from "@/lib/services/email-service";
import { NextRequest } from "next/server";

// Mock prisma for suppression list operations
const mockSuppressionList = new Map<
  string,
  { id: string; email: string; reason: string; createdAt: Date }
>();

// Set of lowercased emails for which the next upsert() call should reject,
// simulating a database outage during suppression processing. Consumed
// on read (removed after failing once) so tests can target a single
// recipient in a multi-recipient batch.
const upsertFailuresQueued = new Set<string>();
// When true, every findUnique() call rejects, simulating a read-path outage.
let findUniqueShouldFail = false;

vi.mock("@/lib/db", () => ({
  prisma: {
    suppressionList: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => {
        if (findUniqueShouldFail) {
          throw new Error("Simulated database outage (read)");
        }
        return mockSuppressionList.get(where.email.toLowerCase()) || null;
      }),
      create: vi.fn(
        async ({ data }: { data: { email: string; reason: string } }) => {
          const record = {
            id: `supp_${Math.random().toString(36).substring(2, 9)}`,
            email: data.email.toLowerCase(),
            reason: data.reason,
            createdAt: new Date(),
          };
          mockSuppressionList.set(record.email, record);
          return record;
        }
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { email: string };
          create: { email: string; reason: string };
          update: { reason: string };
        }) => {
          const normalizedEmail = where.email.toLowerCase();
          if (upsertFailuresQueued.has(normalizedEmail)) {
            upsertFailuresQueued.delete(normalizedEmail);
            throw new Error("Simulated database outage (write)");
          }
          const existing = mockSuppressionList.get(normalizedEmail);
          if (existing) {
            existing.reason = update.reason;
            return existing;
          }
          const record = {
            id: `supp_${Math.random().toString(36).substring(2, 9)}`,
            email: create.email.toLowerCase(),
            reason: create.reason,
            createdAt: new Date(),
          };
          mockSuppressionList.set(record.email, record);
          return record;
        }
      ),
    },
  },
}));

function createSignedSvixHeaders(
  payload: string,
  secret: string = "whsec_testsecret1234567890abcdef123456"
) {
  const svixId = `msg_${Date.now()}`;
  const svixTimestamp = Math.floor(Date.now() / 1000).toString();
  const rawSecret = secret.startsWith("whsec_") ? secret.substring(6) : secret;
  const secretBuffer = Buffer.from(rawSecret, "base64");

  const toSign = `${svixId}.${svixTimestamp}.${payload}`;
  const signature = crypto
    .createHmac("sha256", secretBuffer)
    .update(toSign)
    .digest("base64");

  return {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": `v1,${signature}`,
    "content-type": "application/json",
  };
}

describe("Resend Webhook Receiver & Suppression Engine (#545)", () => {
  const originalWebhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  beforeEach(() => {
    mockSuppressionList.clear();
    upsertFailuresQueued.clear();
    findUniqueShouldFail = false;
    EmailService.resetClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalWebhookSecret === undefined) {
      delete process.env.RESEND_WEBHOOK_SECRET;
    } else {
      process.env.RESEND_WEBHOOK_SECRET = originalWebhookSecret;
    }
  });

  describe("Svix Webhook Cryptographic Verification", () => {
    it("should reject requests missing Svix headers with 400 or 401 status", async () => {
      const payload = JSON.stringify({
        type: "email.delivered",
        created_at: new Date().toISOString(),
        data: { id: "msg_123" },
      });

      const req = new NextRequest("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        body: payload,
        headers: { "content-type": "application/json" },
      });

      const res = await POST(req);
      expect(res.status).toBeGreaterThanOrEqual(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("should reject requests with invalid Svix signature with 401 status", async () => {
      const payload = JSON.stringify({
        type: "email.delivered",
        created_at: new Date().toISOString(),
        data: { id: "msg_123" },
      });

      const req = new NextRequest("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        body: payload,
        headers: {
          "svix-id": "msg_fake",
          "svix-timestamp": Math.floor(Date.now() / 1000).toString(),
          "svix-signature": "v1,invalid_signature_base64",
          "content-type": "application/json",
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/signature/i);
    });

    it("should accept valid Svix signed payload with 200 status", async () => {
      const secret = "whsec_mfZ718U337/lWvJc+wF7/5J1vM+w2YkZ";
      process.env.RESEND_WEBHOOK_SECRET = secret;

      const payload = JSON.stringify({
        type: "email.delivered",
        created_at: new Date().toISOString(),
        data: {
          id: "msg_delivered_123",
          to: ["valid@example.com"],
          from: "notifications@deruiter.dev",
        },
      });

      const headers = createSignedSvixHeaders(payload, secret);
      const req = new NextRequest("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        body: payload,
        headers,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.received).toBe(true);
    });
  });

  describe("Bounce and Complaint Suppression List Handling", () => {
    it("should record email to suppression list on email.bounced event", async () => {
      const secret = "whsec_mfZ718U337/lWvJc+wF7/5J1vM+w2YkZ";
      process.env.RESEND_WEBHOOK_SECRET = secret;

      const payload = JSON.stringify({
        type: "email.bounced",
        created_at: new Date().toISOString(),
        data: {
          id: "msg_bounce_123",
          to: ["bounced.user@example.com"],
          bounce: { message: "550 User not found" },
        },
      });

      const headers = createSignedSvixHeaders(payload, secret);
      const req = new NextRequest("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        body: payload,
        headers,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockSuppressionList.has("bounced.user@example.com")).toBe(true);
      expect(mockSuppressionList.get("bounced.user@example.com")?.reason).toBe(
        "BOUNCE"
      );
    });

    it("should record email to suppression list on email.complained event", async () => {
      const secret = "whsec_mfZ718U337/lWvJc+wF7/5J1vM+w2YkZ";
      process.env.RESEND_WEBHOOK_SECRET = secret;

      const payload = JSON.stringify({
        type: "email.complained",
        created_at: new Date().toISOString(),
        data: {
          id: "msg_complaint_123",
          to: ["complainer@example.com"],
        },
      });

      const headers = createSignedSvixHeaders(payload, secret);
      const req = new NextRequest("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        body: payload,
        headers,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockSuppressionList.has("complainer@example.com")).toBe(true);
      expect(mockSuppressionList.get("complainer@example.com")?.reason).toBe(
        "COMPLAINT"
      );
    });
  });

  describe("EmailService Suppression Defense", () => {
    it("should defensively block sending to suppressed email addresses", async () => {
      mockSuppressionList.set("blocked@example.com", {
        id: "supp_1",
        email: "blocked@example.com",
        reason: "BOUNCE",
        createdAt: new Date(),
      });

      const result = await EmailService.sendRawEmail({
        to: "blocked@example.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/suppress/i);
    });

    it("should allow sending to unsuppressed email addresses", async () => {
      const result = await EmailService.sendRawEmail({
        to: "active.user@example.com",
        subject: "Hello Active User",
        html: "<p>Welcome</p>",
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("fails open (does not block sending) when a suppression-list read fails", async () => {
      findUniqueShouldFail = true;

      const result = await EmailService.sendRawEmail({
        to: "unknown.status@example.com",
        subject: "Hello",
        html: "<p>Hi</p>",
      });

      // Documented policy: a suppression-list *read* failure fails open so a
      // transient database outage does not block all outbound mail. This is
      // distinct from a suppression *write* failure (see below), which must
      // never be silently swallowed.
      expect(result.success).toBe(true);
    });
  });

  describe("Durable Suppression Processing & Retry Contract (#697)", () => {
    it("reproduces the swallowed-failure bug: a suppression write failure must not be acknowledged with 200", async () => {
      const secret = "whsec_mfZ718U337/lWvJc+wF7/5J1vM+w2YkZ";
      process.env.RESEND_WEBHOOK_SECRET = secret;
      upsertFailuresQueued.add("outage.user@example.com");

      const payload = JSON.stringify({
        type: "email.bounced",
        created_at: new Date().toISOString(),
        data: {
          id: "msg_bounce_outage",
          to: ["outage.user@example.com"],
          bounce: { message: "550 User not found" },
        },
      });

      const headers = createSignedSvixHeaders(payload, secret);
      const req = new NextRequest("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        body: payload,
        headers,
      });

      const res = await POST(req);

      // The database write failed, so the response must be retryable (non-2xx)
      // and the address must NOT silently appear as suppressed.
      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(mockSuppressionList.has("outage.user@example.com")).toBe(false);
    });

    it("recovers on redelivery once the durable write succeeds, and the retry is idempotent", async () => {
      const secret = "whsec_mfZ718U337/lWvJc+wF7/5J1vM+w2YkZ";
      process.env.RESEND_WEBHOOK_SECRET = secret;

      const payload = JSON.stringify({
        type: "email.bounced",
        created_at: new Date().toISOString(),
        data: {
          id: "msg_bounce_recovers",
          to: ["recovers.user@example.com"],
          bounce: { message: "550 User not found" },
        },
      });
      const headers = createSignedSvixHeaders(payload, secret);
      const makeRequest = () =>
        new NextRequest("http://localhost:3000/api/webhooks/resend", {
          method: "POST",
          body: payload,
          headers,
        });

      // First delivery: the write fails, so Resend/Svix would redeliver.
      upsertFailuresQueued.add("recovers.user@example.com");
      const firstResponse = await POST(makeRequest());
      expect(firstResponse.status).toBeGreaterThanOrEqual(500);
      expect(mockSuppressionList.has("recovers.user@example.com")).toBe(false);

      // Redelivery (same svix-id, same body) succeeds now that the database
      // is healthy again.
      const secondResponse = await POST(makeRequest());
      expect(secondResponse.status).toBe(200);
      expect(mockSuppressionList.get("recovers.user@example.com")?.reason).toBe(
        "BOUNCE"
      );
    });

    it("propagates a partial-recipient batch failure so the whole event is retried, without losing the recipient that already succeeded", async () => {
      const secret = "whsec_mfZ718U337/lWvJc+wF7/5J1vM+w2YkZ";
      process.env.RESEND_WEBHOOK_SECRET = secret;
      upsertFailuresQueued.add("second.recipient@example.com");

      const payload = JSON.stringify({
        type: "email.complained",
        created_at: new Date().toISOString(),
        data: {
          id: "msg_complaint_partial",
          to: ["first.recipient@example.com", "second.recipient@example.com"],
        },
      });
      const headers = createSignedSvixHeaders(payload, secret);
      const makeRequest = () =>
        new NextRequest("http://localhost:3000/api/webhooks/resend", {
          method: "POST",
          body: payload,
          headers,
        });

      const firstResponse = await POST(makeRequest());
      expect(firstResponse.status).toBeGreaterThanOrEqual(500);
      // The first recipient's write already landed and is safe to keep —
      // re-applying it on retry is a no-op upsert, not a duplicate side effect.
      expect(mockSuppressionList.has("first.recipient@example.com")).toBe(true);
      expect(mockSuppressionList.has("second.recipient@example.com")).toBe(
        false
      );

      // Redelivery reprocesses both recipients; the already-suppressed one is
      // an idempotent no-op and the previously-failed one now succeeds.
      const secondResponse = await POST(makeRequest());
      expect(secondResponse.status).toBe(200);
      expect(mockSuppressionList.has("first.recipient@example.com")).toBe(true);
      expect(mockSuppressionList.has("second.recipient@example.com")).toBe(
        true
      );
    });
  });

  describe("Duplicate Delivery Idempotency (#697)", () => {
    it("safely processes a legitimate redelivery of the same event without rejecting it as a replay", async () => {
      const secret = "whsec_mfZ718U337/lWvJc+wF7/5J1vM+w2YkZ";
      process.env.RESEND_WEBHOOK_SECRET = secret;

      const payload = JSON.stringify({
        type: "email.bounced",
        created_at: new Date().toISOString(),
        data: {
          id: "msg_bounce_duplicate",
          to: ["duplicate.user@example.com"],
          bounce: { message: "550 User not found" },
        },
      });
      // Same svix-id, same timestamp, same body: Svix redelivers an event
      // this way on retry, and Resend can also send a genuine duplicate.
      const headers = createSignedSvixHeaders(payload, secret);
      const makeRequest = () =>
        new NextRequest("http://localhost:3000/api/webhooks/resend", {
          method: "POST",
          body: payload,
          headers,
        });

      const firstResponse = await POST(makeRequest());
      const secondResponse = await POST(makeRequest());

      // A legitimate replay is never rejected outright — both deliveries succeed.
      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);
      // But its effect is idempotent: exactly one suppression record, not two.
      expect(mockSuppressionList.size).toBe(1);
      expect(
        mockSuppressionList.get("duplicate.user@example.com")?.reason
      ).toBe("BOUNCE");
    });

    it("still rejects a request with a stale/invalid signature, distinct from a legitimate replay", async () => {
      const secret = "whsec_mfZ718U337/lWvJc+wF7/5J1vM+w2YkZ";
      process.env.RESEND_WEBHOOK_SECRET = secret;

      const payload = JSON.stringify({
        type: "email.bounced",
        created_at: new Date().toISOString(),
        data: { id: "msg_bounce_forged", to: ["forged@example.com"] },
      });

      // Correct headers shape, but signed with the wrong secret.
      const headers = createSignedSvixHeaders(
        payload,
        "whsec_wrongsecretwrongsecretwrong"
      );
      const req = new NextRequest("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        body: payload,
        headers,
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      expect(mockSuppressionList.has("forged@example.com")).toBe(false);
    });
  });

  describe("Svix Verification Edge Cases (#697)", () => {
    it("rejects a signed request whose timestamp is outside the replay tolerance window", async () => {
      const secret = "whsec_mfZ718U337/lWvJc+wF7/5J1vM+w2YkZ";
      process.env.RESEND_WEBHOOK_SECRET = secret;

      const payload = JSON.stringify({
        type: "email.delivered",
        created_at: new Date().toISOString(),
        data: { id: "msg_stale_timestamp" },
      });

      const staleTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
      const rawSecret = secret.startsWith("whsec_")
        ? secret.substring(6)
        : secret;
      const secretBuffer = Buffer.from(rawSecret, "base64");
      const svixId = `msg_${Date.now()}`;
      const toSign = `${svixId}.${staleTimestamp}.${payload}`;
      const signature = crypto
        .createHmac("sha256", secretBuffer)
        .update(toSign)
        .digest("base64");

      const req = new NextRequest("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        body: payload,
        headers: {
          "svix-id": svixId,
          "svix-timestamp": staleTimestamp,
          "svix-signature": `v1,${signature}`,
          "content-type": "application/json",
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("rejects the request when RESEND_WEBHOOK_SECRET is not configured, even with well-formed headers", async () => {
      delete process.env.RESEND_WEBHOOK_SECRET;

      const payload = JSON.stringify({
        type: "email.delivered",
        created_at: new Date().toISOString(),
        data: { id: "msg_no_secret" },
      });
      const headers = createSignedSvixHeaders(
        payload,
        "whsec_somesecretthatisnotconfigured"
      );
      const req = new NextRequest("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        body: payload,
        headers,
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("rejects a syntactically invalid JSON body even when correctly signed", async () => {
      const secret = "whsec_mfZ718U337/lWvJc+wF7/5J1vM+w2YkZ";
      process.env.RESEND_WEBHOOK_SECRET = secret;

      const payload = "{not valid json";
      const headers = createSignedSvixHeaders(payload, secret);
      const req = new NextRequest("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        body: payload,
        headers,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects a validly-signed, well-formed JSON body that does not match the Resend event schema", async () => {
      const secret = "whsec_mfZ718U337/lWvJc+wF7/5J1vM+w2YkZ";
      process.env.RESEND_WEBHOOK_SECRET = secret;

      const payload = JSON.stringify({
        type: "email.teleported", // not a real Resend event type
        data: {},
      });
      const headers = createSignedSvixHeaders(payload, secret);
      const req = new NextRequest("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        body: payload,
        headers,
      });

      const res = await POST(req);
      expect(res.status).toBe(422);
    });
  });
});
