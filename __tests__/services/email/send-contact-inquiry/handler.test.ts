// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  SendContactInquiryHandler,
  createFailure,
  createSuccess,
} from "@/lib/services";

const VALID_SUBMISSION = {
  name: "Jane Doe",
  email: "jane@example.com",
  intent: "collaboration" as const,
  subject: "Architecture chat",
  message: "Would love to collaborate on clinical data tooling.",
};

describe("SendContactInquiryHandler (Logic Test)", () => {
  it("dispatches admin notification and sender confirmation emails", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue(createSuccess({ id: "msg-1", simulated: true }));
    const handler = new SendContactInquiryHandler({
      sendRawEmailHandler: { execute },
    });

    const result = await handler.execute({
      submission: VALID_SUBMISSION,
      connectionHash: "conn-1",
    });

    expect(result.success).toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("returns failure envelope when admin notification fails", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce(
        createFailure("PROVIDER_REJECTED", "Resend outage", {
          recoverable: true,
        })
      )
      .mockResolvedValueOnce(createSuccess({ id: "msg-2", simulated: true }));

    const handler = new SendContactInquiryHandler({
      sendRawEmailHandler: { execute },
    });

    const result = await handler.execute({ submission: VALID_SUBMISSION });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PROVIDER_REJECTED");
    }
  });
});
