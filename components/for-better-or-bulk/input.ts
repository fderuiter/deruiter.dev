/**
 * Keyboard mapping for For Better or Bulk (ADR 0060). Keys are read by
 * `KeyboardEvent.code`, so the layout stays put whatever the keyboard
 * language. In co-op Fred has WASD with E and F and Abbi has the arrows with
 * Enter and Shift; solo play takes either set for whoever is active, and Tab
 * swaps.
 */

import {
  IDLE_INPUT,
  type Frame,
  type PlayerId,
  type PlayerInput,
  type PresenceDecision,
} from "@/lib/for-better-or-bulk";

/** One keyboard for two people, or one person swapping between them. */
export type ControlMode = "solo" | "coop";

interface KeySet {
  readonly up: readonly string[];
  readonly down: readonly string[];
  readonly left: readonly string[];
  readonly right: readonly string[];
  readonly interact: readonly string[];
  readonly work: readonly string[];
}

const FRED_KEYS: KeySet = {
  up: ["KeyW"],
  down: ["KeyS"],
  left: ["KeyA"],
  right: ["KeyD"],
  interact: ["KeyE", "Space"],
  work: ["KeyF"],
};

const ABBI_KEYS: KeySet = {
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  interact: ["Enter", "NumpadEnter"],
  work: ["ShiftRight", "ShiftLeft"],
};

/** Every code the game handles, so the browser does not scroll or submit. */
export const GAME_CODES: ReadonlySet<string> = new Set(
  [FRED_KEYS, ABBI_KEYS].flatMap((set) => Object.values(set).flat())
);

function any(codes: readonly string[], held: ReadonlySet<string>): boolean {
  return codes.some((code) => held.has(code));
}

function inputFor(
  sets: readonly KeySet[],
  held: ReadonlySet<string>,
  pressed: ReadonlySet<string>
): PlayerInput {
  const on = (
    pick: (set: KeySet) => readonly string[],
    from: ReadonlySet<string>
  ) => sets.some((set) => any(pick(set), from));
  const moveX =
    (on((s) => s.right, held) ? 1 : 0) - (on((s) => s.left, held) ? 1 : 0);
  const moveY =
    (on((s) => s.down, held) ? 1 : 0) - (on((s) => s.up, held) ? 1 : 0);
  return {
    moveX,
    moveY,
    interact: on((s) => s.interact, pressed),
    work: on((s) => s.work, held),
  };
}

/**
 * The engine frame for the keys held now, the keys tapped since the last
 * step (down and up again before it ran), and the keys that went down since
 * the last step. Interact fires once per press; movement and work count a
 * tapped key as held for that step.
 */
export function buildFrame(
  held: ReadonlySet<string>,
  tapped: ReadonlySet<string>,
  pressed: ReadonlySet<string>,
  mode: ControlMode,
  active: PlayerId,
  decision?: PresenceDecision
): Frame {
  const down = new Set([...held, ...tapped]);
  let inputs: Record<PlayerId, PlayerInput>;
  if (mode === "coop") {
    inputs = {
      fred: inputFor([FRED_KEYS], down, pressed),
      abbi: inputFor([ABBI_KEYS], down, pressed),
    };
  } else {
    const input = inputFor([FRED_KEYS, ABBI_KEYS], down, pressed);
    inputs =
      active === "fred"
        ? { fred: input, abbi: IDLE_INPUT }
        : { fred: IDLE_INPUT, abbi: input };
  }
  return decision ? { inputs, decision } : { inputs };
}
