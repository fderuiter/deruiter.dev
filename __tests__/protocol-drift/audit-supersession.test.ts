// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AuditTrail, WAVE1_GRAPH } from "@/lib/protocol-drift";
import {
  ok,
  publish,
  runUntil,
  startEngine,
  WAVE_END_MINUTES,
} from "./helpers";

const B01 = "iss-out-of-range-sub-b01-d14-sysbp-sitting";

function corrected() {
  const engine = startEngine();
  publish(engine, WAVE1_GRAPH, "p1");
  runUntil(engine, WAVE_END_MINUTES[1]);
  ok(engine, { type: "SET_PAUSED", isPaused: true });
  ok(engine, { type: "DRAFT_QUERY", issueId: B01, evidenceLinked: true });
  const queryId = engine.view().queries.at(-1)?.queryId as string;
  ok(engine, { type: "SEND_QUERY", queryId });
  ok(engine, { type: "ADVANCE_TO", minute: engine.view().minute + 48 * 60 });
  const events = ok(engine, { type: "ACCEPT_CORRECTION", issueId: B01 });
  return { engine, events, queryId };
}

describe("source supersession and audit trail", () => {
  it("supersedes the original records with frozen copies linked to their successors", () => {
    const { engine, events } = corrected();
    const rows = engine
      .view()
      .vsLedger.filter((r) => r.submissionId === "sub-b01-d14");
    const old = rows.filter((r) => r.superseded);
    const current = rows.filter((r) => !r.superseded);
    expect(old).toHaveLength(3);
    expect(current).toHaveLength(3);
    for (const r of old) {
      expect(r.sourceRevisionId).toBe("rev-b01-d14-r1");
      expect(
        current.some(
          (c) => c.recordId === r.supersededBy && c.VSSEQ === r.VSSEQ
        )
      ).toBe(true);
    }
    expect(current.every((r) => r.sourceRevisionId === "rev-b01-d14-r2")).toBe(
      true
    );
    expect(events.filter((e) => e.type === "RECORD_SUPERSEDED")).toHaveLength(
      3
    );
    const sources = engine
      .view()
      .sourceLedger.filter((s) => s.submissionId === "sub-b01-d14");
    expect(sources.map((s) => s.revision)).toEqual([1, 2]);
  });

  it("writes an append-only, attributed audit entry for the changed value", () => {
    const { engine, queryId } = corrected();
    const trail = engine.view().auditTrail;
    const change = trail.find(
      (a) => a.type === "SOURCE_RECORD_SUPERSEDED" && a.variable === "VSSTRESN"
    );
    expect(change).toMatchObject({
      subjectId: "PD-101-B01",
      visit: "Day 14",
      oldValue: 210,
      newValue: 120,
      actor: "SITE_COORDINATOR",
      queryThreadId: queryId,
    });
    expect(trail.map((a) => a.eventId)).toEqual(
      trail.map((_, i) => `evt-${String(i + 1).padStart(5, "0")}`)
    );
    expect(
      trail.some(
        (a) => a.type === "ISSUE_RESOLVED" && a.actor === "DATA_ARCHITECT"
      )
    ).toBe(true);
  });

  it("freezes audit entries", () => {
    const trail = new AuditTrail();
    const entry = trail.append(600, {
      type: "ISSUE_RAISED",
      subjectId: "PD-101-A01",
      visit: "Day 7",
      variable: "raw_bp",
      oldValue: null,
      newValue: "x",
      actor: "SIMULATION_ENGINE",
      reason: "test",
    });
    expect(Object.isFrozen(entry)).toBe(true);
    expect(trail.length).toBe(1);
    expect(trail.list()[0]).toBe(entry);
    expect(entry.trialDay).toBe(0);
  });
});
