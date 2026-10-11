import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  DEFAULT_SETUP,
  IDLE_FRAME,
  bankText,
  computeReceipt,
  createLevel,
  stepGame,
  type Frame,
  type GameState,
  type PresenceDecision,
  type Setup,
} from "@/lib/for-better-or-bulk";
import { CeremonyPlayback } from "@/components/for-better-or-bulk/CeremonyPlayback";
import { ReceiptView } from "@/components/for-better-or-bulk/ReceiptView";
import { ceremonyScenes } from "@/components/for-better-or-bulk/playback";

const STAY: PresenceDecision = { choice: "stay", commitment: null };
const REDUCE = "(prefers-reduced-motion: reduce)";

/** A level played to its end with nobody working and the brothers answered. */
function endedState(setup: Setup = DEFAULT_SETUP): GameState {
  let state = createLevel(setup);
  for (let i = 0; i < 20000 && state.phase !== "done"; i++) {
    const frame: Frame =
      state.phase === "brothers"
        ? { ...IDLE_FRAME, decision: STAY }
        : IDLE_FRAME;
    state = stepGame(state, frame).state;
  }
  return state;
}

/** The same ending with every lantern target filled, as if they were hung. */
function withLanternsHung(state: GameState): GameState {
  return {
    ...state,
    targets: state.targets.map((target) =>
      target.category === "lanterns"
        ? { ...target, status: "filled" as const }
        : target
    ),
  };
}

/** Answers the reduced-motion query with `reduce`, and every other query with no match. */
function stubReduced(reduce: boolean) {
  window.matchMedia = vi.fn((query: string) =>
    fromPartial<MediaQueryList>({
      matches: reduce && query === REDUCE,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (window as Partial<Window>).matchMedia;
});

describe("ceremony playback in motion", () => {
  it("focuses Skip when it opens", () => {
    stubReduced(false);
    render(<CeremonyPlayback state={endedState()} onDone={vi.fn()} />);
    expect(screen.getByTestId("fbb-playback").getAttribute("data-mode")).toBe(
      "motion"
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Skip" })
    );
  });

  it("hands over to the receipt once when Skip is pressed", () => {
    stubReduced(false);
    const onDone = vi.fn();
    render(<CeremonyPlayback state={endedState()} onDone={onDone} />);
    const skip = screen.getByRole("button", { name: "Skip" });
    fireEvent.click(skip);
    fireEvent.click(skip);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("skips on Escape, once", () => {
    stubReduced(false);
    const onDone = vi.fn();
    render(<CeremonyPlayback state={endedState()} onDone={onDone} />);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("plays the scenes in order and hands over when the last one ends", () => {
    vi.useFakeTimers();
    stubReduced(false);
    const state = endedState();
    const scenes = ceremonyScenes(state);
    const onDone = vi.fn();
    render(<CeremonyPlayback state={state} onDone={onDone} />);
    expect(screen.getByTestId("fbb-scene").getAttribute("data-scene")).toBe(
      scenes[0]?.id
    );
    for (const [i, scene] of scenes.entries()) {
      expect(screen.getByTestId("fbb-scene").getAttribute("data-scene")).toBe(
        scene.id
      );
      expect(screen.getByText(scene.line)).toBeTruthy();
      expect(onDone).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(scene.seconds * 1000);
      });
      if (i === scenes.length - 1) break;
    }
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("ceremony playback with reduced motion", () => {
  it("shows a static summary card instead of the scenes", () => {
    stubReduced(true);
    const state = endedState();
    const onDone = vi.fn();
    render(<CeremonyPlayback state={state} onDone={onDone} />);
    const card = screen.getByTestId("fbb-playback");
    expect(card.getAttribute("data-mode")).toBe("static");
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
    expect(screen.queryByTestId("fbb-scene")).toBeNull();
    const summary = screen.getAllByTestId("fbb-summary-scene");
    expect(summary).toHaveLength(ceremonyScenes(state).length);
    expect(within(card).getByText(bankText("dinner"))).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Continue to the receipt" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to the receipt" })
    );
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("shows the lanterns at dusk only when lanterns were hung", () => {
    stubReduced(true);
    const state = endedState();
    const { rerender } = render(
      <CeremonyPlayback state={state} onDone={vi.fn()} />
    );
    expect(screen.queryByText(bankText("joke-lanterns"))).toBeNull();
    rerender(
      <CeremonyPlayback state={withLanternsHung(state)} onDone={vi.fn()} />
    );
    expect(screen.getByText(bankText("joke-lanterns"))).toBeTruthy();
  });
});

describe("the receipt card", () => {
  const noop = vi.fn();

  it("shows the real note and links to the wedding page", () => {
    render(
      <ReceiptView
        receipt={computeReceipt(endedState())}
        runCode={null}
        onPlayAgain={noop}
        onChangePlan={noop}
        onWatchReplay={noop}
      />
    );
    const note = screen.getByTestId("fbb-actual");
    expect(note.textContent).toContain("What actually happened");
    expect(note.textContent).toContain(bankText("prep"));
    expect(note.textContent).toContain(bankText("weather"));
    const link = screen.getByRole("link", { name: bankText("actual-link") });
    expect(link.getAttribute("href")).toBe("/wedding");
  });

  it("says Extra smoky when a batch burnt, and keeps the stars block", () => {
    const state = endedState();
    render(
      <ReceiptView
        receipt={computeReceipt({ ...state, burntBatches: 1 })}
        runCode={null}
        onPlayAgain={noop}
        onChangePlan={noop}
        onWatchReplay={noop}
      />
    );
    expect(screen.getByText(/Extra smoky/)).toBeTruthy();
    expect(screen.getByTestId("fbb-stars")).toBeTruthy();
  });
});
