// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  GetSuppressedEmailsErrorCode,
  GetSuppressedEmailsInputSchema,
} from "@/lib/services";

describe("GetSuppressedEmails Spec (Contract Test)", () => {
  it("accepts string array of emails", () => {
    expect(
      GetSuppressedEmailsInputSchema.safeParse({
        emails: ["a@example.com"],
      }).success
    ).toBe(true);
  });

  it("rejects non-array emails and defines STORAGE_UNAVAILABLE", () => {
    expect(
      GetSuppressedEmailsInputSchema.safeParse(fromAny({ emails: "single" }))
        .success
    ).toBe(false);
    expect(GetSuppressedEmailsErrorCode.options).toContain(
      "STORAGE_UNAVAILABLE"
    );
  });
});
