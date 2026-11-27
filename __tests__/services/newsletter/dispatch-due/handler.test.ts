// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  DispatchNewsletterAnnouncementsHandler,
  createSuccess,
  type DispatchNewsletterPrismaPort,
} from "@/lib/services";

describe("DispatchNewsletterAnnouncementsHandler (Logic Test)", () => {
  it("completes cleanly with zero queued deliveries when no dispatches are pending", async () => {
    const db = fromPartial<DispatchNewsletterPrismaPort>({
      blogPost: { findMany: vi.fn().mockResolvedValue([]) },
      outboundEmailQueue: { count: vi.fn().mockResolvedValue(0) },
      newsletterDispatch: { findMany: vi.fn().mockResolvedValue([]) },
    });
    const handler = new DispatchNewsletterAnnouncementsHandler({
      db,
      queuePostAnnouncement: vi
        .fn()
        .mockResolvedValue(createSuccess({ queued: true, blogPostId: "p1" })),
      getSuppressedEmails: vi
        .fn()
        .mockResolvedValue(createSuccess(new Set<string>())),
    });

    const result = await handler.execute({
      now: new Date("2026-03-01T00:00:00Z"),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.queued).toBe(0);
      expect(result.data.openDispatches).toBe(0);
    }
  });

  it("returns DISPATCH_FAILED when database query throws", async () => {
    const db = fromPartial<DispatchNewsletterPrismaPort>({
      blogPost: {
        findMany: vi.fn().mockRejectedValue(new Error("DB unreachable")),
      },
    });
    const handler = new DispatchNewsletterAnnouncementsHandler({ db });
    const result = await handler.execute();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("DISPATCH_FAILED");
    }
  });
});
