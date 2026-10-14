// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  AMENDMENT_PRESETS,
  annotateInspectionReport,
  applySpotInspectionMisroute,
  beginAmendmentEffect,
  buildInspectionReport,
  createAmendmentEffectsState,
  createInitialAuditorState,
  createInitialScoreState,
  DOUBLE_SIGNATURE_CRF_COUNT,
  generateClinicalSubject,
  getRequiredSignatureCount,
  getStationsForPhase,
  getSubmissionMode,
  parkAuditorAtStation,
  recordAmendmentLock,
  SPOT_INSPECTION_SUSPICION_MULTIPLIER,
  summarizeAmendmentOutcomes,
  tickAmendmentEffects,
  verify21CFRSubmission,
  type AmendmentEffectsState,
  type CDISCDomain,
} from "@/lib/clinical-trial-chaos";

const STATIONS: CDISCDomain[] = ["DM", "VS", "AE", "LB"];
const preset = (type: string) => {
  const found = AMENDMENT_PRESETS.find((a) => a.type === type);
  if (!found) throw new Error(`missing preset ${type}`);
  return found;
};

describe("amendment presets (#2053)", () => {
  it("adds both lasting amendments to the pool with regulatory copy", () => {
    const double = preset("double-signature-audit");
    expect(double.description).toMatch(/21 CFR 11\.50/);
    expect(double.description).toMatch(/next 3 CRFs/);
    expect(double.description).toMatch(/countersignature/);

    const spot = preset("gcp-spot-inspection");
    expect(spot.description).toMatch(/BIMO/);
    expect(spot.description).toMatch(/7348\.811/);
    expect(spot.description).toMatch(/counts double/);

    // Every declared amendment type now has a preset.
    expect(new Set(AMENDMENT_PRESETS.map((a) => a.type))).toEqual(
      new Set([
        "station-scramble",
        "sae-priority-rush",
        "unit-shift-lbs-to-kg",
        "double-signature-audit",
        "conmed-reconciliation-rush",
        "gcp-spot-inspection",
      ])
    );
  });
});

describe("double-signature audit handler (#2053)", () => {
  const start = () =>
    beginAmendmentEffect(
      createAmendmentEffectsState(),
      preset("double-signature-audit"),
      STATIONS
    );

  it("requires one signature until the audit begins", () => {
    expect(getRequiredSignatureCount(createAmendmentEffectsState())).toBe(1);
    expect(getRequiredSignatureCount(start())).toBe(2);
  });

  it("covers exactly the next three locks, then closes as met", () => {
    let state: AmendmentEffectsState = start();
    const closed: boolean[] = [];
    for (let i = 0; i < DOUBLE_SIGNATURE_CRF_COUNT; i++) {
      expect(getRequiredSignatureCount(state)).toBe(2);
      const result = recordAmendmentLock(state);
      closed.push(result.auditClosed);
      state = result.state;
    }
    expect(closed).toEqual([false, false, true]);
    expect(state.doubleSignature).toBeNull();
    expect(getRequiredSignatureCount(state)).toBe(1);
    expect(state.outcomes).toEqual([
      expect.objectContaining({
        type: "double-signature-audit",
        resolved: true,
      }),
    ]);
    // A further lock changes nothing.
    expect(recordAmendmentLock(state).state).toBe(state);
  });

  it("tops a running audit back up to three uncountersigned CRFs", () => {
    const once = recordAmendmentLock(start()).state;
    const again = beginAmendmentEffect(
      once,
      preset("double-signature-audit"),
      STATIONS
    );
    expect(again.doubleSignature).toEqual({ required: 4, countersigned: 1 });
  });

  it("reports an audit still open at the end of the shift as not met", () => {
    const state = recordAmendmentLock(start()).state;
    expect(summarizeAmendmentOutcomes(state)).toEqual([
      expect.objectContaining({
        type: "double-signature-audit",
        resolved: false,
        summary: "1 of 3 CRFs were countersigned before the shift ended.",
      }),
    ]);
  });

  it("keeps routine CRFs out of quick dispatch while it runs", () => {
    const subject = generateClinicalSubject(0, false, 7001, ["DM"]);
    const stations = getStationsForPhase(1, "campaign");
    const context = {
      gameMode: "endless" as const,
      submittedCount: 0,
      phaseTarget: 5,
      amendmentActive: false,
    };
    expect(getSubmissionMode(subject, "DM", stations, context)).toBe("quick");
    expect(
      getSubmissionMode(subject, "DM", stations, {
        ...context,
        signaturesRequired: 2,
      })
    ).toBe("full");
  });
});

