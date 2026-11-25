// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  RecordSuppressionErrorCode,
  RecordSuppressionInputSchema,
} from "@/lib/services";

describe("RecordSuppressionInputSchema (Contract Test)", () => {
  it("accepts valid email and suppression reason", () => {
    const parsed = RecordSuppressionInputSchema.safeParse({
      email: "bounced@example.com",
      reason: "BOUNCE",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown suppression reason", () => {
    const parsed = RecordSuppressionInputSchema.safeParse({
      email: "bounced@example.com",
      reason: fromAny("UNKNOWN_REASON"),
    });
    expect(parsed.success).toBe(false);
    expect(RecordSuppressionErrorCode.options).toContain("STORAGE_UNAVAILABLE");
  });
});
