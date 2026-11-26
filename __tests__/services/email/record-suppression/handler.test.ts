// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  RecordEmailSuppressionHandler,
  type RecordEmailSuppressionDeps,
} from "@/lib/services";

describe("RecordEmailSuppressionHandler (Logic Test)", () => {
  it("normalizes email lowercase and upserts suppressionList entry", async () => {
    const upsert = vi.fn(async () => ({}));
    const deps = fromPartial<RecordEmailSuppressionDeps>({
      db: { suppressionList: { upsert } },
    });

    const handler = new RecordEmailSuppressionHandler(deps);
    const result = await handler.execute({
      email: "  User@Example.COM ",
      reason: "BOUNCE",
    });

    expect(result).toEqual({
      success: true,
      data: { email: "user@example.com", reason: "BOUNCE" },
    });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("returns INVALID_INPUT when email is empty", async () => {
    const handler = new RecordEmailSuppressionHandler();
    const result = await handler.execute({
      email: "",
      reason: "BOUNCE",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("returns STORAGE_UNAVAILABLE when upsert throws", async () => {
    const deps = fromPartial<RecordEmailSuppressionDeps>({
      db: {
        suppressionList: {
          upsert: async () => {
            throw new Error("DB error");
          },
        },
      },
    });

    const handler = new RecordEmailSuppressionHandler(deps);
    const result = await handler.execute({
      email: "user@example.com",
      reason: "UNSUBSCRIBE",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
