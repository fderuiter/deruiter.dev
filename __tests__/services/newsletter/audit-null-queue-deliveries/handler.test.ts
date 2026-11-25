// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  AuditNullQueueDeliveriesHandler,
  type AuditNullQueueDeliveriesDeps,
} from "@/lib/services";

describe("AuditNullQueueDeliveriesHandler (Logic Test)", () => {
  it("classifies suppressed deliveries vs orphaned claims", async () => {
    const deps = fromPartial<AuditNullQueueDeliveriesDeps>({
      db: {
        newsletterDelivery: {
          findMany: async () => [
            {
              id: "del_1",
              dispatchId: "disp_1",
              subscriberId: "sub_1",
              subscriber: { email: "bounced@example.com" },
            },
            {
              id: "del_2",
              dispatchId: "disp_1",
              subscriberId: "sub_2",
              subscriber: { email: "active@example.com" },
            },
          ],
          count: async () => 2,
        },
        suppressionList: {
          findMany: async () => [
            { email: "bounced@example.com", reason: "BOUNCED" },
          ],
        },
      },
    });

    const handler = new AuditNullQueueDeliveriesHandler(deps);
    const result = await handler.execute({ page: 1, pageSize: 50 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalNullQueue).toBe(2);
      expect(result.data.intentionalSkips).toHaveLength(1);
      expect(result.data.orphanedClaims).toHaveLength(1);
    }
  });

  it("returns failure envelope when database query rejects", async () => {
    const deps = fromPartial<AuditNullQueueDeliveriesDeps>({
      db: {
        newsletterDelivery: {
          findMany: async () => {
            throw new Error("Neon timeout");
          },
          count: async () => 0,
        },
        suppressionList: {
          findMany: async () => [],
        },
      },
    });

    const handler = new AuditNullQueueDeliveriesHandler(deps);
    const result = await handler.execute();
    expect(result.success).toBe(false);
  });
});
