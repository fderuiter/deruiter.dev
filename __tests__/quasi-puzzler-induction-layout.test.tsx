// @vitest-environment jsdom
import React from "react";
import fs from "fs";
import path from "path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler/QuasiPerfectPuzzler";
import { ExpressionTree } from "@/components/QuasiPerfectPuzzler/ExpressionTree";
import { puzzleLevels } from "@/lib/quasi-perfect";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

/**
 * Act 2's induction levels carry three or more hypotheses. Stacked in a
 * narrow column they pushed the proof tree off the board: to 0 px on the
 * touch cabinet (#2195) and under the docked tactic hand on desktop (#2196).
 */
describe("Quasi Puzzler induction layout (#2195, #2196, #2197)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  beforeEach(() => {
    localStorage.clear();
  });

  it("lays the hypotheses out as one sideways row above the tree", () => {
    const level = puzzleLevels.find((l) => l.hypotheses.length >= 3);
    expect(level).toBeDefined();
    render(
      <ExpressionTree
        goalAST={level!.goal}
        hypotheses={level!.hypotheses}
        selectedTargetId={null}
        hoveredTargetId={null}
        onSelectTarget={() => {}}
        onHoverTarget={() => {}}
      />
    );
    const row = screen.getByTestId("hypotheses-row");
    expect(row.className).toContain("overflow-x-auto");
    expect(row.className).not.toContain("flex-wrap");
    const chips = row.querySelectorAll("button[data-node-id]");
    expect(chips.length).toBe(level!.hypotheses.length);
    for (const chip of chips) {
      expect(chip.className).toContain("shrink-0");
      expect(chip.className).toContain("whitespace-nowrap");
    }
  });

  it("keeps a floor under the touch cabinet's tree so the board scrolls instead", () => {
    const css = fs.readFileSync(
      path.resolve(process.cwd(), "app/arcade/arcade.css"),
      "utf8"
    );
    const rule = css.match(
      /\.qp-root\.qp-touch \.qp-touch-tree \{([^}]*)\}/
    )?.[1];
    expect(rule).toBeDefined();
    const floor = rule!.match(/min-height:\s*(?:min\()?([\d.]+)rem/);
    expect(floor).not.toBeNull();
    expect(Number(floor![1])).toBeGreaterThanOrEqual(12);
    // A zero basis keeps the floor, not the tree's content, as its min-content.
    expect(rule).toMatch(/flex:\s*1 1 0;/);
    expect(css).toMatch(
      /\.qp-root\.qp-touch \.qp-touch-panel > :not\(\.qp-touch-tree\) \{\s*flex-shrink: 0;/
    );
  });

  it("does not dock the tactic hand over the open level map", async () => {
    // Every box reports a bottom well below the viewport, so the hand's slot
    // reads as cut off and the hand docks.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 5000,
      left: 0,
      right: 1000,
      width: 1000,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    render(<QuasiPerfectPuzzler />);
    const dock = screen.getByTestId("quasi-tactic-hand-dock");
    await vi.waitFor(() => expect(dock.dataset.docked).toBe("true"));

    const toggle = document.querySelector<HTMLButtonElement>(
      'button[aria-controls="quasi-level-index"]'
    );
    expect(toggle).not.toBeNull();
    fireEvent.click(toggle!);
    await vi.waitFor(() => expect(dock.dataset.docked).toBe("false"));
  });
});
