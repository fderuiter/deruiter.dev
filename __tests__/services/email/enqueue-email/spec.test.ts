// @vitest-environment node
import { describe, expect, it } from "vitest";
import { EnqueueEmailErrorCode, EnqueueEmailInputSchema } from "@/lib/services";

describe("EnqueueEmailInputSchema (Contract Test)", () => {
  it("accepts valid email options and defaults mode to pending", () => {
    const parsed = EnqueueEmailInputSchema.safeParse({
      options: {
        to: "reader@example.com",
        subject: "Hello",
        html: "<p>Hello</p>",
      },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.mode).toBe("pending");
    }
  });

  it("rejects empty subject or html", () => {
    const parsed = EnqueueEmailInputSchema.safeParse({
      options: {
        to: "reader@example.com",
        subject: "",
        html: "",
      },
    });
    expect(parsed.success).toBe(false);
    expect(EnqueueEmailErrorCode.options).toContain("ENQUEUE_FAILED");
  });
});
