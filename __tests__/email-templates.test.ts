// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  renderContactAdminEmail,
  renderContactConfirmationEmail,
  renderFeedbackNotificationEmail,
} from "@/lib/email-templates";

describe("Email Templates Engine", () => {
  describe("escapeHtml", () => {
    it("should escape special HTML characters and strip malicious scripts", () => {
      const dangerous = '<script>alert("xss")</script>&foo="bar"\'';
      const clean = escapeHtml(dangerous);
      expect(clean).not.toContain("<script>");
      expect(clean).toContain("&amp;foo=&quot;bar&quot;&#039;");
    });

    it("should return empty string for empty input", () => {
      expect(escapeHtml("")).toBe("");
    });
  });

  describe("renderContactAdminEmail", () => {
    it("should generate structured HTML and plain text email with sanitized inputs", () => {
      const payload = {
        name: "Ada Lovelace",
        email: "ada@example.com",
        intent: "collaboration",
        subject: "Deductive Engine Collaboration",
        message:
          "Hello Frederick,\n\nI would like to discuss formal verification proof graphs.\n<script>alert(1)</script>",
        connectionHash: "hash-test-12345",
        submittedAt: new Date("2026-08-19T12:00:00Z"),
      };

      const result = renderContactAdminEmail(payload);

      expect(result.subject).toBe(
        "[Inquiry: COLLABORATION] Deductive Engine Collaboration (from Ada Lovelace)"
      );
      expect(result.html).toContain("Ada Lovelace");
      expect(result.html).toContain("ada@example.com");
      expect(result.html).toContain("INBOUND INQUIRY // COLLABORATION");
      expect(result.html).toContain("hash-test-12345");
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("<br />");
      expect(result.text).toContain("Subject: Deductive Engine Collaboration");
      expect(result.text).toContain("ada@example.com");
    });
  });

  describe("renderContactConfirmationEmail", () => {
    it("should generate receipt confirmation email for visitor", () => {
      const payload = {
        name: "Alan Turing",
        intent: "general",
        subject: "Quick question on Turing machines",
        message: "Loved the arcade quasi puzzler simulator!",
      };

      const result = renderContactConfirmationEmail(payload);

      expect(result.subject).toBe(
        'Message received: "Quick question on Turing machines"'
      );
      expect(result.html).toContain("Thanks for reaching out, Alan Turing!");
      expect(result.html).toContain(
        "Loved the arcade quasi puzzler simulator!"
      );
      expect(result.text).toContain("Thanks for reaching out, Alan Turing!");
      expect(result.text).toContain("https://deruiter.dev");
    });
  });

  describe("renderFeedbackNotificationEmail", () => {
    it("should render admin notification email for case study feedback", () => {
      const payload = {
        caseStudySlug: "clinical-chaos",
        takeaways: ["GxP Validation Standard", "AST Rule Engine"],
        comments: "Incredible attention to detail in the CDISC pipeline.",
        connectionHash: "hash-abc-789",
        submittedAt: new Date("2026-08-19T12:30:00Z"),
      };

      const result = renderFeedbackNotificationEmail(payload);

      expect(result.subject).toBe(
        '[Case Study Feedback] New commentary on "clinical-chaos"'
      );
      expect(result.html).toContain("clinical-chaos");
      expect(result.html).toContain("GxP Validation Standard");
      expect(result.html).toContain("AST Rule Engine");
      expect(result.html).toContain(
        "Incredible attention to detail in the CDISC pipeline."
      );
      expect(result.text).toContain("Target: clinical-chaos");
    });
  });
});
