import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import { GAME_MANUALS } from "@/lib/game-manuals";
import {
  START_CONTINUES,
  clearWorkout,
  newPlan,
  type PlanNodeId,
  type PlanSave,
} from "@/lib/garmin-plan";
import { loadPlan, savePlan } from "@/lib/garmin-plan-store";
import { PLAN_RUN_MODE, RACE_MODE_KEY } from "@/lib/garmin-race-store";
import { safeClear, safeSetRawItem } from "@/lib/safe-storage";
import { GROUND_Y, startGame, updateGameSimulation } from "@/lib/garmin-engine";
import { BASE_HEIGHT } from "@/lib/garmin-powerups";

// The Training Plan in the simulator (#1994): the run mode, the Morning
// Report and map on the watch, starting and settling workouts, practice,
// DNFs, a Recovery Hut, New plan and the panel's map.

const frame = vi.hoisted(() => ({
  cb: null as null | ((deltaMs: number) => void),
}));
const said = vi.hoisted(() => ({ texts: [] as string[] }));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({
    announce: (text: string) => {
      said.texts.push(text);
    },
  }),
}));
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
}));
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));
vi.mock("@/hooks/useAnimationFrame", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/useAnimationFrame")>();
  return {
    ...actual,
    useAnimationFrame: (callback: (deltaMs: number) => void) => {
      frame.cb = callback;
    },
  };
});
vi.mock("@/lib/garmin-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/garmin-engine")>();
  return {
    ...actual,
    // Workouts start on a clear lane with GPS locked.
    startGame: vi.fn((...args: Parameters<typeof actual.startGame>) => ({
      ...actual.startGame(...args),
      gpsMs: 0,
      obstacles: [],
      foes: [],
      lastObstacleTime: Date.now() + 600_000,
      lastAllocTime: Date.now() + 600_000,
      isGrounded: true,
      playerY: GROUND_Y - BASE_HEIGHT,
    })),
    updateGameSimulation: vi.fn(actual.updateGameSimulation),
  };
});

const watch = () => {
  const el = document.querySelector('[data-keyboard-boundary="true"]');
  if (!el) throw new Error("watch keyboard boundary missing");
  return el;
};
const face = () => screen.getByRole("img", { name: /Smartwatch display/ });
const key = (k: string) => fireEvent.keyDown(watch(), { key: k });

/** Runs `n` frames of 1/60 s. */
function frames(n: number) {
  for (let i = 0; i < n; i++) act(() => frame.cb?.(1000 / 60));
}

/** Ends the run on the next step: finished, or out of lives. */
function endNextStep(finished: boolean, extra = {}) {
  vi.mocked(updateGameSimulation).mockImplementationOnce((s) => ({
    ...s,
    gameState: finished ? "summary" : "crashed",
    runClockMs: 64_500,
    lapSplits: [64_500],
    score: 1800,
    lives: finished ? 2 : 0,
    ...extra,
  }));
  frames(1);
}

/** A stored plan with `ids` cleared. */
function storePlan(ids: PlanNodeId[], extra: Partial<PlanSave> = {}) {
  const save = ids.reduce(
    (s, id) =>
      clearWorkout(s, id, { lives: 3, score: 1000, trainingEffect: 3 }),
    newPlan(5)
  );
  savePlan({ ...save, ...extra });
}

/** The simulator in the Training Plan run mode. */
function renderPlan() {
  safeSetRawItem(RACE_MODE_KEY, PLAN_RUN_MODE);
  return render(<GarminWatchSimulator />);
}

