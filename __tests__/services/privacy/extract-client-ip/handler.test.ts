// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  ExtractClientIpHandler,
  extractClientIp,
  extractHeaderValue,
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

  it("supports bare Headers, plain header maps, array headers, x-real-ip, and loopback fallbacks", () => {
    expect(extractHeaderValue(undefined, "x-forwarded-for")).toBeUndefined();
    expect(extractHeaderValue(null, "x-forwarded-for")).toBeUndefined();
    expect(
      extractHeaderValue(
        new Headers({ "x-real-ip": "203.0.113.9" }),
        "x-real-ip"
      )
    ).toBe("203.0.113.9");
    expect(
      extractHeaderValue(
        { "x-forwarded-for": ["198.51.100.88", "10.0.0.2"] },
        "X-Forwarded-For"
      )
    ).toBe("198.51.100.88");
    expect(extractHeaderValue({ "X-Custom": "direct-case" }, "X-Custom")).toBe(
      "direct-case"
    );

    expect(extractClientIp()).toBe("127.0.0.1");
    expect(
      extractClientIp({
        "x-forwarded-for": " , ",
        "x-real-ip": " 203.0.113.77 ",
      })
    ).toBe("203.0.113.77");
    expect(extractClientIp({ "x-real-ip": "   " })).toBe("127.0.0.1");
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
