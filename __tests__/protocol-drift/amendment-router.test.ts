// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SITE_PROFILES, minuteAt, routeAmendment } from "@/lib/protocol-drift";

const activationB = minuteAt(
  SITE_PROFILES["SITE-B"].amendmentActivationDay,
  0,
  0
);

describe("AmendmentRouter", () => {
  it("activates sites A, C and B on Days 22, 23 and 26", () => {
    expect(SITE_PROFILES["SITE-A"].amendmentActivationDay).toBe(22);
    expect(SITE_PROFILES["SITE-C"].amendmentActivationDay).toBe(23);
    expect(SITE_PROFILES["SITE-B"].amendmentActivationDay).toBe(26);
  });

  it("routes a Day 24 assessment submitted on Day 27 by assessment date to v1", () => {
    const decision = routeAmendment(
      {
        assessedAtMinute: minuteAt(24, 14, 0),
        submittedAtMinute: minuteAt(27, 16, 0),
        formVersion: "v1",
      },
      activationB
    );
    expect(decision).toMatchObject({ handle: "v1", requiredVersion: "v1" });
  });

  it("routes a Day 26 assessment to v2", () => {
    const decision = routeAmendment(
      {
        assessedAtMinute: minuteAt(26, 9, 0),
        submittedAtMinute: minuteAt(26, 10, 0),
        formVersion: "v2",
      },
      activationB
    );
    expect(decision.handle).toBe("v2");
  });

  it("sends a v1 form assessed after activation to review as an applicability discrepancy", () => {
    const decision = routeAmendment(
      {
        assessedAtMinute: minuteAt(27, 9, 0),
        submittedAtMinute: minuteAt(27, 10, 0),
        formVersion: "v1",
      },
      activationB
    );
    expect(decision.handle).toBe("review");
    expect(decision.requiredVersion).toBe("v2");
    expect(decision.reason).toMatch(/Applicability discrepancy/);
  });

  it("misroutes the late backlog when configured to use submission time", () => {
    const decision = routeAmendment(
      {
        assessedAtMinute: minuteAt(24, 14, 0),
        submittedAtMinute: minuteAt(27, 16, 0),
        formVersion: "v1",
      },
      activationB,
      "submittedAt"
    );
    expect(decision).toMatchObject({ handle: "review", requiredVersion: "v2" });
  });

  it("sends v2 forms governed by v1 and missing metadata to review", () => {
    const early = {
      assessedAtMinute: minuteAt(20, 9, 0),
      submittedAtMinute: minuteAt(20, 9, 0),
    };
    expect(
      routeAmendment({ ...early, formVersion: "v2" }, activationB).reason
    ).toMatch(/governed by v1/);
    expect(
      routeAmendment({ ...early, formVersion: null }, activationB).reason
    ).toMatch(/Missing protocol version/);
  });
});
