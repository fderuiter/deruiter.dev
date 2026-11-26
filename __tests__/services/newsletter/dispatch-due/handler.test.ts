// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  DispatchDueNewsletterHandler,
  createFailure,
  createSuccess,
  type DispatchDueNewsletterDeps,
  type EnqueueEmailSpec,
  type GetSuppressedEmailsSpec,
  type NewsletterDispatchTxClient,
  type QueuePostAnnouncementSpec,
} from "@/lib/services";

describe("DispatchDueNewsletterHandler (Logic Test)", () => {
  const now = new Date("2026-02-01T00:00:00.000Z");

  it("returns INVALID_INPUT for malformed input payload", async () => {
    const handler = new DispatchDueNewsletterHandler();
    const result = await handler.execute(fromAny("invalid"));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

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
        execute: async () => createSuccess({ dispatchId: "d1", created: true }),
      }),
      getSuppressedEmailsHandler: fromPartial<GetSuppressedEmailsSpec>({
        execute: async () => createSuccess(new Set<string>()),
      }),
      enqueueEmailHandler: fromPartial<EnqueueEmailSpec>({
        execute: async () => createSuccess({ queueId: "q1" }),
      }),
    });

    const handler = new DispatchDueNewsletterHandler(deps);
    const result = await handler.execute({ now });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.openDispatches).toBe(0);
      expect(result.data.queued).toBe(0);
    }
  });

  it("discovers unannounced posts, auto-completes unpublished dispatches, skips suppressed, and enqueues eligible recipients", async () => {
    const createMany = vi.fn(async () => ({}));
    const updateDispatch = vi.fn(async () => ({}));
    const txUpdateDelivery = vi.fn(async () => ({}));

    const deps = fromPartial<DispatchDueNewsletterDeps>({
      db: {
        blogPost: { findMany: async () => [{ id: "post-new" }] },
        outboundEmailQueue: { count: async () => 0 },
        newsletterDispatch: {
          findMany: async () => [
            {
              id: "disp-unpublished",
              createdAt: now,
              blogPost: {
                title: "Draft",
                dek: "Draft",
                slug: "draft",
                published: false,
              },
            },
            {
              id: "disp-published",
              createdAt: now,
              blogPost: {
                title: "Published Post",
                dek: "Summary",
                slug: "published-post",
                published: true,
              },
            },
          ],
          update: updateDispatch,
        },
        newsletterSubscriber: {
          findMany: async () => [
            {
              id: "sub-suppressed",
              email: "Suppressed@Example.com",
              unsubscribeToken: "tok-sup",
            },
            {
              id: "sub-eligible",
              email: "reader@example.com",
              unsubscribeToken: "tok-ok",
            },
          ],
          count: async () => 0,
        },
        newsletterDelivery: { createMany },
        $transaction: async <T>(
          fn: (tx: NewsletterDispatchTxClient) => Promise<T>
        ) =>
          fn(
            fromPartial<NewsletterDispatchTxClient>({
              newsletterDelivery: {
                create: async () => ({ id: "deliv-1" }),
                update: txUpdateDelivery,
              },
            })
          ),
      },
      queueAnnouncementHandler: fromPartial<QueuePostAnnouncementSpec>({
        execute: async () =>
          createSuccess({ dispatchId: "disp-published", created: true }),
      }),
      getSuppressedEmailsHandler: fromPartial<GetSuppressedEmailsSpec>({
        execute: async () => createSuccess(new Set(["suppressed@example.com"])),
      }),
      enqueueEmailHandler: fromPartial<EnqueueEmailSpec>({
        execute: async () => createSuccess({ queueId: "queue-1" }),
      }),
    });

    const handler = new DispatchDueNewsletterHandler(deps);
    const result = await handler.execute({ now });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.openDispatches).toBe(2);
      expect(result.data.skippedSuppressed).toBe(1);
      expect(result.data.queued).toBe(1);
      expect(result.data.completedDispatches).toBe(2);
    }
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(txUpdateDelivery).toHaveBeenCalledTimes(1);
    expect(updateDispatch).toHaveBeenCalledTimes(2);
  });

  it("aborts with ENQUEUE_FAILED when transactional enqueue fails", async () => {
    const deps = fromPartial<DispatchDueNewsletterDeps>({
      db: {
        blogPost: { findMany: async () => [] },
        outboundEmailQueue: { count: async () => 0 },
        newsletterDispatch: {
          findMany: async () => [
            {
              id: "disp-1",
              createdAt: now,
              blogPost: {
                title: "Post",
                dek: "Dek",
                slug: "post",
                published: true,
              },
            },
          ],
          update: async () => ({}),
        },
        newsletterSubscriber: {
          findMany: async () => [
            {
              id: "sub-1",
              email: "reader@example.com",
              unsubscribeToken: "tok-1",
            },
          ],
          count: async () => 1,
        },
        newsletterDelivery: { createMany: async () => ({}) },
        $transaction: async <T>(
          fn: (tx: NewsletterDispatchTxClient) => Promise<T>
        ) =>
          fn(
            fromPartial<NewsletterDispatchTxClient>({
              newsletterDelivery: {
                create: async () => ({ id: "deliv-1" }),
                update: async () => ({}),
              },
            })
          ),
      },
      getSuppressedEmailsHandler: fromPartial<GetSuppressedEmailsSpec>({
        execute: async () => createSuccess(new Set<string>()),
      }),
      enqueueEmailHandler: fromPartial<EnqueueEmailSpec>({
        execute: async () =>
          createFailure("QUEUE_WRITE_FAILED", "Queue insert failed", {
            recoverable: true,
          }),
      }),
    });

    const handler = new DispatchDueNewsletterHandler(deps);
    const result = await handler.execute({ now });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("ENQUEUE_FAILED");
    }
  });

  it("aborts with DISPATCH_FAILED when suppression lookup fails", async () => {
    const deps = fromPartial<DispatchDueNewsletterDeps>({
      db: {
        blogPost: { findMany: async () => [] },
        outboundEmailQueue: { count: async () => 0 },
        newsletterDispatch: {
          findMany: async () => [
            {
              id: "disp-1",
              createdAt: now,
              blogPost: {
                title: "Post",
                dek: "Dek",
                slug: "post",
                published: true,
              },
            },
          ],
          update: async () => ({}),
        },
        newsletterSubscriber: {
          findMany: async () => [],
          count: async () => 0,
        },
      },
      getSuppressedEmailsHandler: fromPartial<GetSuppressedEmailsSpec>({
        execute: async () =>
          createFailure("SUPPRESSION_LOOKUP_FAILED", "Suppression DB down", {
            recoverable: true,
          }),
      }),
    });

    const handler = new DispatchDueNewsletterHandler(deps);
    const result = await handler.execute({ now });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("DISPATCH_FAILED");
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
