import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
const findMany = vi.fn();
const scheduleEmailRetry = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    outboundEmailQueue: {
      create: (...a: unknown[]) => create(...a),
      findMany: (...a: unknown[]) => findMany(...a),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    suppressionList: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock("@/lib/qstash-retry", () => ({
  scheduleEmailRetry: (...a: unknown[]) => scheduleEmailRetry(...a),
}));

import { EmailService } from "@/lib/services/email-service";

describe("EmailService QStash scheduling (#715)", () => {
  beforeEach(() => {
    create.mockReset().mockResolvedValue({ id: "q1" });
    findMany.mockReset().mockResolvedValue([]);
    scheduleEmailRetry.mockReset().mockResolvedValue(true);
  });

  it("schedules a sub-daily retry when a retryable failure is queued", async () => {
    const id = await EmailService.queueOutboundEmail(
      { to: "a@example.com", subject: "s", html: "<p>h</p>" },
      undefined,
      "ETIMEDOUT"
    );
    expect(id).toBe("q1");
    expect(scheduleEmailRetry).toHaveBeenCalledWith("q1", 1);
  });

  it("still returns the queue id when scheduling reports failure", async () => {
    scheduleEmailRetry.mockResolvedValue(false);
    const id = await EmailService.queueOutboundEmail({
      to: "a@example.com",
      subject: "s",
      html: "<p>h</p>",
    });
    expect(id).toBe("q1");
  });

  it("does not schedule bulk enqueues, protecting the 500/day budget", async () => {
    await EmailService.enqueueEmail({
      to: "a@example.com",
      subject: "s",
      html: "<p>h</p>",
    });
    expect(scheduleEmailRetry).not.toHaveBeenCalled();
  });

  it("does not schedule when nothing was persisted", async () => {
    create.mockRejectedValue(new Error("db down"));
    const id = await EmailService.queueOutboundEmail({
      to: "a@example.com",
      subject: "s",
      html: "<p>h</p>",
    });
    expect(id).toBeNull();
    expect(scheduleEmailRetry).not.toHaveBeenCalled();
  });

  it("restricts processRetryQueue to the targeted queue id", async () => {
    await EmailService.processRetryQueue({ queueId: "q1", maxBatchSize: 1 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "q1" }),
        take: 1,
      })
    );
  });

  it("leaves the batch query untargeted without a queue id", async () => {
    await EmailService.processRetryQueue();
    const arg = findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).not.toHaveProperty("id");
  });
});
