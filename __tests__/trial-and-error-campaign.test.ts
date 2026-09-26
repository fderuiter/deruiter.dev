import { describe, it, expect, beforeAll } from "vitest";
import {
  ACT_I,
  ACT_II,
  ACT_II_CRISES,
  ACT_III,
  BIOSTAT_OPS_CAMPAIGN,
  CSR_LOCK_SCENARIO,
  CampaignSchema,
  DMC_MILESTONE_SCENARIO,
  DMC_RELICS,
  DOSE_ESCALATION_SCENARIO,
  FDA_IR_SCENARIO,
  PHASE_II_QC_SCENARIO,
  BLINDED_DATA_REVIEW_SCENARIO,
  advanceRun,
  createRunState,
  deriveRunView,
  drawInt,
  parseRunSave,
  planActs,
  replayRun,
  serializeRun,
  type LoggedAction,
  type RunState,
} from "@/lib/trial-and-error";
import { playBlind, type BotStyle } from "./utils/trial-and-error-bot";

const C = BIOSTAT_OPS_CAMPAIGN;
const DMC_RELIC = DMC_RELICS[0].id;

/** A run whose current Blind is marked cleared, without playing it. */
const cleared = (run: RunState): RunState => ({
  ...run,
  table: { ...run.table, status: "CLEARED", rewardClaimed: "claimed" },
});

/** Clears Blinds without playing them until the run reaches `actIndex`. */
function skipTo(seed: string, actIndex: number): RunState {
  let run = createRunState(C, seed);
  while (run.actIndex < actIndex) {
    run = advanceRun(C, cleared(run), { type: "NEXT_BLIND" });
  }
  return run;
}

/** The Act II Boss a campaign seed draws as Act II starts. */
const actTwoBoss = (seed: string) => skipTo(seed, 1).bossIds[1];

interface Played {
  run: RunState;
  /** Every move, as a save would log it. */
  actions: LoggedAction[];
  /** The Blinds reached, in order. */
  path: string[];
}

/**
 * Plays the campaign with the balance bot, Blind after Blind: it claims the
 * first relic a defended DMC offers and skips the shop. It stops when a
 * Blind fails or the run is won.
 */
function playCampaign(seed: string, style: BotStyle): Played {
  let run = createRunState(C, seed);
  const actions: LoggedAction[] = [];
  const path: string[] = [];
  const act = (action: LoggedAction) => {
    actions.push(action);
    run = advanceRun(C, run, action);
  };
  for (;;) {
    const view = deriveRunView(C, run);
    path.push(view.blind.id);
    for (const action of playBlind(view.blind, run.table, style).actions) {
      if (run.table.status !== "REVIEWING") break;
      if (action.type === "RESET") continue;
      act(action);
    }
    const after = deriveRunView(C, run);
    if (after.phase !== "BLIND_CLEARED") return { run, actions, path };
    const reward = after.table.reward;
    if (reward && reward.claimed === null) {
      act({ type: "CLAIM_RELIC", relicId: reward.choices[0].id });
    }
    act({ type: "NEXT_BLIND" });
  }
}

describe("the campaign (#924)", () => {
  it("parses, and links Acts I, II and III in order", () => {
    expect(CampaignSchema.safeParse(C).success).toBe(true);
    expect(planActs(C)).toEqual([ACT_I, ACT_II, ACT_III]);
    expect(planActs(ACT_II)).toEqual([ACT_II]);
    expect(ACT_I.bossPool).toEqual([DOSE_ESCALATION_SCENARIO]);
    expect(ACT_II.bossPool).toContain(DMC_MILESTONE_SCENARIO);
    expect(ACT_III.bossPool).toEqual([CSR_LOCK_SCENARIO]);
  });

  it("refuses repeated acts and a Blind shared between acts", () => {
    const twice = CampaignSchema.safeParse({ ...C, acts: [ACT_I, ACT_I] });
    expect(twice.success).toBe(false);
    expect(twice.error?.issues.map((i) => i.message)).toContain(
      "Act ids must be unique"
    );
    const shared = CampaignSchema.safeParse({
      ...C,
      acts: [ACT_I, { ...ACT_II, id: "act-2-copy", blinds: ACT_I.blinds }],
    });
    expect(shared.success).toBe(false);
    expect(shared.error?.issues.map((i) => i.message)).toContain(
      `Blind ${ACT_I.blinds[0].id} appears in more than one act`
    );
  });

  it("plays Act I exactly as the act does on its own", () => {
    for (const seed of ["fold-change", "e2e-4", "alpha"]) {
      const alone = createRunState(ACT_I, seed);
      const campaign = createRunState(C, seed);
      expect(campaign).toEqual({ ...alone, actId: C.id });
      const act = advanceRun(ACT_I, cleared(alone), { type: "NEXT_BLIND" });
      const run = advanceRun(C, cleared(campaign), { type: "NEXT_BLIND" });
      expect(run.table).toEqual(act.table);
      expect(run.draws).toEqual(act.draws);
      expect(deriveRunView(C, run).act).toEqual({
        id: ACT_I.id,
        title: ACT_I.title,
        index: 0,
        count: 3,
        round: null,
      });
    }
  });
});

