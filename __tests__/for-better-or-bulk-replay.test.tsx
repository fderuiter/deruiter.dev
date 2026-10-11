import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  DEFAULT_SETUP,
  IDLE_INPUT,
  RUN_CODE_REFUSAL,
  computeReceipt,
  createLevel,
  encodeRunCode,
  runResultOf,
  stepGame,
  type Frame,
  type GameState,
  type SharedRun,
} from "@/lib/for-better-or-bulk";
import { ReplayControls } from "@/components/for-better-or-bulk/ReplayControls";
import { ReceiptView } from "@/components/for-better-or-bulk/ReceiptView";
import { ForBetterOrBulkGame } from "@/components/for-better-or-bulk/ForBetterOrBulkGame";

const clipboard = vi.hoisted(() => ({ copy: vi.fn() }));
const scores = vi.hoisted(() => ({ record: vi.fn(), unlock: vi.fn() }));

vi.mock("@/lib/clipboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/clipboard")>()),
  copyToClipboard: clipboard.copy,
  getActiveHostUrl: () => "https://deruiter.dev",
}));

vi.mock("@/lib/arcade-achievements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/arcade-achievements")>()),
  recordArcadeScore: scores.record,
  unlockArcadeTrophies: scores.unlock,
}));

vi.mock("@/hooks/useAnimationFrame", () => ({
  useAnimationFrame: () => undefined,
}));

vi.mock("@/components/for-better-or-bulk/sfx", () => ({
  playSfx: vi.fn(),
}));

/** A run in which nobody moves: the brothers get a "stay", and the level runs out. */
function idleRun(): SharedRun {
  let state: GameState = createLevel(DEFAULT_SETUP);
  const frames: Frame[] = [];
  for (let tick = 0; tick < 8000 && state.phase !== "done"; tick++) {
    const next: Frame =
      state.phase === "brothers"
        ? {
            inputs: { fred: IDLE_INPUT, abbi: IDLE_INPUT },
            decision: { choice: "stay", commitment: null },
          }
        : { inputs: { fred: IDLE_INPUT, abbi: IDLE_INPUT } };
    frames.push(next);
    state = stepGame(state, next).state;
  }
  return { setup: DEFAULT_SETUP, frames, result: runResultOf(state) };
}

