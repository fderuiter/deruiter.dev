// #2972: the guided tutorial model every arcade game's tutorial is written
// in, its device record, and the scripts the games ship.
import { describe, it, expect, beforeEach } from "vitest";
import {
  ARCADE_REGISTRY,
  ARCADE_TUTORIALS_KEY,
  TUTORIAL_IDLE,
  arcadeTutorialsSlice,
  isStepComplete,
  read,
  setTutorialOutcome,
  shouldOfferTutorial,
  signalCounts,
  tutorialReducer,
  validateTutorialScript,
  type TutorialAction,
  type TutorialScript,
  type TutorialState,
} from "@/lib/arcade";
import {
  LASER_LOON_TUTORIAL,
  LASER_LOON_TUTORIAL_SIGNALS,
} from "@/lib/laser-loon";

const SCRIPT: TutorialScript = {
  gameId: "test-game",
  version: 1,
  minutes: 1,
  steps: [
    { id: "hello", chapter: "Basics", title: "Hi", body: "Read me." },
    {
      id: "jump",
      chapter: "Basics",
      title: "Jump",
      body: "Jump twice.",
      practice: { signal: "jump", count: 2 },
    },
    {
      id: "duck",
      chapter: "Basics",
      title: "Duck",
      body: "Duck once.",
      practice: { signal: "duck" },
    },
    { id: "bye", chapter: "End", title: "Bye", body: "Done." },
  ],
};

function run(...actions: TutorialAction[]): TutorialState {
  return actions.reduce(
    (state, action) => tutorialReducer(SCRIPT, state, action),
    TUTORIAL_IDLE
  );
}

describe("tutorialReducer", () => {
  it("starts on the first step and passes a read step with Next", () => {
    const state = run({ type: "start" }, { type: "next" });
    expect(state.status).toBe("running");
    expect(state.index).toBe(1);
  });

  it("holds a practice step until its signals arrive", () => {
    let state = run({ type: "start" }, { type: "next" });
    expect(isStepComplete(SCRIPT, state)).toBe(false);
    expect(tutorialReducer(SCRIPT, state, { type: "next" })).toBe(state);
    state = tutorialReducer(SCRIPT, state, { type: "signal", name: "jump" });
    expect(state.progress).toBe(1);
    state = tutorialReducer(SCRIPT, state, { type: "signal", name: "jump" });
    expect(isStepComplete(SCRIPT, state)).toBe(true);
    // A third signal changes nothing.
    expect(
      tutorialReducer(SCRIPT, state, { type: "signal", name: "jump" })
    ).toBe(state);
    expect(tutorialReducer(SCRIPT, state, { type: "next" }).index).toBe(2);
  });

  it("ignores signals another step waits for, and signals while idle", () => {
    const state = run({ type: "start" }, { type: "next" });
    expect(
      tutorialReducer(SCRIPT, state, { type: "signal", name: "duck" })
    ).toBe(state);
    expect(
      tutorialReducer(SCRIPT, TUTORIAL_IDLE, { type: "signal", name: "jump" })
    ).toBe(TUTORIAL_IDLE);
    expect(signalCounts(SCRIPT, state, "duck")).toBe(false);
    expect(signalCounts(SCRIPT, state, "jump")).toBe(true);
  });

  it("skips a practice, remembering which, and never skips a read step", () => {
    const reading = run({ type: "start" });
    expect(tutorialReducer(SCRIPT, reading, { type: "skip-practice" })).toBe(
      reading
    );
    const state = run(
      { type: "start" },
      { type: "next" },
      { type: "skip-practice" }
    );
    expect(state.index).toBe(2);
    expect(state.skipped).toEqual(["jump"]);
  });

  it("goes back with the earlier practice reset", () => {
    const state = run(
      { type: "start" },
      { type: "next" },
      { type: "signal", name: "jump" },
      { type: "signal", name: "jump" },
      { type: "next" },
      { type: "back" }
    );
    expect(state.index).toBe(1);
    expect(state.progress).toBe(0);
    expect(
      tutorialReducer(SCRIPT, run({ type: "start" }), { type: "back" })
    ).toMatchObject({ index: 0 });
  });

  it("finishes after the last step and can be left at any step", () => {
    const finished = run(
      { type: "start" },
      { type: "next" },
      { type: "skip-practice" },
      { type: "signal", name: "duck" },
      { type: "next" },
      { type: "next" }
    );
    expect(finished.status).toBe("finished");
    expect(run({ type: "start" }, { type: "exit" }).status).toBe("exited");
    // A finished run ignores everything but a fresh start.
    expect(tutorialReducer(SCRIPT, finished, { type: "back" })).toBe(finished);
    expect(tutorialReducer(SCRIPT, finished, { type: "start" })).toMatchObject({
      status: "running",
      index: 0,
      skipped: [],
    });
  });
});

