// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  ACT_I,
  CSR_LOCK_SCENARIO,
  DMC_MILESTONE_SCENARIO,
  advanceTable,
  createTableState,
  deriveTableView,
  describeBlindLoss,
  type Scenario,
  type TableState,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

/**
 * #2150: a Blind that restricts hand types used to wait, in play, once the
 * deck was spent and the cards left could form none of the hands it
 * accepts. The only way out was a discard. It now fails with the reason.
 */

const DMC = DMC_MILESTONE_SCENARIO;

const outcomeOf = (scenario: Scenario, state: TableState) => {
  const view = deriveTableView(scenario, state);
  return { view, loss: describeBlindLoss(view) };
};

describe("Trial & Error: a stage with no formable hand fails (#2150)", () => {
  it("fails the DMC closed report once no Efficacy Full House is left", () => {
    // HASTY plays one Full House in the closed session, leaving two Listings
    // and an empty deck.
    const { state } = playBlind(DMC, createTableState(DMC), "HASTY");
    expect(state.stage).toBe(1);
    expect(state.status).toBe("FAILED");
    const { view, loss } = outcomeOf(DMC, state);
    expect(view.deckRemaining).toBe(0);
    expect(view.hand.length).toBeGreaterThan(0);
    expect(view.stranded).toEqual(["EFFICACY_FULL_HOUSE"]);
    expect(loss).toContain(
      "The deck ran out, and no Efficacy Full House could be formed from the cards left."
    );
    expect(state.lastEvent?.message).toContain(
      "no Efficacy Full House can be formed from the cards left."
    );
  });

  it("fails the open report when only closed-session outputs are left", () => {
    // SLOPPY spends the open-session outputs on High Tables short of the
    // quota; the blinded closed report cannot be shown in the open session,
    // and the closed session cannot convene before the open report.
    const { state } = playBlind(DMC, createTableState(DMC), "SLOPPY");
    expect(state.stage).toBe(0);
    expect(state.status).toBe("FAILED");
    const { view } = outcomeOf(DMC, state);
    expect(view.stranded).toEqual([
      "HIGH_TABLE",
      "TLF_PAIR",
      "POPULATION_FLUSH",
    ]);
  });

  it("keeps the Blind in play while an accepted hand can still be formed", () => {
    for (const style of ["MEDIAN", "PERFECT"] as const) {
      const { state } = playBlind(DMC, createTableState(DMC), style);
      expect(state.status).toBe("CLEARED");
      expect(deriveTableView(DMC, state).stranded).toBeNull();
    }
    // Fresh tables: the deck still deals, so nothing is stranded.
    expect(deriveTableView(DMC, createTableState(DMC)).stranded).toBeNull();
    const csr = createTableState(CSR_LOCK_SCENARIO);
    expect(deriveTableView(CSR_LOCK_SCENARIO, csr).stranded).toBeNull();
  });

  it("never strands a Blind that accepts every hand", () => {
    const blind = ACT_I.blinds[0];
    const { state } = playBlind(blind, createTableState(blind), "SLOPPY");
    expect(deriveTableView(blind, state).stranded).toBeNull();
  });

  it("waits while a blank shell could still be allocated into the hand", () => {
    // The Act I Small Blind deck holds the blank Table 14.1.3 shell. Deal it
    // first, under a stage that accepts only an Efficacy Full House, with the
    // deck spent.
    const small = ACT_I.blinds[0];
    const shellFirst = [
      ...small.deck.filter((card) => card.shellId),
      ...small.deck.filter((card) => !card.shellId),
    ];
    const staged: Scenario = {
      ...small,
      deck: shellFirst,
      pinned: undefined,
      encounter: {
        ...DMC.encounter,
        stages: [
          { ...DMC.encounter.stages[1], session: "OPEN" },
          DMC.encounter.stages[1],
        ],
      },
    };
    const dealt = createTableState(staged);
    const shell = deriveTableView(staged, dealt).hand.find((c) => c.blank);
    expect(shell).toBeDefined();
    const other = dealt.hand.find((id) => id !== shell!.card.id)!;
    const spent: TableState = { ...dealt, deckIndex: staged.deck.length };
    const discard = (state: TableState) =>
      advanceTable(
        staged,
        advanceTable(staged, state, { type: "TOGGLE_SELECT", cardId: other }),
        { type: "DISCARD" }
      );

    expect(discard(spent).status).toBe("REVIEWING");

    const allocated = advanceTable(staged, spent, {
      type: "ALLOCATE",
      cardId: shell!.card.id,
      population: "ITT",
    });
    const after = discard(allocated);
    expect(after.status).toBe("FAILED");
    expect(deriveTableView(staged, after).stranded).toEqual([
      "EFFICACY_FULL_HOUSE",
    ]);
  });
});
