import type { TutorialScript } from "@/lib/arcade";
import type { WorkingWithDuckState } from "@/lib/working-with-duck-engine";

/**
 * The signals Working With Duck sends its tutorial (#3453): the sprint
 * clock started, a code burst landed, Duck began a trick, a toy was used, or
 * Duck was put down after being carried.
 */
export const WORKING_WITH_DUCK_TUTORIAL_SIGNALS = {
  start: "start",
  code: "code",
  trick: "trick",
  toy: "toy",
  drop: "drop",
} as const;

const S = WORKING_WITH_DUCK_TUTORIAL_SIGNALS;

/**
 * The share of the sprint's work a tutorial sprint can reach. Passive work
 * is held while the tutorial runs and only code bursts add to it, so the
 * sprint cannot be shipped (and end) in the middle of a step.
 */
export const TUTORIAL_WORK_CAP = 0.9;

/**
 * The tutorial signals one transition of the game sends (#3453), read from
 * the state before and after it, so the keyboard, the touch dock and the
 * mouse all count the same way. Toys are signalled where they are used,
 * since a toy changes different fields depending on what Duck is doing.
 */
export function duckTutorialSignals(
  before: WorkingWithDuckState,
  after: WorkingWithDuckState
): string[] {
  const signals: string[] = [];
  if (before.status === "idle" && after.status === "running") {
    signals.push(S.start);
  }
  if (after.activeCodeBursts > before.activeCodeBursts) signals.push(S.code);
  if (after.activeTrick && !before.activeTrick) signals.push(S.trick);
  if (before.duck.state === "DRAGGED" && after.duck.state !== "DRAGGED") {
    signals.push(S.drop);
  }
  return signals;
}

/**
 * Freezes the meters for one step of a tutorial sprint (#3453). Excitement,
 * Bladder, thirst and hunger never rise, though anything the player does can
 * still bring them down. Good Boy never falls. Work only moves with a code
 * burst and stays under {@link TUTORIAL_WORK_CAP} of the target, and no new
 * impulse comes due, so Duck does not start chewing or sniffing for the door
 * while the player reads. A sprint that is not running is returned as it is.
 */
export function holdTutorialMeters(
  before: WorkingWithDuckState,
  after: WorkingWithDuckState
): WorkingWithDuckState {
  if (after.status !== "running" || before.status !== "running") return after;
  const workCap = after.targetWorkProgress * TUTORIAL_WORK_CAP;
  return {
    ...after,
    excitement: Math.min(before.excitement, after.excitement),
    bladder: Math.min(before.bladder, after.bladder),
    thirst: Math.min(before.thirst, after.thirst),
    hunger: Math.min(before.hunger, after.hunger),
    naughtyVsGood: Math.max(before.naughtyVsGood, after.naughtyVsGood),
    workProgress: Math.min(before.workProgress, workCap),
    totalScore: before.totalScore,
    lastImpulseTick: after.ticks,
  };
}

/**
 * Working With Duck's guided tutorial (#3453). It opens Sprint 1 with its
 * meters frozen and teaches by doing: start the clock, a code burst, a
 * trick, a toy, and carrying Duck. Then it reads out the meters and the
 * sprint loop, and hands back a fresh Sprint 1. The wording matches the
 * cabinet's controls.
 */
export const WORKING_WITH_DUCK_TUTORIAL: TutorialScript = {
  gameId: "working-with-duck",
  version: 1,
  minutes: 2,
  steps: [
    {
      id: "welcome",
      chapter: "The office",
      title: "Practice sprint",
      body: "This is a practice Sprint 1. The meters are frozen, so Duck stays calm while you learn the controls, and the sprint cannot be lost.",
    },
    {
      id: "start",
      chapter: "The office",
      title: "Start the clock",
      body: "Sprint 1 waits for you. Your first key or click starts the clock.",
      keys: "Any game key",
      touch: "Tap the room",
      practice: { signal: S.start },
    },
    {
      id: "code",
      chapter: "Work",
      title: "Code burst",
      body: "In a real sprint, work moves on its own while Duck is calm. Here only code bursts move it. A burst does nothing while Duck has an emergency.",
      keys: "Space",
      touch: "Tap Work Sprint",
      practice: { signal: S.code, count: 2 },
    },
    {
      id: "trick",
      chapter: "Duck",
      title: "Call a trick",
      body: "Sit calms Duck and lowers Excitement. High Five, Drop It and Spin are the other tricks, and each takes about a second of your attention.",
      keys: "Q (Sit), W, E or R",
      touch: "Tap Sit",
      practice: { signal: S.trick },
    },
    {
      id: "toy",
      chapter: "Duck",
      title: "Use a toy",
      body: "Toys pull Duck away from your things. Pick one, then press it again to toss it near him: the Kong lands just past Duck.",
      keys: "2, then 2 again",
      touch: "Tap Kong, then tap the room",
      practice: { signal: S.toy },
    },
    {
      id: "carry",
      chapter: "Duck",
      title: "Carry Duck",
      body: "When Bladder fills, Duck needs the Back Door. Pick him up, carry him, and put him down.",
      keys: "Arrows to carry, Enter to drop",
      touch: "Drag Duck and let go",
      practice: { signal: S.drop },
    },
    {
      id: "meters",
      chapter: "The sprint",
      title: "The meters",
      body: "Work fills toward the goal. Excitement and Bladder fill on their own, and an emergency you ignore pulls Good Boy toward the red. If Good Boy reaches the red, the sprint is lost.",
    },
    {
      id: "loop",
      chapter: "The sprint",
      title: "Ship it",
      body: "Ship the work to clear the sprint and earn its stars, then start the next one. The Dog Park and the bath pause the meters while you are there. P pauses.",
    },
  ],
};
