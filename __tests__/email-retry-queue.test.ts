import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  EmailService,
  RawEmailOptions,
  type EmailRetryCounts,
  type EmailRetryResult,
} from "@/lib/services/email-service";
import { prisma } from "@/lib/db";

// In-memory mock store for OutboundEmailQueue & SuppressionList
interface MockQueueItem {
  id: string;
  to: string;
  from: string;
  replyTo: string | null;
  subject: string;
  html: string;
  text: string | null;
  tags: unknown;
  attempts: number;
  status: string;
  nextRetryAt: Date;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const mockQueueStore = new Map<string, MockQueueItem>();
const mockSuppressionStore = new Map<
  string,
  { email: string; reason: string }
>();

vi.mock("@/lib/db", () => ({
  prisma: {
    // Emulates the single lease statement (#1116). The mock body runs without
    // an await, so like the real statement it is atomic: an overlapping call
    // sees rows this one leased as no longer due. Bound values arrive in
    // template order: now, queueId (twice), limit, leaseUntil, updatedAt.
    $queryRaw: vi
      .fn()
      .mockImplementation(
        async (_sql: TemplateStringsArray, ...values: unknown[]) => {
          const [now, queueId, , limit, leaseUntil] = values as [
            Date,
            string | null,
            string | null,
            number,
            Date,
          ];
          const due = Array.from(mockQueueStore.values())
            .filter(
              (item) =>
                ["PENDING", "RETRYING"].includes(item.status) &&
                item.nextRetryAt.getTime() <= now.getTime() &&
                (queueId === null || item.id === queueId)
            )
            .sort((a, b) => a.nextRetryAt.getTime() - b.nextRetryAt.getTime())
            .slice(0, limit);
          return due.map((item) => {
            const leased = { ...item, nextRetryAt: leaseUntil };
            mockQueueStore.set(item.id, leased);
            return { ...leased, dueAt: item.nextRetryAt };
          });
        }
      ),
    suppressionList: {
      findUnique: vi
        .fn()
        .mockImplementation(async ({ where }: { where: { email: string } }) => {
          const item = mockSuppressionStore.get(
            where.email.toLowerCase().trim()
          );
          return item ? { ...item, id: "sup_1", createdAt: new Date() } : null;
        }),
      upsert: vi
        .fn()
        .mockImplementation(
          async ({
            where,
            create,
          }: {
            where: { email: string };
            create: { email: string; reason: string };
          }) => {
            mockSuppressionStore.set(where.email.toLowerCase().trim(), {
              email: where.email.toLowerCase().trim(),
              reason: create.reason,
            });
            return {
              id: "sup_1",
              email: where.email,
              reason: create.reason,
              createdAt: new Date(),
            };
          }
        ),
    },
    outboundEmailQueue: {
      create: vi
        .fn()
        .mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => {
            const id = `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const record: MockQueueItem = {
              id,
              to: data.to as string,
              from: data.from as string,
              replyTo: (data.replyTo as string) || null,
              subject: data.subject as string,
              html: data.html as string,
              text: (data.text as string) || null,
              tags: data.tags || null,
              attempts: (data.attempts as number) ?? 1,
              status: (data.status as string) ?? "RETRYING",
              nextRetryAt: (data.nextRetryAt as Date) ?? new Date(),
              lastError: (data.lastError as string) ?? null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockQueueStore.set(id, record);
            return record;
          }
        ),
      update: vi
        .fn()
        .mockImplementation(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<MockQueueItem>;
          }) => {
            const existing = mockQueueStore.get(where.id);
            if (!existing)
              throw new Error(`Record ${where.id} not found in mock queue`);
            const updated: MockQueueItem = {
              ...existing,
              ...data,
              updatedAt: new Date(),
            };
            mockQueueStore.set(where.id, updated);
            return updated;
          }
        ),
    },
  },
}));

// Mock Resend SDK
const mockSendFn = vi.fn();
vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = {
        send: mockSendFn,
      };
    },
  };
});

async function retryCounts(
  pending: Promise<EmailRetryResult>
): Promise<EmailRetryCounts> {
  const result = await pending;
  if (!result.success) {
    throw new Error(`Retry run failed: ${result.error.code}`);
  }
  return result.data;
}

describe("Outbound Email Queue & Resilient Backoff Retry Engine (#546)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueStore.clear();
    mockSuppressionStore.clear();
    EmailService.resetClient();
    process.env.RESEND_API_KEY = "re_test_mock_api_key";
    process.env.VITEST = "";
  });

  afterEach(() => {
    EmailService.resetClient();
    process.env.VITEST = "1";
    vi.unstubAllEnvs();
  });

  describe("Automatic Queueing on Rate Limit (429) & Network Timeouts", () => {
    it("automatically persists email to OutboundEmailQueue when Resend returns 429 rate limit", async () => {
      mockSendFn.mockResolvedValueOnce({
        data: null,
        error: {
          message: "Too many requests (429 rate limit exceeded)",
          name: "rate_limit_exceeded",
        },
      });

      const options: RawEmailOptions = {
        to: "recipient@example.com",
        subject: "Welcome to Portfolio",
        html: "<p>Hello world</p>",
      };

      const result = await EmailService.sendRawEmail(options);

      expect(result.success).toBe(true);
      expect(result.queued).toBe(true);
      expect(result.queueId).toBeDefined();

      expect(mockQueueStore.size).toBe(1);
      const queuedItem = mockQueueStore.get(result.queueId!);
      expect(queuedItem?.to).toBe("recipient@example.com");
      expect(queuedItem?.status).toBe("RETRYING");
      expect(queuedItem?.attempts).toBe(1);
      expect(queuedItem?.lastError).toContain("429");
    });

    it("automatically persists email to OutboundEmailQueue when network dispatch throws transient error", async () => {
      mockSendFn.mockRejectedValueOnce(
        new Error("fetch failed (ECONNRESET timeout)")
      );

      const options: RawEmailOptions = {
        to: "transient@example.com",
        subject: "Network Failure Test",
        html: "<p>Retry content</p>",
      };

      const result = await EmailService.sendRawEmail(options);

      expect(result.success).toBe(true);
      expect(result.queued).toBe(true);
      expect(result.queueId).toBeDefined();

      const queuedItem = mockQueueStore.get(result.queueId!);
      expect(queuedItem?.to).toBe("transient@example.com");
      expect(queuedItem?.lastError).toContain("ECONNRESET");
    });

    it("does not queue if error is a non-retryable domain validation error", async () => {
      mockSendFn.mockResolvedValueOnce({
        data: null,
        error: { message: "Domain not verified", name: "validation_error" },
      });

      const options: RawEmailOptions = {
        to: "unverified@example.com",
        subject: "Invalid Domain Test",
        html: "<p>Content</p>",
      };

      const result = await EmailService.sendRawEmail(options);

      expect(result.success).toBe(false);
      expect(result.queued).toBeUndefined();
      expect(result.error).toBe("Domain not verified");
      expect(mockQueueStore.size).toBe(0);
    });
  });

  describe("processRetryQueue() Execution & Exponential Backoff", () => {
    it("successfully delivers queued items when upstream recovers and updates status to DELIVERED", async () => {
      // Seed a pending queue item
      const queueId = await EmailService.queueOutboundEmail(
        {
          to: "pending@example.com",
          subject: "Pending Email",
          html: "<p>Delayed body</p>",
        },
        undefined,
        "Initial 429 rate limit"
      );

      // Upstream Resend is now healthy
      mockSendFn.mockResolvedValueOnce({
        data: { id: "msg_success_123" },
        error: null,
      });

      const summary = await retryCounts(
        EmailService.processRetryQueue({
          now: new Date(Date.now() + 5000),
        })
      );

      expect(summary.processed).toBe(1);
      expect(summary.succeeded).toBe(1);
      expect(summary.failed).toBe(0);

      // A null id would mean the seed row was never persisted.
      expect(queueId).not.toBeNull();
      const item = mockQueueStore.get(queueId as string);
      expect(item?.status).toBe("DELIVERED");
      expect(mockSendFn).toHaveBeenCalledWith(
        expect.objectContaining({ to: "pending@example.com" }),
        { idempotencyKey: `portfolio-email-${queueId}` }
      );
    });

    it("leases due rows so overlapping workers dispatch each email once", async () => {
      const queueId = await EmailService.queueOutboundEmail(
        {
          to: "leased@example.com",
          subject: "Lease Test",
          html: "<p>one delivery</p>",
        },
        undefined,
        "temporary"
      );
      mockSendFn.mockResolvedValue({
        data: { id: "msg_leased" },
        error: null,
      });
      const now = new Date(Date.now() + 5000);

      const [workerA, workerB] = await Promise.all([
        retryCounts(EmailService.processRetryQueue({ now })),
        retryCounts(EmailService.processRetryQueue({ now })),
      ]);

      expect(queueId).not.toBeNull();
      expect(workerA.processed + workerB.processed).toBe(1);
      expect(mockSendFn).toHaveBeenCalledTimes(1);
    });

    it("caps one retry invocation at twenty messages", async () => {
      for (let index = 0; index < 25; index++) {
        mockQueueStore.set(`queue-${index}`, {
          id: `queue-${index}`,
          to: `recipient-${index}@example.com`,
          from: "sender@deruiter.dev",
          replyTo: null,
          subject: "Batch cap",
          html: "<p>bounded</p>",
          text: null,
          tags: null,
          attempts: 1,
          status: "RETRYING",
          nextRetryAt: new Date(0),
          lastError: "temporary",
          createdAt: new Date(0),
          updatedAt: new Date(0),
        });
      }
      mockSendFn.mockResolvedValue({ data: { id: "msg" }, error: null });

      const summary = await retryCounts(
        EmailService.processRetryQueue({
          maxBatchSize: 100,
        })
      );

      expect(summary.processed).toBe(20);
      expect(mockSendFn).toHaveBeenCalledTimes(20);
    });

    describe("batch leasing (#1116)", () => {
      const seedDue = (id: string, dueAt: Date) =>
        mockQueueStore.set(id, {
          id,
          to: `${id}@example.com`,
          from: "sender@deruiter.dev",
          replyTo: null,
          subject: "Batch lease",
          html: "<p>once</p>",
          text: null,
          tags: null,
          attempts: 1,
          status: "RETRYING",
          nextRetryAt: dueAt,
          lastError: "temporary",
          createdAt: new Date(0),
          updatedAt: new Date(0),
        });

      it("leases a whole batch in one SKIP LOCKED statement", async () => {
        for (let index = 0; index < 5; index++) {
          seedDue(`batch-${index}`, new Date(index));
        }
        mockSendFn.mockResolvedValue({ data: { id: "msg" }, error: null });

        const summary = await retryCounts(EmailService.processRetryQueue());

        expect(summary.processed).toBe(5);
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        const statement = (
          vi.mocked(prisma.$queryRaw).mock.calls[0][0] as TemplateStringsArray
        ).join("?");
        expect(statement).toContain("FOR UPDATE SKIP LOCKED");
        expect(statement).toContain("RETURNING");
      });

      it("hands a row leased by one worker to no later worker", async () => {
        seedDue("single", new Date(0));
        mockSendFn.mockResolvedValue({ data: { id: "msg" }, error: null });
        // The first worker's send fails transiently, so the row is still
        // RETRYING, but its lease has moved nextRetryAt past `now`.
        mockSendFn.mockRejectedValueOnce(new Error("socket hang up"));
        const now = new Date(1000);

        const first = await retryCounts(
          EmailService.processRetryQueue({ now })
        );
        const second = await retryCounts(
          EmailService.processRetryQueue({ now })
        );

        expect(first.processed).toBe(1);
        expect(second.processed).toBe(0);
        expect(mockSendFn).toHaveBeenCalledTimes(1);
      });

      it("dispatches oldest-due first whatever order RETURNING yields", async () => {
        seedDue("newer", new Date(2000));
        seedDue("older", new Date(1000));
        vi.mocked(prisma.$queryRaw).mockImplementationOnce((async () => [
          { ...mockQueueStore.get("newer"), dueAt: new Date(2000) },
          { ...mockQueueStore.get("older"), dueAt: new Date(1000) },
        ]) as unknown as typeof prisma.$queryRaw);
        mockSendFn.mockResolvedValue({ data: { id: "msg" }, error: null });

        await EmailService.processRetryQueue();

        expect(mockSendFn.mock.calls.map((call) => call[0].to)).toEqual([
          "older@example.com",
          "newer@example.com",
        ]);
      });

      it("sends nothing when the lease statement fails", async () => {
        seedDue("unleased", new Date(0));
        vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(
          new Error("db asleep")
        );
        const consoleError = vi
          .spyOn(console, "error")
          .mockImplementation(() => undefined);

        await expect(EmailService.processRetryQueue()).resolves.toMatchObject({
          success: false,
          error: { code: "QUEUE_LEASE_FAILED" },
        });
        expect(mockSendFn).not.toHaveBeenCalled();
        expect(mockQueueStore.get("unleased")?.nextRetryAt).toEqual(
          new Date(0)
        );
        consoleError.mockRestore();
      });

      it("returns QUEUE_UPDATE_FAILED instead of throwing when a row update fails (#1532)", async () => {
        seedDue("stuck", new Date(0));
        mockSendFn.mockResolvedValue({ data: { id: "msg" }, error: null });
        // The DELIVERED write fails inside the send guard, then the RETRYING
        // fallback write fails too, which is what escapes the row loop.
        vi.mocked(prisma.outboundEmailQueue.update)
          .mockRejectedValueOnce(new Error("db asleep mid-run"))
          .mockRejectedValueOnce(new Error("db asleep mid-run"));
        const consoleError = vi
          .spyOn(console, "error")
          .mockImplementation(() => undefined);

        await expect(EmailService.processRetryQueue()).resolves.toMatchObject({
          success: false,
          error: {
            code: "QUEUE_UPDATE_FAILED",
            details: { succeeded: 0, failed: 0, leased: 1 },
          },
        });
        consoleError.mockRestore();
      });
    });

    it("forces simulated delivery in Preview even when an API key is attached", async () => {
      vi.stubEnv("VERCEL_ENV", "preview");

      const result = await EmailService.sendRawEmail({
        to: "preview@example.com",
        subject: "Preview isolation",
        html: "<p>must not leave preview</p>",
      });

      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(mockSendFn).not.toHaveBeenCalled();
    });

    it("applies exponential backoff on consecutive failures and marks FAILED after max attempts", async () => {
      // Seed an item that has failed 4 times already
      const record: MockQueueItem = {
        id: "queue_max_attempts",
        to: "failing@example.com",
        from: "Frederick de Ruiter <notifications@deruiter.dev>",
        replyTo: null,
        subject: "Max Retries Test",
        html: "<p>Test</p>",
        text: null,
        tags: null,
        attempts: 4,
        status: "RETRYING",
        nextRetryAt: new Date(Date.now() - 5000), // Due for retry
        lastError: "Rate limit",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockQueueStore.set(record.id, record);

      // Still failing upstream
      mockSendFn.mockResolvedValueOnce({
        data: null,
        error: { message: "Rate limit 429", name: "rate_limit_exceeded" },
      });

      const summary = await retryCounts(EmailService.processRetryQueue());

      expect(summary.processed).toBe(1);
      expect(summary.failed).toBe(1);

      const updated = mockQueueStore.get("queue_max_attempts");
      expect(updated?.attempts).toBe(5);
      expect(updated?.status).toBe("FAILED");
    });

    it("marks queued item FAILED immediately if recipient was added to suppression list in the interim", async () => {
      mockSendFn.mockResolvedValueOnce({
        data: null,
        error: {
          message: "Too many requests (429 rate limit exceeded)",
          name: "rate_limit_exceeded",
        },
      });

      const initialDispatch = await EmailService.sendRawEmail({
        to: "suppressed@example.com",
        subject: "Suppression Check Test",
        html: "<p>Test</p>",
      });
      expect(initialDispatch.queued).toBe(true);

      mockSuppressionStore.set("suppressed@example.com", {
        email: "suppressed@example.com",
        reason: "BOUNCE",
      });
      mockSendFn.mockClear();

      const summary = await retryCounts(
        EmailService.processRetryQueue({
          now: new Date(Date.now() + 5000),
        })
      );

      expect(summary.processed).toBe(1);
      expect(summary.failed).toBe(1);
      expect(mockSendFn).not.toHaveBeenCalled();

      const updated = mockQueueStore.get(initialDispatch.queueId!);
      expect(updated?.status).toBe("FAILED");
      expect(updated?.lastError).toContain("suppression list");
    });
  });

  describe("Sender Identity Standardization", () => {
    it("defaults sender address to canonical custom domain format", async () => {
      mockSendFn.mockResolvedValueOnce({
        data: { id: "msg_standard_from" },
        error: null,
      });

      await EmailService.sendRawEmail({
        to: "visitor@example.com",
        subject: "Default Sender Verification",
        html: "<p>Testing sender</p>",
      });

      expect(mockSendFn).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "Frederick de Ruiter <notifications@deruiter.dev>",
        })
      );
    });
  });
});
