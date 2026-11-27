// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  GetRetryQueueHealthErrorCode,
  GetRetryQueueHealthInputSchema,
} from "@/lib/services";

describe("GetRetryQueueHealthInputSchema (Contract Test)", () => {
  it("accepts undefined or optional now Date", () => {
    expect(GetRetryQueueHealthInputSchema.safeParse(undefined).success).toBe(
      true
    );
    expect(
      GetRetryQueueHealthInputSchema.safeParse({
        now: new Date("2026-03-01T00:00:00Z"),
      }).success
    ).toBe(true);
  });

  it("rejects non-Date now values", () => {
    expect(
      GetRetryQueueHealthInputSchema.safeParse({ now: fromAny("bad") }).success
    ).toBe(false);
    expect(GetRetryQueueHealthErrorCode.options).toContain(
      "STORAGE_UNAVAILABLE"
    );
  });
});
