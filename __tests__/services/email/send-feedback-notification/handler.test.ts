// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  SendFeedbackNotificationHandler,
  type SendFeedbackNotificationDeps,
} from "@/lib/services";

describe("SendFeedbackNotificationHandler (Logic Test)", () => {
  it("renders feedback email template and delegates to sendRawEmailHandler", async () => {
    const sendExecute = vi.fn(async () => ({
      success: true as const,
      data: { id: "fb-msg-1", simulated: true },
    }));
    const deps = fromPartial<SendFeedbackNotificationDeps>({
      sendRawEmailHandler: { execute: sendExecute },
    });

    const handler = new SendFeedbackNotificationHandler(deps);
    const result = await handler.execute({
      caseStudySlug: "crf",
      takeaways: ["type-safety"],
      comments: "Nice architecture",
    });

    expect(result).toEqual({
      success: true,
      data: { id: "fb-msg-1", simulated: true },
    });
    expect(sendExecute).toHaveBeenCalledTimes(1);
  });

  it("returns INVALID_INPUT when caseStudySlug is empty", async () => {
    const handler = new SendFeedbackNotificationHandler();
    const result = await handler.execute({
      caseStudySlug: "",
      takeaways: [],
      comments: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
