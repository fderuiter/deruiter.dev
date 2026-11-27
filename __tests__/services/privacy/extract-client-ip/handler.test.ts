// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import { ExtractClientIpHandler } from "@/lib/services";

describe("ExtractClientIpHandler (Logic Test)", () => {
  it("returns extracted client IP via injected extractor", () => {
    const extractIp = vi.fn().mockReturnValue("198.51.100.42");
    const handler = new ExtractClientIpHandler({ extractIp });
    const headers = new Headers({ "x-real-ip": "198.51.100.42" });

    const result = handler.execute({ request: headers });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ip).toBe("198.51.100.42");
    }
    expect(extractIp).toHaveBeenCalledWith(headers);
  });

  it("returns INVALID_INPUT failure envelope on malformed input without throwing", () => {
    const handler = new ExtractClientIpHandler();
    const result = handler.execute(fromAny(null));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
      expect(result.error.recoverable).toBe(false);
    }
  });
});
