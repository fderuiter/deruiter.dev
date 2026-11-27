// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GetSuppressedEmailsHandler } from "@/lib/services";

describe("GetSuppressedEmailsHandler (Logic Test)", () => {
  it("normalizes candidate emails and returns suppressed Set", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ email: "bounced@example.com" }]);
    const handler = new GetSuppressedEmailsHandler({
      prisma: { suppressionList: { findMany } },
    });

    const result = await handler.execute({
      emails: ["Bounced@Example.com", "active@example.com"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.has("bounced@example.com")).toBe(true);
      expect(result.data.has("active@example.com")).toBe(false);
    }
  });

  it("returns SUPPRESSION_LOOKUP_FAILED when suppression query fails", async () => {
    const handler = new GetSuppressedEmailsHandler({
      prisma: {
        suppressionList: {
          findMany: vi.fn().mockRejectedValue(new Error("DB timeout")),
        },
      },
    });
    const result = await handler.execute({ emails: ["a@example.com"] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("SUPPRESSION_LOOKUP_FAILED");
    }
  });
});
