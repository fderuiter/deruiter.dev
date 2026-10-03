// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { TimelineStep } from "@/lib/trial-and-error";
import {
  COUNTER_MIN_CHARS,
  FIGURE_SPACE,
  blankFigures,
  counterWidth,
  easeOutCubic,
  padFigures,
  rollValue,
  scoredChips,
  selectionSlots,
  targetFill,
  travelFrom,
} from "@/components/trial-and-error/scoring-stage";
import {
  ScoreCounters,
  TargetBar,
} from "@/components/trial-and-error/ScoreStage";
import {
  COVER_MARGIN_REM,
  coveredRem,
} from "@/components/trial-and-error/cards/hand-fit";

afterEach(cleanup);

const running = (chips: number, mult: number, xMult = 1) => ({
  chips,
  mult,
  xMult,
});

describe("scoring stage helpers (#1524)", () => {
  it("pads numbers with figure spaces to a fixed width", () => {
    expect(padFigures(7, 3)).toBe(`${FIGURE_SPACE}${FIGURE_SPACE}7`);
    expect(padFigures(1234, 3)).toBe("1234");
    expect(padFigures("12", 0)).toBe("12");
    expect(blankFigures(3)).toBe(FIGURE_SPACE.repeat(3));
    expect(blankFigures(-1)).toBe("");
  });

  it("sizes counters to the widest value a timeline reaches", () => {
    const steps: TimelineStep[] = [
      {
        kind: "HAND_BASE",
        handType: "TLF_PAIR",
        level: 1,
        chips: 10,
        mult: 2,
        text: "",
        running: running(10, 2),
      },
      {
        kind: "TOTAL",
        chips: 123456,
        mult: 2,
        score: 246912,
        text: "",
        running: running(123456, 2),
      },
    ];
    expect(counterWidth([])).toBe(COUNTER_MIN_CHARS);
    expect(counterWidth(steps.slice(0, 1))).toBe(COUNTER_MIN_CHARS);
    expect(counterWidth(steps)).toBe(6);
  });

  it("fills the target bar from 0 to 1, whatever the inputs", () => {
    expect(targetFill(0, 450)).toBe(0);
    expect(targetFill(225, 450)).toBe(0.5);
    expect(targetFill(828, 450)).toBe(1);
    expect(targetFill(-5, 450)).toBe(0);
    expect(targetFill(10, 0)).toBe(1);
    expect(targetFill(0, 0)).toBe(0);
    expect(targetFill(Number.NaN, 450)).toBe(0);
    expect(targetFill(10, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("rolls whole numbers from one value to the next and lands exactly", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(rollValue(0, 80, 0)).toBe(0);
    expect(rollValue(0, 80, 1)).toBe(80);
    expect(rollValue(0, 80, 5)).toBe(80);
    const mid = rollValue(0, 80, 0.5);
    expect(Number.isInteger(mid)).toBe(true);
    // Ease-out: past halfway at the halfway mark.
    expect(mid).toBeGreaterThan(40);
    expect(rollValue(80, 20, 0.5)).toBeLessThan(80);
  });

  it("puts a played card back where it left the hand", () => {
    const hand = { left: 400, top: 600, width: 160, height: 216 };
    const slot = { left: 300, top: 200, width: 56, height: 72 };
    const trip = travelFrom(hand, slot)!;
    // Centre to centre: (480, 708) from (328, 236).
    expect(trip.x).toBe(152);
    expect(trip.y).toBe(472);
    expect(trip.scale).toBeCloseTo(160 / 56, 3);
    // A huge source is capped, and an unmeasured box has no trip.
    expect(travelFrom({ ...hand, width: 1000 }, slot)!.scale).toBe(3);
    expect(travelFrom({ ...hand, width: 0 }, slot)).toBeNull();
    expect(travelFrom(hand, { ...slot, width: 0 })).toBeNull();
  });

  it("fills selection slots in order, up to the Blind's limit", () => {
    expect(selectionSlots(5, ["a", "b"])).toEqual(["a", "b", null, null, null]);
    expect(selectionSlots(2, ["a", "b", "c"])).toEqual(["a", "b"]);
    expect(selectionSlots(0, ["a"])).toEqual([]);
    expect(selectionSlots(-3, [])).toEqual([]);
  });

  it("adds up the Chips each card scores, retriggers included", () => {
    const scored = (cardId: string, chips: number): TimelineStep => ({
      kind: "CARD_SCORED",
      cardId,
      chips,
      mult: 0,
      retrigger: 0,
      text: "",
      running: running(0, 0),
    });
    const chips = scoredChips([
      scored("a", 25),
      scored("b", 10),
      scored("a", 25),
    ]);
    expect(chips.get("a")).toBe(50);
    expect(chips.get("b")).toBe(10);
    expect(chips.has("c")).toBe(false);
  });

  it("covers every card's right edge but the last, by the overlap", () => {
    expect(coveredRem(0, 8, 2.4)).toBe(2.4 + COVER_MARGIN_REM);
    expect(coveredRem(6, 8, 2.4)).toBe(2.4 + COVER_MARGIN_REM);
    expect(coveredRem(7, 8, 2.4)).toBe(0);
    expect(coveredRem(0, 8, 0)).toBe(0);
    expect(coveredRem(0, 1, 3)).toBe(0);
  });
});

describe("ScoreCounters and TargetBar (#1524)", () => {
  it("shows Chips × Mult = Score, with an xMult and a struck Mult", () => {
    render(
      <ScoreCounters
        chips={80}
        mult={3}
        xMult={1.5}
        score={360}
        width={4}
        roll={false}
        struckMult={4}
        idPrefix="t"
      />
    );
    const counters = screen.getByTestId("t-counters");
    expect(counters.getAttribute("data-chips")).toBe("80");
    expect(counters.getAttribute("data-mult")).toBe("3");
    expect(counters.getAttribute("data-score")).toBe("360");
    expect(screen.getByTestId("t-chips").textContent).toContain(
      padFigures(80, 4)
    );
    expect(screen.getByTestId("t-xmult").textContent).toBe("×1.5");
    expect(screen.getByTestId("t-mult").querySelector("s")?.textContent).toBe(
      "4"
    );
  });

  it("holds the score's space blank until it is known", () => {
    render(
      <ScoreCounters
        chips={10}
        mult={1}
        score={null}
        width={4}
        roll={false}
        idPrefix="t"
      />
    );
    expect(screen.getByTestId("t-score").getAttribute("data-value")).toBe("");
    expect(screen.getByTestId("t-score").textContent).toContain(
      blankFigures(4)
    );
    expect(screen.queryByTestId("t-xmult")).toBeNull();
  });

  it("fills toward the target and reads CLEARED once it is crossed", () => {
    const { rerender } = render(
      <TargetBar score={225} target={450} cleared={false} slam={false} />
    );
    const bar = screen.getByRole("progressbar", {
      name: "Round score toward the Blind target",
    });
    expect(bar.getAttribute("aria-valuenow")).toBe("225");
    expect(bar.getAttribute("aria-valuetext")).toBe("225 of 450");
    expect(bar.querySelector("[data-fill]")?.getAttribute("style")).toContain(
      "scaleX(0.5)"
    );
    expect(screen.getByTestId("target-cleared").textContent).toBe("");

    rerender(<TargetBar score={828} target={450} cleared slam />);
    expect(bar.getAttribute("aria-valuenow")).toBe("450");
    expect(bar.getAttribute("aria-valuetext")).toBe("828 of 450");
    expect(screen.getByTestId("target-cleared").textContent).toBe("Cleared");
    expect(screen.getByTestId("target-cleared").className).toContain(
      "te-loud-target-slam"
    );
  });
});
