// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  ACT_III,
  CSR_LOCK_SCENARIO,
  CSR_ORDER,
  CsrStageSchema,
  LOCKED_ALERT,
  MILESTONE_WEIGHTS,
  RunActionSchema,
  ScenarioSchema,
  advanceRun,
  advanceTable,
  campaignScore,
  createRunState,
  createTableState,
  deriveRunView,
  deriveTableView,
  reconcilePackage,
  type CampaignRecord,
  type PackageEvidence,
  type RunState,
  type Scenario,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

const S = CSR_LOCK_SCENARIO;
const DISPOSITION = "C-T14.1.2";
const BASELINE = "C-T14.1.1";
const EFFICACY = "C-T14.2.1";
const SAE_CARRY_OVER = "C-T14.3.3-H";
const OVERVIEW = "C-T14.3.1-H";
const LISTING = "C-L16.2.7";
const PACKAGE = [DISPOSITION, BASELINE, EFFICACY, OVERVIEW, LISTING];

function act(
  state: TableState,
  action: TableAction,
  scenario: Scenario = S
): TableState {
  return advanceTable(scenario, state, action);
}

function selectAll(
  state: TableState,
  ids: readonly string[],
  scenario: Scenario = S
): TableState {
  let next = state;
  for (const id of next.selected) {
    next = act(next, { type: "TOGGLE_SELECT", cardId: id }, scenario);
  }
  for (const cardId of ids) {
    next = act(next, { type: "TOGGLE_SELECT", cardId }, scenario);
  }
  return next;
}

/** Inspects a draft card, reviews every cell and corrects every finding. */
function validateCard(
  state: TableState,
  cardId: string,
  { correct = true, cells = Infinity } = {},
  scenario: Scenario = S
): TableState {
  let next = act(state, { type: "INSPECT_CARD", cardId }, scenario);
  const grid = deriveTableView(scenario, next).inspection!.cells;
  let reviewed = 0;
  grid.forEach((row, r) =>
    row.forEach((_, c) => {
      if (reviewed++ >= cells) return;
      next = act(next, { type: "INSPECT_CELL", row: r, col: c }, scenario);
    })
  );
  if (correct) {
    for (const f of deriveTableView(scenario, next).inspection!.openFindings) {
      next = act(next, { type: "CORRECT_FINDING", findingId: f.id }, scenario);
    }
  }
  return act(next, { type: "CLOSE_INSPECT" }, scenario);
}

const evidence = (
  stage: PackageEvidence["csrStage"],
  over: Partial<PackageEvidence> = {}
): PackageEvidence => ({
  cardId: `card-${stage}`,
  name: `Table ${stage}`,
  csrStage: stage,
  stale: false,
  validation: null,
  openFindings: [],
  ...over,
});

const complete = () => CSR_ORDER.map((stage) => evidence(stage));

