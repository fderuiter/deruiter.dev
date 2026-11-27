// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  QueuePostAnnouncementErrorCode,
  QueuePostAnnouncementInputSchema,
} from "@/lib/services";

describe("QueuePostAnnouncementInputSchema (Contract Test)", () => {
  it("accepts non-empty blogPostId", () => {
    const parsed = QueuePostAnnouncementInputSchema.safeParse({
      blogPostId: "post-uuid-1",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects blank blogPostId", () => {
    const parsed = QueuePostAnnouncementInputSchema.safeParse({
      blogPostId: "   ",
    });
    expect(parsed.success).toBe(false);
    expect(QueuePostAnnouncementErrorCode.options).toContain(
      "INVALID_ANNOUNCEMENT_INPUT"
    );
  });
});
