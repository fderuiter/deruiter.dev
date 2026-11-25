// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  QueuePostAnnouncementHandler,
  type QueuePostAnnouncementDeps,
} from "@/lib/services";

describe("QueuePostAnnouncementHandler (Logic Test)", () => {
  it("upserts newsletter dispatch announcement for blog post", async () => {
    const deps = fromPartial<QueuePostAnnouncementDeps>({
      db: {
        newsletterDispatch: {
          upsert: async () => ({ id: "disp_1", blogPostId: "post_42" }),
        },
      },
    });

    const handler = new QueuePostAnnouncementHandler(deps);
    const result = await handler.execute({ blogPostId: "post_42" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blogPostId).toBe("post_42");
    }
  });

  it("returns STORAGE_UNAVAILABLE when upsert fails", async () => {
    const deps = fromPartial<QueuePostAnnouncementDeps>({
      db: {
        newsletterDispatch: {
          upsert: async () => {
            throw new Error("DB connection failed");
          },
        },
      },
    });

    const handler = new QueuePostAnnouncementHandler(deps);
    const result = await handler.execute({ blogPostId: "post_42" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
