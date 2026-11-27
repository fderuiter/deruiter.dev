// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  GetSuppressedEmailsErrorCode,
  GetSuppressedEmailsInputSchema,
} from "@/lib/services";

describe("GetSuppressedEmailsInputSchema (Contract Test)", () => {
  it("accepts string array of candidate emails", () => {
    const parsed = GetSuppressedEmailsInputSchema.safeParse({
      emails: ["a@example.com", "b@example.com"],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects non-array emails payload", () => {
    const parsed = GetSuppressedEmailsInputSchema.safeParse({
      emails: fromAny("a@example.com"),
    });
    expect(parsed.success).toBe(false);
    expect(GetSuppressedEmailsErrorCode.options).toContain(
      "SUPPRESSION_LOOKUP_FAILED"
    );
  });
});
