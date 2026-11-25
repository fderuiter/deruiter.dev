// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  VerifySvixSignatureErrorCode,
  VerifySvixSignatureInputSchema,
} from "@/lib/services";

describe("VerifySvixSignature Spec (Contract Test)", () => {
  it("accepts string payload and optional svix headers", () => {
    expect(
      VerifySvixSignatureInputSchema.safeParse({
        payload: "{}",
        svixId: "msg_1",
        svixTimestamp: "1700000000",
        svixSignature: "v1,sig",
        secret: "whsec_dGVzdA==",
      }).success
    ).toBe(true);
  });

  it("rejects non-string payload and defines MISSING_HEADERS and INVALID_SIGNATURE", () => {
    expect(
      VerifySvixSignatureInputSchema.safeParse(fromAny({ payload: 123 }))
        .success
    ).toBe(false);
    expect(VerifySvixSignatureErrorCode.options).toEqual(
      expect.arrayContaining([
        "MISSING_HEADERS",
        "INVALID_SIGNATURE",
        "INVALID_INPUT",
      ])
    );
  });
});
