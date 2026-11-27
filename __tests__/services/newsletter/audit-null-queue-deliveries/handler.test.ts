// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  AuditNullQueueDeliveriesHandler,
  type AuditNullQueuePrismaPort,
} from "@/lib/services";

describe("AuditNullQueueDeliveriesHandler (Logic Test)", () => {
  it("separates intentional suppression skips from orphaned claims", async () => {
    const db = fromPartial<AuditNullQueuePrismaPort>({
      newsletterDelivery: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "del-1",
            dispatchId: "disp-1",
            subscriberId: "sub-1",
            subscriber: { email: "bounced@example.com" },
          },
          {
            id: "del-2",
            dispatchId: "disp-1",
            subscriberId: "sub-2",
            subscriber: { email: "orphan@example.com" },
          },
        ]),
        count: vi.fn().mockResolvedValue(2),
      },
      suppressionList: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { email: "bounced@example.com", reason: "BOUNCE" },
          ]),
      },
    });

    const handler = new AuditNullQueueDeliveriesHandler({ db });
    const result = await handler.execute({ page: 1, pageSize: 20 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.intentionalSkips).toHaveLength(1);
      expect(result.data.orphanedClaims).toHaveLength(1);
    }
  });

  it("returns AUDIT_FAILED when database query throws", async () => {
    const db = fromPartial<AuditNullQueuePrismaPort>({
      newsletterDelivery: {
        findMany: vi.fn().mockRejectedValue(new Error("DB connection lost")),
        count: vi.fn().mockResolvedValue(0),
      },
    });
    const handler = new AuditNullQueueDeliveriesHandler({ db });
    const result = await handler.execute();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("AUDIT_FAILED");
    }
  });
});
