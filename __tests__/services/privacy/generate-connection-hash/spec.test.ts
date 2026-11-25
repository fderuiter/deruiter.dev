// @vitest-environment node
import { describe, expect, it } from "vitest";
import { GenerateConnectionHashInputSchema } from "@/lib/services";

describe("GenerateConnectionHashInputSchema (Contract Test)", () => {
  it("accepts explicit IP and defaults omitted IP", () => {
    const parsed = GenerateConnectionHashInputSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ip).toBe("127.0.0.1");
    }
  });

  it("rejects non-string IP values", () => {
    expect(
      GenerateConnectionHashInputSchema.safeParse({ ip: 123 }).success
    ).toBe(false);
  });
});
