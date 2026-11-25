// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  SendFeedbackNotificationInputSchema,
  SendRawEmailErrorCode,
} from "@/lib/services";

describe("SendFeedbackNotification Spec (Contract Test)", () => {
  it("accepts feedback notification payload", () => {
    expect(
      SendFeedbackNotificationInputSchema.safeParse({
        caseStudySlug: "crf",
        caseStudyTitle: "CRF",
        takeaways: ["resilience"],
        comments: "Clear metrics",
      }).success
    ).toBe(true);
  });

  it("rejects empty caseStudySlug and reuses SendRawEmailErrorCode", () => {
    expect(
      SendFeedbackNotificationInputSchema.safeParse({
        caseStudySlug: "",
        takeaways: [],
        comments: "",
      }).success
    ).toBe(false);
    expect(SendRawEmailErrorCode.options).toContain("DELIVERY_FAILED");
  });
});
