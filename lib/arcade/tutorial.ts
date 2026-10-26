/**
 * Guided tutorials (#2972): one script model every arcade game's tutorial is
 * written in, and the pure state machine that walks a player through it.
 *
 * A script is a list of steps grouped into chapters. A read step is passed
 * with Next. A practice step waits for the game to report that the player
 * did the thing (a named signal, such as `fire`), optionally several times,
 * so the tutorial teaches by doing rather than by reading. Any practice can
 * be skipped, and the whole tutorial can be left at any step.
 *
 * The cabinet owns the state; games only send signals and read whether a
 * tutorial is running (`components/arcade/tutorial`).
 */

/** What a practice step waits for. */
export interface TutorialPractice {
  /** The signal name the game sends, such as `fire`. */
  readonly signal: string;
  /** How many signals complete the step. Defaults to 1. */
  readonly count?: number;
}

/** One step of a tutorial. */
export interface TutorialStep {
  /** Stable key, unique in the script; games read it to stage a step. */
  readonly id: string;
  /** The chapter the step belongs to, shown above its title. */
  readonly chapter: string;
  /** A few words. */
  readonly title: string;
  /** One or two sentences: what to do and why it matters. */
  readonly body: string;
  /** The keyboard and mouse control, such as "W A S D". */
  readonly keys?: string;
  /** The touch control, shown in place of `keys` on a touch cabinet. */
  readonly touch?: string;
  /**
   * The control the step points at: the value of a `data-tutorial-target`
   * attribute inside the cabinet. A step without one, or whose target is not
   * on screen, docks its card instead.
   */
  readonly target?: string;
  /** Present on a practice step. */
  readonly practice?: TutorialPractice;
}

/** A game's tutorial. */
export interface TutorialScript {
  /** The game's registry slug. */
  readonly gameId: string;
  /**
   * Bump when the script changes enough to be worth offering again: a
   * player who finished an older version is offered the new one once.
   */
  readonly version: number;
  /** About how long it takes, in minutes, for the offer's wording. */
  readonly minutes: number;
  readonly steps: readonly TutorialStep[];
}

/** Where a tutorial run is. */
export type TutorialStatus = "idle" | "running" | "finished" | "exited";

/** A tutorial run's state. */
export interface TutorialState {
  readonly status: TutorialStatus;
  /** The current step. */
  readonly index: number;
  /** Signals counted toward the current step's practice. */
  readonly progress: number;
  /** Practice steps the player skipped this run, by id. */
  readonly skipped: readonly string[];
}

/** What can happen to a tutorial run. */
export type TutorialAction =
  | { readonly type: "start" }
  | { readonly type: "next" }
  | { readonly type: "back" }
  | { readonly type: "signal"; readonly name: string }
  | { readonly type: "skip-practice" }
  | { readonly type: "exit" };

/** A tutorial that has not started. */
export const TUTORIAL_IDLE: TutorialState = Object.freeze({
  status: "idle",
  index: 0,
  progress: 0,
  skipped: Object.freeze([]) as readonly string[],
});

/** How many signals a step needs: 0 for a read step. */
export function practiceTarget(step: TutorialStep | undefined): number {
  if (!step?.practice) return 0;
  return Math.max(1, Math.floor(step.practice.count ?? 1));
}

/**
 * Whether the current step is done: a read step always is, a practice step
 * once it has had its signals.
 */
export function isStepComplete(
  script: TutorialScript,
  state: TutorialState
): boolean {
  return state.progress >= practiceTarget(script.steps[state.index]);
}

function moveTo(
  script: TutorialScript,
  state: TutorialState,
  index: number
): TutorialState {
  if (index >= script.steps.length) {
    return { ...state, status: "finished", index: script.steps.length - 1 };
  }
  return { ...state, index: Math.max(0, index), progress: 0 };
}

/**
 * The tutorial state machine. Next on a practice step waits until the
 * practice is done; skipping the practice records it and moves on. Signals
 * count only toward the current step, so an action done early is simply
 * asked for again. Back goes to the previous step with its practice reset.
 * Next on the last step finishes the run; Exit leaves it.
 *
 * @param script - The game's tutorial.
 * @param state - The run so far.
 * @param action - What happened.
 * @returns The next state; the same object when nothing changed.
 */
export function tutorialReducer(
  script: TutorialScript,
  state: TutorialState,
  action: TutorialAction
): TutorialState {
  if (action.type === "start") {
    return script.steps.length === 0
      ? { ...TUTORIAL_IDLE, status: "finished" }
      : { ...TUTORIAL_IDLE, status: "running" };
  }
  if (state.status !== "running") return state;
  const step = script.steps[state.index];
  switch (action.type) {
    case "next":
      return isStepComplete(script, state)
        ? moveTo(script, state, state.index + 1)
        : state;
    case "back":
      return state.index === 0 ? state : moveTo(script, state, state.index - 1);
    case "signal": {
      const needed = practiceTarget(step);
      if (
        needed === 0 ||
        step.practice?.signal !== action.name ||
        state.progress >= needed
      ) {
        return state;
      }
      return { ...state, progress: state.progress + 1 };
    }
    case "skip-practice":
      if (!step?.practice) return state;
      return moveTo(
        script,
        {
          ...state,
          skipped: state.skipped.includes(step.id)
            ? state.skipped
            : [...state.skipped, step.id],
        },
        state.index + 1
      );
    case "exit":
      return { ...state, status: "exited" };
  }
}

/**
 * Whether a signal would count right now, so a game can send signals from a
 * hot loop without waking React for the ones that would not.
 *
 * @param script - The game's tutorial.
 * @param state - The run so far.
 * @param name - The signal.
 * @returns True when the signal advances the current practice.
 */
export function signalCounts(
  script: TutorialScript,
  state: TutorialState,
  name: string
): boolean {
  return tutorialReducer(script, state, { type: "signal", name }) !== state;
}

/**
 * The problems with a script, for its unit test: no steps, a step id used
 * twice, empty text, or a practice with no signal.
 *
 * @param script - The script to check.
 * @returns One message per problem; empty when the script is sound.
 */
export function validateTutorialScript(script: TutorialScript): string[] {
  const problems: string[] = [];
  if (script.steps.length === 0) problems.push("The script has no steps.");
  if (!Number.isInteger(script.version) || script.version < 1) {
    problems.push("The version must be a whole number from 1.");
  }
  const seen = new Set<string>();
  for (const step of script.steps) {
    if (seen.has(step.id)) problems.push(`Step id "${step.id}" is repeated.`);
    seen.add(step.id);
    for (const field of ["id", "chapter", "title", "body"] as const) {
      if (step[field].trim() === "") {
        problems.push(`Step "${step.id}" has an empty ${field}.`);
      }
    }
    if (step.practice && step.practice.signal.trim() === "") {
      problems.push(`Step "${step.id}" practises no signal.`);
    }
  }
  return problems;
}