describe("moving to the next act (#924)", () => {
  const SEED = "alpha";
  let boss: RunState;
  let shopped: RunState;
  let next: RunState;

  beforeAll(() => {
    // Act I's Boss, cleared, with a relic, a level, budget and a site.
    let run = createRunState(C, SEED);
    run = advanceRun(C, cleared(run), { type: "NEXT_BLIND" });
    run = advanceRun(C, cleared(run), { type: "NEXT_BLIND" });
    const relic = ACT_I.shop!.entries.find((e) => e.kind === "RELIC")!;
    const site = ACT_I.shop!.sites[0];
    boss = cleared({
      ...run,
      table: {
        ...run.table,
        budget: 9,
        relics: relic.kind === "RELIC" ? [relic.relic] : [],
        handLevels: {
          ...run.table.handLevels,
          TLF_PAIR: { level: 3, playedCount: 0 },
        },
        sites: [site],
        campaign: [
          {
            scenarioId: "earlier",
            blindName: "Earlier",
            score: 100,
            milestone: null,
            hoursToSpare: null,
          },
        ],
      },
    });
    shopped = advanceRun(C, boss, { type: "CASH_OUT" });
    next = advanceRun(C, shopped, { type: "NEXT_BLIND" });
  });

  it("names the next study on the cleared Boss", () => {
    const view = deriveRunView(C, boss);
    expect(view.blind.id).toBe(DOSE_ESCALATION_SCENARIO.id);
    expect(view.phase).toBe("BLIND_CLEARED");
    expect(view.isFinalBlind).toBe(false);
    expect(view.nextBlind?.id).toBe(PHASE_II_QC_SCENARIO.id);
    expect(view.nextAct).toEqual({
      id: ACT_II.id,
      title: ACT_II.title,
      index: 1,
      count: 3,
      round: null,
    });
    expect(view.pendingCashOut).not.toBeNull();
  });

  it("opens the shop between acts, with no sites to enroll yet", () => {
    const view = deriveRunView(C, shopped);
    expect(view.phase).toBe("SHOP");
    expect(shopped.shop?.packs.length).toBeGreaterThan(0);
    expect(
      shopped.shop?.packs.every((p) => p.pack.kind !== "SITE_ACTIVATION")
    ).toBe(true);
    // Within an act the site packs still stock.
    const withinAct = advanceRun(C, cleared(createRunState(C, SEED)), {
      type: "CASH_OUT",
    });
    const kinds = new Set(ACT_I.shop!.packs.map((p) => p.kind));
    expect(kinds.has("SITE_ACTIVATION")).toBe(true);
    expect(withinAct.shop?.packs.length).toBeGreaterThan(0);
  });

  it("starts a new study: its subjects, snapshots, SAP and outputs", () => {
    expect(next).toMatchObject({ actIndex: 1, blindIndex: 0 });
    expect(next.table.scenarioId).toBe(PHASE_II_QC_SCENARIO.id);
    expect(next.table.snapshots).toEqual([
      PHASE_II_QC_SCENARIO.populationSnapshot,
    ]);
    expect(next.table.invalidations).toEqual([]);
    // Act II's SAP is its own.
    expect(PHASE_II_QC_SCENARIO.rulebook.id).not.toBe(
      DOSE_ESCALATION_SCENARIO.rulebook.id
    );
    const act2Deck = new Set(PHASE_II_QC_SCENARIO.deck.map((c) => c.id));
    expect(next.table.hand.every((id) => act2Deck.has(id))).toBe(true);
    expect(next.table.crisis).toBeNull();
    expect(next.table.lastEvent?.kind).toBe("ACT_STARTED");
    expect(next.table.lastEvent?.message).toContain(
      `${ACT_II.title}. A new study`
    );
  });

  it("carries relics, hand levels, budget and cleared Blinds; closes the sites", () => {
    expect(next.table.relics).toEqual(boss.table.relics);
    expect(next.table.handLevels.TLF_PAIR.level).toBe(3);
    expect(next.table.budget).toBe(shopped.table.budget);
    expect(next.table.budget).toBeGreaterThan(9);
    expect(next.table.campaign).toEqual(boss.table.campaign);
    expect(next.table.sites).toEqual([]);
    expect(next.table.enrollments).toEqual([]);
  });

  it("draws Act II's Boss as the study starts, and shows it on the act card", () => {
    const pool = ACT_II.bossPool!;
    const drawn = pool[drawInt(SEED, shopped.drawIndex, pool.length)].id;
    expect(next.bossIds).toEqual([DOSE_ESCALATION_SCENARIO.id, drawn]);
    expect(next.draws.at(-1)).toEqual({
      drawIndex: shopped.drawIndex,
      kind: "BOSS",
      id: drawn,
      actIndex: 1,
      blindIndex: 2,
    });
    const view = deriveRunView(C, next);
    expect(view.act).toEqual({
      id: ACT_II.id,
      title: ACT_II.title,
      index: 1,
      count: 3,
      round: null,
    });
    const boss2 = pool.find((b) => b.id === drawn)!;
    expect(view.actIntro).toEqual({
      act: view.act,
      bossTitle: boss2.title,
      bossIntro: boss2.intro,
      reset: expect.arrayContaining(["The SAP rulebook"]),
      kept: expect.arrayContaining(["SOP relics", "Hand levels"]),
    });
  });

  it("draws the act's crises for its later Blinds, and drops the act card once play starts", () => {
    const view = deriveRunView(C, next);
    expect(view.actIntro).not.toBeNull();
    const big = advanceRun(C, cleared(next), { type: "NEXT_BLIND" });
    expect(ACT_II_CRISES.map((c) => c.id)).toContain(big.table.crisis?.id);
    expect(big.draws.at(-1)).toMatchObject({
      kind: "CRISIS",
      actIndex: 1,
      blindIndex: 1,
    });
    expect(deriveRunView(C, big).actIntro).toBeNull();
    const discarded = advanceRun(
      C,
      advanceRun(C, next, {
        type: "TOGGLE_SELECT",
        cardId: next.table.hand[0],
      }),
      { type: "DISCARD" }
    );
    expect(deriveRunView(C, discarded).actIntro).toBeNull();
  });

  it("names new tray items by the run's Blind number, so ids never repeat across acts", () => {
    const within = advanceRun(C, cleared(createRunState(C, SEED)), {
      type: "CASH_OUT",
    });
    const slot = within.shop!.slots.findIndex((s) => s.entry.kind !== "RELIC");
    const bought = advanceRun(
      C,
      { ...within, table: { ...within.table, budget: 99, consumables: [] } },
      { type: "BUY", slot }
    );
    expect(bought.table.consumables.at(-1)?.id).toMatch(/@shop-0-0$/);
    const between = shopped.shop!.slots.findIndex(
      (s) => s.entry.kind !== "RELIC"
    );
    const later = advanceRun(
      C,
      { ...shopped, table: { ...shopped.table, budget: 99, consumables: [] } },
      { type: "BUY", slot: between }
    );
    expect(later.table.consumables.at(-1)?.id).toMatch(/@shop-2-0$/);
  });
});

