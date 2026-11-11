import type { TutorialScript } from "@/lib/arcade";
import type { DilemmaId, ShiftConfig } from "./types";

/**
 * The signals Patty's Drive-Thru sends its tutorial (#3451): the player
 * turned, picked an order, rang an item up, bumped an order, wiped the
 * counter, or answered a dilemma.
 */
export const PATTY_TUTORIAL_SIGNALS = {
  turn: "turn",
  order: "order",
  ring: "ring",
  bump: "bump",
  wipe: "wipe",
  answer: "answer",
} as const;

const S = PATTY_TUTORIAL_SIGNALS;

/**
 * The practice shift the tutorial runs in (#3451): one car ordering fries,
 * and nothing else. Its clock runs only until that car pulls up, then holds,
 * so the order never ages and the manager never yells. It has hand-built
 * orders, so it never counts toward a score.
 */
export const PATTY_TUTORIAL_SHIFT: Partial<ShiftConfig> = {
  seed: "patty-tutorial",
  durationSec: 600,
  firstArrivalSec: 1,
  arrivalGapMinSec: 30,
  arrivalGapMaxSec: 60,
  customOrders: [{ items: [{ itemId: "fries" }] }],
};

/** The dilemma the tutorial puts to the player to practise answering. */
export const PATTY_TUTORIAL_DILEMMA: DilemmaId = "ice-machine";

/**
 * Patty's Drive-Thru's guided tutorial (#3451). It clocks in to a practice
 * shift with one car ordering fries, walks the player through turning,
 * picking the order, ringing it up, bumping it, wiping the counter and
 * answering a dilemma, then returns to the diary. The wording matches the
 * Field Manual.
 */
export const PATTY_TUTORIAL: TutorialScript = {
  gameId: "patty-drive-thru",
  version: 1,
  minutes: 2,
  steps: [
    {
      id: "welcome",
      chapter: "The booth",
      title: "Practice shift",
      body: "This is a practice shift with one car. The clock is stopped, so the order never goes stale and the manager never yells.",
    },
    {
      id: "turn",
      chapter: "The booth",
      title: "Look around",
      body: "In the 3D booth you can turn half a turn either way: the window and headset to the left, the kitchen to the right. The flat view shows everything at once.",
      keys: "A and D, or ← →",
      touch: "Hold Turn left or Turn right",
      practice: { signal: S.turn },
    },
    {
      id: "order",
      chapter: "Orders",
      title: "Pick the order",
      body: "Each car's order is a ticket on the kitchen display and a key on the register. Press its number to work on it.",
      keys: "1 to 6",
      touch: "Register, then tap the order",
      target: "orders",
      practice: { signal: S.order },
    },
    {
      id: "ring",
      chapter: "Orders",
      title: "Ring it up",
      body: "The register hides things in menus. This car wants fries: open Sides, then press Fries. In the 3D booth, Enter opens the register.",
      keys: "Enter, then Sides › Fries",
      touch: "Register, then Sides › Fries",
      target: "menu",
      practice: { signal: S.ring },
    },
    {
      id: "bump",
      chapter: "Orders",
      title: "Bump it",
      body: "Once every item is rung up, bump the ticket to send the car on. Bump before the ticket turns red.",
      keys: "B",
      touch: "Tap Bump order",
      target: "bump",
      practice: { signal: S.bump },
    },
    {
      id: "wipe",
      chapter: "Keep moving",
      title: "Wipe the counter",
      body: "Standing still fills the idle meter, and a full one brings the manager over. Wiping the counter buys you time.",
      keys: "W",
      touch: "Tap Wipe",
      target: "wipe",
      practice: { signal: S.wipe },
    },
    {
      id: "dilemma",
      chapter: "Keep moving",
      title: "Answer a question",
      body: "Now and then someone asks you something, and the clock is ticking. Your answer moves the meters and changes how the day ends.",
      keys: "Q or E",
      touch: "Tap an answer",
      target: "dilemma",
      practice: { signal: S.answer },
    },
    {
      id: "done",
      chapter: "Your shift",
      title: "Clock in for real",
      body: "A real shift has a lunch rush, drinks the dispenser drops (R re-enters one) and coffee you are too young to brew (C flags a coworker). P pauses.",
    },
  ],
};
