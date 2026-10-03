// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  computeDriftGauge,
  objectiveFor,
} from "@/components/protocol-drift/drift-gauge";
import {
  FULL_GRAPH,
  WAVE1_GRAPH,
  minuteAt,
  type ProtocolDriftView,
} from "@/lib/protocol-drift";
import { publish, runUntil, startEngine } from "./helpers";

function segment(view: ProtocolDriftView, id: string) {
  return computeDriftGauge(view).segments.find((s) => s.id === id)!;
}

describe("Operational Drift gauge", () => {
  it("is the worst segment, never an average", () => {
    const engine = startEngine();
    const gauge = computeDriftGauge(engine.view());
    const ranks = { green: 0, amber: 1, red: 2 } as const;
    const worst = Math.max(...gauge.segments.map((s) => ranks[s.severity]));
    expect(ranks[gauge.overall]).toBe(worst);
  });

  it("flags Site B's low starting goodwill as site strain, not wrong data", () => {
    const seg = segment(startEngine().view(), "site-strain");
    expect(seg.severity).toBe("amber");
    expect(seg.detail).toMatch(/not proof of a wrong value/);
  });

  it("goes amber on an unresolved issue and green when none remain", () => {
    expect(segment(startEngine().view(), "queue").severity).toBe("green");
    const engine = startEngine();
    publish(engine, WAVE1_GRAPH, "p1");
    runUntil(engine, minuteAt(2, 12, 0));
    const open = segment(engine.view(), "queue");
    expect(open.severity).toBe("amber");
  });

  it("marks version exposure red when a site runs v2 without a router", () => {
    const engine = startEngine();
    publish(engine, WAVE1_GRAPH, "p1");
    runUntil(engine, minuteAt(22, 12, 0));
    expect(segment(engine.view(), "version-exposure").severity).toBe("red");
  });

  it("stays out of the red once a router is deployed", () => {
    const engine = startEngine();
    publish(engine, WAVE1_GRAPH, "p1");
    runUntil(engine, minuteAt(20, 8, 0));
    publish(engine, FULL_GRAPH, "p2");
    runUntil(engine, minuteAt(22, 12, 0));
    expect(segment(engine.view(), "version-exposure").severity).not.toBe("red");
  });

  it("states the objective for the scenario and wave", () => {
    expect(objectiveFor(startEngine("tracer").view())).toBe(
      "Wave 1: Establish baseline vitals ingestion for Site A"
    );
    expect(objectiveFor(startEngine("full").view())).toMatch(/^Wave 1:/);
  });
});
