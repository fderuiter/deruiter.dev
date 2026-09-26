import { describe, it, expect, beforeAll } from "vitest";
import {
  ACT_I,
  BIOSTAT_OPS_CAMPAIGN,
  CSR_LOCK_SCENARIO,
  CampaignSchema,
  DMC_MILESTONE_SCENARIO,
  DOSE_ESCALATION_SCENARIO,
  EndlessSchema,
  FDA_IR_SCENARIO,
  PASS_STUDY,
  POST_MARKETING,
  SAFETY_SURVEILLANCE_STUDY,
  advanceRun,
  createRunState,
  deriveRunView,
  endlessAct,
  parseRunSave,
  raiseQuotas,
  replayRun,
  runBlinds,
  serializeRun,
  type LoggedAction,
  type RunState,
} from "@/lib/trial-and-error";
import { playBlind, type BotStyle } from "./utils/trial-and-error-bot";

const C = BIOSTAT_OPS_CAMPAIGN;
const GROWTH = POST_MARKETING.quotaGrowth;
const up100 = (n: number) => Math.ceil(n / 100) * 100;

/** A run whose current Blind is marked cleared, without playing it. */
const cleared = (run: RunState): RunState => ({
  ...run,
  table: { ...run.table, status: "CLEARED", rewardClaimed: "claimed" },
});

/** The campaign run for `seed` at CSR Lock, cleared, without playing it. */
function wonCampaign(seed: string): RunState {
  let run = createRunState(C, seed);
  while (runBlinds(C, run)[run.blindIndex].id !== CSR_LOCK_SCENARIO.id) {
    run = advanceRun(C, cleared(run), { type: "NEXT_BLIND" });
  }
  return cleared(run);
}

const message = (run: RunState) => run.table.lastEvent?.message;

describe("the post-marketing data (#1088)", () => {
  it("parses, and hangs off the campaign", () => {
    expect(EndlessSchema.parse(POST_MARKETING)).toEqual(POST_MARKETING);
    expect(CampaignSchema.parse(C).endless?.id).toBe("post-marketing");
    expect(POST_MARKETING.studies).toEqual([
      SAFETY_SURVEILLANCE_STUDY,
      PASS_STUDY,
    ]);
    // The Bosses are earlier ones, their quotas raised.
    expect(SAFETY_SURVEILLANCE_STUDY.bossPool?.[0].id).toBe(
      DOSE_ESCALATION_SCENARIO.id
    );
    expect(PASS_STUDY.bossPool?.[0].id).toBe(FDA_IR_SCENARIO.id);
  });

  it("refuses a study without a boss pool, and a Boss in two studies", () => {
    const noPool = { ...PASS_STUDY, bossPool: undefined };
    expect(
      EndlessSchema.safeParse({ ...POST_MARKETING, studies: [noPool] }).success
    ).toBe(false);
    expect(
      EndlessSchema.safeParse({
        ...POST_MARKETING,
        studies: [PASS_STUDY, { ...PASS_STUDY, id: "pass-again" }],
      }).success
    ).toBe(false);
    expect(
      EndlessSchema.safeParse({ ...POST_MARKETING, quotaGrowth: 1 }).success
    ).toBe(false);
  });
});

describe("raising quotas (#1088)", () => {
  it("raises a plain Blind's quota, rounded up to the next 100", () => {
    const raised = raiseQuotas(DOSE_ESCALATION_SCENARIO, 1.25);
    expect(raised.blind.quota).toBe(up100(8500 * 1.25));
    expect(raised.id).toBe(DOSE_ESCALATION_SCENARIO.id);
  });

  it("raises each IR question and each DMC stage, keeping their sum", () => {
    const ir = raiseQuotas(FDA_IR_SCENARIO, 1.3);
    if (ir.encounter?.kind !== "FDA_IR") throw new Error("not an IR");
    const questions = ir.encounter.questions.map((q) => q.quota);
    expect(questions).toEqual(
      FDA_IR_SCENARIO.encounter.questions.map((q) => up100(q.quota * 1.3))
    );
    expect(ir.blind.quota).toBe(questions.reduce((a, b) => a + b, 0));

    const dmc = raiseQuotas(DMC_MILESTONE_SCENARIO, 2);
    if (dmc.encounter?.kind !== "DMC_DEFENSE") throw new Error("not a DMC");
    const [open, closed] = dmc.encounter.stages;
    expect(open.quota).toBe(
      up100(DMC_MILESTONE_SCENARIO.encounter.stages[0].quota * 2)
    );
    expect(dmc.blind.quota).toBe(open.quota + closed.quota);
  });

  it("builds each round's study with quotas grown per round", () => {
    const round = (r: number, bossId: string) =>
      endlessAct(POST_MARKETING, bossId, r);
    const one = round(1, DOSE_ESCALATION_SCENARIO.id);
    const two = round(2, DOSE_ESCALATION_SCENARIO.id);
    expect(one.title).toBe("Post-marketing round 1: Safety surveillance");
    expect(one.id).toBe(`${SAFETY_SURVEILLANCE_STUDY.id}-round-1`);
    SAFETY_SURVEILLANCE_STUDY.blinds.forEach((blind, i) => {
      expect(one.blinds[i].blind.quota).toBe(up100(blind.blind.quota * GROWTH));
      expect(two.blinds[i].blind.quota).toBe(
        up100(blind.blind.quota * GROWTH ** 2)
      );
      expect(two.blinds[i].blind.quota).toBeGreaterThan(
        one.blinds[i].blind.quota
      );
    });
    expect(round(3, FDA_IR_SCENARIO.id).title).toBe(
      "Post-marketing round 3: Post-authorisation safety study"
    );
  });
});