describe("Act II's Boss in the campaign (#924, from #920)", () => {
  const seeds = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"];

  it("can draw the DMC milestone or the FDA Information Request", () => {
    expect(new Set(seeds.map(actTwoBoss))).toEqual(
      new Set([DMC_MILESTONE_SCENARIO.id, FDA_IR_SCENARIO.id])
    );
  });

  it("advances a defended DMC milestone to Act III, applying the act reset", () => {
    const seed = seeds.find(
      (s) => actTwoBoss(s) === DMC_MILESTONE_SCENARIO.id
    )!;
    let run = skipTo(seed, 1);
    run = advanceRun(C, cleared(run), { type: "NEXT_BLIND" });
    run = advanceRun(C, cleared(run), { type: "NEXT_BLIND" });
    expect(deriveRunView(C, run).blind.id).toBe(DMC_MILESTONE_SCENARIO.id);
    const defended: RunState = {
      ...run,
      table: { ...run.table, status: "CLEARED" },
    };
    const unclaimed = advanceRun(
      C,
      { ...defended, table: { ...defended.table, rewardClaimed: null } },
      { type: "NEXT_BLIND" }
    );
    expect(unclaimed.table.lastEvent?.message).toBe(
      "Choose an SOP relic first."
    );
    const act3 = advanceRun(
      C,
      { ...defended, table: { ...defended.table, rewardClaimed: DMC_RELIC } },
      { type: "NEXT_BLIND" }
    );
    expect(act3).toMatchObject({ actIndex: 2, blindIndex: 0 });
    expect(act3.table.scenarioId).toBe(BLINDED_DATA_REVIEW_SCENARIO.id);
    expect(act3.table.snapshots).toEqual([
      BLINDED_DATA_REVIEW_SCENARIO.populationSnapshot,
    ]);
    expect(act3.bossIds[2]).toBe(CSR_LOCK_SCENARIO.id);
  });
});

