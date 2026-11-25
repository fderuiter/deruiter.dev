// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  GetSuppressedEmailsHandler,
  type GetSuppressedEmailsDeps,
} from "@/lib/services";

describe("GetSuppressedEmailsHandler (Logic Test)", () => {
  it("returns normalized Set of suppressed email addresses", async () => {
    const deps = fromPartial<GetSuppressedEmailsDeps>({
      db: {
        suppressionList: {
          findMany: async () => [{ email: "blocked@example.com" }],
        },
      },
    });

    const handler = new GetSuppressedEmailsHandler(deps);
    const result = await handler.execute({
      emails: ["Blocked@example.com", "ok@example.com"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.has("blocked@example.com")).toBe(true);
      expect(result.data.has("ok@example.com")).toBe(false);
    }
  });

  it("returns STORAGE_UNAVAILABLE when suppression query fails", async () => {
    const deps = fromPartial<GetSuppressedEmailsDeps>({
      db: {
        suppressionList: {
          findMany: async () => {
            throw new Error("DB timeout");
          },
        },
      },
    });

    const handler = new GetSuppressedEmailsHandler(deps);
    const result = await handler.execute({ emails: ["a@example.com"] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
