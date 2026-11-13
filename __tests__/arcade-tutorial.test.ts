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
import {
  MEME_VAULT_TUTORIAL,
  MEME_VAULT_TUTORIAL_SIGNALS,
} from "@/lib/meme-vault";
import { QUASI_TUTORIAL, QUASI_TUTORIAL_SIGNALS } from "@/lib/quasi-perfect";
import {
  WORKING_WITH_DUCK_TUTORIAL,
  WORKING_WITH_DUCK_TUTORIAL_SIGNALS,
} from "@/lib/working-with-duck";
import {
  GARMIN_TUTORIAL,
  GARMIN_TUTORIAL_SIGNALS,
} from "@/lib/garmin/tutorial";
import { PATTY_TUTORIAL, PATTY_TUTORIAL_SIGNALS } from "@/lib/patty-drive-thru";
import {
  RETRO_LABYRINTH_TUTORIAL,
  RETRO_LABYRINTH_TUTORIAL_SIGNALS,
} from "@/lib/retro-labyrinth";
import {
  CLINICAL_CHAOS_TUTORIAL,
  CLINICAL_CHAOS_TUTORIAL_SIGNALS,
} from "@/lib/clinical-trial-chaos";
import {
  STUDY_DIRECTOR_TUTORIAL,
  STUDY_DIRECTOR_TUTORIAL_SIGNALS,
} from "@/lib/study-director";
import {
  FOR_BETTER_OR_BULK_TUTORIAL,
  FOR_BETTER_OR_BULK_TUTORIAL_SIGNALS,
} from "@/lib/for-better-or-bulk";
import {
  TRIAL_AND_ERROR_TUTORIAL,
  TUTORIAL_RESULT_SIGNAL,
  TUTORIAL_STEPS,
} from "@/lib/trial-and-error";

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
  "meme-vault": MEME_VAULT_TUTORIAL,
  "quasi-puzzler": QUASI_TUTORIAL,
  "working-with-duck": WORKING_WITH_DUCK_TUTORIAL,
  "garmin-watch": GARMIN_TUTORIAL,
  "patty-drive-thru": PATTY_TUTORIAL,
  "trial-and-error": TRIAL_AND_ERROR_TUTORIAL,
  "retro-labyrinth": RETRO_LABYRINTH_TUTORIAL,
  "for-better-or-bulk": FOR_BETTER_OR_BULK_TUTORIAL,
  "study-director": STUDY_DIRECTOR_TUTORIAL,
  "clinical-chaos": CLINICAL_CHAOS_TUTORIAL,
};
const PENDING = ["protocol-drift"];

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

  it("practises only signals Working With Duck sends", () => {
    const sent = new Set<string>(
      Object.values(WORKING_WITH_DUCK_TUTORIAL_SIGNALS)
    );
    for (const step of WORKING_WITH_DUCK_TUTORIAL.steps) {
      if (step.practice) expect(sent.has(step.practice.signal)).toBe(true);
    }
  });

  it("practises only signals Monkey C Mayhem sends", () => {
    const sent = new Set<string>(Object.values(GARMIN_TUTORIAL_SIGNALS));
    for (const step of GARMIN_TUTORIAL.steps) {
      if (step.practice) expect(sent.has(step.practice.signal)).toBe(true);
    }
  });

  it("practises only signals Retro Labyrinth sends", () => {
    const sent = new Set<string>(
      Object.values(RETRO_LABYRINTH_TUTORIAL_SIGNALS)
    );
    for (const step of RETRO_LABYRINTH_TUTORIAL.steps) {
      if (step.practice) expect(sent.has(step.practice.signal)).toBe(true);
    }
  });

  it("practises only signals Patty's Drive-Thru sends", () => {
    const sent = new Set<string>(Object.values(PATTY_TUTORIAL_SIGNALS));
    for (const step of PATTY_TUTORIAL.steps) {
      if (step.practice) expect(sent.has(step.practice.signal)).toBe(true);
    }
  });

  it("practises only signals Clinical Trial Chaos sends", () => {
    const sent = new Set<string>(
      Object.values(CLINICAL_CHAOS_TUTORIAL_SIGNALS)
    );
    for (const step of CLINICAL_CHAOS_TUTORIAL.steps) {
      if (step.practice) expect(sent.has(step.practice.signal)).toBe(true);
    }
  });

  it("practises only signals Study Director sends", () => {
    const sent = new Set<string>(
      Object.values(STUDY_DIRECTOR_TUTORIAL_SIGNALS)
    );
    for (const step of STUDY_DIRECTOR_TUTORIAL.steps) {
      if (step.practice) expect(sent.has(step.practice.signal)).toBe(true);
    }
  });

  it("practises only signals Quasi-Perfect Puzzler sends", () => {
    const sent = new Set<string>(Object.values(QUASI_TUTORIAL_SIGNALS));
    for (const step of QUASI_TUTORIAL.steps) {
      if (step.practice) expect(sent.has(step.practice.signal)).toBe(true);
    }
  });

  it("practises only signals Meme Vault sends", () => {
    const sent = new Set<string>(Object.values(MEME_VAULT_TUTORIAL_SIGNALS));
    for (const step of MEME_VAULT_TUTORIAL.steps) {
      if (step.practice) expect(sent.has(step.practice.signal)).toBe(true);
    }
  });

  it("practises only signals For Better or Bulk sends", () => {
    const sent = new Set<string>(
      Object.values(FOR_BETTER_OR_BULK_TUTORIAL_SIGNALS)
    );
    for (const step of FOR_BETTER_OR_BULK_TUTORIAL.steps) {
      if (step.practice) expect(sent.has(step.practice.signal)).toBe(true);
    }
  });

  it("keeps Trial & Error's seven guided Blind steps as written", () => {
    const [last, ...rest] = [...TRIAL_AND_ERROR_TUTORIAL.steps].reverse();
    const guided = rest.reverse();
    expect(guided.map((step) => [step.id, step.title, step.body])).toEqual(
      TUTORIAL_STEPS.map((step) => [step.id, step.title, step.text])
    );
    // A table step practises its own id; the wrap-up waits for the result.
    for (const [index, step] of guided.entries()) {
      const table = TUTORIAL_STEPS[index];
      expect(step.practice?.signal).toBe(
        table.waitsFor === null ? undefined : table.id
      );
    }
    expect(last.practice?.signal).toBe(TUTORIAL_RESULT_SIGNAL);
  });
});