describe("the end of the campaign (#924)", () => {
  it("ends on CSR Lock: nothing follows it", () => {
    let run = skipTo("alpha", 2);
    run = advanceRun(C, cleared(run), { type: "NEXT_BLIND" });
    run = advanceRun(C, cleared(run), { type: "NEXT_BLIND" });
    expect(deriveRunView(C, run).blind.id).toBe(CSR_LOCK_SCENARIO.id);
    const won = cleared(run);
    const view = deriveRunView(C, won);
    expect(view).toMatchObject({
      phase: "RUN_WON",
      isFinalBlind: true,
      nextBlind: null,
      nextAct: null,
      pendingCashOut: null,
    });
    const complete = `${C.title} is complete.`;
    expect(
      advanceRun(C, won, { type: "NEXT_BLIND" }).table.lastEvent?.message
    ).toBe(complete);
    expect(
      advanceRun(C, won, { type: "CASH_OUT" }).table.lastEvent?.message
    ).toBe(complete);
  });

  it("restarts from Act I with the same seed", () => {
    const run = skipTo("alpha", 2);
    const restarted = advanceRun(C, run, { type: "RESTART_RUN" });
    const fresh = createRunState(C, "alpha");
    expect(restarted).toMatchObject({
      actIndex: 0,
      blindIndex: 0,
      bossIds: fresh.bossIds,
      draws: fresh.draws,
    });
    expect(restarted.table.hand).toEqual(fresh.table.hand);
  });
});

describe("a whole campaign, played (#924)", () => {
  let won: Played;
  let lost: Played;

  beforeAll(() => {
    won = playCampaign("alpha", "PERFECT");
    lost = playCampaign("alpha", "SLOPPY");
  }, 300_000);

  it("is won by locking the CSR at the end of Act III", () => {
    const view = deriveRunView(C, won.run);
    expect(view.phase).toBe("RUN_WON");
    expect(won.path).toHaveLength(9);
    expect(won.path[0]).toBe(ACT_I.blinds[0].id);
    expect(won.path.at(-1)).toBe(CSR_LOCK_SCENARIO.id);
    const lock = view.table.csrLock?.lock;
    expect(lock).not.toBeNull();
    // Every cleared Blind of the three studies reaches the final score, and
    // Act II's Boss weights it.
    expect(lock!.campaign.map((r) => r.scenarioId)).toEqual(won.path);
    expect(lock!.final.bonusPercent).toBe(25);
  });

  it("is lost when a Blind fails: the sponsor moves the program", () => {
    const view = deriveRunView(C, lost.run);
    expect(view.phase).toBe("RUN_FAILED");
    expect(lost.run.actIndex).toBe(0);
  });

  it("replays from its seed and moves, and resumes from a save mid-campaign", () => {
    const log = { actId: C.id, seed: "alpha", actions: won.actions };
    expect(replayRun(C, log)).toEqual(won.run);
    // A won run still offering post-marketing resumes at the choice; once
    // submitted and ended, it has nothing to resume.
    expect(
      deriveRunView(C, parseRunSave(serializeRun(log, new Date(0)), [C])!.run)
        .endless?.canContinue
    ).toBe(true);
    const ended = {
      ...log,
      actions: [...won.actions, { type: "END_RUN" as const }],
    };
    expect(parseRunSave(serializeRun(ended, new Date(0)), [C])).toBeNull();
    const cut = won.actions.findIndex(
      (a, i) =>
        a.type === "NEXT_BLIND" &&
        won.actions.slice(0, i).filter((b) => b.type === "NEXT_BLIND")
          .length === 2
    );
    const partial = { ...log, actions: won.actions.slice(0, cut + 1) };
    const restored = parseRunSave(serializeRun(partial, new Date(0)), [C]);
    expect(restored?.act).toBe(C);
    expect(restored?.run.actIndex).toBe(1);
    expect(deriveRunView(C, restored!.run).actIntro).not.toBeNull();
    // An act's save does not resume as the campaign.
    expect(
      parseRunSave(serializeRun(partial, new Date(0)), [ACT_I])
    ).toBeNull();
  });
});