describe("package reconciliation (#922)", () => {
  it("reads the Straight order from CsrStageSchema", () => {
    expect(CSR_ORDER).toEqual(CsrStageSchema.options);
    expect(CSR_ORDER).toEqual([
      "DISPOSITION",
      "BASELINE",
      "EFFICACY",
      "SAFETY_AE",
      "PATIENT_LISTING",
    ]);
  });

  it("reconciles a complete, current, validated package in order", () => {
    const report = reconcilePackage(complete());
    expect(report.reconciled).toBe(true);
    expect(report.firstBreak).toBeNull();
    expect(report.slots.map((s) => s.status)).toEqual(
      CSR_ORDER.map(() => "OK")
    );
  });

  it("reports a missing slot", () => {
    const report = reconcilePackage(complete().slice(0, 3));
    expect(report.firstBreak?.stage).toBe("SAFETY_AE");
    expect(report.firstBreak?.status).toBe("MISSING");
    expect(report.firstBreak?.reason).toBe(
      "Safety AE slot: no output fills it."
    );
  });

  it("reports the first slot out of order, naming the output", () => {
    const outputs = complete();
    [outputs[1], outputs[2]] = [outputs[2], outputs[1]];
    const report = reconcilePackage(outputs);
    expect(report.firstBreak?.stage).toBe("BASELINE");
    expect(report.firstBreak?.status).toBe("OUT_OF_ORDER");
    expect(report.firstBreak?.reason).toBe(
      "Baseline slot: Table EFFICACY is an Efficacy output, out of order."
    );
    expect(report.slots[2].status).toBe("OUT_OF_ORDER");
  });

  it("reports an output without a CSR stage", () => {
    const outputs = complete();
    outputs[0] = evidence(undefined, { name: "Figure 14.2.4" });
    expect(reconcilePackage(outputs).firstBreak).toMatchObject({
      status: "NO_STAGE",
      reason: "Disposition slot: Figure 14.2.4 is not a CSR output.",
    });
  });

  it("pinpoints a stale, an unvalidated, a rulebook and an open finding", () => {
    const outputs = complete();
    outputs[1] = evidence("BASELINE", { stale: true });
    outputs[2] = evidence("EFFICACY", { validation: "inspect it." });
    outputs[3] = evidence("SAFETY_AE", {
      openFindings: [
        { category: "COUNT", evidence: "S-010 counted twice." },
        { category: "PRECISION", evidence: "16.7 prints 1 dp." },
      ],
    });
    outputs[4] = evidence("PATIENT_LISTING", {
      openFindings: [{ category: "COUNT", evidence: "S-010 counted twice." }],
    });
    const report = reconcilePackage(outputs);
    expect(report.slots.map((s) => s.status)).toEqual([
      "OK",
      "STALE",
      "UNVALIDATED",
      "RULEBOOK",
      "OPEN_FINDING",
    ]);
    expect(report.firstBreak?.stage).toBe("BASELINE");
    expect(report.slots[2].reason).toBe(
      "Efficacy slot: Table EFFICACY is unvalidated: inspect it."
    );
    // A rulebook mismatch outranks the other open findings on the output.
    expect(report.slots[3].reason).toBe(
      "Safety AE slot: Table SAFETY_AE does not follow the active SAP: 16.7 prints 1 dp."
    );
    expect(report.slots[4].reason).toBe(
      "Listing slot: Table PATIENT_LISTING has 1 open finding: S-010 counted twice."
    );
  });
});

describe("campaign score (#922)", () => {
  const record = (
    score: number,
    milestone: CampaignRecord["milestone"] = null
  ): CampaignRecord => ({
    scenarioId: `blind-${score}`,
    blindName: `Blind ${score}`,
    score,
    milestone,
    hoursToSpare: milestone === "FDA_IR" ? 20 : null,
  });

  it("adds every Blind's score, unweighted without milestones", () => {
    expect(campaignScore([record(1000), record(3000)])).toEqual({
      total: 4000,
      bonusPercent: 0,
      score: 4000,
    });
  });

  it("weights the total by the DMC defense and FDA IR resolved", () => {
    const final = campaignScore([
      record(1000, "DMC_DEFENSE"),
      record(2000, "FDA_IR"),
      record(1001),
    ]);
    expect(final.bonusPercent).toBe(
      MILESTONE_WEIGHTS.DMC_DEFENSE + MILESTONE_WEIGHTS.FDA_IR
    );
    expect(final).toEqual({ total: 4001, bonusPercent: 50, score: 6001 });
  });
});

describe("CSR Lock scenario (#922)", () => {
  it("parses, is Act III's only Boss, and deals every CSR stage", () => {
    expect(ScenarioSchema.safeParse(S).success).toBe(true);
    expect(S.encounter).toEqual({ kind: "CSR_LOCK", packageName: "CSR v2.0" });
    expect(ACT_III.bossPool).toEqual([S]);
    const stages = new Set(S.deck.map((c) => c.csrStage));
    for (const stage of CSR_ORDER) expect(stages.has(stage)).toBe(true);
  });

  it("refuses a CSR Lock deck that cannot fill every slot", () => {
    const deck = S.deck.filter((c) => c.csrStage !== "EFFICACY");
    const parsed = ScenarioSchema.safeParse({ ...S, deck });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toMatch(/missing EFFICACY/);
  });

  it("shows the five sequence slots on the boss intro", () => {
    expect(deriveTableView(S, createTableState(S)).bossIntro?.csrSlots).toEqual(
      ["Disposition", "Baseline", "Efficacy", "Safety AE", "Listing"]
    );
  });
});

