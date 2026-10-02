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
});
