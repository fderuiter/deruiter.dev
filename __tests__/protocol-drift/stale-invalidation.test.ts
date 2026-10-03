// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ok, startEngine, runToWave2 } from "./helpers";

describe("stale derivation invalidation", () => {
  it("marks derivations stale after a v2 source correction and clears them on replay", () => {
    const engine = startEngine();
    runToWave2(engine);
    ok(engine, { type: "SET_PAUSED", isPaused: true });
    const events = ok(engine, {
      type: "SITE_SOURCE_CORRECTION",
      submissionId: "sub-a01-d24",
      payload: {
        sbp_sit: 120,
        dbp_sit: 80,
        pulse: 72,
        sbp_stand: 104,
        dbp_stand: 68,
      },
      reason: "Standing SBP re-read from the source worksheet",
    });
    expect(events.some((e) => e.type === "DERIVATION_STALE")).toBe(true);
    let v = engine.view();
    const a01 = (rows: typeof v.adamRows) =>
      rows.filter((r) => r.USUBJID === "PD-101-A01" && r.AVISITN === 24);
    expect(a01(v.adamRows).every((r) => r.stale)).toBe(true);
    expect(a01(v.adamRows).find((r) => r.PARAMCD === "OSBPDRP")?.AVAL).toBe(22);
    expect(v.adamRows.filter((r) => r.stale)).toHaveLength(2);
    expect(v.auditTrail.some((a) => a.type === "DERIVATION_STALE")).toBe(true);

    ok(engine, { type: "REQUEST_LOCK" });
    expect(
      engine
        .view()
        .lastLockAudit?.discrepancies.some(
          (d) => d.code === "STALE_DERIVATIONS_EXIST"
        )
    ).toBe(true);
    ok(engine, { type: "RETURN_TO_WORKBENCH" });

    ok(engine, { type: "REPLAY_DERIVATIONS" });
    v = engine.view();
    expect(v.adamRows.some((r) => r.stale)).toBe(false);
    expect(a01(v.adamRows).map((r) => [r.PARAMCD, r.AVAL, r.CRIT1FL])).toEqual([
      ["OSBPDRP", 16, "N"],
      ["ODBPDRP", 12, "Y"],
    ]);
    expect(v.auditTrail.at(-1)?.type).toBe("DERIVATIONS_REPLAYED");
    ok(engine, { type: "REPLAY_DERIVATIONS" });
  });

  it("rejects replays while running or before publication", () => {
    const engine = startEngine();
    const r = engine.dispatch({ type: "REPLAY_SUBMISSIONS" });
    expect(r.some((e) => e.type === "COMMAND_REJECTED")).toBe(true);
    expect(
      engine
        .dispatch({ type: "REPLAY_DERIVATIONS" })
        .some((e) => e.type === "COMMAND_REJECTED")
    ).toBe(true);
  });
});