describe("locking the package (#922)", () => {
  const start = createTableState(S);

  it("fills the slots in selection order and blocks an out-of-order Straight", () => {
    const state = selectAll(start, [
      BASELINE,
      DISPOSITION,
      EFFICACY,
      OVERVIEW,
      LISTING,
    ]);
    const view = deriveTableView(S, state);
    expect(view.classification?.handType).toBe("CSR_STRAIGHT");
    expect(view.csrLock?.report.slots.map((s) => s.cardId)).toEqual([
      BASELINE,
      DISPOSITION,
      EFFICACY,
      OVERVIEW,
      LISTING,
    ]);
    expect(view.playBlocker?.reason).toBe(
      "Disposition slot: Table 14.1.1 (Final) is a Baseline output, out of order."
    );
    expect(view.playBlocker?.fix).toBe("Select the Disposition output first");
    const refused = act(state, { type: "PLAY_HAND" });
    expect(refused.lastEvent?.kind).toBe("REFUSED");
    expect(refused.handsPlayed).toBe(0);
  });

  it("blocks an unvalidated output until every cell is reviewed", () => {
    let state = selectAll(start, PACKAGE);
    expect(deriveTableView(S, state).playBlocker).toMatchObject({
      reason:
        "Safety AE slot: Table 14.3.1 (Draft H) is unvalidated: inspect it.",
      fix: "Inspect Table 14.3.1",
      key: "I",
    });
    state = selectAll(validateCard(state, OVERVIEW, { cells: 3 }), PACKAGE);
    expect(deriveTableView(S, state).playBlocker?.reason).toMatch(
      /Safety AE slot: Table 14\.3\.1 \(Draft H\) is unvalidated: 3 of 15 cells reviewed; review every cell\./
    );
  });

  it("breaks on the carried-over SAE table's rulebook mismatch until corrected", () => {
    const withSae = [DISPOSITION, BASELINE, EFFICACY, SAE_CARRY_OVER, LISTING];
    let state = validateCard(start, SAE_CARRY_OVER, { correct: false });
    state = selectAll(state, withSae);
    const blocked = deriveTableView(S, state);
    expect(blocked.csrLock?.report.firstBreak?.status).toBe("RULEBOOK");
    expect(blocked.playBlocker?.reason).toMatch(
      /^Safety AE slot: Table 14\.3\.3 \(Draft H\) does not follow the active SAP: /
    );
    state = selectAll(validateCard(state, SAE_CARRY_OVER), withSae);
    expect(deriveTableView(S, state).csrLock?.report.reconciled).toBe(true);
  });

  it("blocks a lock that would leave the round short of the quota", () => {
    const high = { ...S, blind: { ...S.blind, quota: 100_000 } };
    const state = selectAll(
      validateCard(createTableState(high), OVERVIEW, {}, high),
      PACKAGE,
      high
    );
    const view = deriveTableView(high, state);
    expect(view.csrLock?.report.reconciled).toBe(true);
    expect(view.playBlocker?.reason).toMatch(
      /^The package would lock at \d+ of 100000: \d+ short\.$/
    );
  });

  it("accepts only a CSR Straight", () => {
    const state = selectAll(start, [LISTING]);
    const view = deriveTableView(S, state);
    expect(view.stageAccepts).toEqual(["CSR_STRAIGHT"]);
    expect(view.playBlocker?.reason).toBe(
      "CSR Lock accepts only a CSR Straight; this is High Table."
    );
    const refused = act(state, { type: "PLAY_HAND" });
    expect(refused.lastEvent?.kind).toBe("REFUSED");
    expect(refused.roundScore).toBe(0);
  });

  it("locks a reconciled Straight: a CSR release with an immutable audit summary", () => {
    let state = selectAll(validateCard(start, OVERVIEW), PACKAGE);
    const preview = deriveTableView(S, state).preview?.score;
    state = act(state, { type: "PLAY_HAND" });
    expect(state.status).toBe("CLEARED");
    // The table plays the lock's own cue, not a plain clear (#996).
    expect(deriveTableView(S, state).outcome).toBe("LOCKED");
    expect(state.lastEvent?.message).toMatch(
      /CSR v2\.0 LOCKED\. The CSR is released: final campaign score \d+\./
    );
    const lock = state.lock!;
    expect(lock.handScore).toBe(preview);
    expect(lock.roundScore).toBe(state.roundScore);
    expect(lock.outputs.map((o) => [o.stage, o.cardId])).toEqual(
      CSR_ORDER.map((stage, i) => [stage, PACKAGE[i]])
    );
    expect(lock.outputs.every((o) => o.rulebookId === S.rulebook.id)).toBe(
      true
    );
    expect(
      lock.outputs.every((o) => o.snapshotId === S.populationSnapshot.id)
    ).toBe(true);
    expect(lock.campaign).toEqual([
      {
        scenarioId: S.id,
        blindName: S.blind.name,
        score: state.roundScore,
        milestone: null,
        hoursToSpare: null,
      },
    ]);
    expect(lock.final.score).toBe(state.roundScore);
    const view = deriveTableView(S, state).csrLock!;
    expect(view.lock).not.toHaveProperty("before");
    expect(view.lock?.outputs).toEqual(lock.outputs);
  });

  it("weights the final score by the milestones the run resolved", () => {
    const campaign: CampaignRecord[] = [
      {
        scenarioId: "dmc-milestone-boss-blind",
        blindName: "Boss Blind: DMC Milestone Defense",
        score: 30000,
        milestone: "DMC_DEFENSE",
        hoursToSpare: null,
      },
      {
        scenarioId: "fda-information-request-boss-blind",
        blindName: "Boss Blind: FDA Information Request",
        score: 10000,
        milestone: "FDA_IR",
        hoursToSpare: 16,
      },
    ];
    let state = createTableState(S, undefined, {
      consumables: [],
      budget: 0,
      campaign,
    });
    state = act(selectAll(validateCard(state, OVERVIEW), PACKAGE), {
      type: "PLAY_HAND",
    });
    expect(state.lock?.final).toEqual({
      total: 40000 + state.roundScore,
      bonusPercent: 50,
      score: Math.floor(((40000 + state.roundScore) * 150) / 100),
    });
  });

  it("refuses every change to a locked package and names the amendment", () => {
    const locked = act(selectAll(validateCard(start, OVERVIEW), PACKAGE), {
      type: "PLAY_HAND",
    });
    for (const action of [
      { type: "INSPECT_CARD", cardId: locked.hand[0] },
      { type: "DISCARD" },
      { type: "TOGGLE_SELECT", cardId: locked.hand[0] },
    ] as TableAction[]) {
      const refused = act(locked, action);
      expect(refused.lastEvent?.kind).toBe("REFUSED");
      expect(refused.lastEvent?.message).toBe(LOCKED_ALERT);
      expect(refused.lock).toBe(locked.lock);
    }
  });

  it("files a protocol amendment: unlocks, withdraws the hand and invalidates the reviews", () => {
    const validated = validateCard(start, OVERVIEW);
    const locked = act(selectAll(validated, PACKAGE), { type: "PLAY_HAND" });
    expect(deriveTableView(S, locked).csrLock?.amendRefusal).toBeNull();
    const amended = act(locked, { type: "AMEND_PROTOCOL" });
    expect(amended.lastEvent?.kind).toBe("AMENDED");
    expect(amended.lastEvent?.message).toMatch(
      /^Protocol Amendment 1 filed: CSR v2\.0 is unlocked and the lock hand withdrawn\./
    );
    expect(amended.status).toBe("REVIEWING");
    expect(amended.lock).toBeNull();
    expect(amended.amendments).toBe(1);
    expect(amended.roundScore).toBe(0);
    expect(amended.handsPlayed).toBe(0);
    expect(amended.hand).toEqual(validated.hand);
    expect(amended.inspections[OVERVIEW]).toBeUndefined();
    // The amended package cannot lock until its outputs are validated again.
    const again = selectAll(amended, PACKAGE);
    expect(deriveTableView(S, again).csrLock?.report.firstBreak?.status).toBe(
      "UNVALIDATED"
    );
    const relocked = act(selectAll(validateCard(again, OVERVIEW), PACKAGE), {
      type: "PLAY_HAND",
    });
    expect(relocked.status).toBe("CLEARED");
    expect(relocked.lock?.amendment).toBe(1);
  });

  it("refuses an amendment with nothing locked, or without CPU to re-validate", () => {
    expect(act(start, { type: "AMEND_PROTOCOL" }).lastEvent?.message).toBe(
      "Nothing is locked: a protocol amendment amends a locked package."
    );
    const poor = validateCard(
      { ...start, cpu: { available: 3, spent: 0 } },
      OVERVIEW
    );
    const locked = act(selectAll(poor, PACKAGE), { type: "PLAY_HAND" });
    expect(locked.status).toBe("CLEARED");
    const refusal = deriveTableView(S, locked).csrLock?.amendRefusal;
    expect(refusal).toBe(
      "Re-validating the package needs 3 CPU (1 re-inspection and the lock hand); reopening leaves 2."
    );
    expect(act(locked, { type: "AMEND_PROTOCOL" }).lastEvent?.message).toBe(
      refusal
    );
  });

  it("records an amendment as a saved move", () => {
    expect(RunActionSchema.safeParse({ type: "AMEND_PROTOCOL" }).success).toBe(
      true
    );
  });
});

