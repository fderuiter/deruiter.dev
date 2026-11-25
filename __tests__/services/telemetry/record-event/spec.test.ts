// @vitest-environment node
import { describe, expect, it } from "vitest";
import { RecordTelemetryEventInputSchema } from "@/lib/services";

describe("RecordTelemetryEventInputSchema (Contract Test)", () => {
  it("accepts non-empty projectSlug and eventType", () => {
    expect(
      RecordTelemetryEventInputSchema.safeParse({
        projectSlug: "crf",
        eventType: "view",
      }).success
    ).toBe(true);
  });

  it("rejects empty projectSlug or eventType", () => {
    expect(
      RecordTelemetryEventInputSchema.safeParse({
        projectSlug: "",
        eventType: "view",
      }).success
    ).toBe(false);
  });
});
