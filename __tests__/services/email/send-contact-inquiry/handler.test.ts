// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  SendContactInquiryHandler,
  type SendContactInquiryDeps,
} from "@/lib/services";

describe("SendContactInquiryHandler (Logic Test)", () => {
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

  it("propagates admin delivery failure when primary send fails", async () => {
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
  });
});
