// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { CheckRecipientEligibilityHandler } from "@/lib/services";

describe("CheckRecipientEligibilityHandler (Logic Test)", () => {
  it("reports eligible, suppressed, or unknown recipient status", async () => {
    const eligibleHandler = new CheckRecipientEligibilityHandler({
      prisma: {
        suppressionList: { findUnique: vi.fn().mockResolvedValue(null) },
      },
    });
    const eligible = await eligibleHandler.execute({
      recipients: "ok@example.com",
    });
    expect(eligible.success).toBe(true);
    if (eligible.success) {
      expect(eligible.data.status).toBe("eligible");
    }

    const suppressedHandler = new CheckRecipientEligibilityHandler({
      prisma: {
        suppressionList: {
          findUnique: vi.fn().mockResolvedValue({ reason: "BOUNCE" }),
        },
      },
    });
    const suppressed = await suppressedHandler.execute({
      recipients: ["bad@example.com"],
    });
    expect(suppressed.success).toBe(true);
    if (suppressed.success) {
      expect(suppressed.data).toEqual({
        status: "suppressed",
        reason: "BOUNCE",
      });
    }
  });

  it("returns INVALID_INPUT on empty recipient list and unknown on DB lookup error", async () => {
    const handler = new CheckRecipientEligibilityHandler({
      prisma: {
        suppressionList: {
          findUnique: vi.fn().mockRejectedValue(new Error("DB offline")),
        },
      },
    });

    const invalid = await handler.execute({ recipients: [] });
    expect(invalid.success).toBe(false);

    const unknown = await handler.execute({ recipients: "user@example.com" });
    expect(unknown.success).toBe(true);
    if (unknown.success) {
      expect(unknown.data.status).toBe("unknown");
    }
  });
});
