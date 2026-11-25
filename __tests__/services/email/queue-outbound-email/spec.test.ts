// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  QueueOutboundEmailErrorCode,
  QueueOutboundEmailInputSchema,
} from "@/lib/services";

describe("QueueOutboundEmail Spec (Contract Test)", () => {
  it("accepts options with optional fromAddress and errorReason", () => {
    expect(
      QueueOutboundEmailInputSchema.safeParse({
        options: {
          to: "user@example.com",
          subject: "Queued",
          html: "<p>Queued</p>",
        },
        errorReason: "Transient 502",
      }).success
    ).toBe(true);
  });

  it("rejects missing html and defines STORAGE_UNAVAILABLE", () => {
    expect(
      QueueOutboundEmailInputSchema.safeParse({
        options: {
          to: "user@example.com",
          subject: "Queued",
          html: "",
        },
      }).success
    ).toBe(false);
    expect(QueueOutboundEmailErrorCode.options).toContain(
      "STORAGE_UNAVAILABLE"
    );
  });
});
