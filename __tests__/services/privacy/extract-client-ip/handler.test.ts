// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  ExtractClientIpHandler,
  type ExtractClientIpInput,
} from "@/lib/services";

describe("ExtractClientIpHandler (Logic Test)", () => {
  it("extracts normalized client IP from request headers", () => {
    const handler = new ExtractClientIpHandler();
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.42, 10.0.0.1",
    });

    const result = handler.execute({ requestOrHeaders: { headers } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ip).toBe("198.51.100.42");
    }
  });

  it("returns INVALID_INPUT failure when extractor throws", () => {
    const handler = new ExtractClientIpHandler({
      extractIp: () => {
        throw new Error("header read error");
      },
    });
    const result = handler.execute(fromPartial<ExtractClientIpInput>({}));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
