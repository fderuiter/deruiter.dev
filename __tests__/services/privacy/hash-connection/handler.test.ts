// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import { HashConnectionHandler } from "@/lib/services";

describe("HashConnectionHandler (Logic Test)", () => {
  it("hashes explicit IP or request headers via injected hashFn", async () => {
    const hashFn = vi.fn(async (val: string) => `hashed:${val}`);
    const handler = new HashConnectionHandler({ hashFn });

    const direct = await handler.execute({ ip: "203.0.113.9" });
    expect(direct.success).toBe(true);
    if (direct.success) {
      expect(direct.data.hash).toBe("hashed:203.0.113.9");
    }

    const withUa = await handler.execute({
      request: new Headers({
        "x-real-ip": "203.0.113.9",
        "user-agent": "TestAgent/1.0",
      }),
    });
    expect(withUa.success).toBe(true);
  });

  it("returns INVALID_INPUT on schema failure and HASHING_FAILED when hashFn rejects", async () => {
    const invalidHandler = new HashConnectionHandler();
    const invalid = await invalidHandler.execute(fromAny({ ip: 999 }));
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.code).toBe("INVALID_INPUT");
    }

    const failingHandler = new HashConnectionHandler({
      hashFn: vi.fn().mockRejectedValue(new Error("WebCrypto unavailable")),
    });
    const failed = await failingHandler.execute({ ip: "203.0.113.9" });
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.error.code).toBe("HASHING_FAILED");
      expect(failed.error.recoverable).toBe(true);
    }
  });
});
