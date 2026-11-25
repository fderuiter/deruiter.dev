// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  CaseStudyReactionFlushErrorCode,
  FlushCaseStudyReactionsInputSchema,
} from "@/lib/services";

describe("FlushCaseStudyReactions Spec (Contract Test)", () => {
  it("defaults batchSize to 500 when omitted", () => {
    const parsed = FlushCaseStudyReactionsInputSchema.safeParse(undefined);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.batchSize).toBe(500);
    }
  });

  it("rejects non-positive batchSize and enumerates flush error codes", () => {
    const parsed = FlushCaseStudyReactionsInputSchema.safeParse(
      fromAny({ batchSize: 0 })
    );
    expect(parsed.success).toBe(false);
    expect(CaseStudyReactionFlushErrorCode.options).toEqual(
      expect.arrayContaining([
        "PERSISTENCE_FAILED",
        "FLUSH_FAILED",
        "INVALID_INPUT",
      ])
    );
  });
});
