// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  EventQueue,
  EVENT_PRIORITY,
  FSM_TRANSITIONS,
  ProtocolDriftStateError,
  STEP_MINUTES,
  TRACER_GRAPH,
  accumulateRealTime,
  canTransition,
  clockAdvances,
  createProtocolDriftEngine,
  formatClock,
  isoToMinute,
  minuteAt,
  minuteToIso,
  transition,
  trialDayDate,
  trialDayOf,
} from "@/lib/protocol-drift";
import { ok, publish, startEngine } from "./helpers";

describe("deterministic clock", () => {
  it("starts at Day 0 08:00 (minute 0, 2025-11-01)", () => {
    const engine = createProtocolDriftEngine();
    const view = engine.view();
    expect(view.minute).toBe(0);
    expect(formatClock(0)).toBe("Day 0 08:00");
    expect(minuteToIso(0)).toBe("2025-11-01T08:00:00Z");
    expect(isoToMinute("2025-11-01T08:00:00Z")).toBe(0);
    expect(trialDayDate(22)).toBe("2025-11-23");
    expect(formatClock(minuteAt(14, 23, 59))).toBe("Day 14 23:59");
    expect(trialDayOf(minuteAt(14, 23, 59))).toBe(14);
    expect(() => isoToMinute("not a date")).toThrow(RangeError);
  });

  it("1x advances 60 sim minutes per real second; 2x and 5x scale proportionally", () => {
    expect(accumulateRealTime(0, 1000, 1)).toEqual({ minutes: 60, carry: 0 });
    expect(accumulateRealTime(0, 1000, 2)).toEqual({ minutes: 120, carry: 0 });
    expect(accumulateRealTime(0, 1000, 5)).toEqual({ minutes: 300, carry: 0 });
    // A split of the same real time yields the same total.
    const a = accumulateRealTime(0, 7, 1);
    const b = accumulateRealTime(a.carry, 9, 1);
    expect(a.minutes + b.minutes).toBe(accumulateRealTime(0, 16, 1).minutes);
    expect(() => accumulateRealTime(0, -1, 1)).toThrow(RangeError);
  });

  it("the step button advances exactly one sim hour while paused", () => {
    const engine = startEngine("tracer");
    publish(engine, TRACER_GRAPH, "p1");
    ok(engine, { type: "STEP_TICK" });
    expect(engine.view().minute).toBe(STEP_MINUTES);
    expect(engine.view().fsmState).toBe("PAUSED");
    ok(engine, { type: "STEP_TICK" });
    expect(engine.view().minute).toBe(120);
  });

  it("ticks at 2x and 5x process every scheduled minute without skipping", () => {
    const runs = ([1, 2, 5] as const).map((speed) => {
      const engine = startEngine("tracer");
      publish(engine, TRACER_GRAPH, "p1");
      ok(engine, { type: "SET_SPEED", speed });
      ok(engine, { type: "SET_PAUSED", isPaused: false });
      for (
        let i = 0;
        i < 2000 && engine.view().fsmState === "RUNNING";
        i += 1
      ) {
        engine.dispatch({ type: "TICK", realMs: 250 });
      }
      return engine.view();
    });
    for (const v of runs) {
      expect(v.fsmState).toBe("WAVE_REVIEW");
      expect(v.minute).toBe(minuteAt(14, 23, 59));
      expect(v.vsLedger).toHaveLength(18);
    }
    expect(runs[1].vsLedger).toEqual(runs[0].vsLedger);
    expect(runs[2].vsLedger).toEqual(runs[0].vsLedger);
  });

  it("ignores TICK unless running, and rejects backwards ADVANCE_TO", () => {
    const engine = startEngine("tracer");
    publish(engine, TRACER_GRAPH, "p1");
    engine.dispatch({ type: "TICK", realMs: 5000 });
    expect(engine.view().minute).toBe(0);
    ok(engine, { type: "ADVANCE_TO", minute: 30 });
    const events = engine.dispatch({ type: "ADVANCE_TO", minute: 10 });
    expect(events.some((e) => e.type === "COMMAND_REJECTED")).toBe(true);
  });
});

