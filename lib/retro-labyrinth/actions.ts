import {
  controlsFromActions,
  defineActions,
  type ActionName,
  type CabinetControl,
} from "@/lib/arcade";

/** Gamepad buttons in the standard mapping. */
const PAD = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  back: 8,
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

/** The left stick pushed one way, read as a button. */
const STICK_UP = { index: 1, direction: -1 } as const;
const STICK_DOWN = { index: 1, direction: 1 } as const;
const STICK_LEFT = { index: 0, direction: -1 } as const;
const STICK_RIGHT = { index: 0, direction: 1 } as const;

/**
 * The input context of a Retro Labyrinth room: `run` while the room is
 * playing, `card` on every other screen (pause, the trace and room-cleared
 * cards, the timesheet, the hex terminal and the overlays).
 */
export type LabyrinthInputContext = "run" | "card";

/**
 * Everything the player can do in Retro Labyrinth (#2376). Keys, the gamepad
 * and the touch docks all perform these actions, and the cabinet's control
 * list and the field manual's key column are generated from them, so neither
 * can drift from the bindings again (the control list said "1-3" while the
 * game read 1 to 5).
 *
 * Keys are physical positions (`KeyboardEvent.code`). The moves, tools, EMP,
 * Market and scanlines act only while the room is playing (`run`); Enter and
 * R answer the cards (`card`). A held move key repeats at the keyboard's own
 * rate. Pause takes P and Escape in every context, and still acts on a
 * focused button, so the pause card's own buttons never trap it.
 */
export const LABYRINTH_ACTIONS = defineActions(
  {
    "move-up": {
      kind: "press",
      keys: ["ArrowUp", "KeyW"],
      label: "Move up",
      context: "run",
      repeat: true,
      preventDefault: true,
      onControls: true,
      gamepad: { buttons: [PAD.up], axes: [STICK_UP] },
      gamepadLabel: "D-pad",
      group: "move",
    },
    "move-down": {
      kind: "press",
      keys: ["ArrowDown", "KeyS"],
      label: "Move down",
      context: "run",
      repeat: true,
      preventDefault: true,
      onControls: true,
      gamepad: { buttons: [PAD.down], axes: [STICK_DOWN] },
      gamepadLabel: "D-pad",
      group: "move",
    },
    "move-left": {
      kind: "press",
      keys: ["ArrowLeft", "KeyA"],
      label: "Move left",
      context: "run",
      repeat: true,
      preventDefault: true,
      onControls: true,
      gamepad: { buttons: [PAD.left], axes: [STICK_LEFT] },
      gamepadLabel: "D-pad",
      group: "move",
    },
    "move-right": {
      kind: "press",
      keys: ["ArrowRight", "KeyD"],
      label: "Move right",
      context: "run",
      repeat: true,
      preventDefault: true,
      onControls: true,
      gamepad: { buttons: [PAD.right], axes: [STICK_RIGHT] },
      gamepadLabel: "D-pad",
      group: "move",
    },
    "tool-1": {
      kind: "press",
      keys: ["Digit1", "Numpad1"],
      label: "Tool 1",
      context: "run",
      preventDefault: true,
      onControls: true,
      gamepad: { buttons: [PAD.x] },
      gamepadLabel: "X",
      group: "tools",
    },
    "tool-2": {
      kind: "press",
      keys: ["Digit2", "Numpad2"],
      label: "Tool 2",
      context: "run",
      preventDefault: true,
      onControls: true,
      gamepad: { buttons: [PAD.y] },
      gamepadLabel: "Y",
      group: "tools",
    },
    "tool-3": {
      kind: "press",
      keys: ["Digit3", "Numpad3"],
      label: "Tool 3",
      context: "run",
      preventDefault: true,
      onControls: true,
      gamepad: { buttons: [PAD.lb] },
      gamepadLabel: "LB",
      group: "tools",
    },
    "tool-4": {
      kind: "press",
      keys: ["Digit4", "Numpad4"],
      label: "Tool 4",
      context: "run",
      preventDefault: true,
      onControls: true,
      gamepad: { buttons: [PAD.rb] },
      gamepadLabel: "RB",
      group: "tools",
    },
    "tool-5": {
      kind: "press",
      keys: ["Digit5", "Numpad5"],
      label: "Tool 5",
      context: "run",
      preventDefault: true,
      onControls: true,
      gamepad: { buttons: [PAD.lt] },
      gamepadLabel: "LT",
      group: "tools",
    },
    emp: {
      kind: "press",
      keys: ["Space"],
      label: "EMP Burst",
      context: "run",
      preventDefault: true,
      onControls: true,
      gamepad: { buttons: [PAD.a] },
      gamepadLabel: "A",
      group: "emp",
    },
    // Touch and gamepad only, as before: on a keyboard the number keys pick
    // the tool. It fires the next tool that has ammo.
    exploit: {
      kind: "press",
      keys: [],
      label: "Exploit",
      touchLabel: "Tap Exploit",
      context: "run",
      gamepad: { buttons: [PAD.b] },
      gamepadLabel: "B",
    },
    // New in #2376: the Market had no key, so a keyboard player reached it
    // only by clicking or tabbing to the hotbar button. It opens at the rest
    // stop only.
    market: {
      kind: "press",
      keys: ["KeyM"],
      label: "Market",
      context: "run",
      onControls: true,
      gamepad: { buttons: [PAD.back] },
      gamepadLabel: "Back",
      group: "market",
    },
    crt: {
      kind: "press",
      keys: ["KeyC"],
      label: "CRT Scanlines",
      context: "run",
      preventDefault: true,
      onControls: true,
      group: "crt",
    },
    pause: {
      kind: "press",
      keys: ["KeyP"],
      label: "Pause",
      onControls: true,
      gamepad: { buttons: [PAD.start] },
      gamepadLabel: "Start",
      group: "pause",
    },
    escape: {
      kind: "press",
      keys: ["Escape"],
      label: "Pause",
      onControls: true,
      // In fullscreen the cabinet takes Escape first, to leave fullscreen.
      yieldsToCabinet: true,
      group: "pause",
    },
    // A focused route or reward button answers Enter itself, so the session
    // checks for one before it acts on the room-cleared card.
    confirm: {
      kind: "press",
      keys: ["Enter", "NumpadEnter"],
      label: "Continue",
      context: "card",
      onControls: true,
      gamepad: { buttons: [PAD.a] },
      gamepadLabel: "A",
      group: "cards",
    },
    retry: {
      kind: "press",
      keys: ["KeyR"],
      label: "Retry",
      context: "card",
      onControls: true,
      gamepad: { buttons: [PAD.y] },
      gamepadLabel: "Y",
      group: "cards",
    },
  },
  {
    groups: {
      move: { label: "Move", keyLabel: "WASD / Arrows" },
      tools: { label: "Fire Class Tools", keyLabel: "1-5" },
      pause: { label: "Pause", keyLabel: "P / Esc" },
      cards: { label: "Continue / Retry" },
    },
  }
);

/** One action of {@link LABYRINTH_ACTIONS}. */
export type LabyrinthActionName = ActionName<typeof LABYRINTH_ACTIONS>;

/**
 * The cabinet's control list, generated from {@link LABYRINTH_ACTIONS}.
 * Exploit has no key, so it is left to the touch dock's own label.
 */
export const LABYRINTH_CONTROLS: readonly CabinetControl[] =
  controlsFromActions(LABYRINTH_ACTIONS, [
    "move",
    "tools",
    "emp",
    "market",
    "crt",
    "pause",
    "cards",
  ]);
