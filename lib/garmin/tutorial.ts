import type { TutorialScript } from "@/lib/arcade";
import { START_LIVES } from "./powerups";
import type { GameEngineState } from "./engine";

/**
 * The signals Monkey C Mayhem sends its tutorial (#3452): a run started, the
 * runner jumped, held a jump for height, sprinted, eased to a jog, pressed
 * the action key, or slammed down in mid-air.
 */
export const GARMIN_TUTORIAL_SIGNALS = {
  start: "start",
  jump: "jump",
  highJump: "high-jump",
  sprint: "sprint",
  jog: "jog",
  action: "action",
  slam: "slam",
} as const;

const S = GARMIN_TUTORIAL_SIGNALS;

/**
 * How long a jump has to be held, in milliseconds, to count as the tutorial's
 * held jump. A tap cuts the jump short almost at once; this is about the
 * point where holding starts to add height.
 */
export const TUTORIAL_HOLD_JUMP_MS = 250;

/** The Body Battery a tutorial run never drops below, so it never bonks. */
export const TUTORIAL_BODY_BATTERY_FLOOR = 60;

/**
 * Keeps a tutorial run safe (#3452): nothing on the course can end a life
 * and no meter can run out. The course loses its gaps and gym racks, the
 * bugs and foes are cleared as they appear, Body Battery stays above
 * {@link TUTORIAL_BODY_BATTERY_FLOOR} and lives stay full. The run's rules are
 * the default fitness rules, so there is no heap or flash to fill. A watch
 * that is not running is returned as it is.
 *
 * Applied after every step of a tutorial run, so a stage laid out on a stage
 * clear, or a foe that spawns off screen, is cleared before it can reach the
 * runner. Returns the same object when there is nothing to change.
 */
export function keepTutorialRunSafe(state: GameEngineState): GameEngineState {
  if (state.gameState !== "playing" && state.gameState !== "paused") {
    return state;
  }
  const course = state.course;
  const battery = state.bodyBattery;
  const lowBattery =
    battery !== undefined &&
    (battery.bonked || battery.value < TUTORIAL_BODY_BATTERY_FLOOR);
  const hazards =
    state.obstacles.length > 0 ||
    (state.foes?.length ?? 0) > 0 ||
    (state.foeShots?.length ?? 0) > 0 ||
    (course?.gaps.length ?? 0) > 0 ||
    (course?.ceilings?.length ?? 0) > 0;
  const livesLow = (state.lives ?? START_LIVES) < START_LIVES;
  if (!hazards && !lowBattery && !livesLow) return state;
  return {
    ...state,
    obstacles: [],
    foes: [],
    foeShots: [],
    ...(course ? { course: { ...course, gaps: [], ceilings: [] } } : {}),
    ...(lowBattery
      ? { bodyBattery: { value: TUTORIAL_BODY_BATTERY_FLOOR, bonked: false } }
      : {}),
    lives: Math.max(state.lives ?? START_LIVES, START_LIVES),
  };
}

/**
 * Monkey C Mayhem's guided tutorial (#3452). It starts a practice run with no
 * gaps and no foes, teaches starting, jumping, a held jump, sprinting,
 * jogging, the action key and the mid-air slam by doing them, then reads out
 * the meters: Body Battery and Training Effect, and Dev Mode's heap, flash
 * and watchdog. The wording matches the cabinet's controls.
 */
export const GARMIN_TUTORIAL: TutorialScript = {
  gameId: "garmin-watch",
  version: 1,
  minutes: 2,
  steps: [
    {
      id: "welcome",
      chapter: "The watch",
      title: "Practice run",
      body: "This is a practice 5K with no gaps and no foes, and your Body Battery stays topped up. Nothing here can end the run.",
    },
    {
      id: "start",
      chapter: "The watch",
      title: "Start the run",
      body: "The watch waits for START, like a real one. It finds GPS, then the runner sets off on their own.",
      keys: "Enter",
      touch: "Tap START",
      practice: { signal: S.start },
    },
    {
      id: "jump",
      chapter: "Moves",
      title: "Jump",
      body: "Jump over Hurdles and onto ledges. Land on a Couch Potato or a Snooze Button to stomp it.",
      keys: "↑ or Space",
      touch: "Tap Jump",
      practice: { signal: S.jump, count: 2 },
    },
    {
      id: "high-jump",
      chapter: "Moves",
      title: "Jump higher",
      body: "Hold jump for height, and let go early for a short hop. Long gaps need the full jump.",
      keys: "Hold ↑ or Space",
      touch: "Hold Jump",
      practice: { signal: S.highJump },
    },
    {
      id: "sprint",
      chapter: "Pace",
      title: "Sprint",
      body: "Sprinting covers ground faster but drains Body Battery quickly.",
      keys: "Hold →",
      touch: "Hold Sprint",
      practice: { signal: S.sprint },
    },
    {
      id: "jog",
      chapter: "Pace",
      title: "Ease to a jog",
      body: "Jogging recharges Body Battery. Ease off before you bonk, because a bonk means no sprinting until it recovers to 25.",
      keys: "Hold ←",
      touch: "Hold Jog",
      practice: { signal: S.jog },
    },
    {
      id: "action",
      chapter: "Moves",
      title: "Action key",
      body: "With a Heat Map, X throws a heat bolt, and with a Compression Cape it spins. In mid-air it is a Spin Jump. Beside a medicine ball, it picks the ball up.",
      keys: "X",
      touch: "Tap Action",
      practice: { signal: S.action },
    },
    {
      id: "slam",
      chapter: "Moves",
      title: "Burpee Slam",
      body: "Jump, then press down in mid-air to slam into the lane. On a Water Station, down takes you into its bonus room instead.",
      keys: "↑, then ↓ in mid-air",
      touch: "Jump, then tap Down",
      practice: { signal: S.slam },
    },
    {
      id: "meters",
      chapter: "Meters",
      title: "Body Battery and Training Effect",
      body: "Body Battery drains as you run and a hit costs 15. Each stage clear scores a Training Effect from 0.0 to 5.0, and game over shows your Training Status.",
    },
    {
      id: "dev-mode",
      chapter: "Meters",
      title: "Dev Mode meters",
      body: "Dev Mode, off by default in the simulator controls, brings back the firmware meters. The RAM heap fills as the app allocates and a full heap crashes the watch, so Backspace runs garbage collection. NV flash fills as you save, and a watchdog bug that reaches you trips the watch.",
    },
    {
      id: "done",
      chapter: "Your run",
      title: "Run it for real",
      body: "A real run is five 1 km stages on three lives. Grab the finish pole on each one. P pauses.",
    },
  ],
};
