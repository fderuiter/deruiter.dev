// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DEMOGRAPHICS_SCENARIO,
  DOSE_ESCALATION_SCENARIO,
  advanceRun,
  createRunState,
  deriveRunView,
  emptyCodex,
  recordRun,
  summarizeCampaignWin,
  summarizeRun,
  type Campaign,
  type LoggedAction,
  type RunLog,
  type RunState,
  type Scenario,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

/**
 * #2331: "The win is recorded either way" was false for a run that went on
 * into post-marketing and was then abandoned. The win and its unlocks are now
 * recorded when the player continues, and the run's own end replaces that
 * entry rather than adding a second one.
 */

const withQuota = (scenario: Scenario, quota: number): Scenario => ({
  ...scenario,
  blind: { ...scenario.blind, quota },
});

/** One easy study, then a post-marketing round no hand can clear. */
const MINI: Campaign = {
  id: "mini-pm-win",
  title: "Mini campaign",
  acts: [
    {
      id: "mini-pm-1",
      title: "Act I: Phase I Safety",
      blinds: [
        { ...withQuota(DEMOGRAPHICS_SCENARIO, 1), pinned: ["C-L16.2.7"] },
      ],
    },
  ],
  endless: {
    id: "mini-pm",
    title: "Post-marketing",
    quotaGrowth: 1.25,
    studies: [
      {
        id: "mini-pm-surveillance",
        title: "Safety surveillance",
        blinds: [withQuota(DEMOGRAPHICS_SCENARIO, 1_000_000)],
        bossPool: [DOSE_ESCALATION_SCENARIO],
      },
    ],
  },
};

/** Plays the current Blind with the bot, logging each move. */
function playCurrent(run: RunState, actions: LoggedAction[]): RunState {
  const { actions: moves } = playBlind(
    deriveRunView(MINI, run).blind,
    run.table,
    "PERFECT"
  );
  let next = run;
  for (const move of moves) {
    if (move.type === "RESET") continue;
    next = advanceRun(MINI, next, move);
    actions.push(move);
  }
  return next;
}

/** A log that wins the campaign and continues into post-marketing. */
function continuedLog(seed: string): { log: RunLog; run: RunState } {
  const actions: LoggedAction[] = [];
  let run = playCurrent(createRunState(MINI, seed), actions);
  expect(deriveRunView(MINI, run).endless?.canContinue).toBe(true);
  run = advanceRun(MINI, run, { type: "CONTINUE_ENDLESS" });
  actions.push({ type: "CONTINUE_ENDLESS" });
  expect(run.endless).toBe(true);
  return { log: { actId: MINI.id, seed, actions }, run };
}

/** The continued log played on until the post-marketing Blind fails. */
function failedLog(seed: string): RunLog {
  const { log, run: continued } = continuedLog(seed);
  const actions = [...log.actions];
  let run = advanceRun(MINI, continued, { type: "CASH_OUT" });
  actions.push({ type: "CASH_OUT" });
  run = advanceRun(MINI, run, { type: "NEXT_BLIND" });
  actions.push({ type: "NEXT_BLIND" });
  run = playCurrent(run, actions);
  expect(deriveRunView(MINI, run).phase).toBe("RUN_FAILED");
  return { ...log, actions };
}

describe("a campaign win continued into post-marketing (#2331)", () => {
  it("is summarized as a win the moment the run continues", () => {
    const { log } = continuedLog("pm-win");
    // The run is not over, so it has no finished entry yet ...
    expect(summarizeRun(MINI, log)).toBeNull();
    // ... but the win it carries into post-marketing is recordable.
    const win = summarizeCampaignWin(MINI, log, "2026-10-16");
    expect(win).toMatchObject({
      actId: MINI.id,
      seed: "pm-win",
      result: "WON",
      campaignWon: true,
      continued: true,
      moves: log.actions.length,
      endedOn: "2026-10-16",
      reached: { actIndex: 0, round: null },
    });
  });

  it("summarizes the win only once the run has continued", () => {
    const { log } = continuedLog("pm-win");
    const beforeContinue = { ...log, actions: log.actions.slice(0, -1) };
    expect(summarizeCampaignWin(MINI, beforeContinue)).toBeNull();
    // Later moves do not change the win entry, so it is recorded once.
    const failed = failedLog("pm-win");
    expect(summarizeCampaignWin(MINI, failed)).toEqual(
      summarizeCampaignWin(MINI, log)
    );
  });

  it("records the win and unlocks for a run abandoned in post-marketing", () => {
    const win = summarizeCampaignWin(MINI, continuedLog("pm-win").log)!;
    const codex = recordRun(emptyCodex(), win);
    expect(codex.history).toEqual([win]);
    expect(codex.unlocks).toEqual({ VIRTUAL_BIOTECH: 2, ONCOLOGY_PHARMA: 1 });
    // Recording it again, as a re-render would, changes nothing.
    expect(recordRun(codex, win)).toBe(codex);
  });

  it("replaces the continued win with the run's end instead of adding a second entry", () => {
    const win = summarizeCampaignWin(MINI, continuedLog("pm-win").log)!;
    const withWin = recordRun(emptyCodex(), win);
    const end = summarizeRun(MINI, failedLog("pm-win"))!;
    expect(end).toMatchObject({ result: "FAILED", campaignWon: true });
    expect(end.continued).toBeUndefined();

    const ended = recordRun(withWin, end);
    expect(ended.history).toEqual([end]);
    expect(ended.unlocks).toEqual(withWin.unlocks);
  });

  it("keeps a continued win from another run when a different run ends", () => {
    const win = summarizeCampaignWin(MINI, continuedLog("pm-win").log)!;
    const other = summarizeRun(MINI, failedLog("pm-other"))!;
    const codex = recordRun(recordRun(emptyCodex(), win), other);
    expect(codex.history).toEqual([other, win]);
  });
});
