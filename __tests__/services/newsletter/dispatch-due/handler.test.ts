// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  DispatchDueNewsletterHandler,
  createSuccess,
  type DispatchDueNewsletterDeps,
  type EnqueueEmailSpec,
  type GetSuppressedEmailsSpec,
  type QueuePostAnnouncementSpec,
} from "@/lib/services";

describe("DispatchDueNewsletterHandler (Logic Test)", () => {
  it("completes cleanly with zero openDispatches when queue has no pending announcements", async () => {
    const deps = fromPartial<DispatchDueNewsletterDeps>({
      db: {
        blogPost: { findMany: async () => [] },
        outboundEmailQueue: { count: async () => 0 },
        newsletterDispatch: {
          findMany: async () => [],
          update: async () => ({}),
        },
        newsletterSubscriber: {
          findMany: async () => [],
          count: async () => 0,
        },
        newsletterDelivery: { createMany: async () => ({}) },
      },
      queueAnnouncementHandler: fromPartial<QueuePostAnnouncementSpec>({
        execute: async () => createSuccess({ blogPostId: "p1" }),
      }),
      getSuppressedEmailsHandler: fromPartial<GetSuppressedEmailsSpec>({
        execute: async () => createSuccess(new Set<string>()),
      }),
      enqueueEmailHandler: fromPartial<EnqueueEmailSpec>({
        execute: async () => createSuccess({ id: "q1" }),
      }),
    });

    const handler = new DispatchDueNewsletterHandler(deps);
    const result = await handler.execute({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.openDispatches).toBe(0);
      expect(result.data.queued).toBe(0);
    }
  });

  it("returns failure envelope when database read throws", async () => {
    const deps = fromPartial<DispatchDueNewsletterDeps>({
      db: {
        blogPost: {
          findMany: async () => {
            throw new Error("DB unreachable");
          },
        },
      },
    });
    const handler = new DispatchDueNewsletterHandler(deps);
    const result = await handler.execute({});
    expect(result.success).toBe(false);
  });
});
