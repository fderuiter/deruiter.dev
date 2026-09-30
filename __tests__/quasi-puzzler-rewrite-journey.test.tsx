// @vitest-environment jsdom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler/QuasiPerfectPuzzler";
import { isProofComplete, puzzleLevels, tacticDefs } from "@/lib/quasi-perfect";

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

const click = (el: Element) => act(() => void fireEvent.click(el));
const card = (name: RegExp) =>
  screen
    .getAllByRole("button", { name })
    .find((el) => el.hasAttribute("data-tactic-id"))!;
const node = (expression: string) =>
  screen
    .getAllByRole("button")
    .find((el) =>
      el.getAttribute("aria-label")?.endsWith(`Expression: ${expression}`)
    )!;
const ram = () =>
  document.body.textContent?.match(/(\d+(?:\.\d)?) \/ \d+ GB/)?.[1];

// #1232: level 2 rewrites must be targeted at the sub-term, the rule must be
// stated before the penalty, and the copy must match the auto-closing rewrite.
describe("Quasi-Perfect level 2 rewrite journey (#1232)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("states the targeting rule before the tap, explains a wrong target, then closes on the sub-term", () => {
    render(<QuasiPerfectPuzzler />);
    click(screen.getByRole("button", { name: /^L2$/ }));

    click(card(/Tactic symm/i));
    click(node("b = a"));
    expect(document.body.textContent).toContain("a = b");

    expect(screen.queryByTestId("targeting-hint")).toBeNull();
    click(card(/Tactic rw/i));
    const hint = screen.getByTestId("targeting-hint");
    expect(hint.textContent).toMatch(/never the whole equality/);
    expect(hint.textContent).toMatch(/costs 1 GB/);

    const before = Number(ram());
    click(node("a = b"));
    expect(Number(ram())).toBe(before - 1);
    expect(document.body.textContent).toMatch(/Tap one of those sub-terms/);
    expect(document.body.textContent).not.toMatch(/does not match 'a = b'/);

    // A failed tactic leaves the rw card armed, so the next tap is the retry.
    expect(screen.getByTestId("targeting-hint")).toBeTruthy();
    click(node("a"));
    expect(screen.queryByTestId("targeting-hint")).toBeNull();
    expect(document.body.textContent).toMatch(/Q\.E\.D|Proof Complete|solved/i);
  });
});

// The rewrite that leaves both sides equal closes the goal by itself, so a
// level must not tell the player to finish with a separate rfl.
describe("levels whose final rewrite auto-closes do not demand rfl (#1232)", () => {
  it.each([2, 3, 4, 5, 15])(
    "level %i copy matches the auto-closing rewrite",
    (id) => {
      const lvl = puzzleLevels.find((l) => l.id === id)!;
      const copy = [
        ...lvl.hints,
        lvl.educationalConcept.tacticalObjective,
      ].join(" ");
      expect(copy).toMatch(/closes automatically/);
      expect(copy).not.toMatch(/(close|finish)[^.]*with ['`]?rfl/i);
      expect(copy).not.toMatch(/followed by `rfl`/);
    }
  );

  it("level 5 closes at x = x after the 2 GB rewrite alone", () => {
    const lvl = puzzleLevels.find((l) => l.id === 5)!;
    const res = tacticDefs.rw.execute(
      lvl.goal.children![0],
      lvl.goal,
      lvl.hypotheses,
      "add_zero"
    );
    expect(res.success).toBe(true);
    expect(res.ramConsumed).toBe(2);
    expect(isProofComplete(res.newAST!)).toBe(true);
  });
});
