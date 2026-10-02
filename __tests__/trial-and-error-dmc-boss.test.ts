// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DEMOGRAPHICS_SCENARIO,
  DMC_MILESTONE_SCENARIO,
  DMC_RELICS,
  ScenarioSchema,
  UNBLINDING_RULE_ID,
  advanceRun,
  advanceTable,
  carriedInventory,
  createRunState,
  createTableState,
  deriveTableView,
  type Act,
  type RunAction,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";

const scenario = DMC_MILESTONE_SCENARIO;
const run = (
  actions: TableAction[],
  from: TableState = createTableState(scenario)
) =>
  actions.reduce(
    (state, action) => advanceTable(scenario, state, action),
    from
  );
const view = (state: TableState) => deriveTableView(scenario, state);
const select = (...ids: string[]): TableAction[] =>
  ids.map((cardId) => ({ type: "TOGGLE_SELECT", cardId }));
const play = (...ids: string[]): TableAction[] => [
  ...select(...ids),
  { type: "PLAY_HAND" },
];

const BLINDED_TABLES = ["C-T14.3.1-D", "C-T14.3.3-D", "C-T14.3.2.5-D"];
const FIGURES = ["C-F14.3.3", "C-F14.3.1"];
const FULL_HOUSE = [...BLINDED_TABLES, ...FIGURES];

/** Stage 1: two supporting pairs, 240 + 210, defend the open report. */
const OPEN_REPORT: TableAction[] = [
  ...play("C-T14.1.1", "C-L16.2.4"),
  ...play("C-T14.1.2", "C-L16.1.1"),
];
const CONVENE: TableAction[] = [
  ...BLINDED_TABLES.map((cardId): TableAction => ({
    type: "STRUCTURAL_QC",
    cardId,
  })),
  { type: "SET_SESSION", session: "CLOSED" },
];
const inspect = (cardId: string, ...fixes: TableAction[]): TableAction[] => [
  { type: "INSPECT_CARD", cardId },
  ...fixes,
  { type: "CLOSE_INSPECT" },
];
/** Stage 2's review: every table validated, the SAE count and both KMs reconciled. */
const CLOSED_REVIEW: TableAction[] = [
  ...inspect("C-T14.3.1-D"),
  ...inspect(
    "C-T14.3.3-D",
    { type: "INSPECT_CELL", row: 4, col: 1 },
    { type: "CORRECT_FINDING", findingId: "DMC-SAF-04@r4c1" }
  ),
  ...inspect("C-T14.3.2.5-D"),
  ...inspect("C-F14.3.3", {
    type: "CORRECT_FINDING",
    findingId: "AT_RISK@PLACEBOt8",
  }),
  ...inspect("C-F14.3.1", {
    type: "CORRECT_FINDING",
    findingId: "CENSOR_TICK@ACTIVE",
  }),
];
const DEFENDED = [
  ...OPEN_REPORT,
  ...CONVENE,
  ...CLOSED_REVIEW,
  ...play(...FULL_HOUSE),
];

