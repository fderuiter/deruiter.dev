import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";

const publishJSON = vi.fn();
vi.mock("@upstash/qstash", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@upstash/qstash")>();
  class MockClient {
    constructor(public config: unknown) {}
    publishJSON = publishJSON;
  }
  return { ...actual, Client: MockClient };
});

const processRetryQueue = vi.fn();
const getQueueEntryState = vi.fn();
vi.mock("@/lib/services/email-service", () => ({
  EmailService: {
    processRetryQueue: (...a: unknown[]) => processRetryQueue(...a),
    getQueueEntryState: (...a: unknown[]) => getQueueEntryState(...a),
  },
}));

import { createFailure, createSuccess } from "@/lib/services/service-result";
import { POST } from "@/app/api/webhooks/qstash/retry/route";
import {
  getQStashRetryDelaySeconds,
  getQStashRetryUrl,
  scheduleEmailRetry,
} from "@/lib/qstash-retry";

const CURRENT = "current-signing-key";
const NEXT = "next-signing-key";

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Signs a delivery the way QStash does: HS256 JWT binding url and body hash. */
function sign(body: string, key: string, url = getQStashRetryUrl()): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: "Upstash",
      sub: url,
      exp: now + 300,
      nbf: now - 10,
      iat: now,
      jti: crypto.randomUUID(),
      body: crypto.createHash("sha256").update(body).digest("base64url"),
    })
  );
  const sig = crypto
    .createHmac("sha256", key)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

function request(body: string, signature?: string): NextRequest {
  return new NextRequest("https://deruiter.dev/api/webhooks/qstash/retry", {
    method: "POST",
    body,
    headers: signature ? { "upstash-signature": signature } : {},
  });
}

const BODY = JSON.stringify({ queueId: "q_123" });

