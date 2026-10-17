import { describe, it, expect } from "vitest";
import {
  CPU_COSTS,
  DMC_MILESTONE_SCENARIO,
  advanceTable,
  classifyHand,
  createTableState,
  deriveTableView,
  describeBlindLoss,
  type TableState,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

/**
 * #2332: at the DMC Milestone closed report (Cardio Mega-Trial, stake 2), the
 * only Efficacy Full House left needed stale cards recompiled with CPU the
 * player no longer had. The deck was spent and Play Hand was disabled, but
 * the stranded-hand check counted every stale card as recompiled, whatever
 * the CPU, so the Blind never said it was lost.
 */

const DMC = DMC_MILESTONE_SCENARIO;
const FULL_HOUSE = ["EFFICACY_FULL_HOUSE"] as const;

/**
 * A closed-session table from a PERFECT run whose hand holds an Efficacy
 * Full House and one card outside it, with the deck spent.
 */
function closedReport(): {
  state: TableState;
  fullHouse: string[];
  spare: string;
} {
  const { actions } = playBlind(DMC, createTableState(DMC), "PERFECT");
  let state = createTableState(DMC);
  for (const action of actions) {
    state = advanceTable(DMC, state, action);
    if (
      state.status !== "REVIEWING" ||
      state.stage !== 1 ||
      state.session !== "CLOSED" ||
      state.crisis
    ) {
      continue;
    }
    const cards = deriveTableView(DMC, state).hand.map((c) => ({
      ...c.card,
      stale: false,
    }));
    const best = classifyHand(cards, FULL_HOUSE);
    if (best?.handType !== "EFFICACY_FULL_HOUSE") continue;
    const spare = state.hand.find((id) => !best.scoringCardIds.includes(id));
    if (!spare) continue;
    return {
      state: { ...state, selected: [], deckIndex: DMC.deck.length },
      fullHouse: best.scoringCardIds,
      spare,
    };
  }
  throw new Error("no closed-session Full House found");
}

/** `state` with `stale` compiled under a superseded SAP and `cpu` left. */
function withStale(
  state: TableState,
  stale: readonly string[],
  cpu: number
): TableState {
  return {
    ...state,
    compiledUnder: Object.fromEntries(stale.map((id) => [id, "SAP-OLD"])),
    cpu: { ...state.cpu, available: cpu },
  };
}

/** Discards the one spare card, which settles the Blind. */
function discardSpare(state: TableState, spare: string): TableState {
  return advanceTable(
    DMC,
    advanceTable(DMC, state, { type: "TOGGLE_SELECT", cardId: spare }),
    { type: "DISCARD" }
  );
}

describe("Trial & Error: a Full House the CPU cannot recompile is stranded (#2332)", () => {
  it("fails the closed report when the recompiles cost more CPU than is left", () => {
    const { state, fullHouse, spare } = closedReport();
    // Every Full House card is stale. After the discard, the CPU left pays
    // for one recompile and the play, not for all five recompiles.
    const cpu = CPU_COSTS.DISCARD + CPU_COSTS.PLAY_HAND + CPU_COSTS.RECOMPILE;
    const after = discardSpare(withStale(state, fullHouse, cpu), spare);
    expect(after.status).toBe("FAILED");
    expect(after.lastEvent?.message).toContain(
      "no Efficacy Full House can be formed from the cards left."
    );
    const view = deriveTableView(DMC, after);
    expect(view.stranded).toEqual(["EFFICACY_FULL_HOUSE"]);
    expect(describeBlindLoss(view)).toContain(
      "no Efficacy Full House could be formed from the cards left."
    );
  });

  it("stays in play while the CPU left pays for every recompile and the play", () => {
    const { state, fullHouse, spare } = closedReport();
    const cpu =
      CPU_COSTS.DISCARD +
      CPU_COSTS.PLAY_HAND +
      CPU_COSTS.RECOMPILE * fullHouse.length;
    const after = discardSpare(withStale(state, fullHouse, cpu), spare);
    expect(after.status).toBe("REVIEWING");
    expect(deriveTableView(DMC, after).stranded).toBeNull();
  });

  it("counts only the stale cards: one recompile is enough for one stale card", () => {
    const { state, fullHouse, spare } = closedReport();
    const cpu = CPU_COSTS.DISCARD + CPU_COSTS.PLAY_HAND + CPU_COSTS.RECOMPILE;
    const after = discardSpare(withStale(state, [fullHouse[0]], cpu), spare);
    expect(after.status).toBe("REVIEWING");
  });
});
