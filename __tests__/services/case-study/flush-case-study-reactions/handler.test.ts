// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { FlushCaseStudyReactionsHandler } from "@/lib/services";

describe("FlushCaseStudyReactionsHandler (Logic Test)", () => {
  it("returns zero counts cleanly when Redis is unconfigured in test environment", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 0 });
    const handler = new FlushCaseStudyReactionsHandler({
      reactions: { createMany },
    });

    const result = await handler.execute({ batchSize: 50 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ processed: 0, inserted: 0 });
    }
  });
});
