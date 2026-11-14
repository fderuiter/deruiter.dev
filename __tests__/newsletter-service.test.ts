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
  createdAt?: Date;
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
  const mockPrisma: Record<string, unknown> = {
    $transaction: vi.fn(async (cb: unknown) => {
      if (typeof cb === "function") {
        const snapshot = {
          deliveries: [...db.deliveries.map((d) => ({ ...d }))],
          queue: [...db.queue.map((q) => ({ ...q }))],
          subscribers: [...db.subscribers.map((s) => ({ ...s }))],
          dispatches: [...db.dispatches.map((d) => ({ ...d }))],
        };
        try {
          return await (cb as (tx: unknown) => Promise<unknown>)(mockPrisma);
        } catch (err) {
          db.deliveries = snapshot.deliveries;
          db.queue = snapshot.queue;
          db.subscribers = snapshot.subscribers;
          db.dispatches = snapshot.dispatches;
          throw err;
        }
      }
      if (Array.isArray(cb)) {
        return Promise.all(cb);
      }
    }),
  };
  return {
    prisma: Object.assign(mockPrisma, {
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
            ) {
              const err = new Error("Unique constraint failed");
              (err as unknown as { code: string }).code = "P2002";
              throw err;
            }
            const row = {
              id: id("dlv"),
              queueId: null,
              createdAt: new Date(),
              ...data,
            };
            db.deliveries.push(row);
            return row;
          }
        ),
        createMany: vi.fn(
          async ({
            data,
            skipDuplicates,
          }: {
            data: Array<{ dispatchId: string; subscriberId: string }>;
            skipDuplicates?: boolean;
          }) => {
            let count = 0;
            for (const item of data) {
              const exists = db.deliveries.some(
                (d) =>
                  d.dispatchId === item.dispatchId &&
                  d.subscriberId === item.subscriberId
              );
              if (exists && !skipDuplicates) {
                const err = new Error("Unique constraint failed");
                (err as unknown as { code: string }).code = "P2002";
                throw err;
              }
              if (!exists) {
                db.deliveries.push({
                  id: id("dlv"),
                  queueId: null,
                  createdAt: new Date(),
                  ...item,
                });
                count++;
              }
            }
            return { count };
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
          async ({
            where,
            include,
            skip,
            take,
          }: {
            where?: {
              subscriberId?: string;
              queueId?: null | string | { not: null };
            };
            include?: { subscriber?: boolean };
            skip?: number;
            take?: number;
          } = {}) => {
            let res = db.deliveries;
            if (where?.subscriberId) {
              res = res.filter((d) => d.subscriberId === where.subscriberId);
            }
            if (where && "queueId" in where) {
              if (
                where.queueId !== null &&
                typeof where.queueId === "object" &&
                "not" in where.queueId
              ) {
                res = res.filter((d) => d.queueId !== null);
              } else {
                res = res.filter((d) => d.queueId === where.queueId);
              }
            } else if (where?.subscriberId) {
              res = res.filter((d) => d.queueId !== null);
            }
            if (skip) {
              res = res.slice(skip);
            }
            if (take !== undefined) {
              res = res.slice(0, take);
            }
            if (include?.subscriber) {
              return res.map((d) => ({
                ...d,
                subscriber: db.subscribers.find(
                  (s) => s.id === d.subscriberId
                )!,
              }));
            }
            return res;
          }
        ),
        count: vi.fn(
          async ({
            where,
          }: {
            where?: { queueId?: null | string | { not: null } };
          } = {}) => {
            let res = db.deliveries;
            if (where && "queueId" in where) {
              if (
                where.queueId !== null &&
                typeof where.queueId === "object" &&
                "not" in where.queueId
              ) {
                res = res.filter((d) => d.queueId !== null);
              } else {
                res = res.filter((d) => d.queueId === where.queueId);
              }
            }
            return res.length;
          }
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
        findUnique: vi.fn(async ({ where }: { where: { email: string } }) => {
          const email = where.email.toLowerCase().trim();
          return db.suppressed.has(email) || db.suppressed.has(where.email)
            ? { email: where.email, reason: "BOUNCE" }
            : null;
        }),
        findMany: vi.fn(
          async ({
            where,
            select,
          }: {
            where?: { email?: { in?: string[] } };
            select?: { email?: boolean };
          } = {}) => {
            const inList = where?.email?.in ?? [];
            return inList
              .filter(
                (e) =>
                  db.suppressed.has(e) ||
                  db.suppressed.has(e.toLowerCase().trim())
              )
              .map((e) =>
                select?.email
                  ? { email: e }
                  : { id: id("sup"), email: e, reason: "BOUNCE" }
              );
          }
        ),
      },
    }),
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

    it("batches suppression lookups and records skipped deliveries in batch", async () => {
      publishPost("p1");
      confirmed("user1@example.com", new Date(0));
      confirmed("user2@example.com", new Date(0));
      confirmed("user3@example.com", new Date(0));
      db.suppressed.add("user2@example.com");

      const getSuppressedSpy = vi.spyOn(EmailService, "getSuppressedEmails");
      await NewsletterService.queuePostAnnouncement("p1");

      const counts = await dispatchCounts();

      expect(getSuppressedSpy).toHaveBeenCalledTimes(1);
      expect(getSuppressedSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          "user1@example.com",
          "user2@example.com",
          "user3@example.com",
        ])
      );

      expect(counts).toMatchObject({
        queued: 2,
        skippedSuppressed: 1,
        completedDispatches: 1,
      });

      const user2Delivery = db.deliveries.find(
        (d) => d.subscriberId === "sub_user2@example.com"
      );
      expect(user2Delivery).toBeDefined();
      expect(user2Delivery?.queueId).toBeNull();

      expect(db.queue.map((q) => q.to).sort()).toEqual([
        "user1@example.com",
        "user3@example.com",
      ]);
    });

    it("completes dispatch when all recipients in a batch are suppressed without queueing emails", async () => {
      publishPost("p1");
      confirmed("all1@example.com", new Date(0));
      confirmed("all2@example.com", new Date(0));
      db.suppressed.add("all1@example.com");
      db.suppressed.add("all2@example.com");
      await NewsletterService.queuePostAnnouncement("p1");

      const counts = await dispatchCounts();

      expect(counts).toMatchObject({
        queued: 0,
        skippedSuppressed: 2,
        completedDispatches: 1,
      });
      expect(db.queue).toHaveLength(0);
      expect(db.deliveries).toHaveLength(2);
      expect(db.dispatches[0].completedAt).not.toBeNull();
    });

    it("ends run with typed DISPATCH_FAILED when suppression lookup fails without claiming or queueing (#3806)", async () => {
      publishPost("p1");
      confirmed("reader@example.com", new Date(0));
      await NewsletterService.queuePostAnnouncement("p1");

      vi.spyOn(EmailService, "getSuppressedEmails").mockRejectedValueOnce(
        new Error("Suppression DB connection lost")
      );

      const result = await NewsletterService.dispatchDue();

      expect(result).toMatchObject({
        success: false,
        error: {
          code: "DISPATCH_FAILED",
          message: "Suppression DB connection lost",
        },
      });

      // No recipient claimed or queued
      expect(db.deliveries).toHaveLength(0);
      expect(db.queue).toHaveLength(0);
      expect(db.dispatches[0].completedAt ?? null).toBeNull();
    });

    describe("fault injection at transaction write boundaries (#3801)", () => {
      it("Boundary 1 (before claim): rollback when delivery claim creation fails", async () => {
        publishPost("p1");
        confirmed("reader@example.com", new Date(0));
        await NewsletterService.queuePostAnnouncement("p1");

        const { prisma } = await import("@/lib/db");
        vi.spyOn(prisma.newsletterDelivery, "create").mockRejectedValueOnce(
          new Error("Claim insert failed: connection reset")
        );

        const result = await NewsletterService.dispatchDue();

        expect(result).toMatchObject({
          success: false,
          error: {
            code: "DISPATCH_FAILED",
            message: "Claim insert failed: connection reset",
          },
        });
        expect(db.deliveries).toHaveLength(0);
        expect(db.queue).toHaveLength(0);
        expect(db.dispatches[0].completedAt ?? null).toBeNull();

        // Rerun succeeds cleanly
        const retryCounts = await dispatchCounts();
        expect(retryCounts.queued).toBe(1);
        expect(db.deliveries).toHaveLength(1);
        expect(db.deliveries[0].queueId).toBe(db.queue[0].id);
      });

      it("Boundary 2 (after claim, during enqueue): rollback when enqueue fails", async () => {
        publishPost("p1");
        confirmed("reader@example.com", new Date(0));
        await NewsletterService.queuePostAnnouncement("p1");

        const { prisma } = await import("@/lib/db");
        vi.spyOn(prisma.outboundEmailQueue, "create").mockRejectedValueOnce(
          new Error("Queue disk full")
        );

        const result = await NewsletterService.dispatchDue();

        expect(result).toMatchObject({
          success: false,
          error: {
            code: "ENQUEUE_FAILED",
            message: "Could not enqueue a newsletter dispatch email",
          },
        });
        // Delivery claim is atomically rolled back; no orphan delivery remains
        expect(db.deliveries).toHaveLength(0);
        expect(db.queue).toHaveLength(0);
        expect(db.dispatches[0].completedAt ?? null).toBeNull();

        // Rerun succeeds cleanly
        const retryCounts = await dispatchCounts();
        expect(retryCounts.queued).toBe(1);
        expect(db.deliveries).toHaveLength(1);
        expect(db.deliveries[0].queueId).toBe(db.queue[0].id);
      });

      it("Boundary 3 (after outbound insert, before link): rollback when link update fails", async () => {
        publishPost("p1");
        confirmed("reader@example.com", new Date(0));
        await NewsletterService.queuePostAnnouncement("p1");

        const { prisma } = await import("@/lib/db");
        vi.spyOn(prisma.newsletterDelivery, "update").mockRejectedValueOnce(
          new Error("Lock timeout on delivery link update")
        );

        const result = await NewsletterService.dispatchDue();

        expect(result).toMatchObject({
          success: false,
          error: {
            code: "DISPATCH_FAILED",
            message: "Lock timeout on delivery link update",
          },
        });
        // Both delivery and queue row are rolled back atomically
        expect(db.deliveries).toHaveLength(0);
        expect(db.queue).toHaveLength(0);
        expect(db.dispatches[0].completedAt ?? null).toBeNull();

        // Rerun succeeds cleanly
        const retryCounts = await dispatchCounts();
        expect(retryCounts.queued).toBe(1);
        expect(db.deliveries).toHaveLength(1);
        expect(db.deliveries[0].queueId).toBe(db.queue[0].id);
      });

      it("handles duplicate invocation and replay idempotently without double-queueing", async () => {
        publishPost("p1");
        confirmed("dup1@example.com", new Date(0));
        confirmed("suppressed@example.com", new Date(0));
        db.suppressed.add("suppressed@example.com");
        await NewsletterService.queuePostAnnouncement("p1");

        const firstRun = await dispatchCounts();
        expect(firstRun.queued).toBe(1);
        expect(firstRun.skippedSuppressed).toBe(1);
        expect(firstRun.completedDispatches).toBe(1);

        // Replay: dispatchDue on completed dispatch
        const replayedRun = await dispatchCounts();
        expect(replayedRun.queued).toBe(0);
        expect(replayedRun.skippedSuppressed).toBe(0);
        expect(db.queue).toHaveLength(1);
        expect(db.deliveries).toHaveLength(2);

        // Simulated concurrent run hitting unique constraint on claim (Prisma P2002):
        // Returns DISPATCH_FAILED instead of throwing across service boundary
        confirmed("concurrent@example.com", new Date(0));
        const { prisma } = await import("@/lib/db");
        const uniqueErr = new Error(
          "Unique constraint failed on the fields: (`dispatchId`,`subscriberId`)"
        );
        (uniqueErr as unknown as { code: string }).code = "P2002";
        vi.spyOn(prisma.newsletterDelivery, "create").mockRejectedValueOnce(
          uniqueErr
        );

        // Reopen dispatch to simulate concurrent run
        db.dispatches[0].completedAt = null;
        const concurrentResult = await NewsletterService.dispatchDue();
        expect(concurrentResult).toMatchObject({
          success: false,
          error: {
            code: "DISPATCH_FAILED",
            message:
              "Unique constraint failed on the fields: (`dispatchId`,`subscriberId`)",
          },
        });
      });

      it("cancels queued email when an unsubscribe races the dispatch", async () => {
        publishPost("p1");
        const subscriber = confirmed("racing@example.com", new Date(0));
        await NewsletterService.queuePostAnnouncement("p1");

        // Dispatch runs and enqueues the announcement inside atomic transaction
        const counts = await dispatchCounts();
        expect(counts.queued).toBe(1);
        expect(db.deliveries).toHaveLength(1);
        const queueId = db.deliveries[0].queueId;
        expect(queueId).not.toBeNull();
        expect(db.queue[0].status).toBe("PENDING");

        // Unsubscribe races immediately after dispatch
        const unsubResult = await NewsletterService.unsubscribe(
          subscriber.unsubscribeToken
        );
        expect(unsubResult).toBe("unsubscribed");

        // The queued email has been canceled so it is never sent
        expect(db.queue[0].status).toBe("FAILED");
        expect(db.queue[0].lastError).toBe("Recipient unsubscribed");
      });
    });

    describe("auditNullQueueDeliveries (#3801 Step 3)", () => {
      it("distinguishes intentional skips from orphaned claims without mutating database", async () => {
        publishPost("p1");
        const dsp = db.dispatches[0] ?? { id: "dsp_1" };

        const subSkipped = confirmed("suppressed@example.com", new Date(0));
        const subOrphan = confirmed("orphan@example.com", new Date(0));
        const subLinked = confirmed("linked@example.com", new Date(0));

        db.suppressed.add("suppressed@example.com");

        // 1. Intentional skip: queueId is null, email is in suppressionList
        db.deliveries.push({
          id: "dlv_skip",
          dispatchId: dsp.id,
          subscriberId: subSkipped.id,
          queueId: null,
        });

        // 2. Orphaned claim: queueId is null, email is NOT in suppressionList
        db.deliveries.push({
          id: "dlv_orphan",
          dispatchId: dsp.id,
          subscriberId: subOrphan.id,
          queueId: null,
        });

        // 3. Normal linked delivery: queueId is present
        db.deliveries.push({
          id: "dlv_linked",
          dispatchId: dsp.id,
          subscriberId: subLinked.id,
          queueId: "q_1",
        });

        const audit = await NewsletterService.auditNullQueueDeliveries();

        expect(audit.success).toBe(true);
        if (audit.success) {
          expect(audit.data.totalNullQueue).toBe(2);
          expect(audit.data.page).toBe(1);
          expect(audit.data.pageSize).toBe(100);
          expect(audit.data.intentionalSkips).toHaveLength(1);
          expect(audit.data.intentionalSkips[0]).toEqual({
            deliveryId: "dlv_skip",
            dispatchId: dsp.id,
            subscriberId: subSkipped.id,
            suppressionReason: "BOUNCE",
          });
          expect(audit.data.orphanedClaims).toHaveLength(1);
          expect(audit.data.orphanedClaims[0]).toEqual({
            deliveryId: "dlv_orphan",
            dispatchId: dsp.id,
            subscriberId: subOrphan.id,
          });
        }

        // Paged invocation: supports take/skip bounds
        const pagedAudit = await NewsletterService.auditNullQueueDeliveries({
          page: 2,
          pageSize: 1,
        });
        expect(pagedAudit.success).toBe(true);
        if (pagedAudit.success) {
          expect(pagedAudit.data.totalNullQueue).toBe(2);
          expect(pagedAudit.data.page).toBe(2);
          expect(pagedAudit.data.pageSize).toBe(1);
          expect(
            pagedAudit.data.intentionalSkips.length +
              pagedAudit.data.orphanedClaims.length
          ).toBe(1);
        }

        // Database remains unmutated
        expect(db.deliveries).toHaveLength(3);
        expect(
          db.deliveries.find((d) => d.id === "dlv_orphan")?.queueId
        ).toBeNull();
      });
    });
  });
});