describe("the choice after CSR Lock (#1088)", () => {
  it("offers to end the run or continue, with the win recorded", () => {
    const won = wonCampaign("alpha");
    expect(deriveRunView(C, won)).toMatchObject({
      phase: "RUN_WON",
      nextBlind: null,
      endless: {
        title: "Post-marketing",
        canContinue: true,
        round: null,
        campaignWon: true,
      },
    });
    // Nothing is offered mid-campaign, or without an endless mode.
    expect(deriveRunView(C, createRunState(C, "alpha")).endless).toMatchObject({
      canContinue: false,
      campaignWon: false,
    });
    expect(deriveRunView(ACT_I, createRunState(ACT_I, "alpha")).endless).toBe(
      null
    );
  });

  it("ends the run exactly as a win, and nothing follows", () => {
    const ended = advanceRun(C, wonCampaign("alpha"), { type: "END_RUN" });
    expect(ended.ended).toBe(true);
    expect(message(ended)).toBe(`Package submitted. ${C.title} won.`);
    expect(deriveRunView(C, ended)).toMatchObject({
      phase: "RUN_WON",
      endless: { canContinue: false, campaignWon: true, round: null },
    });
    expect(message(advanceRun(C, ended, { type: "CONTINUE_ENDLESS" }))).toBe(
      "The run has ended."
    );
    expect(message(advanceRun(C, ended, { type: "END_RUN" }))).toBe(
      "The run has ended."
    );
  });

  it("refuses both before the campaign is won, and without an endless mode", () => {
    const early = createRunState(C, "alpha");
    for (const type of ["CONTINUE_ENDLESS", "END_RUN"] as const) {
      expect(message(advanceRun(C, early, { type }))).toBe(
        `Win ${C.title} first.`
      );
      expect(
        message(advanceRun(ACT_I, createRunState(ACT_I, "alpha"), { type }))
      ).toBe(`${ACT_I.title} has no post-marketing mode.`);
    }
  });
});

describe("post-marketing rounds (#1088)", () => {
  const won = wonCampaign("alpha");
  const continued = advanceRun(C, won, { type: "CONTINUE_ENDLESS" });

  it("draws round 1's study and Boss with the seeded draw, and names it", () => {
    expect(continued.endless).toBe(true);
    expect(continued.bossIds).toHaveLength(4);
    expect(continued.draws.at(-1)).toMatchObject({
      kind: "BOSS",
      id: continued.bossIds[3],
      actIndex: 3,
    });
    const view = deriveRunView(C, continued);
    expect(view.phase).toBe("BLIND_CLEARED");
    expect(view.endless).toMatchObject({ canContinue: false, round: null });
    expect(view.nextAct).toMatchObject({ index: 3, count: 3, round: 1 });
    expect(view.nextAct?.title).toMatch(/^Post-marketing round 1: /);
    expect(message(continued)).toMatch(
      /^The package is submitted and the compound is on the market\. Post-marketing begins: Post-marketing round 1: /
    );
    expect(
      message(advanceRun(C, continued, { type: "CONTINUE_ENDLESS" }))
    ).toBe("The run is already in post-marketing.");
  });

  it("visits the shop before the round, with no site packs", () => {
    const shop = advanceRun(C, continued, { type: "CASH_OUT" }).shop;
    expect(shop).not.toBeNull();
    expect(shop!.packs.map((p) => p.pack.kind)).not.toContain(
      "SITE_ACTIVATION"
    );
  });

  it("starts each round as a new study on its act card, and draws the next round's Boss", () => {
    const round1 = advanceRun(C, continued, { type: "NEXT_BLIND" });
    expect(round1.actIndex).toBe(3);
    expect(round1.bossIds).toHaveLength(5);
    const view = deriveRunView(C, round1);
    expect(view.act.round).toBe(1);
    expect(view.endless).toMatchObject({ round: 1, campaignWon: true });
    expect(view.actIntro?.act.round).toBe(1);
    const study = endlessAct(POST_MARKETING, round1.bossIds[3], 1);
    expect(view.blind.blind.quota).toBe(study.blinds[0].blind.quota);
    expect(message(round1)).toMatch(/A new post-marketing study/);
    // Relics, levels and budget carry as between acts; sites close out.
    expect(round1.table.relics).toEqual(won.table.relics);
    expect(round1.table.sites).toEqual([]);

    let run = round1;
    while (run.actIndex === 3) {
      run = advanceRun(C, cleared(run), { type: "NEXT_BLIND" });
    }
    expect(deriveRunView(C, run).act.round).toBe(2);
    expect(run.bossIds).toHaveLength(6);
    const two = endlessAct(POST_MARKETING, run.bossIds[4], 2);
    expect(deriveRunView(C, run).blind.blind.quota).toBe(
      two.blinds[0].blind.quota
    );
  });

  it("draws the same rounds for the same seed", () => {
    const again = advanceRun(C, wonCampaign("alpha"), {
      type: "CONTINUE_ENDLESS",
    });
    expect(again.bossIds).toEqual(continued.bossIds);
    const seen = new Set<string | null>();
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const run = advanceRun(C, wonCampaign(seed), {
        type: "CONTINUE_ENDLESS",
      });
      seen.add(run.bossIds[3]);
    }
    expect(seen).toEqual(
      new Set([DOSE_ESCALATION_SCENARIO.id, FDA_IR_SCENARIO.id])
    );
  });
});

