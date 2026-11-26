// @vitest-environment node
import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  SendContactInquiryHandler,
  getEffectiveResendApiKey,
  getResendClient,
  isRetryableEmailError,
  parseQueuedHeaders,
  parseQueuedTags,
  resetEmailClient,
  shouldSimulateEmailDelivery,
  verifySvixSignature,
  type SendContactInquiryDeps,
} from "@/lib/services";

describe("SendContactInquiryHandler (Logic Test)", () => {
  it("returns INVALID_INPUT when submission payload is invalid", async () => {
    const handler = new SendContactInquiryHandler();
    const result = await handler.execute({
      submission: {
        name: "",
        email: "bad",
        intent: "general",
        subject: "",
        message: "short",
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("dispatches admin inquiry and confirmation receipt via sendRawEmailHandler", async () => {
    const sendExecute = vi.fn(async () => ({
      success: true as const,
      data: { id: "msg-123", simulated: true },
    }));
    const deps = fromPartial<SendContactInquiryDeps>({
      sendRawEmailHandler: { execute: sendExecute },
    });

    const handler = new SendContactInquiryHandler(deps);
    const result = await handler.execute({
      submission: {
        name: "Jane Doe",
        email: "jane@example.com",
        intent: "collaboration",
        subject: "Architecture Collaboration",
        message:
          "Hello Frederick, I would love to discuss an architectural collaboration.",
      },
      connectionHash: "hash-1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messageId).toBe("msg-123");
    }
    expect(sendExecute).toHaveBeenCalledTimes(2);
  });

  it("propagates admin delivery failure and handles thrown send exceptions", async () => {
    let callCount = 0;
    const deps = fromPartial<SendContactInquiryDeps>({
      sendRawEmailHandler: {
        execute: async () => {
          callCount += 1;
          if (callCount === 1) {
            return {
              success: false,
              error: {
                code: "TRANSPORT_UNCONFIGURED",
                message: "Missing RESEND_API_KEY",
                recoverable: false,
              },
            };
          }
          return { success: true, data: { id: "confirm-1" } };
        },
      },
    });

    const handler = new SendContactInquiryHandler(deps);
    const result = await handler.execute({
      submission: {
        name: "Jane Doe",
        email: "jane@example.com",
        intent: "general",
        subject: "Architecture Collaboration",
        message:
          "Hello Frederick, I would love to discuss an architectural collaboration.",
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TRANSPORT_UNCONFIGURED");
    }

    const throwingHandler = new SendContactInquiryHandler({
      sendRawEmailHandler: {
        execute: async () => {
          throw new Error("Template transport crash");
        },
      },
    });
    const thrownRes = await throwingHandler.execute({
      submission: {
        name: "Jane Doe",
        email: "jane@example.com",
        intent: "general",
        subject: "Architecture Collaboration",
        message:
          "Hello Frederick, I would love to discuss an architectural collaboration.",
      },
    });
    expect(thrownRes.success).toBe(false);
    if (!thrownRes.success) {
      expect(thrownRes.error.code).toBe("DELIVERY_FAILED");
    }
  });
});

describe("Email shared contract helpers", () => {
  it("parses queued tags/headers, checks retryable errors, and verifies Svix signatures", () => {
    resetEmailClient();
    expect(getEffectiveResendApiKey() ?? null).toSatisfy(
      (v) => v === null || typeof v === "string"
    );
    expect(getResendClient()).toSatisfy(
      (v) => v === null || typeof v === "object"
    );
    expect(shouldSimulateEmailDelivery(undefined)).toBe(true);
    expect(shouldSimulateEmailDelivery("re_test_123")).toBe(false);

    expect(isRetryableEmailError("503 Service Unavailable")).toBe(true);
    expect(isRetryableEmailError("Invalid email syntax")).toBe(false);

    expect(parseQueuedTags("{bad-json")).toBeUndefined();
    expect(parseQueuedTags("null")).toBeUndefined();
    expect(parseQueuedTags([null, { name: "only-name" }])).toBeUndefined();
    expect(
      parseQueuedTags(JSON.stringify([{ name: "cat", value: "news" }]))
    ).toEqual([{ name: "cat", value: "news" }]);

    expect(parseQueuedHeaders(null)).toBeUndefined();
    expect(parseQueuedHeaders(["arr"])).toBeUndefined();
    expect(parseQueuedHeaders({ bad: 123 })).toBeUndefined();
    expect(parseQueuedHeaders({ "X-Custom": "ok", num: 1 })).toEqual({
      "X-Custom": "ok",
    });

    expect(
      verifySvixSignature({
        payload: "{}",
        svixId: null,
        svixTimestamp: null,
        svixSignature: null,
        secret: "whsec_dGVzdHNlY3JldA==",
      })
    ).toBe(false);

    expect(
      verifySvixSignature({
        payload: "{}",
        svixId: "msg_1",
        svixTimestamp: "1000",
        svixSignature: "v1,abc",
        secret: "whsec_dGVzdHNlY3JldA==",
      })
    ).toBe(false);

    const rawKey = Buffer.from("super-secret-webhook-key");
    const secret = `whsec_${rawKey.toString("base64")}`;
    const ts = String(Math.floor(Date.now() / 1000));
    const payload = '{"type":"email.bounced"}';
    const sig = crypto
      .createHmac("sha256", rawKey)
      .update(`msg_ok.${ts}.${payload}`)
      .digest("base64");

    expect(
      verifySvixSignature({
        payload,
        svixId: "msg_ok",
        svixTimestamp: ts,
        svixSignature: `v0,ignored v1,${sig}`,
        secret,
      })
    ).toBe(true);

    expect(
      verifySvixSignature({
        payload,
        svixId: "msg_ok",
        svixTimestamp: ts,
        svixSignature: "v1,d3Jvbmc=",
        secret,
      })
    ).toBe(false);
  });
});
