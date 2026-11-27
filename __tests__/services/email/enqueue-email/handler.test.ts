// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { EnqueueEmailHandler } from "@/lib/services";

describe("EnqueueEmailHandler (Logic Test)", () => {
  it("persists retry row and triggers QStash scheduleRetry", async () => {
    const create = vi.fn().mockResolvedValue({ id: "queue-1" });
    const scheduleRetry = vi.fn().mockResolvedValue(true);
    const handler = new EnqueueEmailHandler({
      prisma: { outboundEmailQueue: { create } },
      scheduleRetry,
    });

    const result = await handler.execute({
      options: {
        to: "reader@example.com",
        subject: "Update",
        html: "<p>Update</p>",
      },
      mode: "retry",
      errorReason: "429 rate limited",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.queueId).toBe("queue-1");
    }
    expect(scheduleRetry).toHaveBeenCalledWith("queue-1", 1);
  });

  it("returns ENQUEUE_FAILED when database insert throws", async () => {
    const handler = new EnqueueEmailHandler({
      prisma: {
        outboundEmailQueue: {
          create: vi.fn().mockRejectedValue(new Error("DB write failed")),
        },
      },
    });

    const result = await handler.execute({
      options: {
        to: "reader@example.com",
        subject: "Update",
        html: "<p>Update</p>",
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("ENQUEUE_FAILED");
      expect(result.error.recoverable).toBe(true);
    }
  });
});