describe("CSR Lock in an Act III run (#922)", () => {
  function toBoss(seed: string): RunState {
    let run = createRunState(ACT_III, seed);
    while (deriveRunView(ACT_III, run).blind.id !== S.id) {
      const { blind } = deriveRunView(ACT_III, run);
      for (const action of playBlind(blind, run.table, "PERFECT").actions) {
        if (run.table.status !== "REVIEWING") break;
        if (action.type === "RESET") continue;
        run = advanceRun(ACT_III, run, action);
      }
      expect(run.table.status).toBe("CLEARED");
      run = advanceRun(ACT_III, run, { type: "NEXT_BLIND" });
    }
    return run;
  }

  it("ends the act on the lock, with every Blind in the campaign score", () => {
    let run = toBoss("alpha");
    expect(run.table.campaign.map((r) => r.scenarioId)).toEqual(
      ACT_III.blinds.map((b) => b.id)
    );
    for (const action of playBlind(S, run.table, "MEDIAN").actions) {
      if (run.table.status !== "REVIEWING") break;
      if (action.type === "RESET") continue;
      run = advanceRun(ACT_III, run, action);
    }
    const view = deriveRunView(ACT_III, run);
    expect(view.phase).toBe("RUN_WON");
    const lock = view.table.csrLock?.lock;
    expect(lock?.campaign.map((r) => r.scenarioId)).toEqual([
      ...ACT_III.blinds.map((b) => b.id),
      S.id,
    ]);
    expect(lock?.final.total).toBe(
      lock?.campaign.reduce((sum, r) => sum + r.score, 0)
    );
    // An amendment reopens the final Blind.
    const amended = advanceRun(ACT_III, run, { type: "AMEND_PROTOCOL" });
    expect(deriveRunView(ACT_III, amended).phase).toBe("PLAYING");
  });

  it("locks only for a player who validates", () => {
    const run = toBoss("e2e-4");
    for (const style of ["SLOPPY", "HASTY"] as const) {
      const { state } = playBlind(S, run.table, style);
      // Without validation no Straight ever reconciles, so none is played.
      expect(state.status, style).not.toBe("CLEARED");
      expect(state.lock, style).toBeNull();
      expect(state.handsPlayed, style).toBe(0);
    }
    expect(playBlind(S, run.table, "MEDIAN").state.lock).not.toBeNull();
  });
});
