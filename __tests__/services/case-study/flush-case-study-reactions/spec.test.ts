// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CaseStudyReactionFlushErrorCode,
  FlushCaseStudyReactionsInputSchema,
} from "@/lib/services";

describe("FlushCaseStudyReactionsInputSchema (Contract Test)", () => {
  it("accepts optional bounded batchSize", () => {
    expect(FlushCaseStudyReactionsInputSchema.safeParse({}).success).toBe(true);
    expect(
      FlushCaseStudyReactionsInputSchema.safeParse({ batchSize: 250 }).success
    ).toBe(true);
  });

  it("rejects out-of-range batchSize", () => {
    expect(
      FlushCaseStudyReactionsInputSchema.safeParse({ batchSize: 0 }).success
    ).toBe(false);
    expect(CaseStudyReactionFlushErrorCode.options).toContain(
      "PERSISTENCE_FAILED"
    );
  });
});