describe("QStash email retry", () => {
  beforeEach(() => {
    // jsdom's TextEncoder yields a Uint8Array from another realm, which the
    // verifier's JWT library rejects. Production runs on Node, not jsdom.
    vi.stubGlobal(
      "TextEncoder",
      class {
        encode(input: string): Uint8Array {
          return new Uint8Array(Buffer.from(input));
        }
      }
    );
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("QSTASH_TOKEN", "qtok");
    vi.stubEnv("QSTASH_CURRENT_SIGNING_KEY", CURRENT);
    vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", NEXT);
    processRetryQueue.mockReset();
    getQueueEntryState.mockReset();
    publishJSON.mockReset();
    publishJSON.mockResolvedValue({ messageId: "m1" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe("publishing", () => {
    it("publishes one delayed message targeting the webhook", async () => {
      expect(await scheduleEmailRetry("q_123", 1)).toBe(true);
      expect(publishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          url: getQStashRetryUrl(),
          body: { queueId: "q_123" },
          delay: 300,
        })
      );
    });

    it("backs off 5m, 15m, 1h and then holds", () => {
      expect([1, 2, 3, 4, 9].map(getQStashRetryDelaySeconds)).toEqual([
        300, 900, 3600, 3600, 3600,
      ]);
    });

    it("does nothing when QStash is not configured", async () => {
      vi.stubEnv("QSTASH_TOKEN", "");
      expect(await scheduleEmailRetry("q_123", 1)).toBe(false);
      expect(publishJSON).not.toHaveBeenCalled();
    });

    it("does not publish from preview deployments", async () => {
      vi.stubEnv("VERCEL_ENV", "preview");
      expect(await scheduleEmailRetry("q_123", 1)).toBe(false);
      expect(publishJSON).not.toHaveBeenCalled();
    });

    it("swallows publish failures so the daily cron stays the fallback", async () => {
      publishJSON.mockRejectedValue(new Error("qstash down"));
      await expect(scheduleEmailRetry("q_123", 1)).resolves.toBe(false);
    });
  });

  describe("webhook signature verification", () => {
    it("rejects an unsigned request without touching the queue", async () => {
      const res = await POST(request(BODY));
      expect(res.status).toBe(401);
      expect(processRetryQueue).not.toHaveBeenCalled();
    });

    it("rejects a request signed with the wrong key", async () => {
      const res = await POST(request(BODY, sign(BODY, "attacker-key")));
      expect(res.status).toBe(401);
      expect(processRetryQueue).not.toHaveBeenCalled();
    });

    it("rejects a valid signature replayed with a tampered body", async () => {
      const sig = sign(BODY, CURRENT);
      const res = await POST(
        request(JSON.stringify({ queueId: "other" }), sig)
      );
      expect(res.status).toBe(401);
      expect(processRetryQueue).not.toHaveBeenCalled();
    });

    it("rejects a signature bound to a different URL", async () => {
      const sig = sign(BODY, CURRENT, "https://evil.example/api");
      const res = await POST(request(BODY, sig));
      expect(res.status).toBe(401);
    });

    it("answers 503 when signing keys are not configured", async () => {
      vi.stubEnv("QSTASH_CURRENT_SIGNING_KEY", "");
      vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", "");
      const res = await POST(request(BODY, sign(BODY, CURRENT)));
      expect(res.status).toBe(503);
      expect(processRetryQueue).not.toHaveBeenCalled();
    });

    it("accepts the current key and the next key (rotation)", async () => {
      processRetryQueue.mockResolvedValue(
        createSuccess({ processed: 1, succeeded: 1, failed: 0 })
      );
      for (const key of [CURRENT, NEXT]) {
        const res = await POST(request(BODY, sign(BODY, key)));
        expect(res.status).toBe(200);
      }
      expect(processRetryQueue).toHaveBeenCalledTimes(2);
    });
  });

  describe("webhook behaviour", () => {
    it("runs a targeted retry for the signed queue id", async () => {
      processRetryQueue.mockResolvedValue(
        createSuccess({ processed: 1, succeeded: 1, failed: 0 })
      );
      const res = await POST(request(BODY, sign(BODY, CURRENT)));
      expect(res.status).toBe(200);
      expect(processRetryQueue).toHaveBeenCalledWith(
        expect.objectContaining({ queueId: "q_123", maxBatchSize: 1 })
      );
      expect(publishJSON).not.toHaveBeenCalled();
      expect(await res.json()).toMatchObject({
        received: true,
        queueId: "q_123",
        rescheduled: false,
      });
    });

    it("schedules the next attempt while the row is still retrying", async () => {
      processRetryQueue.mockResolvedValue(
        createSuccess({ processed: 1, succeeded: 0, failed: 1 })
      );
      getQueueEntryState.mockResolvedValue({ status: "RETRYING", attempts: 2 });
      const res = await POST(request(BODY, sign(BODY, CURRENT)));
      expect(await res.json()).toMatchObject({ rescheduled: true });
      expect(publishJSON).toHaveBeenCalledWith(
        expect.objectContaining({ delay: 900 })
      );
    });

    it("does not reschedule a terminally failed row", async () => {
      processRetryQueue.mockResolvedValue(
        createSuccess({ processed: 1, succeeded: 0, failed: 1 })
      );
      getQueueEntryState.mockResolvedValue({ status: "FAILED", attempts: 5 });
      const res = await POST(request(BODY, sign(BODY, CURRENT)));
      expect(await res.json()).toMatchObject({ rescheduled: false });
      expect(publishJSON).not.toHaveBeenCalled();
    });

    it("rejects a signed payload that fails schema validation", async () => {
      const bad = JSON.stringify({ queueId: "" });
      const res = await POST(request(bad, sign(bad, CURRENT)));
      expect(res.status).toBe(422);
    });

    it("answers 500 so QStash redelivers when processing throws", async () => {
      processRetryQueue.mockRejectedValue(new Error("db asleep"));
      const res = await POST(request(BODY, sign(BODY, CURRENT)));
      expect(res.status).toBe(500);
    });

    it("answers 500 so QStash redelivers when the retry returns a failure (#1532)", async () => {
      processRetryQueue.mockResolvedValue(
        createFailure(
          "QUEUE_LEASE_FAILED",
          "Could not lease due rows from the outbound email queue"
        )
      );
      const res = await POST(request(BODY, sign(BODY, CURRENT)));
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({
        error: "Failed to process email retry",
      });
      expect(getQueueEntryState).not.toHaveBeenCalled();
      expect(publishJSON).not.toHaveBeenCalled();
    });

    it("ignores validly signed deliveries on non-production deployments", async () => {
      vi.stubEnv("VERCEL_ENV", "preview");
      const res = await POST(request(BODY, sign(BODY, CURRENT)));
      expect(res.status).toBe(202);
      expect(processRetryQueue).not.toHaveBeenCalled();
    });
  });
});
