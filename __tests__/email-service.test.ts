// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "@/lib/services/email-service";
import { env } from "@/lib/env";
import * as Sentry from "@sentry/nextjs";

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
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

  describe("Production Transport Unconfigured Mode (#3793)", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      EmailService.resetClient();
    });

    it("should return configuration failure and queue outbound email when RESEND_API_KEY is absent in production", async () => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("RESEND_API_KEY", "");
      EmailService.resetClient();

      const queueSpy = vi
        .spyOn(EmailService, "queueOutboundEmail")
        .mockResolvedValueOnce("queue_msg_prod_123");

      const result = await EmailService.sendRawEmail({
        to: "recipient@example.com",
        subject: "Unconfigured Production Test",
        html: "<p>Important message</p>",
      });

      expect(result.success).toBe(false);
      expect(result.simulated).toBeUndefined();
      expect(result.queued).toBe(true);
      expect(result.queueId).toBe("queue_msg_prod_123");
      expect(result.error).toContain("unconfigured");
      expect(mockSend).not.toHaveBeenCalled();
      expect(queueSpy).toHaveBeenCalledWith(
        expect.objectContaining({ to: "recipient@example.com" }),
        expect.any(String),
        expect.stringContaining("unconfigured")
      );
    });

    it("should return configuration failure and queue outbound email when RESEND_API_KEY is blank in production", async () => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("RESEND_API_KEY", "   ");
      EmailService.resetClient();

      const queueSpy = vi
        .spyOn(EmailService, "queueOutboundEmail")
        .mockResolvedValueOnce("queue_msg_blank_123");

      const result = await EmailService.sendRawEmail({
        to: "recipient@example.com",
        subject: "Blank Key Production Test",
        html: "<p>Important message</p>",
      });

      expect(result.success).toBe(false);
      expect(result.simulated).toBeUndefined();
      expect(result.queued).toBe(true);
      expect(result.queueId).toBe("queue_msg_blank_123");
      expect(mockSend).not.toHaveBeenCalled();
      expect(queueSpy).toHaveBeenCalled();
    });

    it("should return configuration failure without queueing when skipQueue is true in production", async () => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("RESEND_API_KEY", "");
      EmailService.resetClient();

      const queueSpy = vi.spyOn(EmailService, "queueOutboundEmail");

      const result = await EmailService.sendRawEmail({
        to: "recipient@example.com",
        subject: "Unconfigured SkipQueue Test",
        html: "<p>Important message</p>",
        skipQueue: true,
      });

      expect(result.success).toBe(false);
      expect(result.simulated).toBeUndefined();
      expect(result.queued).toBeUndefined();
      expect(result.error).toContain("unconfigured");
      expect(mockSend).not.toHaveBeenCalled();
      expect(queueSpy).not.toHaveBeenCalled();
    });

    it("should force simulated delivery in preview even when a production-like API key is configured", async () => {
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("RESEND_API_KEY", "re_live_preview");
      EmailService.resetClient();

      const result = await EmailService.sendRawEmail({
        to: "preview-visitor@example.com",
        subject: "Preview Isolated",
        html: "<p>Preview content</p>",
      });

      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.data?.id).toMatch(/^sim_msg_/);
      expect(mockSend).not.toHaveBeenCalled();
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

  describe("getSuppressedEmails", () => {
    it("returns empty set when given an empty list without querying database", async () => {
      const { prisma } = await import("@/lib/db");
      const findManySpy = vi.spyOn(prisma.suppressionList, "findMany");
      const result = await EmailService.getSuppressedEmails([]);
      expect(result.size).toBe(0);
      expect(findManySpy).not.toHaveBeenCalled();
    });

    it("queries suppressionList with normalized emails and returns matching lowercase emails", async () => {
      const { prisma } = await import("@/lib/db");
      const findManySpy = vi
        .spyOn(prisma.suppressionList, "findMany")
        .mockResolvedValueOnce([
          {
            id: "sup_1",
            email: "bounced@example.com",
            reason: "BOUNCE",
            createdAt: new Date(),
          },
        ]);

      const result = await EmailService.getSuppressedEmails([
        "  Bounced@Example.com ",
        "clean@example.com",
      ]);

      expect(findManySpy).toHaveBeenCalledWith({
        where: { email: { in: ["bounced@example.com", "clean@example.com"] } },
        select: { email: true },
      });
      expect(result.has("bounced@example.com")).toBe(true);
      expect(result.has("clean@example.com")).toBe(false);
    });

    it("propagates database rejections so caller can handle unknown eligibility (#3806)", async () => {
      const { prisma } = await import("@/lib/db");
      vi.spyOn(prisma.suppressionList, "findMany").mockRejectedValueOnce(
        new Error("Neon connection terminated")
      );

      await expect(
        EmailService.getSuppressedEmails(["user@example.com"])
      ).rejects.toThrow("Neon connection terminated");
    });
  });

  describe("sendRawEmail batched suppression pre-check", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("executes exactly one suppression query for a multi-recipient dispatch when none are suppressed", async () => {
      const { prisma } = await import("@/lib/db");
      const findManySpy = vi
        .spyOn(prisma.suppressionList, "findMany")
        .mockResolvedValueOnce([]);
      const findUniqueSpy = vi.spyOn(prisma.suppressionList, "findUnique");

      (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = "re_test_key";
      mockSend.mockResolvedValueOnce({
        data: { id: "msg_batch_clean" },
        error: null,
      });

      const result = await EmailService.sendRawEmail({
        to: ["user1@example.com", "user2@example.com", "user3@example.com"],
        subject: "Batched Suppression Check",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(true);
      expect(findManySpy).toHaveBeenCalledTimes(1);
      expect(findManySpy).toHaveBeenCalledWith({
        where: {
          email: {
            in: ["user1@example.com", "user2@example.com", "user3@example.com"],
          },
        },
        select: { email: true },
      });
      expect(findUniqueSpy).not.toHaveBeenCalled();
    });

    it("executes exactly one batch query and queries suppression reason only for the rejected address when suppressed", async () => {
      const { prisma } = await import("@/lib/db");
      const findManySpy = vi
        .spyOn(prisma.suppressionList, "findMany")
        .mockResolvedValueOnce([
          {
            id: "sup_1",
            email: "bounced@example.com",
            reason: "BOUNCE",
            createdAt: new Date(),
          },
        ]);
      const findUniqueSpy = vi
        .spyOn(prisma.suppressionList, "findUnique")
        .mockResolvedValueOnce({
          id: "sup_1",
          email: "bounced@example.com",
          reason: "BOUNCE" as const,
          createdAt: new Date(),
        });

      (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = "re_test_key";

      const result = await EmailService.sendRawEmail({
        to: ["clean1@example.com", "bounced@example.com", "clean2@example.com"],
        subject: "Batched Suppression Check With Bounce",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Recipient address bounced@example.com is suppressed due to previous BOUNCE."
      );
      expect(findManySpy).toHaveBeenCalledTimes(1);
      expect(findUniqueSpy).toHaveBeenCalledTimes(1);
      expect(findUniqueSpy).toHaveBeenCalledWith({
        where: { email: "bounced@example.com" },
      });
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("executes zero queries when recipients list is empty", async () => {
      const { prisma } = await import("@/lib/db");
      const findManySpy = vi.spyOn(prisma.suppressionList, "findMany");
      const findUniqueSpy = vi.spyOn(prisma.suppressionList, "findUnique");

      (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = "re_test_key";
      mockSend.mockResolvedValueOnce({
        data: { id: "msg_empty" },
        error: null,
      });

      await EmailService.sendRawEmail({
        to: [],
        subject: "Empty to array",
        html: "<p>Hello</p>",
      });

      expect(findManySpy).not.toHaveBeenCalled();
      expect(findUniqueSpy).not.toHaveBeenCalled();
    });
  });
});
