// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { RecordSuppressionHandler } from "@/lib/services";

describe("RecordSuppressionHandler (Logic Test)", () => {
  it("normalizes email and upserts suppression entry", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const handler = new RecordSuppressionHandler({
      prisma: { suppressionList: { upsert } },
    });

    const result = await handler.execute({
      email: "  Bounced@Example.com ",
      reason: "BOUNCE",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        email: "bounced@example.com",
        reason: "BOUNCE",
      });
    }
  });

  it("returns STORAGE_UNAVAILABLE when upsert throws", async () => {
    const handler = new RecordSuppressionHandler({
      prisma: {
        suppressionList: {
          upsert: vi.fn().mockRejectedValue(new Error("DB error")),
        },
      },
    });
    const result = await handler.execute({
      email: "bounced@example.com",
      reason: "COMPLAINT",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
