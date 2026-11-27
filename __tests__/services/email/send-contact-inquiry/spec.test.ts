// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  SendContactInquiryErrorCode,
  SendContactInquiryInputSchema,
} from "@/lib/services";

describe("SendContactInquiryInputSchema (Contract Test)", () => {
  it("accepts valid contact submission payload", () => {
    const parsed = SendContactInquiryInputSchema.safeParse({
      submission: {
        name: "Jane Doe",
        email: "jane@example.com",
        intent: "collaboration",
        subject: "Architecture chat",
        message: "Would love to collaborate on clinical data tooling.",
      },
      connectionHash: "conn-hash-1",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects short message or invalid email", () => {
    const parsed = SendContactInquiryInputSchema.safeParse({
      submission: {
        name: "Jane",
        email: "not-an-email",
        intent: "general",
        subject: "Hi",
        message: "Too short",
      },
    });
    expect(parsed.success).toBe(false);
    expect(SendContactInquiryErrorCode.options).toContain("INVALID_INPUT");
  });
});
