// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RunInfo } from "@/components/trial-and-error/RunInfo";
import { ScorePlayer } from "@/components/trial-and-error/ScorePlayer";
import {
  ACT_I_SHOP,
  evaluateHand,
  relicModifiers,
  scoreTimeline,
  type Relic,
  type ShopEntry,
} from "@/lib/trial-and-error";

afterEach(cleanup);

const relic = (id: string): Relic =>
  (
    ACT_I_SHOP.entries.find(
      (e) => e.kind === "RELIC" && e.relic.id === id
    ) as Extract<ShopEntry, { kind: "RELIC" }>
  ).relic;

const PURIST = relic("REL-ITT-PURIST");
const SENIOR = relic("REL-SENIOR-PROGRAMMER");

describe("a card relic firing in the score player (#924)", () => {
  const steps = scoreTimeline(
    evaluateHand({
      handType: "HIGH_TABLE",
      cards: [{ id: "T1", chips: 25, mult: 1 }],
      ruleResults: [],
      modifiers: relicModifiers([PURIST], {
        cards: [
          {
            id: "T1",
            cardType: "TABLE",
            population: "ITT",
            chips: 25,
            mult: 1,
            qcPassed: false,
            cancelled: false,
          },
        ],
        ruleResults: [],
      }),
    }),
    {
      roundScoreBefore: 0,
      target: 1000,
      cardNames: { T1: "Table 14.1.2" },
      relicNames: { [PURIST.id]: PURIST.name },
    }
  );
  const at = steps.findIndex((s) => s.kind === "RELIC") + 1;
  const player = (shown: number, loud: boolean) => (
    <ScorePlayer
      steps={steps}
      shown={shown}
      cards={[{ id: "T1", number: "Table 14.1.2" }]}
      loudEffectsEnabled={loud}
      onSkip={() => {}}
    />
  );

  it("pops and shakes the card it fires on, with the relic's number", () => {
    const { container } = render(player(at, true));
    const card = container.querySelector("[data-relic-fired]");
    expect(card?.textContent).toBe("Table 14.1.2");
    expect(card?.className).toContain("te-loud-shake");
    expect(card?.className).toContain("motion-safe:scale-110");
    expect(
      screen.getByText("The ITT Purist on Table 14.1.2: +25 Chips, +1 Mult.")
    ).toBeTruthy();
    expect(screen.getByTestId("player-counters").textContent).toBe(
      "[65] × [3]"
    );
  });

  it("pops without shaking when loud effects are off, and settles after", () => {
    const { container, rerender } = render(player(at, false));
    const card = container.querySelector("[data-relic-fired]");
    expect(card?.className).not.toContain("te-loud-shake");
    rerender(player(at + 1, false));
    expect(container.querySelector("[data-relic-fired]")).toBeNull();
  });
});

describe("relic phases in Run Info (#924)", () => {
  it("labels each relic with the phase it fires in", () => {
    render(
      <RunInfo
        rows={[]}
        seed="alpha"
        relicSlots={5}
        relics={[SENIOR, PURIST]}
        onClose={() => {}}
      />
    );
    const items = screen
      .getByTestId("run-info-relics")
      .querySelectorAll("li.break-words");
    expect([...items].map((li) => li.textContent)).toEqual([
      `Senior Programmer (Hand played): ${SENIOR.description}`,
      `The ITT Purist (Card scored): ${PURIST.description}`,
    ]);
  });
});
