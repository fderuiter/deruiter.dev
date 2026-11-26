// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  GenerateConnectionHashHandler,
  computeSha256Hash,
  generateClientConnectionHash,
  generateClientConnectionHashSync,
  sha256HexSync,
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

  it("matches Web Crypto SHA-256 digests in pure synchronous fallback across single-block and multi-block inputs", async () => {
    expect(sha256HexSync("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    const multiBlock =
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq";
    expect(sha256HexSync(multiBlock)).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
    );

    const webCryptoDigest = await generateClientConnectionHash("198.51.100.7");
    const syncFallbackDigest = await computeSha256Hash("198.51.100.7", null);
    expect(syncFallbackDigest).toBe(webCryptoDigest);
    expect(generateClientConnectionHashSync("198.51.100.7")).toBe(
      webCryptoDigest
    );
    expect(generateClientConnectionHashSync("   ")).toBe(
      await computeSha256Hash("", null)
    );
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
