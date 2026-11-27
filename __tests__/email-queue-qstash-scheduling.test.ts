// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
const queryRaw = vi.fn();
const scheduleEmailRetry = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
    outboundEmailQueue: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: (...a: unknown[]) => create(...a),
      update: vi.fn(),
    },
    suppressionList: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock("@/lib/qstash-retry", () => ({
  scheduleEmailRetry: (...a: unknown[]) => scheduleEmailRetry(...a),
}));

import { EnqueueEmailHandler, ProcessRetryQueueHandler } from "@/lib/services";

describe("EmailService QStash scheduling (#715)", () => {
  beforeEach(() => {
    create.mockReset().mockResolvedValue({ id: "q1" });
    queryRaw.mockReset().mockResolvedValue([]);
    scheduleEmailRetry.mockReset().mockResolvedValue(true);
  });

  it("schedules a sub-daily retry when a retryable failure is queued", async () => {
    const res = await new EnqueueEmailHandler().execute({
      options: { to: "a@example.com", subject: "s", html: "<p>h</p>" },
      mode: "retry",
      errorReason: "ETIMEDOUT",
    });
    expect(res).toEqual({ success: true, data: { queueId: "q1" } });
    expect(scheduleEmailRetry).toHaveBeenCalledWith("q1", 1);
  });

  it("still returns the queue id when scheduling reports failure", async () => {
    scheduleEmailRetry.mockResolvedValue(false);
    const res = await new EnqueueEmailHandler().execute({
      options: {
        to: "a@example.com",
        subject: "s",
        html: "<p>h</p>",
      },
      mode: "retry",
    });
    expect(res).toEqual({ success: true, data: { queueId: "q1" } });
  });

  it("does not schedule bulk enqueues, protecting the 500/day budget", async () => {
    await new EnqueueEmailHandler().execute({
      options: {
        to: "a@example.com",
        subject: "s",
        html: "<p>h</p>",
      },
      mode: "pending",
    });
    expect(scheduleEmailRetry).not.toHaveBeenCalled();
  });

  it("does not schedule when nothing was persisted", async () => {
    create.mockRejectedValue(new Error("db down"));
    const res = await new EnqueueEmailHandler().execute({
      options: {
        to: "a@example.com",
        subject: "s",
        html: "<p>h</p>",
      },
      mode: "retry",
    });
    expect(res.success).toBe(false);
    expect(scheduleEmailRetry).not.toHaveBeenCalled();
  });

  // The lease statement's bound values, in template order: now, queueId
  // (twice), limit, leaseUntil, updatedAt (#1116).
  const leaseValues = () => queryRaw.mock.calls[0].slice(1) as unknown[];

  it("restricts processRetryQueue to the targeted queue id", async () => {
    await new ProcessRetryQueueHandler().execute({
      queueId: "q1",
      maxBatchSize: 1,
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const [, queueId, sameQueueId, limit] = leaseValues();
    expect(queueId).toBe("q1");
    expect(sameQueueId).toBe("q1");
    expect(limit).toBe(1);
  });

  it("leaves the batch query untargeted without a queue id", async () => {
    await new ProcessRetryQueueHandler().execute();
    const [, queueId, sameQueueId, limit] = leaseValues();
    expect(queueId).toBeNull();
    expect(sameQueueId).toBeNull();
    expect(limit).toBe(20);
  });
});
