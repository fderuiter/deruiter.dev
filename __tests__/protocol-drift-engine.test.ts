// @vitest-environment node
/**
 * The 18-point engine contract from #1097, one case per point, driven only
 * through the public Protocol Drift API.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEED,
  EXPECTED_ADVS_ROWS,
  EXPECTED_MH_RECORDS,
  EXPECTED_VS_RECORDS,
  FULL_GRAPH,
  KPA_TO_MMHG,
  RUBBER_STAMP_RESPONSE,
  WAVE1_GRAPH,
  createProtocolDriftEngine,
  evaluateLockGate,
  pairAndDerive,
  restoreProtocolDriftEngine,
  visitKey,
  type PDCommand,
  type PipelineGraph,
  type ProtocolDriftEngine,
  type SimSpeed,
} from "@/lib/protocol-drift";
import {
  ok,
  playFullLevel,
  publish,
  runToWave2,
  runUntil,
  startEngine,
  WAVE_END_MINUTES,
} from "./protocol-drift/helpers";

const B01 = "iss-out-of-range-sub-b01-d14-sysbp-sitting";

function wave1(graph: PipelineGraph = WAVE1_GRAPH): ProtocolDriftEngine {
  const engine = startEngine();
  publish(engine, graph, "p1");
  runUntil(engine, WAVE_END_MINUTES[1]);
  return engine;
}

const current = (engine: ProtocolDriftEngine) =>
  engine.view().vsLedger.filter((r) => !r.superseded);

describe("Protocol Drift engine contract (#1097)", () => {
  it("01 happy path: three waves, every check green, database locked", () => {
    const engine = startEngine();
    playFullLevel(engine);
    ok(engine, { type: "REQUEST_LOCK" });
    const audit = engine.view().lastLockAudit;
    expect(audit?.canLock).toBe(true);
    expect(audit?.sdtmChecklist.vsRecordCount.actual).toBe(EXPECTED_VS_RECORDS);
    expect(audit?.sdtmChecklist.mhRecordCount.actual).toBe(EXPECTED_MH_RECORDS);
    expect(audit?.adamChecklist.derivedRecordsCount.actual).toBe(
      EXPECTED_ADVS_ROWS
    );
    const locked = ok(engine, { type: "CONFIRM_LOCK" }).find(
      (e) => e.type === "LOCKED"
    );
    expect(engine.view().fsmState).toBe("LOCKED");
    expect(
      locked && locked.type === "LOCKED" && locked.scorecard.integrityPassed
    ).toBe(true);
  });

  it("02 replay determinism: seed 48291 and the same commands reproduce the run bit for bit", () => {
    const a = startEngine("full", DEFAULT_SEED);
    playFullLevel(a);
    const b = startEngine("full", 48291);
    playFullLevel(b);
    expect(b.stateHash()).toBe(a.stateHash());
    expect(JSON.stringify(b.view())).toBe(JSON.stringify(a.view()));
    const save = ok(a, {
      type: "EXPORT_SAVE",
      savedAt: "2026-01-01T00:00:00Z",
    }).find((e) => e.type === "SAVE_EXPORTED");
    if (!save || save.type !== "SAVE_EXPORTED") throw new Error("no save");
    expect(restoreProtocolDriftEngine(save.save).stateHash()).toBe(
      a.stateHash()
    );
    const replay = createProtocolDriftEngine(DEFAULT_SEED);
    for (const c of a.commandLog()) replay.dispatch(c);
    expect(replay.stateHash()).toBe(a.stateHash());
  });

  it("03 Site C locale: DD/MM/YYYY dates normalize to ISO 8601", () => {
    const rows = current(wave1()).filter((r) => r.siteId === "SITE-C");
    expect(
      rows.find((r) => r.USUBJID === "PD-101-C01" && r.VISITNUM === 7)?.VSDTC
    ).toBe("2025-11-08");
    expect(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.VSDTC))).toBe(true);
  });

  it("04 Site C units: kPa standardizes to mmHg with the original preserved", () => {
    const rows = current(wave1()).filter(
      (r) => r.siteId === "SITE-C" && r.VSTESTCD !== "PULSE"
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r).toMatchObject({
        VSORRESU: "kPa",
        VSSTRESU: "mmHg",
        precision: 1,
      });
      expect(r.VSSTRESN).toBeCloseTo(Number(r.VSORRES) * KPA_TO_MMHG, 10);
    }
  });

  it("05 partial date: A02 onset stays 2025-10, UNCERTAIN, zero fabricated bits", () => {
    const v = wave1().view();
    expect(v.mhLedger.find((r) => r.USUBJID === "PD-101-A02")).toMatchObject({
      MHSTDTC: "2025-10",
      epistemicStatus: "UNCERTAIN",
      fabricatedBits: 0,
    });
    expect(v.debt.fabricatedBits).toBe(0);
  });

  it("06 imputing the day fabricates precision and blocks the lock gate", () => {
    const imputing: PipelineGraph = {
      nodes: WAVE1_GRAPH.nodes.map((n) =>
        n.id === "date" ? { ...n, data: { partialDates: "impute-day" } } : n
      ),
      edges: [
        ...WAVE1_GRAPH.edges.filter(
          (e) => !(e.source === "ingest" && e.sourceHandle === "mh_entry")
        ),
        {
          id: "mh-to-date",
          source: "ingest",
          sourceHandle: "mh_entry",
          target: "date",
          targetHandle: "mh_in",
        },
        {
          id: "date-to-sink",
          source: "date",
          sourceHandle: "mh_out",
          target: "sink",
          targetHandle: "mh_in",
        },
      ],
    };
    const engine = wave1(imputing);
    const a02 = engine.view().mhLedger.find((r) => r.USUBJID === "PD-101-A02");
    expect(a02?.MHSTDTC).toMatch(/^2025-10-\d{2}$/);
    expect(a02?.fabricatedBits).toBeCloseTo(Math.log2(31), 10);
    expect(engine.view().debt.fabricatedBits).toBeGreaterThan(0);
    ok(engine, { type: "SET_PAUSED", isPaused: true });
    ok(engine, { type: "REQUEST_LOCK" });
    const fab = engine
      .view()
      .lastLockAudit?.discrepancies.find(
        (d) => d.code === "FABRICATED_DEBT_EXCEEDED"
      );
    expect(fab?.entityId).toBe(a02?.recordId);
    expect(
      engine
        .dispatch({ type: "CONFIRM_LOCK" })
        .some((e) => e.type === "COMMAND_REJECTED")
    ).toBe(true);
  });

  it("07 narrative: the repeat reading is never silently selected or dropped", () => {
    const v = wave1().view();
    const a01d7 = v.vsLedger.filter(
      (r) => !r.superseded && r.USUBJID === "PD-101-A01" && r.VISITNUM === 7
    );
    expect(a01d7.find((r) => r.VSTESTCD === "SYSBP")?.VSSTRESN).toBe(120);
    expect(a01d7.some((r) => r.VSSTRESN === 118)).toBe(false);
    expect(v.unmatched.map((u) => u.text).join(" ")).toContain("118/78");
    expect(v.issues.find((i) => i.code === "NARRATIVE_REPEAT")?.status).toBe(
      "Open"
    );
    expect(v.debt.semanticLossCount).toBe(1);
  });

  it("08 rubber stamp: a generic query to Site B returns Confirmed Correct and fixes nothing", () => {
    const engine = wave1();
    ok(engine, { type: "SET_PAUSED", isPaused: true });
    ok(engine, { type: "DRAFT_QUERY", issueId: B01, evidenceLinked: false });
    const id = engine.view().queries.at(-1)?.queryId as string;
    ok(engine, { type: "SEND_QUERY", queryId: id });
    ok(engine, { type: "ADVANCE_TO", minute: engine.view().minute + 48 * 60 });
    expect(
      engine.view().queries.find((q) => q.queryId === id)?.responseReceived
    ).toBe(RUBBER_STAMP_RESPONSE);
    expect(engine.view().issues.find((i) => i.issueId === B01)?.status).toBe(
      "Open"
    );
  });

  it("09 B01 correction supersedes 210 with 120 and keeps both in history", () => {
    const engine = wave1();
    ok(engine, { type: "SET_PAUSED", isPaused: true });
    ok(engine, { type: "DRAFT_QUERY", issueId: B01, evidenceLinked: true });
    ok(engine, {
      type: "SEND_QUERY",
      queryId: engine.view().queries.at(-1)?.queryId as string,
    });
    ok(engine, { type: "ADVANCE_TO", minute: engine.view().minute + 48 * 60 });
    ok(engine, { type: "ACCEPT_CORRECTION", issueId: B01 });
    const sbp = engine
      .view()
      .vsLedger.filter(
        (r) => r.submissionId === "sub-b01-d14" && r.VSTESTCD === "SYSBP"
      );
    expect(sbp.map((r) => [r.VSSTRESN, r.superseded])).toEqual([
      [210, true],
      [120, false],
    ]);
    expect(sbp[0].supersededBy).toBe(sbp[1].recordId);
  });

  it("10 legacy retention: the 54 Wave 1 v1 records survive the amendment unchanged", () => {
    const engine = wave1();
    const legacy = current(engine);
    expect(legacy).toHaveLength(54);
    runUntil(engine, WAVE_END_MINUTES[1] + 60 * 6);
    publish(engine, FULL_GRAPH, "p2");
    runUntil(engine, WAVE_END_MINUTES[2]);
    const after = current(engine);
    expect(after).toHaveLength(80);
    for (const r of legacy)
      expect(after.find((x) => x.recordId === r.recordId)).toEqual(r);
  });

  it("11 signature test: B Day 24 visits submitted on Day 27 route to v1 with no penalty", () => {
    const engine = startEngine();
    runToWave2(engine);
    const v = engine.view();
    expect(
      v.routing
        .filter(
          (r) =>
            r.submissionId.startsWith("sub-b0") &&
            r.submissionId.endsWith("-d24")
        )
        .map((r) => r.handle)
    ).toEqual(["v1", "v1"]);
    expect(v.sites["SITE-B"].goodwill).toBe(35);
    expect(
      current(engine).filter(
        (r) => r.USUBJID === "PD-101-B01" && r.VISITNUM === 24
      )
    ).toHaveLength(3);
  });

  it("12 post-activation applicability: routing by submission time misroutes and costs goodwill", () => {
    const misconfigured: PipelineGraph = {
      nodes: FULL_GRAPH.nodes.map((n) =>
        n.id === "router" ? { ...n, data: { routeBy: "submittedAt" } } : n
      ),
      edges: FULL_GRAPH.edges,
    };
    const engine = startEngine();
    runToWave2(engine, misconfigured);
    const v = engine.view();
    const b = v.routing.filter(
      (r) =>
        r.submissionId === "sub-b01-d24" || r.submissionId === "sub-b02-d24"
    );
    expect(
      b.every(
        (r) =>
          r.handle === "review" &&
          r.requiredVersion === "v2" &&
          r.routedBy === "submittedAt"
      )
    ).toBe(true);
    expect(
      v.issues.filter((i) => i.code === "APPLICABILITY_DISCREPANCY").length
    ).toBeGreaterThan(0);
    expect(v.sites["SITE-B"].goodwill).toBeLessThan(35);
    expect(
      current(engine).filter(
        (r) => r.USUBJID === "PD-101-B01" && r.VISITNUM === 24
      )
    ).toHaveLength(0);
  });

  it("13 collision: a standing value wired into a sitting handle is held, never overwritten", () => {
    const miswired: PipelineGraph = {
      nodes: FULL_GRAPH.nodes,
      edges: [
        ...FULL_GRAPH.edges,
        {
          id: "bad",
          source: "unit-dbp-stand",
          sourceHandle: "std_val",
          target: "pivot",
          targetHandle: "dbp",
        },
      ],
    };
    const engine = startEngine();
    runToWave2(engine, miswired);
    const v = engine.view();
    expect(v.debt.collisionCount).toBe(4);
    expect(v.held.filter((h) => /collision/i.test(h.reason))).toHaveLength(4);
    expect(current(engine)).toHaveLength(80);
  });

  it("14 NOT EVALUABLE: v1 visits get AVAL null, and no cross-visit pair is ever derived", () => {
    const engine = startEngine();
    runToWave2(engine);
    const v = engine.view();
    const ne = v.unpaired.find(
      (r) => r.USUBJID === "PD-101-B01" && r.AVISITN === 24
    );
    expect(ne).toMatchObject({
      AVAL: null,
      AVALC: "NOT EVALUABLE",
      PARAMCD: "ORTHOST",
    });
    for (const row of v.adamRows) {
      const sit = v.vsLedger.find(
        (r) => r.recordId === row.sourceSittingRecordId
      );
      const stand = v.vsLedger.find(
        (r) => r.recordId === row.sourceStandingRecordId
      );
      expect(visitKey(sit?.USUBJID ?? "", sit?.VISITNUM ?? -1)).toBe(
        visitKey(stand?.USUBJID ?? "", stand?.VISITNUM ?? -2)
      );
    }
    const bySubject = pairAndDerive(v.vsLedger, { joinKey: "subject" });
    expect(bySubject.traceViolations.length).toBeGreaterThan(0);
    expect(bySubject.adamRows).toHaveLength(v.adamRows.length);
  });

  it("15 A01 Day 24 derives 22 and 12 mmHg drops flagged Y", () => {
    const engine = startEngine();
    runToWave2(engine);
    const rows = engine
      .view()
      .adamRows.filter((r) => r.USUBJID === "PD-101-A01" && r.AVISITN === 24);
    expect(rows.map((r) => [r.PARAMCD, r.AVAL, r.CRIT1FL])).toEqual([
      ["OSBPDRP", 22, "Y"],
      ["ODBPDRP", 12, "Y"],
    ]);
  });

  it("16 stale: a source correction invalidates derivations until replayed", () => {
    const engine = startEngine();
    runToWave2(engine);
    ok(engine, { type: "SET_PAUSED", isPaused: true });
    ok(engine, {
      type: "SITE_SOURCE_CORRECTION",
      submissionId: "sub-a02-d24",
      payload: {
        sbp_sit: 122,
        dbp_sit: 78,
        pulse: 70,
        sbp_stand: 100,
        dbp_stand: 72,
      },
      reason: "Standing SBP transcription corrected",
    });
    expect(
      engine
        .view()
        .adamRows.filter((r) => r.stale)
        .map((r) => r.USUBJID)
    ).toEqual(["PD-101-A02", "PD-101-A02"]);
    ok(engine, { type: "REPLAY_DERIVATIONS" });
    const row = engine
      .view()
      .adamRows.find(
        (r) =>
          r.USUBJID === "PD-101-A02" &&
          r.AVISITN === 24 &&
          r.PARAMCD === "OSBPDRP"
      );
    expect(row).toMatchObject({ AVAL: 22, CRIT1FL: "Y", stale: false });
  });

  it("17 no invisible oracle: the lock gate is a pure function of inspectable state", () => {
    const engine = wave1();
    ok(engine, { type: "SET_PAUSED", isPaused: true });
    ok(engine, { type: "REQUEST_LOCK" });
    const v = engine.view();
    const recomputed = evaluateLockGate({
      vsRecords: v.vsLedger,
      mhRecords: v.mhLedger,
      adamRows: v.adamRows,
      unpaired: v.unpaired,
      issues: v.issues,
      queries: v.queries,
      held: v.held,
      unmatched: v.unmatched,
      traceViolations: v.traceViolations,
      debt: v.debt,
    });
    expect(recomputed).toEqual(v.lastLockAudit);
    expect(recomputed.canLock).toBe(false);
    const known = new Set<string>([
      "VS",
      "MH",
      "ADVS",
      ...v.vsLedger.map((r) => r.recordId),
      ...v.mhLedger.map((r) => r.recordId),
      ...v.issues.map((i) => i.issueId),
      ...v.queries.map((q) => q.queryId),
      ...v.held.map((h) => h.heldId),
      ...v.unmatched.map((u) => u.unmatchedId),
      ...v.adamRows.map((r) => r.rowId),
      ...v.vsLedger.map((r) => visitKey(r.USUBJID, r.VISITNUM)),
    ]);
    for (const d of recomputed.discrepancies)
      expect(known.has(d.entityId), d.entityId).toBe(true);
  });

  it("18 speed and step invariance: 1x, 2x, 5x and step-only reach the same Wave 1 state", () => {
    const run = (speed: SimSpeed | "step") => {
      const engine = startEngine();
      publish(engine, WAVE1_GRAPH, "p1");
      if (speed !== "step") ok(engine, { type: "SET_SPEED", speed });
      for (
        let i = 0;
        i < 5000 && engine.view().fsmState !== "WAVE_REVIEW";
        i += 1
      ) {
        const state = engine.view().fsmState;
        const cmd: PDCommand =
          speed === "step"
            ? { type: "STEP_TICK" }
            : state === "PAUSED"
              ? { type: "SET_PAUSED", isPaused: false }
              : { type: "TICK", realMs: 700 };
        ok(engine, cmd);
      }
      expect(engine.view().minute).toBe(WAVE_END_MINUTES[1]);
      return engine.stateHash();
    };
    const reference = run(1);
    expect(run(2)).toBe(reference);
    expect(run(5)).toBe(reference);
    expect(run("step")).toBe(reference);
  });
});
