// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  AuditNullQueueDeliveriesInputSchema,
  AuditNullQueueErrorCode,
} from "@/lib/services";

describe("AuditNullQueueDeliveriesInputSchema (Contract Test)", () => {
  it("accepts optional integer page and pageSize", () => {
    const parsed = AuditNullQueueDeliveriesInputSchema.safeParse({
      page: 1,
      pageSize: 50,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects non-integer pagination fields", () => {
    const parsed = AuditNullQueueDeliveriesInputSchema.safeParse({
      page: 1.5,
    });
    expect(parsed.success).toBe(false);
    expect(AuditNullQueueErrorCode.options).toContain("AUDIT_FAILED");
  });
});