describe("state machine", () => {
  it("walks BRIEF to DRAFT to VALIDATE to DEPLOY_READY to PAUSED to RUNNING", () => {
    const engine = createProtocolDriftEngine({ scenario: "tracer" });
    const states: string[] = [engine.view().fsmState];
    ok(engine, { type: "ACCEPT_BRIEF" });
    states.push(engine.view().fsmState);
    ok(engine, { type: "LOAD_GRAPH", ...TRACER_GRAPH });
    states.push(engine.view().fsmState);
    ok(engine, { type: "VALIDATE_GRAPH", ...TRACER_GRAPH });
    states.push(engine.view().fsmState);
    ok(engine, { type: "PUBLISH_REVISION", revisionId: "p1", ...TRACER_GRAPH });
    states.push(engine.view().fsmState);
    ok(engine, { type: "SET_PAUSED", isPaused: false });
    states.push(engine.view().fsmState);
    expect(states).toEqual([
      "BRIEF",
      "DRAFT",
      "DRAFT",
      "DEPLOY_READY",
      "PAUSED",
      "RUNNING",
    ]);
    ok(engine, { type: "SET_PAUSED", isPaused: true });
    expect(engine.view().fsmState).toBe("PAUSED");
  });

  it("throws an explicit state error on illegal transitions", () => {
    expect(() => transition("DRAFT", "RUNNING")).toThrow(
      ProtocolDriftStateError
    );
    expect(() => transition("DRAFT", "RUNNING")).toThrow(
      "Illegal transition: DRAFT -> RUNNING"
    );
    expect(() => transition("LOCKED", "PAUSED")).toThrow(
      ProtocolDriftStateError
    );
    expect(transition("VALIDATE", "DEPLOY_READY")).toBe("DEPLOY_READY");
    expect(canTransition("RUNNING", "WAVE_REVIEW")).toBe(true);
    expect(FSM_TRANSITIONS.LOCKED).toEqual([]);
    expect(clockAdvances("RUNNING")).toBe(true);
    expect(clockAdvances("DRAFT")).toBe(false);
  });

  it("rejects running from DRAFT without validation and publication", () => {
    const engine = startEngine("tracer");
    const events = engine.dispatch({ type: "SET_PAUSED", isPaused: false });
    const rejected = events.find((e) => e.type === "COMMAND_REJECTED");
    expect(rejected).toBeDefined();
    expect(engine.view().fsmState).toBe("DRAFT");
    const step = engine.dispatch({ type: "STEP_TICK" });
    expect(step.some((e) => e.type === "COMMAND_REJECTED")).toBe(true);
  });

  it("refuses to publish a graph that changed after validation or reuses an id", () => {
    const engine = startEngine("tracer");
    ok(engine, { type: "VALIDATE_GRAPH", ...TRACER_GRAPH });
    const changed = {
      ...TRACER_GRAPH,
      nodes: TRACER_GRAPH.nodes.map((n) =>
        n.id === "sink" ? { ...n, position: { x: 800, y: 200 } } : n
      ),
    };
    const events = engine.dispatch({
      type: "PUBLISH_REVISION",
      revisionId: "p1",
      ...changed,
    });
    expect(events.some((e) => e.type === "COMMAND_REJECTED")).toBe(true);
    ok(engine, { type: "PUBLISH_REVISION", revisionId: "p1", ...TRACER_GRAPH });
    ok(engine, { type: "VALIDATE_GRAPH", ...TRACER_GRAPH });
    const again = engine.dispatch({
      type: "PUBLISH_REVISION",
      revisionId: "p1",
      ...TRACER_GRAPH,
    });
    expect(again.some((e) => e.type === "COMMAND_REJECTED")).toBe(true);
  });

  it("emits a STATE_SNAPSHOT after every command", () => {
    const engine = createProtocolDriftEngine();
    const events = engine.dispatch({ type: "ACCEPT_BRIEF" });
    const snap = events.at(-1);
    expect(snap?.type).toBe("STATE_SNAPSHOT");
    if (snap?.type === "STATE_SNAPSHOT") {
      expect(snap.clockLabel).toBe("Day 0 08:00");
      expect(snap.activeSites["SITE-B"].goodwill).toBe(35);
      expect(snap.isPaused).toBe(true);
    }
  });
});

describe("event queue tie-break order", () => {
  it("orders activations, visits, submissions, pipeline, query responses, reconciliation", () => {
    const q = new EventQueue();
    q.push(100, EVENT_PRIORITY.RECONCILIATION, "WAVE_END", "1");
    q.push(100, EVENT_PRIORITY.QUERY_RESPONSE, "QUERY_RESPONSE", "q");
    q.push(100, EVENT_PRIORITY.PIPELINE_PROCESSING, "PIPELINE_PROCESSING", "r");
    q.push(100, EVENT_PRIORITY.SOURCE_SUBMISSION, "SOURCE_SUBMISSION", "s");
    q.push(100, EVENT_PRIORITY.SCHEDULED_VISIT, "SCHEDULED_VISIT", "v");
    q.push(100, EVENT_PRIORITY.SITE_ACTIVATION, "SITE_ACTIVATION", "a");
    q.push(50, EVENT_PRIORITY.RECONCILIATION, "WAVE_END", "early");
    expect(q.size).toBe(7);
    expect(q.toArray().map((e) => e.ref)).toEqual([
      "early",
      "a",
      "v",
      "s",
      "r",
      "q",
      "1",
    ]);
    expect(q.peek()?.ref).toBe("early");
    expect(q.pop()?.ref).toBe("early");
    expect(q.size).toBe(6);
  });
});
