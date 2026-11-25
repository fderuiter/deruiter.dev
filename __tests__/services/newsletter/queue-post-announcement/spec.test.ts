// @vitest-environment node
import { describe, expect, it } from "vitest";
import { QueuePostAnnouncementInputSchema } from "@/lib/services";

describe("QueuePostAnnouncementInputSchema (Contract Test)", () => {
  it("accepts non-empty blogPostId", () => {
    expect(
      QueuePostAnnouncementInputSchema.safeParse({ blogPostId: "post_1" })
        .success
    ).toBe(true);
  });

  it("rejects empty blogPostId", () => {
    expect(
      QueuePostAnnouncementInputSchema.safeParse({ blogPostId: "" }).success
    ).toBe(false);
  });
});