describe("GCP spot inspection handler (#2053)", () => {
  const start = (random = () => 0.6) =>
    beginAmendmentEffect(
      createAmendmentEffectsState(),
      preset("gcp-spot-inspection"),
      STATIONS,
      random
    );

  it("parks the inspection on one open station for the amendment window", () => {
    const state = start();
    expect(state.spotInspection).toEqual({
      stationId: "AE",
      timeRemaining: preset("gcp-spot-inspection").durationSeconds,
      durationSeconds: preset("gcp-spot-inspection").durationSeconds,
      misroutes: 0,
    });
    expect(start(() => 0.9999).spotInspection?.stationId).toBe("LB");
    expect(start(() => 0).spotInspection?.stationId).toBe("DM");
  });

  it("does nothing without open stations", () => {
    const empty = createAmendmentEffectsState();
    expect(beginAmendmentEffect(empty, preset("gcp-spot-inspection"), [])).toBe(
      empty
    );
  });

  it("doubles suspicion for a misroute at the watched station only", () => {
    const state = start();
    const elsewhere = applySpotInspectionMisroute(state, "DM", 15);
    expect(elsewhere).toEqual({ state, suspicionDelta: 15, doubled: false });

    const watched = applySpotInspectionMisroute(state, "AE", 15);
    expect(watched.doubled).toBe(true);
    expect(watched.suspicionDelta).toBe(
      15 * SPOT_INSPECTION_SUSPICION_MULTIPLIER
    );
    expect(watched.state.spotInspection?.misroutes).toBe(1);

    // The doubled delta matches a real domain-mismatch rejection.
    const subject = generateClinicalSubject(0, false, 7002, ["DM"]);
    const rejection = verify21CFRSubmission(subject, "Intent to Submit", "AE");
    expect(rejection.success).toBe(false);
    expect(
      applySpotInspectionMisroute(state, "AE", rejection.suspicionDelta)
        .suspicionDelta
    ).toBe(rejection.suspicionDelta * 2);
  });

  it("runs the window down and records how it went", () => {
    let state = applySpotInspectionMisroute(start(), "AE", 15).state;
    const paused = tickAmendmentEffects(state, 0);
    expect(paused.state).toBe(state);

    const mid = tickAmendmentEffects(state, 5);
    expect(mid.inspectionEnded).toBeNull();
    expect(mid.state.spotInspection?.timeRemaining).toBe(15);
    state = mid.state;

    const end = tickAmendmentEffects(state, 15);
    expect(end.inspectionEnded?.stationId).toBe("AE");
    expect(end.state.spotInspection).toBeNull();
    expect(end.state.outcomes).toEqual([
      {
        type: "gcp-spot-inspection",
        title: "GCP spot inspection",
        summary:
          "Inspector observed the AE station for 20s: 1 misroute counted double.",
        resolved: false,
      },
    ]);
    // Misroutes after the window are ordinary again.
    expect(applySpotInspectionMisroute(end.state, "AE", 15).doubled).toBe(
      false
    );
  });

  it("closes a running inspection when a new one starts", () => {
    const first = start(() => 0);
    const second = beginAmendmentEffect(
      first,
      preset("gcp-spot-inspection"),
      STATIONS,
      () => 0.9
    );
    expect(second.spotInspection?.stationId).toBe("LB");
    expect(second.outcomes).toEqual([
      expect.objectContaining({ type: "gcp-spot-inspection", resolved: true }),
    ]);
  });

  it("parks the auditor at the station but respects breaks and a 483", () => {
    const auditor = createInitialAuditorState();
    const parked = parkAuditorAtStation(auditor, 0.42, "LB");
    expect(parked).toMatchObject({
      x: 0.42,
      behavior: "inspecting",
      targetStationId: "LB",
    });
    expect(parkAuditorAtStation(auditor, 7, "LB").x).toBe(1);
    const onBreak = { ...auditor, behavior: "coffee_break" as const };
    expect(parkAuditorAtStation(onBreak, 0.4, "LB")).toBe(onBreak);
    const writing = { ...auditor, behavior: "issuing_483" as const };
    expect(parkAuditorAtStation(writing, 0.4, "LB")).toBe(writing);
  });
});

describe("BIMO report annotation (#2053)", () => {
  const report = () =>
    buildInspectionReport(
      createInitialScoreState(),
      createInitialAuditorState(),
      [],
      [],
      null,
      []
    );

  it("adds the Audit Year for endless and the amendment outcomes", () => {
    const effects = beginAmendmentEffect(
      createAmendmentEffectsState(),
      preset("gcp-spot-inspection"),
      STATIONS,
      () => 0
    );
    const annotated = annotateInspectionReport(report(), 4, effects);
    expect(annotated.auditYear).toBe(4);
    expect(annotated.amendmentOutcomes).toEqual([
      expect.objectContaining({ type: "gcp-spot-inspection" }),
    ]);
  });

  it("leaves a campaign report with no amendments unchanged in shape", () => {
    const annotated = annotateInspectionReport(
      report(),
      null,
      createAmendmentEffectsState()
    );
    expect(annotated).not.toHaveProperty("auditYear");
    expect(annotated).not.toHaveProperty("amendmentOutcomes");
  });
});
