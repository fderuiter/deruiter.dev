// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import { CardTable } from "@/components/trial-and-error/CardTable";
import { useScorePlayback } from "@/components/trial-and-error/ScorePlayer";
import {
  DEMOGRAPHICS_SCENARIO,
  advanceTable,
  createTableState,
  deriveTableView,
  type TableAction,
  type TimelineStep,
} from "@/lib/trial-and-error";

const announce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce }),
}));
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: () => <button type="button">Manual</button>,
}));

function mockMedia({ reduced = false, compact = false } = {}) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches:
        (query.includes("reduce") && reduced) ||
        (query.includes("max-width") && compact),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  announce.mockClear();
  window.localStorage.clear();
  mockMedia();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const DRAFT_A = "C-T14.1.1-A";
const DM_LISTING = "C-L16.2.4";
const card = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-card-id="${id}"]`)!;
const player = () => screen.queryByTestId("score-player");
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
/** Advances in small ticks so each step's re-armed timer can fire. */
const elapse = (ms: number) => {
  for (let t = 0; t < ms; t += 10) advance(Math.min(10, ms - t));
};

/** The timeline the domain produces for the same actions, for comparison. */
function expectedTimeline(actions: TableAction[]): TimelineStep[] {
  const state = actions.reduce(
    (s, a) => advanceTable(DEMOGRAPHICS_SCENARIO, s, a),
    createTableState(DEMOGRAPHICS_SCENARIO)
  );
  return deriveTableView(DEMOGRAPHICS_SCENARIO, state).lastTimeline!;
}

const ZEROED_PAIR: TableAction[] = [
  { type: "TOGGLE_SELECT", cardId: DRAFT_A },
  { type: "TOGGLE_SELECT", cardId: DM_LISTING },
  { type: "PLAY_HAND" },
];

function playZeroedPair() {
  fireEvent.click(card(DRAFT_A));
  fireEvent.click(card(DM_LISTING));
  announce.mockClear();
  fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
}

/** Inspects and corrects all of Draft A, then plays the clearing pair. */
function playClearingPair() {
  act(() => card(DRAFT_A).focus());
  fireEvent.keyDown(card(DRAFT_A), { key: "i" });
  const drawer = screen.getByTestId("inspect-drawer");
  const rows = within(drawer).getAllByRole("row").slice(1);
  for (const row of rows) {
    for (const cell of within(row).getAllByRole("gridcell")) {
      act(() => cell.focus());
      fireEvent.keyDown(cell, { key: "Enter" });
      fireEvent.keyDown(cell, { key: "c" });
    }
  }
  fireEvent.click(screen.getByRole("button", { name: /Close Inspect/ }));
  playZeroedPair();
}

describe("ScorePlayer on the Card Table", () => {
  it("plays the timeline step by step, in the domain's order, with input locked", () => {
    render(<CardTable />);
    playZeroedPair();
    const steps = expectedTimeline(ZEROED_PAIR);

    expect(player()).not.toBeNull();
    const skip = screen.getByRole("button", { name: /Skip/ });
    expect(document.activeElement).toBe(skip);
    expect(screen.getByTestId("hand").closest("[inert]")).not.toBeNull();
    expect(screen.queryByTestId("last-hand")).toBeNull();
    expect(screen.queryByTestId("score-breakdown")).toBeNull();
    // The summary waits for the timeline to resolve.
    expect(announce).not.toHaveBeenCalled();

    const seen: string[] = [];
    // Two steps at most 450 ms each, so one tick per step at 1×.
    const stepMs = Math.min(450, 3300 / steps.length);
    for (let i = 0; i < steps.length; i++) {
      advance(stepMs);
      seen.push(within(player()!).getByText(steps[i].text).textContent!);
    }
    expect(seen).toEqual(steps.map((s) => s.text));
    expect(screen.getByTestId("zero-slam").textContent).toBe(
      "DENOMINATOR ERROR ×0"
    );

    advance(600);
    expect(player()).toBeNull();
    expect(screen.getByTestId("last-hand").textContent).toContain(
      "(zero-score rule)"
    );
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls[0][0]).toContain("TLF Pair scored 0");
    expect(document.activeElement?.getAttribute("data-card-id")).not.toBeNull();
  });

  it("holds the Blind's round score until the TOTAL step lands", () => {
    render(<CardTable />);
    playClearingPair();
    expect(screen.getByTestId("round-score").textContent?.trim()).toBe("0");
    expect(screen.queryByTestId("blind-result")).toBeNull();
    elapse(10_000);
    expect(screen.getByTestId("round-score").textContent?.trim()).toBe("828");
    expect(screen.getByTestId("blind-result").textContent).toContain(
      "Blind cleared"
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Cash out/ })
    );
  });

  it("catches fire and flashes CLEARED when the hand crosses the target", () => {
    render(<CardTable />);
    playClearingPair();
    const playerEl = player()!;
    // Advance until the last step (BLIND_PROGRESS) is shown, before the hold ends.
    for (let i = 0; i < 20 && !screen.queryByTestId("player-cleared"); i++) {
      advance(450);
    }
    expect(screen.getByTestId("player-cleared")).not.toBeNull();
    expect(playerEl.className).toContain("te-loud-fire");
    expect(screen.getByTestId("blind-cleared-flash").textContent).toBe(
      "Cleared"
    );
    advance(600);
    expect(player()).toBeNull();
    expect(screen.getByTestId("blind-cleared-flash").textContent).toBe("");
  });

  it("shakes and flashes the stage through useArcadeFx on the zero-score rule, and not below 768px", () => {
    // The Arcade Kit shakes with the Web Animations API (#1524), which jsdom
    // lacks; a stub records which element each animation ran on.
    const animate = vi.fn(
      (_keyframes: Keyframe[], _options?: KeyframeAnimationOptions) =>
        ({}) as Animation
    );
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      writable: true,
      value: animate,
    });
    /** Transforms the score player's own stage was animated through. */
    const stageMoves = () => {
      const stage = player()!.firstElementChild;
      return animate.mock.contexts.flatMap((target, i) =>
        target === stage
          ? animate.mock.calls[i][0].map((frame) => String(frame.transform))
          : []
      );
    };
    try {
      render(<CardTable />);
      playZeroedPair();
      for (let i = 0; i < 20 && !screen.queryByTestId("zero-slam"); i++) {
        advance(450);
      }
      expect(stageMoves().some((t) => t.startsWith("translate("))).toBe(true);
      cleanup();
      animate.mockClear();

      mockMedia({ compact: true });
      render(<CardTable />);
      playZeroedPair();
      for (let i = 0; i < 20 && !screen.queryByTestId("zero-slam"); i++) {
        advance(450);
      }
      expect(stageMoves()).toEqual([]);
    } finally {
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
    }
  });

  it("skip, by button or plate click, lands on the identical final state", () => {
    const finalState = () => ({
      round: screen.getByTestId("round-score").textContent,
      cpu: screen.getByTestId("cpu-counter").textContent,
      lastHand: screen.getByTestId("last-hand").textContent,
      breakdown: screen.getByTestId("score-breakdown").textContent,
      announced: announce.mock.calls.map((c) => c[0]),
    });

    render(<CardTable />);
    playZeroedPair();
    elapse(10_000);
    const watched = finalState();
    cleanup();
    announce.mockClear();

    render(<CardTable />);
    playZeroedPair();
    advance(450);
    fireEvent.keyDown(screen.getByRole("button", { name: /Skip/ }), {
      key: " ",
    });
    fireEvent.click(screen.getByRole("button", { name: /Skip/ }));
    expect(player()).toBeNull();
    expect(finalState()).toEqual(watched);
    cleanup();
    announce.mockClear();

    render(<CardTable />);
    playZeroedPair();
    fireEvent.click(player()!);
    expect(player()).toBeNull();
    expect(finalState()).toEqual(watched);
  });

  it("plays faster at 4× and remembers the choice", () => {
    render(<CardTable />);
    const four = screen.getByRole("button", { name: "4×" });
    fireEvent.click(four);
    expect(four.getAttribute("aria-pressed")).toBe("true");
    expect(window.localStorage.getItem("te:game-speed")).toBe("4");

    playZeroedPair();
    const steps = expectedTimeline(ZEROED_PAIR);
    // At 1× this hand takes steps × 450 ms plus a 600 ms hold.
    const atOne = steps.length * Math.min(450, 3300 / steps.length) + 600;
    elapse(Math.ceil(atOne / 4) + 100);
    expect(player()).toBeNull();
    expect(screen.getByTestId("last-hand")).not.toBeNull();
  });

  it("never exceeds about 4 s at 1×, however long the timeline", () => {
    render(<CardTable />);
    playZeroedPair();
    elapse(4000);
    expect(player()).toBeNull();
  });

  it("under reduced motion resolves at once with one summary announcement", () => {
    mockMedia({ reduced: true });
    render(<CardTable />);
    playZeroedPair();
    expect(player()).toBeNull();
    expect(screen.getByTestId("last-hand")).not.toBeNull();
    const breakdown = screen.getByTestId("score-breakdown");
    const steps = expectedTimeline(ZEROED_PAIR);
    expect(
      within(breakdown)
        .getAllByRole("listitem")
        .map((li) => li.textContent)
    ).toEqual(steps.map((s) => s.text));
    const summary = breakdown.querySelector("summary")!;
    expect(summary.textContent).toBe("Last hand breakdown");
    expect(announce).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[class*='te-loud-']")).toBeNull();
  });
});

describe("useScorePlayback", () => {
  const longTimeline = (n: number): TimelineStep[] =>
    Array.from({ length: n }, (_, i) => ({
      kind: "X_MULT",
      source: `R${i}`,
      factor: 1,
      text: `R${i}: ×1 Mult.`,
      running: { chips: 1, mult: 1, xMult: 1 },
    }));

  it("keeps a 40-step relic chain under 4 s at 1×", () => {
    const steps = longTimeline(40);
    const key = {};
    const { result } = renderHook(() =>
      useScorePlayback(steps, key, { speed: 1, reducedMotion: false })
    );
    const start = Date.now();
    while (result.current.playing) {
      act(() => vi.advanceTimersToNextTimer());
    }
    expect(Date.now() - start).toBeLessThanOrEqual(4000);
    expect(result.current.shown).toBe(40);
  });

  it("emits onStep once per step, in order, even across re-renders", () => {
    const steps = longTimeline(3);
    const key = {};
    const onStep = vi.fn();
    const { result, rerender } = renderHook(() =>
      useScorePlayback(steps, key, { speed: 2, reducedMotion: false, onStep })
    );
    rerender();
    elapse(2000);
    rerender();
    expect(result.current.playing).toBe(false);
    expect(
      onStep.mock.calls.map(([step, index]) => [step.source, index])
    ).toEqual([
      ["R0", 0],
      ["R1", 1],
      ["R2", 2],
    ]);
  });

  it("does not play before any hand, and resolves at once under reduced motion", () => {
    const { result: idle } = renderHook(() =>
      useScorePlayback(null, null, { speed: 1, reducedMotion: false })
    );
    expect(idle.current).toMatchObject({ playing: false, shown: 0 });
    const steps = longTimeline(3);
    const onStep = vi.fn();
    const { result } = renderHook(() =>
      useScorePlayback(steps, {}, { speed: 1, reducedMotion: true, onStep })
    );
    expect(result.current).toMatchObject({ playing: false, shown: 3 });
    expect(onStep).not.toHaveBeenCalled();
  });
});
