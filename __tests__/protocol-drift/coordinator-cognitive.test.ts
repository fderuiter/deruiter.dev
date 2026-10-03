// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ATTENTION_START,
  ENTRY_FIELD_SPECS,
  FULL_SUBMISSIONS,
  GOODWILL_RULES,
  SITE_PROFILES,
  baseFieldCost,
  clampGoodwill,
  fatigueErrorProbability,
  fieldCost,
  responseLatencyHours,
  rubberStampProbability,
  seededDraw,
  simulateEntrySession,
  transposeDigits,
  type SubmissionFixture,
} from "@/lib/protocol-drift";
import {
  ok,
  publish,
  runUntil,
  startEngine,
  WAVE_END_MINUTES,
} from "./helpers";
import { WAVE1_GRAPH } from "@/lib/protocol-drift";

describe("attention depletion", () => {
  it("prices fields with c_f = base + floor(max(0, options-1)/8) + nesting", () => {
    expect(baseFieldCost("numeric")).toBe(1);
    expect(baseFieldCost("date")).toBe(2);
    expect(baseFieldCost("freetext")).toBe(3);
    expect(baseFieldCost("dropdown")).toBe(1);
    expect(fieldCost({ key: "x", type: "dropdown", options: 9 })).toBe(2);
    expect(
      fieldCost({ key: "x", type: "dropdown", options: 17, nesting: 2 })
    ).toBe(5);
    expect(fieldCost({ key: "x", type: "numeric", options: 0 })).toBe(1);
    expect(fieldCost({ key: "x", type: "numeric", hardStop: true })).toBe(7);
    expect(fieldCost(ENTRY_FIELD_SPECS.MHTERM)).toBe(4);
  });

  it("starts each session at 100 and depletes per field entered", () => {
    const sub = FULL_SUBMISSIONS.find(
      (s) => s.submissionId === "sub-a01-d00"
    ) as SubmissionFixture;
    const session = simulateEntrySession([sub], 48291);
    expect(session.steps[0].attentionBefore).toBe(ATTENTION_START);
    expect(session.finalAttention).toBe(100 - 6);
    expect(session.entered.get("sub-a01-d00")).toEqual(sub.payload);
  });

  it("Site B's backlog session reaches A = 22 at B01 Day 14 SBP and transposes 120 to 210", () => {
    const backlog = FULL_SUBMISSIONS.filter(
      (s) => s.sessionId === "sess-b-wave1-backlog"
    );
    const session = simulateEntrySession(backlog, 48291);
    const step = session.steps.find(
      (s) => s.submissionId === "sub-b01-d14" && s.field === "sbp"
    );
    expect(step?.attentionBefore).toBe(22);
    expect(step?.errorProbability).toBeCloseTo(18 / 160, 10);
    expect(step?.transposed).toBe(true);
    expect(session.entered.get("sub-b01-d14")?.sbp).toBe(210);
    expect(session.entered.get("sub-b02-d14")?.sbp).toBe(124);
  });

  it("does not transpose when attention stays at or above 40", () => {
    const b01d14 = FULL_SUBMISSIONS.find(
      (s) => s.submissionId === "sub-b01-d14"
    ) as SubmissionFixture;
    const session = simulateEntrySession([b01d14], 48291);
    expect(session.entered.get("sub-b01-d14")?.sbp).toBe(120);
  });

  it("fatigue probability is 0 at A >= 40 and grows linearly to the 0.25 cap", () => {
    expect(fatigueErrorProbability(40)).toBe(0);
    expect(fatigueErrorProbability(100)).toBe(0);
    expect(fatigueErrorProbability(39)).toBeCloseTo(1 / 160, 10);
    expect(fatigueErrorProbability(22)).toBeCloseTo(0.1125, 10);
    expect(fatigueErrorProbability(0)).toBe(0.25);
    expect(transposeDigits(120)).toBe(210);
    expect(transposeDigits(7)).toBe(7);
  });
});

describe("goodwill and latency", () => {
  it("computes T_latency = ceil(base * (1 + (100 - G)/25))", () => {
    expect(responseLatencyHours(8, 35)).toBe(29);
    expect(responseLatencyHours(4, 85)).toBe(7);
    expect(responseLatencyHours(4, 70)).toBe(9);
    expect(responseLatencyHours(8, 34)).toBe(30);
  });

  it("rubber-stamps with p = (40 - G)/100 clamped to [0, 1]", () => {
    expect(rubberStampProbability(35)).toBeCloseTo(0.05, 10);
    expect(rubberStampProbability(85)).toBe(0);
    expect(rubberStampProbability(-100)).toBe(1);
    expect(clampGoodwill(120)).toBe(100);
    expect(clampGoodwill(-3)).toBe(0);
    expect(clampGoodwill(40, 35)).toBe(35);
    expect(GOODWILL_RULES).toEqual({
      distinctQuery: -1,
      duplicateQuery: -3,
      hardStop: -2,
      resolvedDiscrepancy: 1,
    });
    const d = seededDraw(48291, "SITE-B|x");
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThan(1);
    expect(seededDraw(48291, "SITE-B|x")).toBe(d);
  });

  it("erodes goodwill by 1 per distinct query and 3 per duplicate", () => {
    const engine = startEngine();
    publish(engine, WAVE1_GRAPH, "p1");
    runUntil(engine, WAVE_END_MINUTES[1]);
    ok(engine, { type: "SET_PAUSED", isPaused: true });
    const issue = engine
      .view()
      .issues.find((i) => i.submissionId === "sub-b01-d14");
    expect(issue).toBeDefined();
    ok(engine, {
      type: "DRAFT_QUERY",
      issueId: issue?.issueId as string,
      evidenceLinked: false,
    });
    ok(engine, { type: "SEND_QUERY", queryId: "qry-0001" });
    expect(engine.view().sites["SITE-B"].goodwill).toBe(34);
    expect(engine.view().queries[0].latencyHours).toBe(29);
    ok(engine, {
      type: "DRAFT_QUERY",
      issueId: issue?.issueId as string,
      evidenceLinked: false,
    });
    ok(engine, { type: "SEND_QUERY", queryId: "qry-0002" });
    const v = engine.view();
    expect(v.sites["SITE-B"].goodwill).toBe(31);
    expect(v.queries[1]).toMatchObject({
      duplicate: true,
      communicationState: "Closed",
      goodwillCost: -3,
    });
    expect(v.sites["SITE-B"].latencyHours).toBe(
      responseLatencyHours(SITE_PROFILES["SITE-B"].baseLatencyHours, 31)
    );
  });
});
