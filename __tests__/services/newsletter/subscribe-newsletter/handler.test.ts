// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  SubscribeNewsletterHandler,
  createFailure,
  createSuccess,
  type SendRawEmailSpec,
  type SubscribeNewsletterDeps,
} from "@/lib/services";

describe("SubscribeNewsletterHandler (Logic Test)", () => {
  const now = new Date("2026-02-01T12:00:00.000Z");

  it("returns INVALID_INPUT for malformed email address", async () => {
    const handler = new SubscribeNewsletterHandler();
    const result = await handler.execute({ email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("leaves already confirmed subscribers untouched and throttles recent pending resends", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({
        id: "sub_confirmed",
        status: "CONFIRMED",
        confirmationSentAt: now,
      })
      .mockResolvedValueOnce({
        id: "sub_recent_pending",
        status: "PENDING",
        confirmationSentAt: new Date(now.getTime() - 60_000),
      });

    const deps = fromPartial<SubscribeNewsletterDeps>({
      db: {
        newsletterSubscriber: {
          findUnique,
          create: async () => ({}),
          update: async () => ({}),
        },
      },
    });

    const handler = new SubscribeNewsletterHandler(deps);
    const confirmedRes = await handler.execute({
      email: "reader@example.com",
      now,
    });
    expect(confirmedRes).toEqual({
      success: true,
      data: { confirmationSent: false },
    });

    const throttledRes = await handler.execute({
      email: "reader@example.com",
      now,
    });
    expect(throttledRes).toEqual({
      success: true,
      data: { confirmationSent: false },
    });
  });

  it("creates pending subscriber or updates unsubscribed subscriber and dispatches confirmation email", async () => {
    const update = vi.fn(async () => ({}));
    const create = vi.fn(async () => ({ id: "sub_new" }));
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "sub_unsub",
        status: "UNSUBSCRIBED",
        confirmationSentAt: null,
      });

    const sendRawEmailHandler = fromPartial<SendRawEmailSpec>({
      execute: async () =>
        createSuccess({ id: "email_confirm_1", simulated: true }),
    });
    const deps = fromPartial<SubscribeNewsletterDeps>({
      db: {
        newsletterSubscriber: {
          findUnique,
          create,
          update,
        },
      },
      sendRawEmailHandler,
      tokenGenerator: () => "tok_generated",
    });

    const handler = new SubscribeNewsletterHandler(deps);
    const createdRes = await handler.execute({
      email: "reader@example.com",
      now,
    });
    expect(createdRes).toEqual({
      success: true,
      data: { confirmationSent: true, simulated: true },
    });
    expect(create).toHaveBeenCalledTimes(1);

    const updatedRes = await handler.execute({
      email: "reader@example.com",
      now,
    });
    expect(updatedRes).toEqual({
      success: true,
      data: { confirmationSent: true, simulated: true },
    });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("maps transient email failures to STORAGE_UNAVAILABLE and permanent failures to DELIVERY_FAILED", async () => {
    const executeEmail = vi
      .fn()
      .mockResolvedValueOnce(
        createFailure("TRANSPORT_UNCONFIGURED", "Missing Resend key", {
          recoverable: true,
        })
      )
      .mockResolvedValueOnce(
        createFailure("RECIPIENT_SUPPRESSED", "Suppressed recipient", {
          recoverable: false,
        })
      );

    const deps = fromPartial<SubscribeNewsletterDeps>({
      db: {
        newsletterSubscriber: {
          findUnique: async () => null,
          create: async () => ({ id: "sub_new" }),
          update: async () => ({}),
        },
      },
      sendRawEmailHandler: fromPartial<SendRawEmailSpec>({
        execute: executeEmail,
      }),
      tokenGenerator: () => "tok_generated",
    });

    const handler = new SubscribeNewsletterHandler(deps);

    const transientRes = await handler.execute({
      email: "reader@example.com",
      now,
    });
    expect(transientRes.success).toBe(false);
    if (!transientRes.success) {
      expect(transientRes.error.code).toBe("STORAGE_UNAVAILABLE");
      expect(transientRes.error.recoverable).toBe(true);
    }

    const permanentRes = await handler.execute({
      email: "reader@example.com",
      now,
    });
    expect(permanentRes.success).toBe(false);
    if (!permanentRes.success) {
      expect(permanentRes.error.code).toBe("DELIVERY_FAILED");
      expect(permanentRes.error.recoverable).toBe(false);
    }
  });

  it("returns STORAGE_UNAVAILABLE when database lookup throws", async () => {
    const deps = fromPartial<SubscribeNewsletterDeps>({
      db: {
        newsletterSubscriber: {
          findUnique: async () => {
            throw new Error("Neon offline");
          },
          create: async () => ({}),
          update: async () => ({}),
        },
      },
    });

    const handler = new SubscribeNewsletterHandler(deps);
    const result = await handler.execute({ email: "reader@example.com" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
