// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AuditNullQueueDeliveriesInputSchema } from "@/lib/services";

describe("AuditNullQueueDeliveriesInputSchema (Contract Test)", () => {
  it("accepts optional page and pageSize or undefined", () => {
    expect(
      AuditNullQueueDeliveriesInputSchema.safeParse({ page: 1, pageSize: 50 })
        .success
    ).toBe(true);
    expect(
      AuditNullQueueDeliveriesInputSchema.safeParse(undefined).success
    ).toBe(true);
  });

  it("rejects non-finite pagination values", () => {
    expect(
      AuditNullQueueDeliveriesInputSchema.safeParse({ page: Number.NaN })
        .success
    ).toBe(false);
  });
});
