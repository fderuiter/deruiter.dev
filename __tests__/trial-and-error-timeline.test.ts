// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DEMOGRAPHICS_SCENARIO,
  advanceTable,
  createTableState,
  deriveTableView,
  evaluateHand,
  scoreTimeline,
  type HandInput,
  type TableAction,
  type TimelineStep,
} from "@/lib/trial-and-error";

const context = { roundScoreBefore: 0, target: 300 };
const kinds = (steps: TimelineStep[]) => steps.map((s) => s.kind);
const last = (steps: TimelineStep[]) => steps[steps.length - 1];
const byKind = <K extends TimelineStep["kind"]>(
  steps: TimelineStep[],
  kind: K
) =>
  steps.filter((s): s is Extract<TimelineStep, { kind: K }> => s.kind === kind);

describe("scoreTimeline", () => {
  it("narrates a bare hand: base, each card, total, progress", () => {
    const evaluation = evaluateHand({
      handType: "TLF_PAIR",
      cards: [
        { id: "T", chips: 30, mult: 1 },
        { id: "L", chips: 20, mult: 0 },
      ],
      ruleResults: [],
    });
    const steps = scoreTimeline(evaluation, {
      ...context,
      cardNames: { T: "Table 14.1.1" },
    });
    expect(kinds(steps)).toEqual([
      "HAND_BASE",
      "CARD_SCORED",
      "CARD_SCORED",
      "TOTAL",
      "BLIND_PROGRESS",
    ]);
    expect(steps[0]).toMatchObject({
      handType: "TLF_PAIR",
      level: 1,
      chips: 30,
      mult: 2,
      text: "TLF Pair Lv.1: 30 Chips, +2 Mult.",
    });
    expect(steps[1]).toMatchObject({
      cardId: "T",
      chips: 30,
      mult: 1,
      retrigger: 0,
      text: "Table 14.1.1: +30 Chips, +1 Mult.",
    });
    expect(steps[2]).toMatchObject({ cardId: "L", text: "L: +20 Chips." });
    expect(steps[3]).toMatchObject({ chips: 80, mult: 3, score: 240 });
    expect(steps[3].running).toEqual({ chips: 80, mult: 3, xMult: 1 });
    expect(last(steps)).toMatchObject({
      before: 0,
      after: 240,
      target: 300,
      crossed: false,
      text: "Round 240 of 300.",
    });
  });

  it("narrates rule results, relics and ×Mult in phase order", () => {
    const input: HandInput = {
      handType: "HIGH_TABLE",
      cards: [{ id: "T", chips: 30, mult: 1 }],
      ruleResults: [
        {
          ruleId: "R-CHIPS",
          passed: true,
          chipsDelta: 12,
          multDelta: 0,
          evidence: "12 records reconcile.",
        },
        {
          ruleId: "R-RED",
          passed: false,
          chipsDelta: 0,
          multDelta: -1,
          evidence: "Precision slip.",
        },
        {
          ruleId: "R-NOOP",
          passed: true,
          chipsDelta: 0,
          multDelta: 0,
          evidence: "Clean.",
        },
        {
          ruleId: "R-SYN",
          passed: true,
          chipsDelta: 0,
          multDelta: 0,
          multMultiplier: 2,
          evidence: "Synergy.",
        },
      ],
      modifiers: [
        {
          sourceId: "RELIC-A",
          label: "Macro",
          chips: 10,
          plusMult: 4,
          xMult: 1.5,
        },
        {
          sourceId: "RELIC-B",
          label: "Inert",
          chips: 0,
          plusMult: 0,
          xMult: 1,
        },
      ],
    };
    const evaluation = evaluateHand(input);
    const steps = scoreTimeline(evaluation, {
      roundScoreBefore: 250,
      target: 300,
    });
    expect(kinds(steps)).toEqual([
      "HAND_BASE",
      "CARD_SCORED",
      "RULE",
      "RULE",
      "RELIC",
      "RELIC",
      "X_MULT",
      "X_MULT",
      "TOTAL",
      "BLIND_PROGRESS",
    ]);
    expect(byKind(steps, "RULE").map((s) => s.text)).toEqual([
      "R-CHIPS: +12 Chips. 12 records reconcile.",
      "R-RED: -1 Mult. Precision slip.",
    ]);
    expect(byKind(steps, "RELIC")).toEqual([
      expect.objectContaining({
        relicId: "RELIC-A",
        chips: 10,
        mult: 4,
        xMult: 1.5,
        text: "RELIC-A: +10 Chips, +4 Mult, ×1.5 Mult.",
      }),
      expect.objectContaining({
        relicId: "RELIC-B",
        text: "RELIC-B: no effect.",
      }),
    ]);
    // A relic's ×1 is no factor, so it plays no X_MULT step.
    expect(byKind(steps, "X_MULT").map((s) => s.factor)).toEqual([2, 1.5]);
    const total = byKind(steps, "TOTAL")[0];
    expect(total).toMatchObject({
      chips: evaluation.chips.total,
      mult: evaluation.finalMult,
      score: evaluation.score,
    });
    expect(total.running.xMult).toBe(evaluation.xMult.product);
    expect(last(steps)).toMatchObject({
      crossed: true,
      text: expect.stringContaining("Blind cleared"),
    });
  });

  it("slams the zero-score rule once with a readable label", () => {
    const evaluation = evaluateHand({
      handType: "HIGH_TABLE",
      cards: [{ id: "T", chips: 30, mult: 1 }],
      ruleResults: [
        {
          ruleId: "SAP-DM-01",
          passed: false,
          chipsDelta: 0,
          multDelta: 0,
          multMultiplier: 0,
          evidence: "FAS N used.",
        },
        {
          ruleId: "SAP-DM-01",
          passed: false,
          chipsDelta: 0,
          multDelta: 0,
          multMultiplier: 0,
          evidence: "FAS N again.",
        },
      ],
    });
    const steps = scoreTimeline(evaluation, {
      ...context,
      zeroRuleLabels: { "SAP-DM-01": "DENOMINATOR ERROR" },
    });
    expect(kinds(steps)).toEqual([
      "HAND_BASE",
      "CARD_SCORED",
      "ZERO_RULE",
      "TOTAL",
      "BLIND_PROGRESS",
    ]);
    expect(byKind(steps, "ZERO_RULE")[0]).toMatchObject({
      label: "DENOMINATOR ERROR",
      text: "DENOMINATOR ERROR ×0: 2 fatal findings under SAP-DM-01. FAS N used.",
    });
    expect(byKind(steps, "TOTAL")[0]).toMatchObject({ score: 0, mult: 0 });
    expect(byKind(steps, "TOTAL")[0].running.xMult).toBe(0);

    const generic = scoreTimeline(evaluation, context);
    expect(byKind(generic, "ZERO_RULE")[0].label).toBe("ZERO-SCORE RULE");
  });

  it("does not claim a crossing when the round was already past the target", () => {
    const evaluation = evaluateHand({
      handType: "HIGH_TABLE",
      cards: [{ id: "T", chips: 30, mult: 1 }],
      ruleResults: [],
    });
    expect(
      last(scoreTimeline(evaluation, { roundScoreBefore: 400, target: 300 }))
    ).toMatchObject({ crossed: false });
  });

  it("is deterministic", () => {
    const evaluation = evaluateHand({
      handType: "HIGH_TABLE",
      cards: [{ id: "T", chips: 30, mult: 1 }],
      ruleResults: [],
    });
    expect(scoreTimeline(evaluation, context)).toEqual(
      scoreTimeline(evaluation, context)
    );
  });

  it("is exposed for the last hand played on the Card Table, with rulebook zero labels", () => {
    const actions: TableAction[] = [
      { type: "TOGGLE_SELECT", cardId: "C-T14.1.1-A" },
      { type: "TOGGLE_SELECT", cardId: "C-L16.2.4" },
      { type: "PLAY_HAND" },
    ];
    const start = createTableState(DEMOGRAPHICS_SCENARIO);
    expect(
      deriveTableView(DEMOGRAPHICS_SCENARIO, start).lastTimeline
    ).toBeNull();
    const state = actions.reduce(
      (s, a) => advanceTable(DEMOGRAPHICS_SCENARIO, s, a),
      start
    );
    const steps = deriveTableView(DEMOGRAPHICS_SCENARIO, state).lastTimeline!;
    expect(byKind(steps, "ZERO_RULE")[0].label).toBe("DENOMINATOR ERROR");
    expect(byKind(steps, "CARD_SCORED").map((s) => s.text)).toEqual([
      "Table 14.1.1: +30 Chips, +1 Mult.",
      "Listing 16.2.4: +20 Chips.",
    ]);
    expect(last(steps)).toMatchObject({ before: 0, after: 0, target: 450 });
  });
});
