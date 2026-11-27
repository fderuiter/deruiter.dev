// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  HashConnectionErrorCode,
  HashConnectionInputSchema,
} from "@/lib/services";

describe("HashConnectionInputSchema (Contract Test)", () => {
  it("accepts explicit IP or request with includeUserAgent toggle", () => {
    const parsed = HashConnectionInputSchema.safeParse({
      ip: "198.51.100.5",
      includeUserAgent: false,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects non-string ip values", () => {
    const parsed = HashConnectionInputSchema.safeParse({
      ip: 12345,
    });
    expect(parsed.success).toBe(false);
    expect(HashConnectionErrorCode.options).toEqual([
      "INVALID_INPUT",
      "HASHING_FAILED",
    ]);
  });
});
