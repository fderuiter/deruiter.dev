// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  CheckRecipientEligibilityHandler,
  type CheckRecipientEligibilityDeps,
} from "@/lib/services";

describe("CheckRecipientEligibilityHandler (Logic Test)", () => {
  it("returns suppressed when email is on suppression list", async () => {
    const deps = fromPartial<CheckRecipientEligibilityDeps>({
      db: {
        suppressionList: {
          findUnique: async () => ({ reason: "BOUNCE" }),
        },
      },
    });

    const handler = new CheckRecipientEligibilityHandler(deps);
    const result = await handler.execute({ email: "bounced@example.com" });
    expect(result).toEqual({
      success: true,
      data: { status: "suppressed", reason: "BOUNCE" },
    });
  });

  it("returns unknown status when suppression lookup throws", async () => {
    const deps = fromPartial<CheckRecipientEligibilityDeps>({
      db: {
        suppressionList: {
          findUnique: async () => {
            throw new Error("DB connection failed");
          },
        },
      },
    });

    const handler = new CheckRecipientEligibilityHandler(deps);
    const result = await handler.execute({ email: "user@example.com" });
    expect(result).toEqual({
      success: true,
      data: { status: "unknown", code: "SUPPRESSION_LOOKUP_FAILED" },
    });
  });
});
