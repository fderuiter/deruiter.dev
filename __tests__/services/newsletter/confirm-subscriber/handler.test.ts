// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  ConfirmSubscriberHandler,
  createSuccess,
  type ConfirmSubscriberPort,
} from "@/lib/services";

describe("ConfirmSubscriberHandler (Logic Test)", () => {
  it("confirms pending subscriber and sends welcome email", async () => {
    const subscribers = fromPartial<ConfirmSubscriberPort>({
      findUnique: vi.fn().mockResolvedValue({
        id: "sub-1",
        email: "reader@example.com",
        status: "PENDING",
        unsubscribeToken: "unsub-token-12345",
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    });
    const sendRawEmail = vi
      .fn()
      .mockResolvedValue(createSuccess({ delivered: true }));

    const handler = new ConfirmSubscriberHandler({
      subscribers,
      sendRawEmail,
      resolveAdminEmail: () => undefined,
    });
    const result = await handler.execute({
      token: "confirm-token-12345",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outcome).toBe("confirmed");
    }
    expect(sendRawEmail).toHaveBeenCalledTimes(1);
  });

  it("returns INVALID_TOKEN for unknown token and STORAGE_UNAVAILABLE on DB error", async () => {
    const notFoundHandler = new ConfirmSubscriberHandler({
      subscribers: fromPartial<ConfirmSubscriberPort>({
        findUnique: vi.fn().mockResolvedValue(null),
      }),
    });
    const notFound = await notFoundHandler.execute({
      token: "missing-token-12345",
    });
    expect(notFound.success).toBe(false);
    if (!notFound.success) {
      expect(notFound.error.code).toBe("INVALID_TOKEN");
    }

    const dbErrHandler = new ConfirmSubscriberHandler({
      subscribers: fromPartial<ConfirmSubscriberPort>({
        findUnique: vi.fn().mockRejectedValue(new Error("Postgres down")),
      }),
    });
    const dbErr = await dbErrHandler.execute({ token: "valid-token-12345" });
    expect(dbErr.success).toBe(false);
    if (!dbErr.success) {
      expect(dbErr.error.code).toBe("STORAGE_UNAVAILABLE");
      expect(dbErr.error.recoverable).toBe(true);
    }
  });
});
