// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  EmailService,
  EMAIL_TRANSPORT_UNCONFIGURED,
} from "@/lib/services/email-service";
import { env } from "@/lib/env";
import * as Sentry from "@sentry/nextjs";

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Synthetic queue storage: no test here reaches a real database.
const { mockQueryRaw, mockQueueUpdate, mockQueueCreate } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockQueueUpdate: vi.fn(),
  mockQueueCreate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    suppressionList: { findUnique: vi.fn().mockResolvedValue(null) },
    outboundEmailQueue: { update: mockQueueUpdate, create: mockQueueCreate },
  },
}));

// No sub-daily retry is scheduled from a unit test.
vi.mock("@/lib/qstash-retry", () => ({
  scheduleEmailRetry: vi.fn().mockResolvedValue(undefined),
}));

// Mock Resend
const mockSend = vi.fn();
vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = {
        send: mockSend,
      };
    },
  };
});

describe("EmailService (Spec & Handler)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    EmailService.resetClient();
  });

  afterEach(() => {
    EmailService.resetClient();
  });

  describe("Simulated Delivery Mode", () => {
    it("should return simulated message ID when RESEND_API_KEY is not provisioned", async () => {
      // Ensure RESEND_API_KEY is empty
      const origKey = env.RESEND_API_KEY;
      (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = "";

      const result = await EmailService.sendRawEmail({
        to: "recipient@example.com",
        subject: "Simulated Test",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.data?.id).toMatch(/^sim_msg_/);
      expect(mockSend).not.toHaveBeenCalled();

      (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = origKey;
    });
  });

  describe("Live Resend API Mode", () => {
    it("should call resend.emails.send and return message ID on success", async () => {
      (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = "re_test_123456";
      mockSend.mockResolvedValueOnce({
        data: { id: "resend_msg_abc123" },
        error: null,
      });

      const result = await EmailService.sendRawEmail({
        to: "target@example.com",
        subject: "Live Dispatch Test",
        html: "<h1>Greetings</h1>",
      });

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe("resend_msg_abc123");
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "target@example.com",
          subject: "Live Dispatch Test",
          html: "<h1>Greetings</h1>",
        })
      );
    });

    it("should capture Sentry exception and return error message when Resend returns an error", async () => {
      (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = "re_test_123456";
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Domain not verified", name: "validation_error" },
      });

      const result = await EmailService.sendRawEmail({
        to: "target@example.com",
        subject: "Failing Dispatch Test",
        html: "<p>Fail</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Domain not verified");
      await new Promise((r) => setTimeout(r, 0));
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe("sendContactInquiry", () => {
    it("should dispatch both admin notification and visitor confirmation", async () => {
      (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = "re_test_123456";
      mockSend.mockResolvedValue({
        data: { id: "msg_inquiry_ok" },
        error: null,
      });

      const submission = {
        name: "Ada Lovelace",
        email: "ada@analyticalengine.com",
        intent: "collaboration" as const,
        subject: "Deductive Proofs",
        message: "Let us build an engine together!",
      };

      const result = await EmailService.sendContactInquiry(
        submission,
        "hash_123"
      );

      expect(result.success).toBe(true);
      expect(result.adminResult.success).toBe(true);
      expect(result.confirmationResult?.success).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe("sendFeedbackNotification", () => {
    it("should dispatch feedback alert to admin email", async () => {
      (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = "re_test_123456";
      mockSend.mockResolvedValueOnce({
        data: { id: "msg_feedback_ok" },
        error: null,
      });

      const payload = {
        caseStudySlug: "clinical-chaos",
        takeaways: ["CDISC Standards", "Reactive Physics"],
        comments: "Brilliant execution.",
        connectionHash: "hash_456",
      };

      const result = await EmailService.sendFeedbackNotification(payload);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe("msg_feedback_ok");
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("clinical-chaos"),
        })
      );
    });
  });

  describe("Production without an API key (#3793)", () => {
    const now = new Date("2026-11-13T12:00:00Z");
    const dueRow = {
      id: "queue_row_1",
      to: "reader@example.com",
      from: "hello@example.com",
      replyTo: null,
      subject: "Queued",
      html: "<p>Queued</p>",
      text: null,
      tags: null,
      headers: null,
      attempts: 1,
      status: "RETRYING",
      nextRetryAt: new Date(now.getTime() + 5 * 60 * 1000),
      lastError: "Initial dispatch failed",
      dueAt: new Date(now.getTime() - 1000),
    };
    let origKey: string | undefined;

    beforeEach(() => {
      origKey = env.RESEND_API_KEY;
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("PLAYWRIGHT_TEST", "");
      mockQueryRaw.mockResolvedValue([{ ...dueRow }]);
      mockQueueUpdate.mockResolvedValue({});
      mockQueueCreate.mockResolvedValue({ id: "queue_new_1" });
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = origKey;
    });

    it.each([
      ["absent", undefined],
      ["blank", "   "],
    ])(
      "keeps a due row recoverable when the key is %s",
      async (_label, key) => {
        vi.stubEnv("RESEND_API_KEY", key ?? "");
        (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = key;

        const result = await EmailService.processRetryQueue({ now });

        expect(mockSend).not.toHaveBeenCalled();
        expect(result).toEqual({
          success: true,
          data: { processed: 1, succeeded: 0, failed: 1 },
        });
        expect(mockQueueUpdate).toHaveBeenCalledTimes(1);
        const update = mockQueueUpdate.mock.calls[0][0] as {
          where: { id: string };
          data: Record<string, unknown>;
        };
        expect(update.where.id).toBe("queue_row_1");
        expect(update.data.status).toBeUndefined();
        expect(update.data.attempts).toBeUndefined();
        expect(update.data.lastError).toMatch(/not configured/);
      }
    );

    it("queues an inline send instead of reporting it sent", async () => {
      vi.stubEnv("RESEND_API_KEY", "");
      (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = "";

      const result = await EmailService.sendRawEmail({
        to: "visitor@example.com",
        subject: "Inline",
        html: "<p>Inline</p>",
      });

      expect(mockSend).not.toHaveBeenCalled();
      expect(result.simulated).toBeUndefined();
      expect(result.queued).toBe(true);
      expect(result.queueId).toBe("queue_new_1");
      expect(result.errorCode).toBe(EMAIL_TRANSPORT_UNCONFIGURED);
      const created = mockQueueCreate.mock.calls[0][0] as {
        data: { status: string };
      };
      expect(created.data.status).toBe("RETRYING");
    });

    it("returns a configuration failure when the send may not queue", async () => {
      vi.stubEnv("RESEND_API_KEY", "");
      (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = "";

      const result = await EmailService.sendRawEmail({
        to: "visitor@example.com",
        subject: "Inline",
        html: "<p>Inline</p>",
        skipQueue: true,
      });

      expect(mockSend).not.toHaveBeenCalled();
      expect(mockQueueCreate).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EMAIL_TRANSPORT_UNCONFIGURED);
    });

    it("still simulates on preview, even with a key attached", async () => {
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("RESEND_API_KEY", "re_test_preview");
      (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = "re_test_preview";

      const inline = await EmailService.sendRawEmail({
        to: "visitor@example.com",
        subject: "Preview",
        html: "<p>Preview</p>",
      });
      expect(inline.success).toBe(true);
      expect(inline.simulated).toBe(true);

      const queued = await EmailService.processRetryQueue({ now });
      expect(queued).toEqual({
        success: true,
        data: { processed: 1, succeeded: 1, failed: 0 },
      });
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
