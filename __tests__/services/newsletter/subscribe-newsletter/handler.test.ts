// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  SubscribeNewsletterHandler,
  createFailure,
  createSuccess,
  type SubscribeNewsletterSubscriberPort,
} from "@/lib/services";

describe("SubscribeNewsletterHandler (Logic Test)", () => {
  it("creates pending subscriber and dispatches confirmation email", async () => {
    const subscribers = fromPartial<SubscribeNewsletterSubscriberPort>({
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "sub-1" }),
    });
    const sendRawEmail = vi
      .fn()
      .mockResolvedValue(createSuccess({ delivered: true }));

    const handler = new SubscribeNewsletterHandler({
      subscribers,
      sendRawEmail,
      tokenGenerator: () => "tok-1234567890",
    });

    const result = await handler.execute({ email: "Reader@Example.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confirmationSent).toBe(true);
    }
    expect(sendRawEmail).toHaveBeenCalledTimes(1);
  });

  it("returns EMAIL_DELIVERY_FAILED when confirmation email fails", async () => {
    const subscribers = fromPartial<SubscribeNewsletterSubscriberPort>({
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "sub-1" }),
    });
    const handler = new SubscribeNewsletterHandler({
      subscribers,
      sendRawEmail: vi
        .fn()
        .mockResolvedValue(createFailure("PROVIDER_REJECTED", "Resend down")),
      tokenGenerator: () => "tok-1234567890",
    });

    const result = await handler.execute({ email: "reader@example.com" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("EMAIL_DELIVERY_FAILED");
    }
  });
});
