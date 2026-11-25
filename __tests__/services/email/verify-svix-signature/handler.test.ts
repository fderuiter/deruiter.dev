// @vitest-environment node
import { describe, expect, it } from "vitest";
import { VerifySvixSignatureHandler } from "@/lib/services";

describe("VerifySvixSignatureHandler (Logic Test)", () => {
  it("returns MISSING_HEADERS when required Svix headers are absent", () => {
    const handler = new VerifySvixSignatureHandler();
    const result = handler.execute({
      payload: "{}",
      svixId: null,
      svixTimestamp: null,
      svixSignature: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("MISSING_HEADERS");
    }
  });

  it("returns valid: true when injected verifyFn succeeds", () => {
    const handler = new VerifySvixSignatureHandler({
      verifyFn: () => true,
    });
    const result = handler.execute({
      payload: "{}",
      svixId: "msg_1",
      svixTimestamp: "1700000000",
      svixSignature: "v1,valid",
      secret: "whsec_dGVzdA==",
    });
    expect(result).toEqual({ success: true, data: { valid: true } });
  });
});
