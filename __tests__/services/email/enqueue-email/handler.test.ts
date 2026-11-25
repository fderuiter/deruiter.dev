// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { EnqueueEmailHandler, type EnqueueEmailDeps } from "@/lib/services";

describe("EnqueueEmailHandler (Logic Test)", () => {
  it("creates PENDING outboundEmailQueue row and returns queueId", async () => {
    const deps = fromPartial<EnqueueEmailDeps>({
      db: {
        outboundEmailQueue: {
          create: async () => ({ id: "queue-123" }),
        },
      },
    });

    const handler = new EnqueueEmailHandler(deps);
    const result = await handler.execute({
      options: {
        to: "reader@example.com",
        subject: "Update",
        html: "<p>News</p>",
      },
    });
    expect(result).toEqual({ success: true, data: { queueId: "queue-123" } });
  });

  it("returns ENQUEUE_FAILED when database insert fails", async () => {
    const deps = fromPartial<EnqueueEmailDeps>({
      db: {
        outboundEmailQueue: {
          create: async () => {
            throw new Error("Insert failed");
          },
        },
      },
    });

    const handler = new EnqueueEmailHandler(deps);
    const result = await handler.execute({
      options: {
        to: "reader@example.com",
        subject: "Update",
        html: "<p>News</p>",
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("ENQUEUE_FAILED");
    }
  });
});