beforeEach(() => {
  frame.cb = null;
  said.texts = [];
  safeClear();
  vi.mocked(startGame).mockClear();
  vi.mocked(updateGameSimulation).mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Training Plan run mode (#1994)", () => {
  it("is picked from the run modes and opens on the Morning Report", () => {
    render(<GarminWatchSimulator />);
    expect(screen.queryByTestId("training-plan-panel")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Training Plan" }));
    expect(screen.getByTestId("training-plan-panel")).toBeTruthy();
    expect(face().getAttribute("aria-label")).toContain(
      "Morning Report. Training Readiness 75, High. Next workout: Easy Run, Monday."
    );
    // The idle start card stays away: the watch shows the plan.
    expect(screen.queryByText("START SIMULATION")).toBeNull();
    expect(
      screen.getByRole("switch", { name: "Dev Mode" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("moves round the map with the arrow keys along open paths", () => {
    storePlan(["easy", "tempo"]);
    renderPlan();
    key("Enter");
    expect(face().getAttribute("aria-label")).toContain(
      "Training Plan map. On Easy Run, Monday."
    );
    key("ArrowRight");
    expect(said.texts.at(-1)).toBe(
      "Tempo, week 1 Wednesday, stage 2: cleared, Space or START runs it as practice"
    );
    key("ArrowDown");
    expect(said.texts.at(-1)).toContain("Recovery Hut, week 2 Tuesday: open");
    key("ArrowUp");
    key("ArrowRight");
    key("ArrowRight");
    // Long Run is still locked, so the cursor stays on Intervals.
    expect(face().getAttribute("aria-label")).toContain(
      "On Intervals, Friday."
    );
    expect(loadPlan()?.cursor).toBe("intervals");
  });

  it("starts the workout under the cursor with the plan's lives", () => {
    storePlan([], { lives: 5 });
    renderPlan();
    key("Enter");
    key(" ");
    const args = vi.mocked(startGame).mock.calls.at(-1);
    expect(args?.[4]).toEqual({
      stage: 1,
      seed: expect.any(Number),
      raceDay: false,
    });
    expect(args?.[3]).toBeUndefined();
    frames(1);
    expect(face().getAttribute("aria-label")).toContain("Status: playing");
    expect(face().getAttribute("aria-label")).toContain("lives 5");
  });

  it("clears a finished workout, opens its paths and shows the card", () => {
    renderPlan();
    key("Enter");
    key("Enter");
    frames(2);
    endNextStep(true);
    const save = loadPlan();
    expect(save?.cleared).toEqual(["easy"]);
    expect(save?.lives).toBe(2);
    expect(save?.score).toBe(1800);
    expect(face().getAttribute("aria-label")).toContain(
      "Easy Run done in 1:04.50. Tempo open."
    );
    fireEvent.click(screen.getByRole("button", { name: /Back to training/ }));
    expect(face().getAttribute("aria-label")).toContain("Morning Report");
    expect(face().getAttribute("aria-label")).toContain(
      "Next workout: Tempo, Wednesday."
    );
  });

  it("leaves the plan untouched after a practice run", () => {
    storePlan(["easy"]);
    renderPlan();
    const before = loadPlan();
    key("Enter");
    key("Enter");
    expect(said.texts).toContain(
      "Practice: Easy Run. Nothing on the plan changes."
    );
    // Practice starts with a fresh three, whatever the plan holds.
    frames(1);
    expect(face().getAttribute("aria-label")).toContain("lives 3");
    endNextStep(true);
    expect(loadPlan()).toEqual(before);
    expect(face().getAttribute("aria-label")).toContain(
      "Practice Easy Run done in 1:04.50. The plan is unchanged."
    );
  });

  it("sends a lost workout back to training, paid for with a continue", () => {
    renderPlan();
    key("Enter");
    key("Enter");
    frames(1);
    endNextStep(false);
    const save = loadPlan();
    expect(save?.cleared).toEqual([]);
    expect(save?.continues).toBe(START_CONTINUES - 1);
    expect(save?.lives).toBe(3);
    expect(face().getAttribute("aria-label")).toContain(
      "DNF, back to training. 1 continue left. Lives back to 3."
    );
    key("Enter");
    expect(face().getAttribute("aria-label")).toContain("Morning Report");
  });

  it("gives one of three hidden items at a Recovery Hut", () => {
    storePlan(["easy", "tempo"], { cursor: "hut-1" });
    renderPlan();
    key("Enter");
    key("Enter");
    expect(face().getAttribute("aria-label")).toContain(
      "Recovery Hut. Box 2 of 3 selected."
    );
    key("ArrowLeft");
    expect(face().getAttribute("aria-label")).toContain("Box 1 of 3 selected.");
    key(" ");
    const save = loadPlan();
    expect(save?.bag).toHaveLength(1);
    expect(save?.cleared).toContain("hut-1");
    expect(said.texts.at(-1)).toMatch(
      /^You took the .+\. It is in the gear bag\.$/
    );
    const panel = screen.getByTestId("training-plan-panel");
    expect(within(panel).getByRole("list", { name: "Gear bag" })).toBeTruthy();
    key("Enter");
    expect(face().getAttribute("aria-label")).toContain("Training Plan map");
  });

  it("runs Race Day as a race on its own board", () => {
    storePlan(["easy", "tempo", "intervals", "long"], { cursor: "raceday" });
    renderPlan();
    key("Enter");
    key("Enter");
    const args = vi.mocked(startGame).mock.calls.at(-1);
    expect(args?.[3]).toEqual({
      course: "raceday",
      category: "any",
      seed: args?.[4]?.seed,
    });
    expect(args?.[4]?.raceDay).toBe(true);
    frames(1);
    endNextStep(true);
    expect(loadPlan()?.finished).toBe(true);
    expect(face().getAttribute("aria-label")).toContain(
      "Finisher! Race Day in 1:04.50."
    );
    const report = screen.getByRole("region", { name: "Race report" });
    expect(within(report).getByText(/Race Day/)).toBeTruthy();
  });
});

describe("the Training Plan panel (#1994)", () => {
  it("lists every node with its label, and only open ones can be entered", () => {
    storePlan(["easy"]);
    renderPlan();
    const map = screen.getByRole("list", { name: "Training Plan map" });
    const buttons = within(map).getAllByRole("button");
    expect(buttons).toHaveLength(7);
    const easy = within(map).getByRole("button", {
      name: "Easy Run, week 1 Monday, stage 1: cleared, Space or START runs it as practice",
    });
    expect(easy.getAttribute("aria-current")).toBe("true");
    const race = within(map).getByRole("button", { name: /^Race Day/ });
    expect(race.hasAttribute("disabled")).toBe(true);
    fireEvent.click(
      within(map).getByRole("button", {
        name: /^Tempo, .*Space or START starts it$/,
      })
    );
    const args = vi.mocked(startGame).mock.calls.at(-1);
    expect(args?.[4]?.stage).toBe(2);
  });

  it("starts a new plan once confirmed", () => {
    storePlan(["easy", "tempo"], { score: 5000 });
    renderPlan();
    const confirm = vi.spyOn(window, "confirm");
    confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "New plan" }));
    expect(loadPlan()?.cleared).toEqual(["easy", "tempo"]);
    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "New plan" }));
    expect(loadPlan()?.cleared).toEqual([]);
    expect(loadPlan()?.score).toBe(0);
  });
});

describe("the gear bag (#1995)", () => {
  it("opens on the map with X, as a dialog that takes and gives back focus", async () => {
    storePlan([], { bag: ["cape", "gel"] });
    renderPlan();
    key("Enter");
    (watch() as HTMLElement).focus();
    key("x");
    const dialog = screen.getByRole("dialog", { name: "Gear bag · 2/8" });
    expect(document.activeElement).toBe(
      within(dialog).getByRole("heading", { name: "Gear bag · 2/8" })
    );
    expect(
      within(dialog).getByRole("list", { name: "Items in the bag" })
    ).toBeTruthy();
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    // The trap gives focus back on a timeout.
    await waitFor(() => expect(document.activeElement).toBe(watch()));
  });

  it("packs a power-up that the next workout starts with, and spends it", () => {
    storePlan([], { bag: ["cape"] });
    renderPlan();
    fireEvent.click(screen.getByRole("button", { name: "Open gear bag (X)" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Pack Compression Cape" })
    );
    expect(loadPlan()?.packed).toEqual(["cape"]);
    expect(loadPlan()?.bag).toEqual([]);
    // The pressed button is gone, so focus stays in the bag on its heading.
    expect(document.activeElement?.closest('[role="dialog"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    key("Enter");
    key(" ");
    frames(1);
    expect(face().getAttribute("aria-label")).toContain("Compression Cape");
    expect(loadPlan()?.packed).toEqual([]);
    expect(said.texts.some((t) => t.includes("Packed: Compression Cape"))).toBe(
      true
    );
  });

  it("leaves packed gear alone on a practice run", () => {
    storePlan(["easy"], { bag: [], packed: ["gel"], cursor: "easy" });
    renderPlan();
    key("Enter");
    key(" ");
    expect(loadPlan()?.packed).toEqual(["gel"]);
  });

  it("takes a Rest Day from the bag to open the paths past the next workout", () => {
    storePlan(["easy"], { bag: ["restday"] });
    renderPlan();
    fireEvent.click(screen.getByRole("button", { name: "Open gear bag (X)" }));
    const take = screen.getByRole("button", { name: "Take Rest Day" });
    expect(take.getAttribute("aria-describedby")).toBeTruthy();
    fireEvent.click(take);
    expect(loadPlan()?.unlocked).toEqual(["intervals", "hut-1"]);
    expect(said.texts).toContain(
      "Rest Day taken. Intervals and Recovery Hut are open."
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    const map = screen.getByRole("list", { name: "Training Plan map" });
    expect(
      within(map)
        .getByRole("button", { name: /^Intervals,/ })
        .hasAttribute("disabled")
    ).toBe(false);
  });

  it("closes on Escape without taking the watch back from the map", () => {
    storePlan([], { bag: ["gel"] });
    renderPlan();
    key("Enter");
    key("x");
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(face().getAttribute("aria-label")).toContain("Training Plan map");
  });

  it("is closed by a workout starting, and stays closed after it", () => {
    storePlan([], { bag: ["gel"] });
    renderPlan();
    key("Enter");
    key("x");
    expect(screen.getByRole("dialog")).toBeTruthy();
    // The watch still takes START while the bag is open.
    key(" ");
    frames(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    endNextStep(true);
    // The result card is a dialog of its own; the bag stays shut.
    expect(screen.queryByRole("dialog", { name: /Gear bag/ })).toBeNull();
  });

  it("is left alone by Race Mode: Base tier, and the packed gear stays", () => {
    storePlan([], { bag: ["gel"], packed: ["cape"] });
    safeSetRawItem(RACE_MODE_KEY, "1");
    render(<GarminWatchSimulator />);
    expect(screen.queryByRole("button", { name: /gear bag/ })).toBeNull();
    key("Enter");
    frames(1);
    const label = face().getAttribute("aria-label") ?? "";
    expect(label).toContain("Status: playing");
    expect(label).not.toContain("Compression Cape");
    expect(loadPlan()?.packed).toEqual(["cape"]);
    expect(loadPlan()?.bag).toEqual(["gel"]);
  });

  it("shows why an item can't be used", () => {
    storePlan([], { bag: ["protein"], packed: ["cape"] });
    renderPlan();
    fireEvent.click(screen.getByRole("button", { name: "Open gear bag (X)" }));
    const pack = screen.getByRole("button", { name: "Pack Protein Shake" });
    expect(pack.hasAttribute("disabled")).toBe(true);
    const reason = document.getElementById(
      pack.getAttribute("aria-describedby") ?? ""
    );
    expect(reason?.textContent).toContain(
      "One power-up per workout: the Compression Cape is packed."
    );
  });
});

describe("Training Plan manual entries (#1994)", () => {
  it("describes the plan, huts, practice and The Wall", () => {
    const manual = JSON.stringify(GAME_MANUALS["garmin-watch"]);
    expect(manual).toContain('"title":"Training Plan"');
    expect(manual).toContain('"title":"Race Day and The Wall"');
    expect(manual).toContain("never changes the plan");
    expect(manual).toContain("It takes three hits");
    expect(manual).toContain('"title":"Gear Bag"');
    expect(manual).toContain("every race starts from the Base tier");
  });
});
