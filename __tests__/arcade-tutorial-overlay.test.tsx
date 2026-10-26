// @vitest-environment jsdom
// #2972: the cabinet's guided tutorial. The first-launch offer, the coach
// card that waits for the game's practice signals, Skip, Leave, the closing
// card, and the device record behind them.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { useEffect } from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from "@testing-library/react";
import axe from "axe-core";
import {
  CabinetTutorialContext,
  TutorialOverlay,
  useCabinetTutorial,
  useTutorialRun,
  type TutorialRun,
} from "@/components/arcade/tutorial";
import {
  arcadeTutorialsSlice,
  read,
  setTutorialOutcome,
  type TutorialScript,
} from "@/lib/arcade";

const SCRIPT: TutorialScript = {
  gameId: "laser-loon",
  version: 1,
  minutes: 2,
  steps: [
    { id: "hello", chapter: "Basics", title: "Flight school", body: "Read." },
    {
      id: "fire",
      chapter: "Basics",
      title: "Fire",
      body: "Fire twice.",
      keys: "Space",
      touch: "Hold Fire",
      target: "controls",
      practice: { signal: "fire", count: 2 },
    },
    { id: "bye", chapter: "End", title: "Modes", body: "Pick a run." },
  ],
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 300,
    left: 40,
    right: 284,
    bottom: 344,
    width: 244,
    height: 44,
    x: 40,
    y: 300,
    toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// What the last render saw, written after commit.
const probe: {
  run: TutorialRun | null;
  game: { active: boolean; stepId: string | null } | null;
} = { run: null, game: null };

function Game() {
  const tutorial = useCabinetTutorial();
  useEffect(() => {
    probe.game = { active: tutorial.active, stepId: tutorial.stepId };
  });
  return (
    <div data-keyboard-boundary="true" tabIndex={0} data-testid="game">
      <button
        type="button"
        data-tutorial-target="controls"
        onClick={() => tutorial.signal("fire")}
      >
        Fire
      </button>
      <button type="button" onClick={() => tutorial.signal("jump")}>
        Jump
      </button>
    </div>
  );
}

function Cabinet({ touch = false }: { touch?: boolean }) {
  const run = useTutorialRun(SCRIPT);
  useEffect(() => {
    probe.run = run;
  });
  return (
    <main>
      <div data-arcade-cabinet="laser-loon" className="relative">
        <CabinetTutorialContext.Provider value={run.value}>
          <Game />
        </CabinetTutorialContext.Provider>
        <button type="button" onClick={run.start}>
          Tutorial
        </button>
        <TutorialOverlay
          run={run}
          gameName="Laser Loon"
          launched
          touch={touch}
        />
      </div>
    </main>
  );
}

describe("TutorialOverlay", () => {
  it("offers the tutorial once on launch, and Skip remembers the answer", () => {
    render(<Cabinet />);
    expect(screen.getByTestId("tutorial-offer")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "New to Laser Loon?" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip, just play" }));
    expect(screen.queryByTestId("tutorial-offer")).toBeNull();
    expect(read(arcadeTutorialsSlice).games["laser-loon"]).toEqual({
      version: 1,
      outcome: "declined",
    });
    cleanup();
    render(<Cabinet />);
    expect(screen.queryByTestId("tutorial-offer")).toBeNull();
  });

  it("walks a read step with Next and focuses it", async () => {
    render(<Cabinet />);
    fireEvent.click(screen.getByRole("button", { name: "Start the tutorial" }));
    const card = screen.getByTestId("tutorial-card");
    expect(card.getAttribute("data-tutorial-step")).toBe("hello");
    expect(probe.game).toEqual({ active: true, stepId: "hello" });
    const next = screen.getByRole("button", { name: "Next" });
    await waitFor(() => expect(document.activeElement).toBe(next));
    fireEvent.click(next);
    expect(
      screen.getByTestId("tutorial-card").getAttribute("data-tutorial-step")
    ).toBe("fire");
  });

  it("hands a practice step to the game, counts its signals and moves on", async () => {
    render(<Cabinet />);
    fireEvent.click(screen.getByRole("button", { name: "Start the tutorial" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByTestId("game"))
    );
    // A practice step has no Next: it waits for the game.
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.getByText("Space")).toBeTruthy();
    expect(screen.getByTestId("tutorial-ring")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Jump" }));
    expect(screen.getByTestId("tutorial-practice").textContent).toBe("0 of 2");
    fireEvent.click(screen.getByRole("button", { name: "Fire" }));
    fireEvent.click(screen.getByRole("button", { name: "Fire" }));
    expect(screen.getByTestId("tutorial-practice").textContent).toContain(
      "Done"
    );
    await waitFor(
      () =>
        expect(
          screen.getByTestId("tutorial-card").getAttribute("data-tutorial-step")
        ).toBe("bye"),
      { timeout: 2000 }
    );
  });

  it("shows the touch control on a touch cabinet", () => {
    render(<Cabinet touch />);
    fireEvent.click(screen.getByRole("button", { name: "Start the tutorial" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Hold Fire")).toBeTruthy();
  });

  it("skips a practice and finishes, recording the completion", () => {
    render(<Cabinet />);
    fireEvent.click(screen.getByRole("button", { name: "Start the tutorial" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip this step" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.getByTestId("tutorial-finished").textContent).toContain(
      "You skipped 1 practice step"
    );
    expect(read(arcadeTutorialsSlice).games["laser-loon"]?.outcome).toBe(
      "completed"
    );
    expect(probe.game?.active).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Start playing" }));
    expect(screen.queryByTestId("tutorial-finished")).toBeNull();
  });

  it("leaves from any step with the close key or Escape", () => {
    render(<Cabinet />);
    fireEvent.click(screen.getByRole("button", { name: "Start the tutorial" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave the tutorial" }));
    expect(screen.queryByTestId("tutorial-card")).toBeNull();
    // The Tutorial key replays it after leaving.
    fireEvent.click(screen.getByRole("button", { name: "Tutorial" }));
    fireEvent.keyDown(screen.getByTestId("tutorial-card"), { key: "Escape" });
    expect(screen.queryByTestId("tutorial-card")).toBeNull();
    expect(probe.run?.state.status).toBe("exited");
  });

  it("replays from the Tutorial key after it was finished", () => {
    setTutorialOutcome("laser-loon", 1, "completed");
    render(<Cabinet />);
    expect(screen.queryByTestId("tutorial-offer")).toBeNull();
    act(() => probe.run?.start());
    expect(screen.getByTestId("tutorial-card")).toBeTruthy();
  });

  it("has no axe violations on the offer and the card", async () => {
    const { container } = render(<Cabinet />);
    expect((await axe.run(container)).violations).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Start the tutorial" }));
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