interface Played {
  run: RunState;
  actions: LoggedAction[];
  /** The Blinds played in post-marketing, as `round:id:quota`. */
  rounds: string[];
}

/**
 * Plays the campaign with the balance bot, continues past CSR Lock, and
 * plays post-marketing rounds until a Blind fails or `maxRound` is passed.
 */
function playEndless(seed: string, style: BotStyle, maxRound = 6): Played {
  let run = createRunState(C, seed);
  const actions: LoggedAction[] = [];
  const rounds: string[] = [];
  const act = (action: LoggedAction) => {
    actions.push(action);
    run = advanceRun(C, run, action);
  };
  for (;;) {
    const view = deriveRunView(C, run);
    for (const action of playBlind(view.blind, run.table, style).actions) {
      if (run.table.status !== "REVIEWING") break;
      if (action.type === "RESET") continue;
      act(action);
    }
    const after = deriveRunView(C, run);
    if (after.act.round !== null) {
      rounds.push(
        `${after.act.round}:${after.blind.id}:${after.blind.blind.quota}`
      );
    }
    if (after.phase === "RUN_WON") act({ type: "CONTINUE_ENDLESS" });
    else if (after.phase !== "BLIND_CLEARED") return { run, actions, rounds };
    const reward = deriveRunView(C, run).table.reward;
    if (reward && reward.claimed === null) {
      act({ type: "CLAIM_RELIC", relicId: reward.choices[0].id });
    }
    if ((after.act.round ?? 0) >= maxRound && after.blindIndex === 2) {
      return { run, actions, rounds };
    }
    act({ type: "NEXT_BLIND" });
  }
}

describe("post-marketing, played (#1088)", () => {
  let perfect: Played;
  let median: Played;

  beforeAll(() => {
    perfect = playEndless("alpha", "PERFECT");
    median = playEndless("alpha", "MEDIAN");
  }, 600_000);

  it("is lost when a Blind fails, still recording the win and the round", () => {
    for (const played of [perfect, median]) {
      const view = deriveRunView(C, played.run);
      expect(view.phase).toBe("RUN_FAILED");
      expect(view.endless).toMatchObject({ campaignWon: true });
      expect(view.endless?.round).toBe(
        Number(played.rounds.at(-1)!.split(":")[0])
      );
    }
  });

  it("stops median play before perfect play (the balance harness)", () => {
    const reached = (p: Played) => deriveRunView(C, p.run).endless!.round!;
    expect(reached(median)).toBe(1);
    expect(reached(perfect)).toBeGreaterThanOrEqual(3);
    // Every round's quotas outgrow the last round's for the same study.
    const byStudy = new Map<string, number>();
    for (const entry of perfect.rounds) {
      const [, id, quota] = entry.split(":");
      if (byStudy.has(id))
        expect(Number(quota)).toBeGreaterThan(byStudy.get(id)!);
      byStudy.set(id, Number(quota));
    }
  });

  it("replays from its seed and moves, and resumes mid-round from a save", () => {
    const log = { actId: C.id, seed: "alpha", actions: perfect.actions };
    expect(replayRun(C, log)).toEqual(perfect.run);
    const cut = perfect.actions.findIndex((a) => a.type === "CONTINUE_ENDLESS");
    const partial = {
      ...log,
      actions: [
        ...perfect.actions.slice(0, cut + 1),
        { type: "NEXT_BLIND" as const },
      ],
    };
    const restored = parseRunSave(serializeRun(partial, new Date(0)), [C]);
    expect(restored?.run.actIndex).toBe(3);
    expect(deriveRunView(C, restored!.run).act.round).toBe(1);
    // A lost post-marketing run has nothing to resume.
    expect(parseRunSave(serializeRun(log, new Date(0)), [C])).toBeNull();
  });
});
