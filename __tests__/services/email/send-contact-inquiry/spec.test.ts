// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  SendContactInquiryErrorCode,
  SendContactInquiryInputSchema,
} from "@/lib/services";

describe("SendContactInquiry Spec (Contract Test)", () => {
  it("accepts valid contact submission payload", () => {
    const parsed = SendContactInquiryInputSchema.safeParse({
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
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid email and defines DELIVERY_FAILED and STORAGE_UNAVAILABLE", () => {
    const parsed = SendContactInquiryInputSchema.safeParse({
      submission: {
        name: "Jane Doe",
        email: "not-an-email",
        intent: "general",
        subject: "Hello",
        message: "Too short",
      },
    });
    expect(parsed.success).toBe(false);
    expect(SendContactInquiryErrorCode.options).toEqual(
      expect.arrayContaining([
        "DELIVERY_FAILED",
        "STORAGE_UNAVAILABLE",
        "INVALID_INPUT",
      ])
    );
  });
});
