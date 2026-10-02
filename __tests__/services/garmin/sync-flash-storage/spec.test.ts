// @vitest-environment node
import { describe, it, expect } from "vitest";
import { SyncFlashStorageInputSchema } from "@/lib/services";

describe("SyncFlashStorageInputSchema (Contract Test)", () => {
  it("accepts valid load action", () => {
    const parsed = SyncFlashStorageInputSchema.safeParse({ action: "load" });
    expect(parsed.success).toBe(true);
  });

  it("accepts valid save action with variables", () => {
    const parsed = SyncFlashStorageInputSchema.safeParse({
      action: "save",
      variables: [{ id: 1, name: "test.dat", sizeKb: 4, allocatedAt: 12345 }],
    });
    expect(parsed.success).toBe(true);
  });
});
