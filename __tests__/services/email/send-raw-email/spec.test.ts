// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SendRawEmailErrorCode, SendRawEmailInputSchema } from "@/lib/services";

describe("SendRawEmail Spec (Contract Test)", () => {
  it("accepts single or array recipient with subject and html", () => {
    expect(
      SendRawEmailInputSchema.safeParse({
        to: ["a@example.com", "b@example.com"],
        subject: "Batch",
        html: "<p>Body</p>",
      }).success
    ).toBe(true);
  });

  it("rejects empty recipients and defines RECIPIENT_SUPPRESSED and RECIPIENT_ELIGIBILITY_UNKNOWN", () => {
    expect(
      SendRawEmailInputSchema.safeParse({
        to: [],
        subject: "Batch",
        html: "<p>Body</p>",
      }).success
    ).toBe(false);
    expect(SendRawEmailErrorCode.options).toEqual(
      expect.arrayContaining([
        "RECIPIENT_SUPPRESSED",
        "RECIPIENT_ELIGIBILITY_UNKNOWN",
        "TRANSPORT_UNCONFIGURED",
        "STORAGE_UNAVAILABLE",
        "DELIVERY_FAILED",
        "INVALID_INPUT",
      ])
    );
  });
});
