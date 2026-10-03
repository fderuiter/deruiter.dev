// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  AMENDMENT_GRAPH,
  WAVE1_GRAPH,
  WAVE_VS_TOTALS,
  minuteAt,
} from "@/lib/protocol-drift";
import {
  ok,
  publish,
  runUntil,
  startEngine,
  WAVE_END_MINUTES,
  runToWave2,
} from "./helpers";

describe("Wave 2 Amendment 01", () => {
  it("auto-pauses at the Day 20 08:00 memo and requires the AmendmentRouter", () => {
    const engine = startEngine();
    publish(engine, WAVE1_GRAPH, "p1");
    runUntil(engine, WAVE_END_MINUTES[1]);
    ok(engine, { type: "SET_PAUSED", isPaused: true });
    const events = ok(engine, {
      type: "ADVANCE_TO",
      minute: minuteAt(25, 0, 0),
    });
    expect(events.some((e) => e.type === "AUTO_PAUSED")).toBe(true);
    const v = engine.view();
    expect(v.minute).toBe(minuteAt(20, 8, 0));
    expect(v.amendmentAnnounced).toBe(true);
    expect(v.fsmState).toBe("PAUSED");
    const result = engine
      .dispatch({ type: "VALIDATE_GRAPH", ...WAVE1_GRAPH })
      .find((e) => e.type === "VALIDATION_RESULT");
    expect(result && result.type === "VALIDATION_RESULT" && result.valid).toBe(
      false
    );
    expect(v.auditTrail.some((a) => a.type === "AMENDMENT_ANNOUNCED")).toBe(
      true
    );
  });

  it("ends Wave 2 with 80 records: 20 v2 rows from A/C, 6 v1 rows from B, legacy 54 unchanged", () => {
    const engine = startEngine();
    publish(engine, WAVE1_GRAPH, "p1");
    runUntil(engine, WAVE_END_MINUTES[1]);
    const legacy = engine.view().vsLedger.filter((r) => !r.superseded);
    runUntil(engine, minuteAt(20, 8, 0));
    publish(engine, AMENDMENT_GRAPH, "p2");
    runUntil(engine, WAVE_END_MINUTES[2]);
    const v = engine.view();
    expect(v.fsmState).toBe("WAVE_REVIEW");
    const current = v.vsLedger.filter((r) => !r.superseded);
    expect(current).toHaveLength(WAVE_VS_TOTALS[2]);
    expect(current).toHaveLength(80);
    const added = current.filter(
      (r) => !legacy.some((l) => l.recordId === r.recordId)
    );
    expect(
      added.filter((r) => r.siteId !== "SITE-B" && r.protocolVersion === "v2")
    ).toHaveLength(20);
    expect(
      added.filter((r) => r.siteId === "SITE-B" && r.protocolVersion === "v1")
    ).toHaveLength(6);
    for (const l of legacy) {
      expect(current.find((r) => r.recordId === l.recordId)).toEqual(l);
      expect(l.protocolVersion).toBe("v1");
    }
    expect(v.sites["SITE-A"].version).toBe("v2");
    expect(
      v.auditTrail.filter((a) => a.type === "SITE_ACTIVATED")
    ).toHaveLength(3);
    expect(v.adamRows).toHaveLength(0);
  });

  it("derives the analysis lane when the full graph is published", () => {
    const engine = startEngine();
    runToWave2(engine);
    expect(engine.view().adamRows).toHaveLength(8);
  });
});
