// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  DispatchNewsletterAnnouncementsInputSchema,
  NewsletterDispatchErrorCode,
} from "@/lib/services";

describe("DispatchNewsletterAnnouncementsInputSchema (Contract Test)", () => {
  it("accepts empty object or optional now Date", () => {
    expect(
      DispatchNewsletterAnnouncementsInputSchema.safeParse({}).success
    ).toBe(true);
    expect(
      DispatchNewsletterAnnouncementsInputSchema.safeParse({
        now: new Date("2026-03-01T00:00:00Z"),
      }).success
    ).toBe(true);
  });

  it("rejects non-Date now values", () => {
    const parsed = DispatchNewsletterAnnouncementsInputSchema.safeParse({
      now: fromAny("not-a-date"),
    });
    expect(parsed.success).toBe(false);
    expect(NewsletterDispatchErrorCode.options).toContain("DISPATCH_FAILED");
  });
});
