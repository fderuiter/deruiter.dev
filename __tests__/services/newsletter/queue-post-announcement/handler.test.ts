// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { QueuePostAnnouncementHandler } from "@/lib/services";

describe("QueuePostAnnouncementHandler (Logic Test)", () => {
  it("upserts newsletter dispatch row idempotently", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "disp-1" });
    const handler = new QueuePostAnnouncementHandler({
      dispatches: { upsert },
    });

    const result = await handler.execute({ blogPostId: "post-42" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ queued: true, blogPostId: "post-42" });
    }
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("returns INVALID_ANNOUNCEMENT_INPUT or STORAGE_UNAVAILABLE without throwing", async () => {
    const invalidHandler = new QueuePostAnnouncementHandler();
    const invalid = await invalidHandler.execute({ blogPostId: "" });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.code).toBe("INVALID_ANNOUNCEMENT_INPUT");
    }

    const dbFailHandler = new QueuePostAnnouncementHandler({
      dispatches: {
        upsert: vi.fn().mockRejectedValue(new Error("DB timeout")),
      },
    });
    const dbFail = await dbFailHandler.execute({ blogPostId: "post-42" });
    expect(dbFail.success).toBe(false);
    if (!dbFail.success) {
      expect(dbFail.error.code).toBe("STORAGE_UNAVAILABLE");
      expect(dbFail.error.recoverable).toBe(true);
    }
  });
});
