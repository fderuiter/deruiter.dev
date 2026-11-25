// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  RecordEmailSuppressionErrorCode,
  RecordEmailSuppressionInputSchema,
} from "@/lib/services";

describe("RecordEmailSuppression Spec (Contract Test)", () => {
  it("accepts email and valid SuppressionReason", () => {
    expect(
      RecordEmailSuppressionInputSchema.safeParse({
        email: "user@example.com",
        reason: "COMPLAINT",
      }).success
    ).toBe(true);
  });

  it("rejects unsupported reason and defines STORAGE_UNAVAILABLE", () => {
    expect(
      RecordEmailSuppressionInputSchema.safeParse(
        fromAny({ email: "user@example.com", reason: "OTHER" })
      ).success
    ).toBe(false);
    expect(RecordEmailSuppressionErrorCode.options).toContain(
      "STORAGE_UNAVAILABLE"
    );
  });
});
