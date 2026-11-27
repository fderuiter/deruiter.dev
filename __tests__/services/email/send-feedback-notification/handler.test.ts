// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  SendFeedbackNotificationHandler,
  createFailure,
  createSuccess,
} from "@/lib/services";

describe("SendFeedbackNotificationHandler (Logic Test)", () => {
  it("renders feedback email and delegates to sendRawEmailHandler", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue(createSuccess({ id: "msg-1", simulated: true }));
    const handler = new SendFeedbackNotificationHandler({
      sendRawEmailHandler: { execute },
    });

    const result = await handler.execute({
      caseStudySlug: "crf-studio",
      takeaways: ["Vertical slices"],
      comments: "Solid tradeoffs",
    });

    expect(result.success).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("propagates INVALID_INPUT or downstream delivery failure", async () => {
    const handler = new SendFeedbackNotificationHandler({
      sendRawEmailHandler: {
        execute: vi.fn().mockResolvedValue(
          createFailure("PROVIDER_REJECTED", "Resend 500", {
            recoverable: true,
          })
        ),
      },
    });

    const invalid = await handler.execute({
      caseStudySlug: "   ",
      takeaways: [],
      comments: "",
    });
    expect(invalid.success).toBe(false);

    const failed = await handler.execute({
      caseStudySlug: "crf-studio",
      takeaways: [],
      comments: "Note",
    });
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.error.code).toBe("PROVIDER_REJECTED");
    }
  });
});
