// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  GenerateConnectionHashHandler,
  type GenerateConnectionHashDeps,
} from "@/lib/services";

describe("GenerateConnectionHashHandler (Logic Test)", () => {
  it("computes deterministic hex hash for client IP", async () => {
    const handler = new GenerateConnectionHashHandler();
    const first = await handler.execute({ ip: "198.51.100.7" });
    const second = await handler.execute({ ip: "198.51.100.7" });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (first.success && second.success) {
      expect(first.data.hash).toBe(second.data.hash);
      expect(first.data.hash.length).toBeGreaterThanOrEqual(16);
    }
  });

  it("returns HASH_FAILED when injected hash function rejects", async () => {
    const deps = fromPartial<GenerateConnectionHashDeps>({
      hashFn: async () => {
        throw new Error("subtle digest failure");
      },
    });
    const handler = new GenerateConnectionHashHandler(deps);
    const result = await handler.execute({ ip: "198.51.100.7" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("HASH_FAILED");
    }
  });
});
