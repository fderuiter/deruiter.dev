// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  GetEmailRetryQueueHealthErrorCode,
  GetEmailRetryQueueHealthInputSchema,
} from "@/lib/services";

describe("GetEmailRetryQueueHealth Spec (Contract Test)", () => {
  it("accepts optional now Date", () => {
    expect(
      GetEmailRetryQueueHealthInputSchema.safeParse({ now: new Date() }).success
    ).toBe(true);
  });

  it("rejects non-Date now and defines STORAGE_UNAVAILABLE", () => {
    expect(
      GetEmailRetryQueueHealthInputSchema.safeParse(
        fromAny({ now: "not-date" })
      ).success
    ).toBe(false);
    expect(GetEmailRetryQueueHealthErrorCode.options).toContain(
      "STORAGE_UNAVAILABLE"
    );
  });
});
