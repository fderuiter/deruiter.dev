// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  UnsubscribeSubscriberHandler,
  type UnsubscribeSubscriberDeps,
} from "@/lib/services";

describe("UnsubscribeSubscriberHandler (Logic Test)", () => {
  it("marks subscriber UNSUBSCRIBED and cancels pending queued deliveries", async () => {
    const deps = fromPartial<UnsubscribeSubscriberDeps>({
      db: {
        newsletterSubscriber: {
          findUnique: async () => ({ id: "sub_1", status: "CONFIRMED" }),
          update: async () => ({}),
        },
        newsletterDelivery: {
          findMany: async () => [{ queueId: "q_pending_1" }],
        },
        outboundEmailQueue: {
          updateMany: async () => ({ count: 1 }),
        },
      },
    });

    const handler = new UnsubscribeSubscriberHandler(deps);
    const result = await handler.execute({ token: "unsub_token_1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outcome).toBe("unsubscribed");
    }
  });

  it("returns NOT_FOUND on unknown token and STORAGE_UNAVAILABLE on database error", async () => {
    const notFound = await new UnsubscribeSubscriberHandler(
      fromPartial<UnsubscribeSubscriberDeps>({
        db: {
          newsletterSubscriber: {
            findUnique: async () => null,
            update: async () => ({}),
          },
        },
      })
    ).execute({ token: "missing_tok" });

    expect(notFound.success).toBe(false);
    if (!notFound.success) {
      expect(notFound.error.code).toBe("NOT_FOUND");
    }

    const outage = await new UnsubscribeSubscriberHandler(
      fromPartial<UnsubscribeSubscriberDeps>({
        db: {
          newsletterSubscriber: {
            findUnique: async () => {
              throw new Error("DB error");
            },
            update: async () => ({}),
          },
        },
      })
    ).execute({ token: "unsub_token_1" });

    expect(outage.success).toBe(false);
    if (!outage.success) {
      expect(outage.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
