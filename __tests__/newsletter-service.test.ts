// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// In-memory stand-in for the Prisma models the newsletter touches (#841).
interface Subscriber {
  id: string;
  email: string;
  status: "PENDING" | "CONFIRMED" | "UNSUBSCRIBED";
  confirmationToken: string | null;
  confirmationSentAt: Date | null;
  unsubscribeToken: string;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
}
interface Dispatch {
  id: string;
  blogPostId: string;
  createdAt: Date;
  completedAt: Date | null;
}
interface Delivery {
  id: string;
  dispatchId: string;
  subscriberId: string;
  queueId: string | null;
}
interface QueueRow {
  id: string;
  to: string;
  subject: string;
  status: string;
  headers?: Record<string, string>;
  lastError?: string | null;
}

const db = vi.hoisted(() => ({
  subscribers: [] as Subscriber[],
  dispatches: [] as Dispatch[],
  deliveries: [] as Delivery[],
  queue: [] as QueueRow[],
  posts: new Map<
    string,
    {
      title: string;
      dek: string;
      slug: string;
      published: boolean;
      created_at?: Date;
    }
  >(),
  suppressed: new Set<string>(),
  seq: 0,
}));

vi.mock("@/lib/db", () => {
  const id = (p: string) => `${p}_${++db.seq}`;
  type Where = Record<string, unknown>;
  const matchSubscriber = (s: Subscriber, where: Where) => {
    if (where.status && s.status !== where.status) return false;
    const confirmedAt = where.confirmedAt as { lte: Date } | undefined;
    if (confirmedAt && !(s.confirmedAt && s.confirmedAt <= confirmedAt.lte))
      return false;
    const deliveries = where.deliveries as
      { none: { dispatchId: string } } | undefined;
    if (
      deliveries &&
      db.deliveries.some(
        (d) =>
          d.subscriberId === s.id && d.dispatchId === deliveries.none.dispatchId
      )
    )
      return false;
    return true;
  };
  return {
    prisma: {
      newsletterSubscriber: {
        findUnique: vi.fn(async ({ where }: { where: Where }) => {
          const [key, value] = Object.entries(where)[0];
          return (
            db.subscribers.find((s) => s[key as keyof Subscriber] === value) ??
            null
          );
        }),
        create: vi.fn(async ({ data }: { data: Partial<Subscriber> }) => {
          const row = {
            id: id("sub"),
            confirmedAt: null,
            unsubscribedAt: null,
            confirmationSentAt: null,
            confirmationToken: null,
            ...data,
          } as Subscriber;
          db.subscribers.push(row);
          return row;
        }),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<Subscriber>;
          }) => {
            const row = db.subscribers.find((s) => s.id === where.id)!;
            Object.assign(row, data);
            return row;
          }
        ),
        updateMany: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string; confirmationToken: string };
            data: Partial<Subscriber>;
          }) => {
            const rows = db.subscribers.filter(
              (s) =>
                s.id === where.id &&
                s.confirmationToken === where.confirmationToken
            );
            rows.forEach((r) => Object.assign(r, data));
            return { count: rows.length };
          }
        ),
        findMany: vi.fn(
          async ({ where, take }: { where: Where; take?: number }) =>
            db.subscribers
              .filter((s) => matchSubscriber(s, where))
              .sort(
                (a, b) =>
                  (a.confirmedAt?.getTime() ?? 0) -
                  (b.confirmedAt?.getTime() ?? 0)
              )
              .slice(0, take ?? Infinity)
        ),
        count: vi.fn(
          async ({ where }: { where: Where }) =>
            db.subscribers.filter((s) => matchSubscriber(s, where)).length
        ),
      },
      newsletterDispatch: {
        upsert: vi.fn(async ({ where }: { where: { blogPostId: string } }) => {
          const found = db.dispatches.find(
            (d) => d.blogPostId === where.blogPostId
          );
          if (found) return found;
          const row = {
            id: id("dsp"),
            blogPostId: where.blogPostId,
            createdAt: new Date(),
            completedAt: null,
          };
          db.dispatches.push(row);
          return row;
        }),
        findMany: vi.fn(async () =>
          db.dispatches
            .filter((d) => d.completedAt === null)
            .map((d) => ({ ...d, blogPost: db.posts.get(d.blogPostId)! }))
        ),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<Dispatch>;
          }) => {
            const row = db.dispatches.find((d) => d.id === where.id)!;
            Object.assign(row, data);
            return row;
          }
        ),
      },
      newsletterDelivery: {
        create: vi.fn(
          async ({
            data,
          }: {
            data: { dispatchId: string; subscriberId: string };
          }) => {
            if (
              db.deliveries.some(
                (d) =>
                  d.dispatchId === data.dispatchId &&
                  d.subscriberId === data.subscriberId
              )
            )
              throw new Error("Unique constraint failed");
            const row = { id: id("dlv"), queueId: null, ...data };
            db.deliveries.push(row);
            return row;
          }
        ),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<Delivery>;
          }) => {
            const row = db.deliveries.find((d) => d.id === where.id)!;
            Object.assign(row, data);
            return row;
          }
        ),
        delete: vi.fn(async ({ where }: { where: { id: string } }) => {
          db.deliveries = db.deliveries.filter((d) => d.id !== where.id);
        }),
        findMany: vi.fn(
          async ({ where }: { where: { subscriberId: string } }) =>
            db.deliveries.filter(
              (d) => d.subscriberId === where.subscriberId && d.queueId
            )
        ),
      },
      outboundEmailQueue: {
        count: vi.fn(
          async () =>
            db.queue.filter((q) => ["PENDING", "RETRYING"].includes(q.status))
              .length
        ),
        create: vi.fn(
          async ({
            data,
          }: {
            data: Omit<QueueRow, "id"> & { headers?: Record<string, string> };
          }) => {
            const row = { ...data, id: id("q") };
            db.queue.push(row);
            return row;
          }
        ),
        updateMany: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: { in: string[] } };
            data: Partial<QueueRow>;
          }) => {
            const rows = db.queue.filter(
              (q) =>
                where.id.in.includes(q.id) &&
                ["PENDING", "RETRYING"].includes(q.status)
            );
            rows.forEach((r) => Object.assign(r, data));
            return { count: rows.length };
          }
        ),
      },
      blogPost: {
        findMany: vi.fn(
          async ({ where }: { where: { created_at: { gte: Date } } }) =>
            [...db.posts.entries()]
              .filter(
                ([id, post]) =>
                  post.published &&
                  (post.created_at ?? new Date(0)) >= where.created_at.gte &&
                  !db.dispatches.some((d) => d.blogPostId === id)
              )
              .map(([id]) => ({ id }))
        ),
      },
      suppressionList: {
        findUnique: vi.fn(async ({ where }: { where: { email: string } }) =>
          db.suppressed.has(where.email)
            ? { email: where.email, reason: "BOUNCE" }
            : null
        ),
      },
    },
  };
});

