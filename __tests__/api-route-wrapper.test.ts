// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { z } from "zod";
import { fromPartial } from "@total-typescript/shoehorn";
import { GET as getMedia } from "@/app/api/media/[key]/route";
import { POST as postResend } from "@/app/api/webhooks/resend/route";
import { POST as postQStashRetry } from "@/app/api/webhooks/qstash/retry/route";
import {
  GetMediaAssetHandler,
  HandleResendWebhookHandler,
  ProcessRetryQueueHandler,
  createFailure,
} from "@/lib/services";
import { SECURITY_HEADERS } from "@/lib/security-headers";
import {
  mapServiceErrorToHttpStatus,
  serviceFailureResponse,
  zodIssueDetails,
} from "@/lib/route-wrapper";
import { logger } from "@/lib/logger";

/**
 * The media and webhook routes go through `createApiHandler` like every
 * other route, name their `auth`, and keep their own checks (#3472).
 */

vi.mock("@/lib/qstash-retry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@upstash/qstash")>();
  return {
    ...actual,
    isQStashReceivingConfigured: vi.fn(() => true),
    verifyQStashSignature: vi.fn(async () => false),
  };
});

/** A header the wrapper adds that no handler sets itself. */
const WRAPPER_HEADER = Object.keys(SECURITY_HEADERS).find(
  (key) => key !== "Content-Security-Policy"
)!;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /api/media/[key] through the route wrapper", () => {
  it("serves the asset with the wrapper's headers and keeps its own strict CSP", async () => {
    vi.spyOn(GetMediaAssetHandler.prototype, "execute").mockResolvedValue(
      fromPartial({
        success: true,
        data: { buffer: Buffer.from("png-bytes"), contentType: "image/png" },
      })
    );
    const req = new NextRequest("http://localhost:3000/api/media/hero.png");

    const res = await getMedia(req, {
      params: Promise.resolve({ key: "hero.png" }),
    });

    expect(getMedia.auth).toBe("public");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'"
    );
    expect(res.headers.get(WRAPPER_HEADER)).toBe(
      SECURITY_HEADERS[WRAPPER_HEADER as keyof typeof SECURITY_HEADERS]
    );
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("png-bytes");
  });

  it("returns 404 for a missing asset", async () => {
    vi.spyOn(GetMediaAssetHandler.prototype, "execute").mockResolvedValue(
      fromPartial({ success: true, data: null })
    );
    const req = new NextRequest("http://localhost:3000/api/media/none.png");

    const res = await getMedia(req, {
      params: Promise.resolve({ key: "none.png" }),
    });

    expect(res.status).toBe(404);
    expect(res.headers.get(WRAPPER_HEADER)).not.toBeNull();
  });
});

describe("webhooks through the route wrapper", () => {
  it("rejects a Resend delivery with a bad signature before touching the payload", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_dGVzdC1zZWNyZXQ=");
    const handle = vi.spyOn(HandleResendWebhookHandler.prototype, "execute");
    const req = new NextRequest("http://localhost:3000/api/webhooks/resend", {
      method: "POST",
      body: JSON.stringify({ type: "email.bounced", data: {} }),
      headers: {
        "svix-id": "msg_1",
        "svix-timestamp": String(Math.floor(Date.now() / 1000)),
        "svix-signature": "v1,not-a-valid-signature",
      },
    });

    const res = await postResend(req);

    expect(postResend.auth).toBe("public");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: "Invalid Svix webhook signature",
    });
    expect(res.headers.get(WRAPPER_HEADER)).not.toBeNull();
    expect(handle).not.toHaveBeenCalled();
  });

  it("rejects a QStash delivery with a bad signature before any retry", async () => {
    const retry = vi.spyOn(ProcessRetryQueueHandler.prototype, "execute");
    const req = new NextRequest(
      "http://localhost:3000/api/webhooks/qstash/retry",
      {
        method: "POST",
        body: JSON.stringify({ queueId: "q_1" }),
        headers: { "upstash-signature": "forged" },
      }
    );

    const res = await postQStashRetry(req);

    expect(postQStashRetry.auth).toBe("public");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid QStash signature" });
    expect(retry).not.toHaveBeenCalled();
  });
});

