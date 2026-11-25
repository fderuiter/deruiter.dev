// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SendRawEmailErrorCode, SendRawEmailInputSchema } from "@/lib/services";

describe("SendRawEmailInputSchema (Contract Test)", () => {
  it("accepts valid outbound email options", () => {
    const parsed = SendRawEmailInputSchema.safeParse({
      to: "reader@example.com",
      subject: "Subject line",
      html: "<p>Body</p>",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects missing recipient or empty subject", () => {
    const parsed = SendRawEmailInputSchema.safeParse({
      to: "",
      subject: "",
      html: "<p>Body</p>",
    });
    expect(parsed.success).toBe(false);
    expect(SendRawEmailErrorCode.options).toContain("RECIPIENT_SUPPRESSED");
  });
});