describe("validateTutorialScript", () => {
  it("passes a sound script and names each problem", () => {
    expect(validateTutorialScript(SCRIPT)).toEqual([]);
    const broken: TutorialScript = {
      ...SCRIPT,
      version: 0,
      steps: [
        { id: "a", chapter: "x", title: "", body: "b" },
        {
          id: "a",
          chapter: "x",
          title: "t",
          body: "b",
          practice: { signal: " " },
        },
      ],
    };
    expect(validateTutorialScript(broken)).toHaveLength(4);
  });
});

describe("arcade.tutorials slice", () => {
  beforeEach(() => localStorage.clear());

  it("offers a tutorial until this version is finished or turned down", () => {
    expect(shouldOfferTutorial(undefined, 1)).toBe(true);
    setTutorialOutcome("laser-loon", 1, "declined");
    const record = read(arcadeTutorialsSlice).games["laser-loon"];
    expect(shouldOfferTutorial(record, 1)).toBe(false);
    // A revised script is offered again.
    expect(shouldOfferTutorial(record, 2)).toBe(true);
    expect(localStorage.getItem(ARCADE_TUTORIALS_KEY)).toContain("laser-loon");
  });

  it("never lets a decline overwrite a completion of the same version", () => {
    setTutorialOutcome("laser-loon", 1, "completed");
    setTutorialOutcome("laser-loon", 1, "declined");
    expect(read(arcadeTutorialsSlice).games["laser-loon"]).toEqual({
      version: 1,
      outcome: "completed",
    });
  });

  it("drops damaged entries rather than the whole record", () => {
    localStorage.setItem(
      ARCADE_TUTORIALS_KEY,
      JSON.stringify({
        version: 1,
        games: {
          "laser-loon": { version: 1, outcome: "completed" },
          broken: { version: "x", outcome: "maybe" },
        },
      })
    );
    expect(Object.keys(read(arcadeTutorialsSlice).games)).toEqual([
      "laser-loon",
    ]);
  });
});

/**
 * Every game gets a tutorial under epic #2972, one PR per game. A game moves
 * from PENDING to SCRIPTS when its tutorial ships, so the epic cannot close
 * with one missing.
 */
const SCRIPTS: Record<string, TutorialScript> = {
  "laser-loon": LASER_LOON_TUTORIAL,
};
const PENDING = [
  "working-with-duck",
  "quasi-puzzler",
  "garmin-watch",
  "clinical-chaos",
  "trial-and-error",
  "study-director",
  "patty-drive-thru",
  "for-better-or-bulk",
  "retro-labyrinth",
  "meme-vault",
  "protocol-drift",
];

describe("game tutorials", () => {
  it("covers every registry game, each either shipped or pending", () => {
    const slugs = ARCADE_REGISTRY.map((game) => game.slug).sort();
    expect([...Object.keys(SCRIPTS), ...PENDING].sort()).toEqual(slugs);
  });

  it.each(Object.entries(SCRIPTS))("%s has a sound script", (slug, script) => {
    expect(script.gameId).toBe(slug);
    expect(validateTutorialScript(script)).toEqual([]);
    // Teaching by doing: at least half the steps are practice.
    const practice = script.steps.filter((step) => step.practice).length;
    expect(practice * 2).toBeGreaterThanOrEqual(script.steps.length);
  });

  it("practises only signals Laser Loon sends", () => {
    const sent = new Set<string>(Object.values(LASER_LOON_TUTORIAL_SIGNALS));
    for (const step of LASER_LOON_TUTORIAL.steps) {
      if (step.practice) expect(sent.has(step.practice.signal)).toBe(true);
    }
  });
});
