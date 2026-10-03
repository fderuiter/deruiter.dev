// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEED,
  TRACER_GRAPH,
  TRACER_VS_RECORDS,
  formatClock,
  hashValue,
  type PDWorkerEvent,
} from "@/lib/protocol-drift";
import { ok, publish, startEngine } from "./helpers";

function runTracer(seed = DEFAULT_SEED) {
  const engine = startEngine("tracer", seed);
  publish(engine, TRACER_GRAPH, "p1");
  ok(engine, { type: "SET_PAUSED", isPaused: false });
  const events: PDWorkerEvent[] = [];
  for (let i = 0; i < 1000 && engine.view().fsmState === "RUNNING"; i += 1) {
    events.push(...engine.dispatch({ type: "TICK", realMs: 1000 }));
  }
  return { engine, events };
}

describe("Wave 1 tracer bullet", () => {
  it("enters WAVE_REVIEW exactly at Day 14 23:59 with 18 VS rows and zero debt", () => {
    const { engine, events } = runTracer();
    const v = engine.view();
    expect(v.fsmState).toBe("WAVE_REVIEW");
    expect(formatClock(v.minute)).toBe("Day 14 23:59");
    expect(v.vsLedger).toHaveLength(TRACER_VS_RECORDS);
    expect(v.queries).toHaveLength(0);
    expect(v.debt.fabricatedBits).toBe(0);
    expect(v.debt.semanticLossCount).toBe(0);
    expect(v.vsLedger.every((r) => r.epistemicStatus === "CONFIRMED")).toBe(
      true
    );
    const done = events.find((e) => e.type === "WAVE_COMPLETED");
    expect(
      done && done.type === "WAVE_COMPLETED" && done.summary
    ).toMatchObject({
      waveIndex: 1,
      vsRecords: 18,
      newVsRecords: 18,
      confirmedRecords: 18,
      openIssues: 0,
    });
    expect(events.filter((e) => e.type === "RECORD_TABULATED")).toHaveLength(
      18
    );
    expect(events.some((e) => e.type === "PACKET_DISPATCHED")).toBe(true);
  });

  it("replays with seed 48291 to identical record IDs and hashes", () => {
    const a = runTracer().engine;
    const b = runTracer().engine;
    expect(b.view().vsLedger.map((r) => r.recordId)).toEqual(
      a.view().vsLedger.map((r) => r.recordId)
    );
    expect(hashValue(b.view().vsLedger)).toBe(hashValue(a.view().vsLedger));
    expect(b.stateHash()).toBe(a.stateHash());
  });

  it("can continue after the wave review without further events", () => {
    const { engine } = runTracer();
    ok(engine, { type: "SET_PAUSED", isPaused: false });
    expect(engine.view().fsmState).toBe("RUNNING");
    engine.dispatch({ type: "TICK", realMs: 3000 });
    expect(engine.view().vsLedger).toHaveLength(18);
  });
});