describe("DMC milestone Boss Blind", () => {
  it("is a valid scenario whose stage quotas sum to the Blind's", () => {
    expect(ScenarioSchema.parse(scenario)).toEqual(scenario);
    const stages = scenario.encounter!.stages;
    expect(stages.map((s) => s.session)).toEqual(["OPEN", "CLOSED"]);
    expect(stages[0].quota + stages[1].quota).toBe(scenario.blind.quota);
    expect(scenario.boss?.debuffType).toBe("BLIND_FIREWALL");
  });

  it("rejects an encounter without a DMC charter or with stages out of order", () => {
    const { dmc: _dmc, ...noCharter } = scenario;
    expect(ScenarioSchema.safeParse(noCharter).success).toBe(false);
    const [open, closed] = scenario.encounter!.stages;
    const reversed = {
      ...scenario,
      encounter: { ...scenario.encounter!, stages: [closed, open] },
    };
    expect(ScenarioSchema.safeParse(reversed).success).toBe(false);
  });

  it("opens in Stage 1 with the closed report face down", () => {
    const v = view(createTableState(scenario));
    expect(v.encounter).toMatchObject({
      current: 0,
      stages: [
        { status: "ACTIVE", score: 0 },
        { status: "PENDING", score: 0 },
      ],
    });
    const faceDown = v.hand.filter((h) => h.faceDown).map((h) => h.card.id);
    expect(faceDown).toEqual(
      expect.arrayContaining([...BLINDED_TABLES, "C-F14.3.3"])
    );
    expect(v.reward).toBeNull();
    expect(v.relics).toEqual([]);
  });

  it("leaks no closed-session value or KM record into the open-session view", () => {
    const serialized = JSON.stringify(view(createTableState(scenario)));
    expect(serialized).not.toContain("83.3");
    expect(serialized).not.toContain('"subjectId"');
  });

  it("refuses closed-session outputs in Stage 1", () => {
    const closedPair = run(play("C-T14.3.3-D", "C-L16.2.8"));
    expect(closedPair.lastEvent?.kind).toBe("REFUSED");
    expect(closedPair.lastEvent?.message).toMatch(
      /cannot be presented in the open session/
    );
    expect(closedPair.handsPlayed).toBe(0);
  });

  it("refuses to convene the closed session before Stage 1 is defended", () => {
    const early = run(CONVENE);
    expect(early.session).toBe("OPEN");
    expect(early.lastEvent?.message).toMatch(/^Premature unblinding/);
  });

  it("advances to Stage 2 when the open report meets its quota", () => {
    const state = run(OPEN_REPORT);
    expect(state.lastEvent?.message).toMatch(
      /Stage 1: Open report defended: convene the closed session for Stage 2: Closed report\.$/
    );
    expect(view(state).encounter).toMatchObject({
      current: 1,
      stages: [
        { status: "DEFENDED", score: 450 },
        { status: "ACTIVE", score: 0 },
      ],
    });
    const tooSoon = run(play("C-T14.3.3-D", "C-L16.2.8"), state);
    expect(tooSoon.lastEvent?.message).toMatch(
      /played in the closed session: convene it first/
    );
  });

  it("lifts the firewall in the closed session and keeps it closed", () => {
    const closed = run([...OPEN_REPORT, ...CONVENE]);
    expect(closed.session).toBe("CLOSED");
    const v = view(closed);
    expect(v.hand.some((h) => h.faceDown)).toBe(false);
    expect(v.firewall).toBeFalsy();
    const reopen = run([{ type: "SET_SESSION", session: "OPEN" }], closed);
    expect(reopen.session).toBe("CLOSED");
    expect(reopen.lastEvent?.message).toMatch(/closed session stays in force/);
  });

  it("accepts only an Efficacy Full House in Stage 2", () => {
    const closed = run([...OPEN_REPORT, ...CONVENE]);
    const pair = run(play("C-T14.3.3-D", "C-L16.2.8"), closed);
    expect(pair.lastEvent?.message).toMatch(
      /^Stage 2: Closed report accepts Efficacy Full House/
    );
  });

  it("plays an accepted pair from a selection the stage would refuse as Two Pair", () => {
    // Two supporting pairs make a TLF Two Pair, which Stage 1 does not
    // accept; the TLF Pair inside the selection is played instead (#1077).
    // The second pair's Listing is dealt later, so the hand is set here.
    const pairs = ["C-T14.1.1", "C-L16.2.4", "C-T14.1.2", "C-L16.1.1"];
    const start = createTableState(scenario);
    const selected = run(select(...pairs), {
      ...start,
      hand: [...pairs, ...start.hand.filter((id) => !pairs.includes(id))],
    });
    expect(selected.selected).toEqual(pairs);
    const v = view(selected);
    expect(v.stageAccepts).toEqual([
      "HIGH_TABLE",
      "TLF_PAIR",
      "POPULATION_FLUSH",
    ]);
    expect(v.classification?.handType).toBe("TLF_PAIR");
    const played = run([{ type: "PLAY_HAND" }], selected);
    expect(played.lastEvent?.kind).not.toBe("REFUSED");
    expect(played.lastPlay?.evaluation).toEqual(v.preview);
    expect(played.lastPlay?.evaluation.handType).toBe("TLF_PAIR");
  });

  it("classifies Stage 2's mixed selection as the Full House and names what a refused one is", () => {
    const closed = run([...OPEN_REPORT, ...CONVENE]);
    const v = view(run(select(...FULL_HOUSE), closed));
    expect(v.stageAccepts).toEqual(["EFFICACY_FULL_HOUSE"]);
    expect(v.classification?.handType).toBe("EFFICACY_FULL_HOUSE");
    const pair = run(play("C-T14.3.3-D", "C-L16.2.8"), closed);
    expect(pair.lastEvent?.message).toBe(
      "Stage 2: Closed report accepts Efficacy Full House; this is TLF Pair."
    );
  });

  it("names no accepted hands outside a staged encounter or once it is defended", () => {
    expect(
      deriveTableView(
        DEMOGRAPHICS_SCENARIO,
        createTableState(DEMOGRAPHICS_SCENARIO)
      ).stageAccepts
    ).toBeNull();
    expect(view(run(DEFENDED)).stageAccepts).toBeNull();
  });

  it("is not cleared by an unreconciled closed report", () => {
    const sloppy = run([...OPEN_REPORT, ...CONVENE, ...play(...FULL_HOUSE)]);
    expect(sloppy.status).not.toBe("CLEARED");
    expect(view(sloppy).encounter?.stages[1].status).toBe("ACTIVE");
  });

  it("is defended by a reconciled Full House and offers the SOP relics", () => {
    const state = run(DEFENDED);
    expect(state.status).toBe("CLEARED");
    expect(state.lastEvent?.message).toMatch(
      /DMC Milestone Review defended\. Choose an SOP relic\.$/
    );
    expect(view(state).reward).toEqual({ choices: DMC_RELICS, claimed: null });
  });

  it("claims exactly one relic, and carries it forward", () => {
    const cleared = run(DEFENDED);
    const early = run(
      [{ type: "CLAIM_RELIC", relicId: "SOP-STAT-03" }],
      run(OPEN_REPORT)
    );
    expect(early.lastEvent?.kind).toBe("REFUSED");
    const claimed = run(
      [{ type: "CLAIM_RELIC", relicId: "SOP-STAT-03" }],
      cleared
    );
    expect(claimed.relics.map((r) => r.id)).toEqual(["SOP-STAT-03"]);
    expect(view(claimed).reward?.claimed).toBe("SOP-STAT-03");
    const twice = run([{ type: "CLAIM_RELIC", relicId: "SOP-QC-12" }], claimed);
    expect(twice.lastEvent?.kind).toBe("REFUSED");
    expect(twice.relics).toHaveLength(1);
    expect(carriedInventory(claimed).relics?.map((r) => r.id)).toEqual([
      "SOP-STAT-03",
    ]);
  });

  it("scores a carried relic on every later hand", () => {
    const relic = DMC_RELICS.find((r) => r.id === "SOP-DMC-07")!;
    const plain = createTableState(DEMOGRAPHICS_SCENARIO);
    const equipped = createTableState(DEMOGRAPHICS_SCENARIO, undefined, {
      ...carriedInventory(plain),
      relics: [relic],
    });
    const cardId = DEMOGRAPHICS_SCENARIO.deck[0].id;
    const preview = (s: TableState) =>
      deriveTableView(
        DEMOGRAPHICS_SCENARIO,
        advanceTable(DEMOGRAPHICS_SCENARIO, s, {
          type: "TOGGLE_SELECT",
          cardId,
        })
      ).preview!;
    expect(preview(equipped).mult.relics).toBe(4);
    expect(preview(equipped).score).toBeGreaterThan(preview(plain).score);
  });

  it("zeroes the next hand after a peek in the open session", () => {
    const peeked = run([{ type: "PEEK_BLINDED", cardId: "C-T14.3.3-D" }]);
    const played = run(play("C-T14.1.1", "C-L16.2.4"), peeked);
    expect(played.roundScore).toBe(0);
    expect(played.lastPlay?.evaluation.zeroRule.ruleIds).toContain(
      UNBLINDING_RULE_ID
    );
  });

  it("holds the run on the Boss until a relic is chosen", () => {
    const act: Act = {
      id: "dmc-test-act",
      title: "DMC test act",
      blinds: [scenario, DEMOGRAPHICS_SCENARIO],
    };
    const cleared = (DEFENDED as RunAction[]).reduce(
      (r, a) => advanceRun(act, r, a),
      createRunState(act)
    );
    expect(cleared.table.status).toBe("CLEARED");
    const held = advanceRun(act, cleared, { type: "NEXT_BLIND" });
    expect(held.table.lastEvent?.message).toBe("Choose an SOP relic first.");
    const next = advanceRun(
      act,
      advanceRun(act, cleared, { type: "CLAIM_RELIC", relicId: "SOP-QC-12" }),
      { type: "NEXT_BLIND" }
    );
    expect(next.blindIndex).toBe(1);
    expect(next.table.relics.map((r) => r.id)).toEqual(["SOP-QC-12"]);
  });

  it("is deterministic", () => {
    expect(run(DEFENDED)).toEqual(run(DEFENDED));
  });
});
