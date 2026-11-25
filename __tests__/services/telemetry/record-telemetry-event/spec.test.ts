// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  RecordTelemetryEventErrorCode,
  RecordTelemetryEventInputSchema,
} from "@/lib/services";

describe("RecordTelemetryEventInputSchema (Contract Test)", () => {
  it("accepts valid projectSlug and eventType", () => {
    const parsed = RecordTelemetryEventInputSchema.safeParse({
      projectSlug: "crf-studio",
      eventType: "page_view",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty projectSlug", () => {
    const parsed = RecordTelemetryEventInputSchema.safeParse({
      projectSlug: "   ",
      eventType: "page_view",
    });
    expect(parsed.success).toBe(false);
    expect(RecordTelemetryEventErrorCode.options).toContain("INVALID_INPUT");
  });
});