describe("ReplayControls", () => {
  const noop = () => undefined;

  function renderControls(
    overrides: Partial<React.ComponentProps<typeof ReplayControls>> = {}
  ) {
    const props = {
      clock: "9:00",
      playing: true,
      finished: false,
      speed: 1 as const,
      announcement: "",
      onTogglePlay: noop,
      onRestart: noop,
      onSpeedChange: noop,
      onExit: noop,
      ...overrides,
    };
    return render(<ReplayControls {...props} />);
  }

  afterEach(() => {
    cleanup();
  });

  it("labels every control and focuses play when a replay opens", () => {
    renderControls({ playing: false });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Play replay" }));
    expect(screen.getByRole("button", { name: "Restart replay" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exit replay" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Replay speed" })).toBeTruthy();
  });

  it("shows the current speed as pressed", () => {
    renderControls({ speed: 2 });
    expect(
      screen
        .getByRole("button", { name: "Replay at 2x speed" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Replay at 1x speed" })
        .getAttribute("aria-pressed")
    ).toBe("false");
  });

  it("calls back for play, restart, speed and exit", () => {
    const onTogglePlay = vi.fn();
    const onRestart = vi.fn();
    const onSpeedChange = vi.fn();
    const onExit = vi.fn();
    renderControls({ onTogglePlay, onRestart, onSpeedChange, onExit });
    fireEvent.click(screen.getByRole("button", { name: "Pause replay" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart replay" }));
    fireEvent.click(screen.getByRole("button", { name: "Replay at 4x speed" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit replay" }));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onSpeedChange).toHaveBeenCalledWith(4);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("offers to watch again once the replay has finished", () => {
    renderControls({ playing: false, finished: true });
    expect(screen.getByRole("button", { name: "Watch again" })).toBeTruthy();
  });

  it("announces the replay state in a live region", () => {
    renderControls({ announcement: "Replay paused at 9:40." });
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("Replay paused at 9:40.");
  });
});

describe("ReceiptView game challenges", () => {
  const receipt = computeReceipt({
    ...createLevel(DEFAULT_SETUP),
    burntBatches: 0,
    finishedAt: 0,
    presence: null,
  });

  beforeEach(() => {
    clipboard.copy.mockReset();
    clipboard.copy.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  function renderReceipt(runCode: string | null, onWatchReplay = vi.fn()) {
    return render(
      <ReceiptView
        receipt={receipt}
        runCode={runCode}
        onPlayAgain={vi.fn()}
        onChangePlan={vi.fn()}
        onWatchReplay={onWatchReplay}
      />
    );
  }

  it("shows the copy, the stars and each challenge's state", () => {
    renderReceipt(null);
    expect(
      screen.getByText("Game challenges. Not a grade on the wedding.")
    ).toBeTruthy();
    expect(screen.getByTestId("fbb-stars").textContent).toContain("3 of 3 met");
    expect(screen.getByTestId("fbb-challenge-no-burnt").textContent).toContain(
      "Met"
    );
    expect(
      screen.getByTestId("fbb-challenge-fred-stayed").textContent
    ).toContain("Fred stayed");
  });

  it("offers replay and a copyable run link only when the run can be shared", () => {
    renderReceipt(null);
    expect(screen.queryByRole("button", { name: "Watch replay" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy run code" })).toBeNull();
  });

  it("copies the #run= link on the page's own origin", async () => {
    renderReceipt("f1.abc");
    fireEvent.click(screen.getByRole("button", { name: "Copy run code" }));
    await waitFor(() =>
      expect(clipboard.copy).toHaveBeenCalledWith(
        "https://deruiter.dev" + window.location.pathname + "#run=f1.abc"
      )
    );
    expect(await screen.findByRole("status")).toBeTruthy();
  });

  it("starts the replay from the watch button", () => {
    const onWatchReplay = vi.fn();
    renderReceipt("f1.abc", onWatchReplay);
    fireEvent.click(screen.getByRole("button", { name: "Watch replay" }));
    expect(onWatchReplay).toHaveBeenCalledTimes(1);
  });
});

describe("For Better or Bulk shared links", () => {
  beforeEach(() => {
    scores.record.mockClear();
    scores.unlock.mockClear();
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  it("refuses a corrupt run code with a message and does not throw", () => {
    const code = encodeRunCode(idleRun());
    const flipped = `${code.slice(0, 20)}${code[20] === "A" ? "B" : "A"}${code.slice(21)}`;
    window.history.replaceState(
      null,
      "",
      `/arcade/for-better-or-bulk#run=${flipped}`
    );
    render(<ForBetterOrBulkGame />);
    expect(screen.getByRole("alert").textContent).toBe(RUN_CODE_REFUSAL);
    expect(screen.queryByRole("button", { name: "Watch replay" })).toBeNull();
  });

  it("offers a valid shared run, replays it, and records no score", () => {
    const code = encodeRunCode(idleRun());
    window.history.replaceState(
      null,
      "",
      `/arcade/for-better-or-bulk#run=${code}`
    );
    render(<ForBetterOrBulkGame />);
    expect(screen.queryByTestId("fbb-replay")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Watch replay" }));
    expect(screen.getByTestId("fbb-replay")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Exit replay" }));
    expect(screen.getByTestId("fbb-setup")).toBeTruthy();
    expect(scores.record).not.toHaveBeenCalled();
    expect(scores.unlock).not.toHaveBeenCalled();
  });

  it("clears the offer when dismissed", () => {
    const code = encodeRunCode(idleRun());
    window.history.replaceState(
      null,
      "",
      `/arcade/for-better-or-bulk#run=${code}`
    );
    render(<ForBetterOrBulkGame />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    });
    expect(screen.queryByTestId("fbb-shared")).toBeNull();
  });
});