import { EmailService } from "@/lib/services/email-service";
import { resolveBaseUrl } from "@/lib/domain";
import {
  NewsletterService,
  NEWSLETTER_DISPATCH_CAP,
} from "@/lib/services/newsletter-service";

const HOUR = 60 * 60 * 1000;

/** Runs the dispatch phase and unwraps its counts, failing on an error result. */
async function dispatchCounts(now?: Date) {
  const result = await NewsletterService.dispatchDue(now);
  if (!result.success) {
    throw new Error(`Dispatch failed: ${result.error.code}`);
  }
  return result.data;
}

function confirmed(email: string, confirmedAt: Date): Subscriber {
  const row: Subscriber = {
    id: `sub_${email}`,
    email,
    status: "CONFIRMED",
    confirmationToken: null,
    confirmationSentAt: null,
    unsubscribeToken: `unsub-token-for-${email}`,
    confirmedAt,
    unsubscribedAt: null,
  };
  db.subscribers.push(row);
  return row;
}

describe("NewsletterService (#841)", () => {
  let send: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    db.subscribers = [];
    db.dispatches = [];
    db.deliveries = [];
    db.queue = [];
    db.posts.clear();
    db.suppressed.clear();
    send = vi.spyOn(EmailService, "sendRawEmail");
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("double opt-in signup", () => {
    it("stores a new address as PENDING and emails a confirmation link", async () => {
      const result = await NewsletterService.subscribe("  Reader@Example.com ");

      expect(result).toMatchObject({ success: true, confirmationSent: true });
      expect(db.subscribers).toHaveLength(1);
      const [row] = db.subscribers;
      expect(row.email).toBe("reader@example.com");
      expect(row.status).toBe("PENDING");
      expect(row.confirmationToken).toBeTruthy();
      expect(row.unsubscribeToken).toBeTruthy();
      expect(send).toHaveBeenCalledOnce();
      const mail = send.mock.calls[0][0] as { to: string; html: string };
      expect(mail.to).toBe("reader@example.com");
      expect(mail.html).toContain(
        `/api/newsletter/confirm?token=${row.confirmationToken}`
      );
    });

    it("re-sends to a pending address at most once an hour", async () => {
      const t0 = new Date("2026-09-25T00:00:00Z");
      await NewsletterService.subscribe("reader@example.com", t0);
      const firstToken = db.subscribers[0].confirmationToken;

      const again = await NewsletterService.subscribe(
        "reader@example.com",
        new Date(t0.getTime() + HOUR / 2)
      );
      expect(again).toMatchObject({ success: true, confirmationSent: false });
      expect(send).toHaveBeenCalledOnce();

      await NewsletterService.subscribe(
        "reader@example.com",
        new Date(t0.getTime() + HOUR + 1)
      );
      expect(send).toHaveBeenCalledTimes(2);
      expect(db.subscribers[0].confirmationToken).not.toBe(firstToken);
    });

    it("sends nothing to an address that is already confirmed", async () => {
      confirmed("reader@example.com", new Date());
      const result = await NewsletterService.subscribe("reader@example.com");
      expect(result).toMatchObject({ success: true, confirmationSent: false });
      expect(send).not.toHaveBeenCalled();
    });

    it("confirms from the single-use token and then forgets it", async () => {
      await NewsletterService.subscribe("reader@example.com");
      const token = db.subscribers[0].confirmationToken!;
      send.mockClear();

      expect(await NewsletterService.confirm(token)).toBe("confirmed");
      expect(db.subscribers[0].status).toBe("CONFIRMED");
      expect(db.subscribers[0].confirmationToken).toBeNull();
      // Welcome to the subscriber, carrying one-click unsubscribe headers.
      const welcome = send.mock.calls[0][0] as {
        to: string;
        headers: Record<string, string>;
      };
      expect(welcome.to).toBe("reader@example.com");
      expect(welcome.headers["List-Unsubscribe-Post"]).toBe(
        "List-Unsubscribe=One-Click"
      );

      expect(await NewsletterService.confirm(token)).toBe("invalid");
    });

    it("rejects an unknown confirmation token", async () => {
      expect(await NewsletterService.confirm("not-a-real-token-123")).toBe(
        "invalid"
      );
    });
  });

  describe("one-click unsubscribe", () => {
    it("unsubscribes from the token alone and cancels queued dispatches", async () => {
      const sub = confirmed("reader@example.com", new Date(0));
      db.queue.push({
        id: "q_pending",
        to: sub.email,
        subject: "New dispatch",
        status: "PENDING",
      });
      db.deliveries.push({
        id: "d1",
        dispatchId: "dsp_x",
        subscriberId: sub.id,
        queueId: "q_pending",
      });

      expect(await NewsletterService.unsubscribe(sub.unsubscribeToken)).toBe(
        "unsubscribed"
      );
      expect(sub.status).toBe("UNSUBSCRIBED");
      expect(db.queue[0]).toMatchObject({
        status: "FAILED",
        lastError: "Recipient unsubscribed",
      });
      expect(await NewsletterService.unsubscribe(sub.unsubscribeToken)).toBe(
        "already_unsubscribed"
      );
      expect(await NewsletterService.unsubscribe("unknown-token-12345")).toBe(
        "invalid"
      );
    });
  });

  describe("capped dispatch phase", () => {
    function publishPost(id: string, published = true) {
      db.posts.set(id, {
        title: `Post ${id}`,
        dek: "A dek.",
        slug: `post-${id}`,
        published,
      });
    }

    it("queues one announcement per eligible subscriber, with unsubscribe headers", async () => {
      publishPost("p1");
      const early = confirmed("early@example.com", new Date(0));
      confirmed("bounced@example.com", new Date(0));
      db.suppressed.add("bounced@example.com");
      await NewsletterService.queuePostAnnouncement("p1");
      // Confirmed after the post was queued: not a recipient of this post.
      confirmed("late@example.com", new Date(Date.now() + HOUR));
      db.subscribers.push({
        ...early,
        id: "sub_pending",
        email: "pending@example.com",
        status: "PENDING",
        unsubscribeToken: "pending-unsub-token",
      });

      const counts = await dispatchCounts();

      expect(counts).toMatchObject({
        queued: 1,
        skippedSuppressed: 1,
        completedDispatches: 1,
      });
      expect(db.queue).toHaveLength(1);
      expect(db.queue[0].to).toBe("early@example.com");
      expect(db.queue[0].status).toBe("PENDING");
      expect(db.queue[0].headers).toEqual({
        "List-Unsubscribe": `<${resolveBaseUrl()}/api/newsletter/unsubscribe?token=${encodeURIComponent(early.unsubscribeToken)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      });
      expect(send).not.toHaveBeenCalled();

      // A replayed run sends nothing twice.
      await NewsletterService.queuePostAnnouncement("p1");
      const again = await dispatchCounts();
      expect(again.queued).toBe(0);
      expect(db.queue).toHaveLength(1);
    });

    it("never enqueues more than the cap in one run, across several posts", async () => {
      for (let i = 0; i < 30; i++) {
        confirmed(`reader${i}@example.com`, new Date(i));
      }
      for (const post of ["p1", "p2", "p3"]) {
        publishPost(post);
        await NewsletterService.queuePostAnnouncement(post);
      }

      const first = await dispatchCounts();
      expect(first.queued).toBe(NEWSLETTER_DISPATCH_CAP);
      expect(db.queue).toHaveLength(NEWSLETTER_DISPATCH_CAP);
      expect(first.completedDispatches).toBe(0);
    });

    it("leaves room in the queue batch for mail already waiting", async () => {
      for (let i = 0; i < 20; i++) {
        confirmed(`reader${i}@example.com`, new Date(i));
      }
      for (let i = 0; i < 10; i++) {
        db.queue.push({
          id: `retry_${i}`,
          to: "x@example.com",
          subject: "retry",
          status: "RETRYING",
        });
      }
      publishPost("p1");
      await NewsletterService.queuePostAnnouncement("p1");

      const counts = await dispatchCounts();
      // Batch of 15 minus 10 already waiting leaves 5.
      expect(counts.capacity).toBe(5);
      expect(counts.queued).toBe(5);
    });

    it("discovers a recently published post that was never queued, but not an old one", async () => {
      const now = new Date("2026-09-25T00:00:00Z");
      confirmed("reader@example.com", new Date(0));
      db.posts.set("fresh", {
        title: "Fresh",
        dek: "Published in the database two days ago.",
        slug: "fresh",
        published: true,
        created_at: new Date(now.getTime() - 2 * 24 * HOUR),
      });
      db.posts.set("old", {
        title: "Old",
        dek: "Published a month ago.",
        slug: "old",
        published: true,
        created_at: new Date(now.getTime() - 30 * 24 * HOUR),
      });

      const counts = await dispatchCounts(now);

      expect(db.dispatches.map((d) => d.blogPostId)).toEqual(["fresh"]);
      expect(counts.queued).toBe(1);
      expect(db.queue[0].subject).toBe("New dispatch: Fresh");
    });

    it("returns ENQUEUE_FAILED and releases the claim when the outbound queue write fails (#1532)", async () => {
      publishPost("p1");
      confirmed("reader@example.com", new Date(0));
      await NewsletterService.queuePostAnnouncement("p1");
      vi.spyOn(EmailService, "enqueueEmail").mockResolvedValueOnce(null);

      const result = await NewsletterService.dispatchDue();

      expect(result).toMatchObject({
        success: false,
        error: {
          code: "ENQUEUE_FAILED",
          message: "Could not enqueue a newsletter dispatch email",
        },
      });
      // The claim is released so the next run retries this recipient.
      expect(db.deliveries).toHaveLength(0);
      expect(db.dispatches[0].completedAt ?? null).toBeNull();

      const retried = await dispatchCounts();
      expect(retried.queued).toBe(1);
    });

    it("returns DISPATCH_FAILED instead of throwing when a database read fails (#1532)", async () => {
      const { prisma } = await import("@/lib/db");
      const dbError = new Error("Neon compute suspended");
      vi.spyOn(prisma.blogPost, "findMany").mockRejectedValueOnce(dbError);

      await expect(NewsletterService.dispatchDue()).resolves.toMatchObject({
        success: false,
        error: { code: "DISPATCH_FAILED", details: dbError },
      });
    });

    it("closes a dispatch whose post was unpublished without sending", async () => {
      confirmed("reader@example.com", new Date(0));
      publishPost("p1", false);
      await NewsletterService.queuePostAnnouncement("p1");

      const counts = await dispatchCounts();
      expect(counts).toMatchObject({ queued: 0, completedDispatches: 1 });
      expect(db.dispatches[0].completedAt).not.toBeNull();
    });
  });
});
