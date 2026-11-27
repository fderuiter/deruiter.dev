// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  EnqueueEmailHandler,
  GetSuppressedEmailsHandler,
  SendContactInquiryHandler,
  SendFeedbackNotificationHandler,
  SendRawEmailHandler,
  createSuccess,
  resetResendClient,
} from "@/lib/services";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
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

describe("Email Vertical Slices (Spec & Handler)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetResendClient();
    // No suppression record: recipients are known eligible. A failed lookup
    // is unknown, not eligible (#3806), so tests must state eligibility.
    vi.spyOn(prisma.suppressionList, "findUnique").mockResolvedValue(
      null as never
    );
  });

  afterEach(() => {
    resetResendClient();
  });

  describe("Simulated Delivery Mode", () => {
    it("should return simulated message ID when RESEND_API_KEY is not provisioned", async () => {
      const origKey = env.RESEND_API_KEY;
      (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = "";

      const result = await new SendRawEmailHandler().execute({
        to: "recipient@example.com",
        subject: "Simulated Test",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.simulated).toBe(true);
        expect(result.data.id).toMatch(/^sim_msg_/);
      }
      expect(mockSend).not.toHaveBeenCalled();

      (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = origKey;
    });
  });

  describe("Production Transport Unconfigured Mode (#3793)", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      resetResendClient();
    });

    it("should return configuration failure and queue outbound email when RESEND_API_KEY is absent in production", async () => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("RESEND_API_KEY", "");
      resetResendClient();

      const queueSpy = vi
        .spyOn(EnqueueEmailHandler.prototype, "execute")
        .mockResolvedValueOnce(
          createSuccess({ queueId: "queue_msg_prod_123" })
        );

      const result = await new SendRawEmailHandler().execute({
        to: "recipient@example.com",
        subject: "Unconfigured Production Test",
        html: "<p>Important message</p>",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("TRANSPORT_UNCONFIGURED");
        expect(result.error.message).toContain("unconfigured");
        expect(result.error.details).toEqual({
          queued: true,
          queueId: "queue_msg_prod_123",
        });
      }
      expect(mockSend).not.toHaveBeenCalled();
      expect(queueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ to: "recipient@example.com" }),
          mode: "retry",
          fromAddress: expect.any(String),
          errorReason: expect.stringContaining("unconfigured"),
        })
      );
    });

    it("should return configuration failure and queue outbound email when RESEND_API_KEY is blank in production", async () => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("RESEND_API_KEY", "   ");
      resetResendClient();

      const queueSpy = vi
        .spyOn(EnqueueEmailHandler.prototype, "execute")
        .mockResolvedValueOnce(
          createSuccess({ queueId: "queue_msg_blank_123" })
        );

      const result = await new SendRawEmailHandler().execute({
        to: "recipient@example.com",
        subject: "Blank Key Production Test",
        html: "<p>Important message</p>",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("TRANSPORT_UNCONFIGURED");
        expect(result.error.details).toEqual({
          queued: true,
          queueId: "queue_msg_blank_123",
        });
      }
      expect(mockSend).not.toHaveBeenCalled();
      expect(queueSpy).toHaveBeenCalled();
    });

    it("should return configuration failure without queueing when skipQueue is true in production", async () => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("RESEND_API_KEY", "");
      resetResendClient();

      const queueSpy = vi.spyOn(EnqueueEmailHandler.prototype, "execute");

      const result = await new SendRawEmailHandler().execute({
        to: "recipient@example.com",
        subject: "Unconfigured SkipQueue Test",
        html: "<p>Important message</p>",
        skipQueue: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("TRANSPORT_UNCONFIGURED");
        expect(result.error.message).toContain("unconfigured");
        expect(result.error.details).toBeUndefined();
      }
      expect(mockSend).not.toHaveBeenCalled();
      expect(queueSpy).not.toHaveBeenCalled();
    });

    it("should force simulated delivery in preview even when a production-like API key is configured", async () => {
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("RESEND_API_KEY", "re_live_preview");
      resetResendClient();

      const result = await new SendRawEmailHandler().execute({
        to: "preview-visitor@example.com",
        subject: "Preview Isolated",
        html: "<p>Preview content</p>",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.simulated).toBe(true);
        expect(result.data.id).toMatch(/^sim_msg_/);
      }
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

      const result = await new SendRawEmailHandler().execute({
        to: "target@example.com",
        subject: "Live Dispatch Test",
        html: "<h1>Greetings</h1>",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("resend_msg_abc123");
      }
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

      const result = await new SendRawEmailHandler().execute({
        to: "target@example.com",
        subject: "Failing Dispatch Test",
        html: "<p>Fail</p>",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Domain not verified");
      }
      await new Promise((r) => setTimeout(r, 0));
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe("SendContactInquiryHandler", () => {
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

      const result = await new SendContactInquiryHandler().execute({
        submission,
        connectionHash: "hash_123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.adminDelivery.id).toBe("msg_inquiry_ok");
        expect(result.data.confirmationResult?.success).toBe(true);
      }
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe("SendFeedbackNotificationHandler", () => {
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

      const result = await new SendFeedbackNotificationHandler().execute(
        payload
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("msg_feedback_ok");
      }
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("clinical-chaos"),
        })
      );
    });
  });

  describe("GetSuppressedEmailsHandler", () => {
    it("returns empty set when given an empty list without querying database", async () => {
      const findManySpy = vi.spyOn(prisma.suppressionList, "findMany");
      const result = await new GetSuppressedEmailsHandler().execute({
        emails: [],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.size).toBe(0);
      }
      expect(findManySpy).not.toHaveBeenCalled();
    });

    it("queries suppressionList with normalized emails and returns matching lowercase emails", async () => {
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

      const result = await new GetSuppressedEmailsHandler().execute({
        emails: ["  Bounced@Example.com ", "clean@example.com"],
      });

      expect(findManySpy).toHaveBeenCalledWith({
        where: { email: { in: ["bounced@example.com", "clean@example.com"] } },
        select: { email: true },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.has("bounced@example.com")).toBe(true);
        expect(result.data.has("clean@example.com")).toBe(false);
      }
    });

    it("returns SUPPRESSION_LOOKUP_FAILED when database rejects so caller handles unknown eligibility (#3806)", async () => {
      vi.spyOn(prisma.suppressionList, "findMany").mockRejectedValueOnce(
        new Error("Neon connection terminated")
      );

      const result = await new GetSuppressedEmailsHandler().execute({
        emails: ["user@example.com"],
      });

      expect(result).toMatchObject({
        success: false,
        error: {
          code: "SUPPRESSION_LOOKUP_FAILED",
          message: "Neon connection terminated",
          recoverable: true,
        },
      });
    });
  });
});
