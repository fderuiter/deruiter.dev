import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import {
  sessionEvents,
  useTrialAndErrorSession,
  type SessionMoment,
  type TrialAndErrorEvent,
} from "@/components/trial-and-error/useTrialAndErrorSession";
import { fromPartial } from "@total-typescript/shoehorn";
import { BIOSTAT_OPS_CAMPAIGN, type LevelUp } from "@/lib/trial-and-error";
import { safeClear } from "@/lib/safe-storage";
import { playBlind } from "./utils/trial-and-error-bot";

/**
 * The Trial & Error session hook on its own (#3434): its named events for a
 * scored hand and a cleared Blind, played through the session's dispatch by
 * the balance bot, and the rules that derive every event from a move.
 */

beforeEach(() => safeClear());
afterEach(() => cleanup());

/** A session on the campaign at a seed the balance bot wins (as in the release replay). */
function renderCampaign(onEvent: (event: TrialAndErrorEvent) => void) {
  return renderHook(() =>
    useTrialAndErrorSession({
      act: BIOSTAT_OPS_CAMPAIGN,
      seed: "bravo",
      persist: false,
      onEvent,
    })
  );
}

describe("useTrialAndErrorSession events", () => {
  it("emits handScored for a played hand, with the hand's score", () => {
    const events: TrialAndErrorEvent[] = [];
    const { result } = renderCampaign((e) => events.push(e));
    const plan = playBlind(
      result.current.scenario,
      result.current.tableState,
      "PERFECT"
    ).actions;
    const firstPlay = plan.findIndex((a) => a.type === "PLAY_HAND");
    expect(firstPlay).toBeGreaterThanOrEqual(0);
    for (const action of plan.slice(0, firstPlay + 1)) {
      if (action.type === "RESET") continue;
      act(() => result.current.dispatch(action));
    }

    const scored = events.filter((e) => e.type === "handScored");
    expect(scored).toHaveLength(1);
    expect(scored[0]).toEqual({
      type: "handScored",
      score: result.current.view.roundScore,
    });
  });

  it("emits blindCleared once when the bot clears the first Blind", () => {
    const events: TrialAndErrorEvent[] = [];
    const { result } = renderCampaign((e) => events.push(e));
    const plan = playBlind(
      result.current.scenario,
      result.current.tableState,
      "PERFECT"
    ).actions;
    for (const action of plan) {
      if (result.current.view.status !== "REVIEWING") break;
      if (action.type === "RESET") continue;
      act(() => result.current.dispatch(action));
    }

    expect(result.current.runView.phase).toBe("BLIND_CLEARED");
    const cleared = events.filter((e) => e.type === "blindCleared");
    expect(cleared).toEqual([
      {
        type: "blindCleared",
        roundScore: result.current.view.roundScore,
        quota: result.current.view.quota,
      },
    ]);
    expect(events.some((e) => e.type === "blindFailed")).toBe(false);
    expect(events.filter((e) => e.type === "handScored").length).toBe(
      result.current.view.handsPlayed
    );
  });

  it("emits nothing when the table only re-renders", () => {
    const onEvent = vi.fn();
    const { rerender } = renderCampaign(onEvent);
    rerender();
    rerender();
    expect(onEvent).not.toHaveBeenCalled();
  });
});

/** A moment at event `sequence` of `kind`, with everything else quiet. */
function moment(
  sequence: number,
  kind: NonNullable<SessionMoment["event"]>["kind"],
  patch: Partial<SessionMoment> = {}
): SessionMoment {
  return {
    event: { kind, message: kind, sequence },
    outcome: null,
    timeline: null,
    roundScore: 0,
    quota: 300,
    blindKey: "bravo:0:0:small",
    bossIntro: false,
    actions: [],
    ...patch,
  };
}

describe("sessionEvents", () => {
  it("emits nothing before a previous moment or for the same event", () => {
    expect(sessionEvents(null, moment(1, "PLAYED"))).toEqual([]);
    expect(sessionEvents(moment(1, "PLAYED"), moment(1, "PLAYED"))).toEqual([]);
  });

  it("emits nothing for a refused move", () => {
    expect(sessionEvents(moment(1, "SELECTED"), moment(2, "REFUSED"))).toEqual(
      []
    );
  });

  it("adds fatalError when a zero rule slams the hand", () => {
    const events = sessionEvents(
      moment(1, "SELECTED"),
      moment(2, "PLAYED", {
        timeline: [
          { kind: "ZERO_RULE", ruleId: "r", evidence: "e", label: "FAS N" },
          { kind: "TOTAL", chips: 40, mult: 0, score: 0 },
        ] as SessionMoment["timeline"],
      })
    );
    expect(events).toEqual([
      { type: "handScored", score: 0 },
      { type: "fatalError", label: "FAS N" },
    ]);
  });

  it("emits blindFailed, and csrLocked after blindCleared on a lock", () => {
    expect(
      sessionEvents(
        moment(1, "SELECTED"),
        moment(2, "DISCARDED", { outcome: "FAILED", roundScore: 120 })
      )
    ).toEqual([{ type: "blindFailed", roundScore: 120, quota: 300 }]);
    expect(
      sessionEvents(
        moment(1, "SELECTED"),
        moment(2, "PLAYED", { outcome: "LOCKED", roundScore: 400 })
      ).map((e) => e.type)
    ).toEqual(["handScored", "blindCleared", "csrLocked"]);
  });

  it("emits levelUp, sealApplied, purchase and bossIntro from their moves", () => {
    const levelUp = fromPartial<LevelUp>({
      guidanceName: "ICH E9",
      from: { level: 1, chips: 10, mult: 2 },
      to: { level: 2, chips: 25, mult: 3 },
    });
    expect(
      sessionEvents(moment(1, "SHOP"), {
        ...moment(2, "LEVELED_UP"),
        event: { kind: "LEVELED_UP", message: "", sequence: 2, levelUp },
      })
    ).toEqual([{ type: "levelUp", levelUp }]);
    expect(sessionEvents(moment(1, "SHOP"), moment(2, "SEALED"))).toEqual([
      { type: "sealApplied" },
    ]);
    expect(
      sessionEvents(
        moment(1, "SHOP"),
        moment(2, "SHOP", { actions: [{ type: "BUY_PACK", slot: 1 }] })
      )
    ).toEqual([{ type: "purchase", slot: 1, pack: true }]);
    expect(
      sessionEvents(
        moment(1, "SHOP"),
        moment(2, "BLIND_STARTED", {
          blindKey: "bravo:0:2:boss",
          bossIntro: true,
        })
      )
    ).toEqual([{ type: "bossIntro", blindKey: "bravo:0:2:boss" }]);
  });
});
