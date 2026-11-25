// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  ConfirmSubscriberHandler,
  createSuccess,
  type ConfirmSubscriberDeps,
  type SendRawEmailSpec,
} from "@/lib/services";

describe("ConfirmSubscriberHandler (Logic Test)", () => {
  it("confirms pending subscriber and dispatches welcome email", async () => {
    const sendRawEmailHandler = fromPartial<SendRawEmailSpec>({
      execute: async () => createSuccess({ id: "msg_welcome" }),
    });
    const deps = fromPartial<ConfirmSubscriberDeps>({
      db: {
        newsletterSubscriber: {
          findUnique: async () => ({
            id: "sub_1",
            email: "reader@example.com",
            status: "PENDING",
            unsubscribeToken: "unsub_1",
          }),
          updateMany: async () => ({ count: 1 }),
        },
      },
      sendRawEmailHandler,
    });

    const handler = new ConfirmSubscriberHandler(deps);
    const result = await handler.execute({ token: "confirm_tok_1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outcome).toBe("confirmed");
    }
  });

  it("returns NOT_FOUND on unknown token and STORAGE_UNAVAILABLE on database failure", async () => {
    const notFoundHandler = new ConfirmSubscriberHandler(
      fromPartial<ConfirmSubscriberDeps>({
        db: {
          newsletterSubscriber: {
            findUnique: async () => null,
            updateMany: async () => ({ count: 0 }),
          },
        },
      })
    );
    const missing = await notFoundHandler.execute({ token: "unknown" });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.code).toBe("NOT_FOUND");
    }

    const outageHandler = new ConfirmSubscriberHandler(
      fromPartial<ConfirmSubscriberDeps>({
        db: {
          newsletterSubscriber: {
            findUnique: async () => {
              throw new Error("DB down");
            },
            updateMany: async () => ({ count: 0 }),
          },
        },
      })
    );
    const outage = await outageHandler.execute({ token: "confirm_tok_1" });
    expect(outage.success).toBe(false);
    if (!outage.success) {
      expect(outage.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