describe("mapServiceErrorToHttpStatus & serviceFailureResponse", () => {
  it("maps canonical domain error codes to HTTP status codes", () => {
    expect(mapServiceErrorToHttpStatus("NOT_FOUND")).toBe(404);
    expect(mapServiceErrorToHttpStatus("POST_NOT_FOUND")).toBe(404);
    expect(mapServiceErrorToHttpStatus("INVALID_TOKEN")).toBe(404);
    expect(mapServiceErrorToHttpStatus("DUPLICATE_SLUG")).toBe(409);
    expect(mapServiceErrorToHttpStatus("RATE_LIMITED")).toBe(429);
    expect(mapServiceErrorToHttpStatus("UNAUTHORIZED")).toBe(401);
    expect(mapServiceErrorToHttpStatus("FORBIDDEN")).toBe(403);
    expect(mapServiceErrorToHttpStatus("SCHEMA_VALIDATION_FAILED")).toBe(422);
    expect(mapServiceErrorToHttpStatus("INVALID_INPUT")).toBe(400);
    expect(mapServiceErrorToHttpStatus("STORAGE_UNAVAILABLE")).toBe(503);
    expect(mapServiceErrorToHttpStatus("PERSISTENCE_FAILED")).toBe(503);
    expect(mapServiceErrorToHttpStatus("UNKNOWN_ERROR", 502)).toBe(502);
  });

  it("logs raw Error cause once for 5xx responses and honors statusOverrides", async () => {
    const logSpy = vi.spyOn(logger, "error").mockImplementation(() => ({
      level: "error",
      message: "",
      timestamp: "",
    }));
    const cause = new Error("Neon socket closed");

    const unavailableRes = serviceFailureResponse(
      createFailure("STORAGE_UNAVAILABLE", "Database temporarily unavailable", {
        recoverable: true,
        details: cause,
      }),
      { logContext: "Persist failed:" }
    );
    expect(unavailableRes.status).toBe(503);
    await expect(unavailableRes.json()).resolves.toEqual({
      error: "Database temporarily unavailable",
    });
    expect(logSpy).toHaveBeenCalledWith("Persist failed:", cause, undefined);

    logSpy.mockClear();
    const clientRes = serviceFailureResponse(
      createFailure("CUSTOM_CLIENT_CODE", "Bad input"),
      { statusOverrides: { CUSTOM_CLIENT_CODE: 400 } }
    );
    expect(clientRes.status).toBe(400);
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe("zodIssueDetails", () => {
  const schema = z.object({ name: z.string() });

  it("maps each issue to a dotted path and its message", () => {
    const error = schema.safeParse({ name: 1 }).error;
    expect(zodIssueDetails(error, "payload")).toEqual([
      { path: "name", message: expect.any(String) },
    ]);
  });

  it("uses the fallback path for an issue at the top level", () => {
    const error = schema.safeParse("not an object").error;
    expect(zodIssueDetails(error, "payload")[0].path).toBe("payload");
    expect(zodIssueDetails(error)[0].path).toBe("");
  });
});

describe("every API route names its auth", () => {
  function routeFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return routeFiles(full);
      return name === "route.ts" ? [full] : [];
    });
  }

  it.each(
    routeFiles(path.resolve(process.cwd(), "app/api")).map((file) => [
      path.relative(process.cwd(), file),
    ])
  )("%s", (file) => {
    const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
    const handlers =
      source.match(/\b(createApiHandler|withApiWrapper)\(/g) ?? [];
    const named =
      source.match(/\bauth:\s*"(public|clerk_admin|cron_secret)"/g) ?? [];
    expect(handlers.length).toBeGreaterThan(0);
    expect(named).toHaveLength(handlers.length);
  });
});
