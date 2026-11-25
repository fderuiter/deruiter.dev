// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DispatchDueNewsletterInputSchema } from "@/lib/services";

describe("DispatchDueNewsletterInputSchema (Contract Test)", () => {
  it("accepts optional Date or empty input", () => {
    expect(
      DispatchDueNewsletterInputSchema.safeParse({
        now: new Date("2026-11-25T12:00:00Z"),
      }).success
    ).toBe(true);
    expect(DispatchDueNewsletterInputSchema.safeParse(undefined).success).toBe(
      true
    );
  });

  it("rejects invalid now values", () => {
    expect(
      DispatchDueNewsletterInputSchema.safeParse({ now: "not-a-date" }).success
    ).toBe(false);
  });
});
