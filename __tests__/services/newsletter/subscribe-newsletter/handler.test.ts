// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  SubscribeNewsletterHandler,
  createSuccess,
  type SendRawEmailSpec,
  type SubscribeNewsletterDeps,
} from "@/lib/services";

describe("SubscribeNewsletterHandler (Logic Test)", () => {
  it("creates pending subscriber and dispatches confirmation email", async () => {
    const sendRawEmailHandler = fromPartial<SendRawEmailSpec>({
      execute: async () =>
        createSuccess({ id: "email_confirm_1", simulated: true }),
    });
    const deps = fromPartial<SubscribeNewsletterDeps>({
      db: {
        newsletterSubscriber: {
          findUnique: async () => null,
          create: async () => ({ id: "sub_new" }),
          update: async () => ({}),
        },
      },
      sendRawEmailHandler,
      tokenGenerator: () => "tok_generated",
    });

    const handler = new SubscribeNewsletterHandler(deps);
    const result = await handler.execute({ email: "reader@example.com" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confirmationSent).toBe(true);
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
