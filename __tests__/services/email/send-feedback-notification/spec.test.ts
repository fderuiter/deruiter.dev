// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  SendFeedbackNotificationErrorCode,
  SendFeedbackNotificationInputSchema,
} from "@/lib/services";

describe("SendFeedbackNotificationInputSchema (Contract Test)", () => {
  it("accepts valid feedback notification payload", () => {
    const parsed = SendFeedbackNotificationInputSchema.safeParse({
      caseStudySlug: "crf-studio",
      takeaways: ["Clear architecture"],
      comments: "Great writeup",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty caseStudySlug", () => {
    const parsed = SendFeedbackNotificationInputSchema.safeParse({
      caseStudySlug: "",
      takeaways: [],
      comments: "",
    });
    expect(parsed.success).toBe(false);
    expect(SendFeedbackNotificationErrorCode.options).toContain(
      "INVALID_INPUT"
    );
  });
});
