import { defineActions, type ActionName } from "./arcade";

/** Gamepad buttons in the standard mapping. */
const PAD = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

/** The left stick pushed up or down, read as a button. */
const STICK_UP = { index: 1, direction: -1 } as const;
const STICK_DOWN = { index: 1, direction: 1 } as const;
const STICK_LEFT = { index: 0, direction: -1 } as const;
const STICK_RIGHT = { index: 0, direction: 1 } as const;

/**
 * Everything the player can do in Working With Duck (#2356). The keyboard,
 * the gamepad and the touch dock all perform these actions, and the
 * cabinet's control list and the field manual's key column are generated
 * from them.
 *
 * Keys are physical positions (`KeyboardEvent.code`). Two contexts share
 * keys: in the `park` the up and down keys (and W) steer Duck, and in the
 * `room` (the office and the bathtub) the arrows carry him and W asks for a
 * high five. Holding Space, a steer key or an arrow repeats it; the toys,
 * treats, tricks, the package and pause act once per press.
 */
export const DUCK_ACTIONS = defineActions(
  {
    "toy-1": {
      kind: "press",
      keys: ["Digit1", "Numpad1"],
      label: "Tennis ball",
      gamepad: { buttons: [PAD.y] },
      gamepadLabel: "Y",
      group: "toys",
    },
    "toy-2": {
      kind: "press",
      keys: ["Digit2", "Numpad2"],
      label: "Kong",
      group: "toys",
    },
    "toy-3": {
      kind: "press",
      keys: ["Digit3", "Numpad3"],
      label: "Squeaky toy",
      group: "toys",
    },
    treat: {
      kind: "press",
      keys: ["Digit4", "Numpad4"],
      label: "Treat",
      gamepad: { buttons: [PAD.b] },
      gamepadLabel: "B",
      group: "toys",
    },
    "trick-sit": {
      kind: "press",
      keys: ["KeyQ"],
      label: "Sit",
      group: "tricks",
    },
    "trick-high-five": {
      kind: "press",
      keys: ["KeyW"],
      label: "High Five",
      context: "room",
      group: "tricks",
    },
    "trick-drop-it": {
      kind: "press",
      keys: ["KeyE"],
      label: "Drop It",
      gamepad: { buttons: [PAD.x] },
      gamepadLabel: "X",
      group: "tricks",
    },
    "trick-spin": {
      kind: "press",
      keys: ["KeyR"],
      label: "Spin",
      group: "tricks",
    },
    space: {
      kind: "press",
      keys: ["Space"],
      label: "Work Sprint",
      repeat: true,
      preventDefault: true,
      gamepad: { buttons: [PAD.a] },
      gamepadLabel: "A",
      group: "work",
    },
    "steer-up": {
      kind: "press",
      keys: ["ArrowUp", "KeyW"],
      keyLabel: "W / ↑",
      label: "Steer up",
      context: "park",
      repeat: true,
      preventDefault: true,
      gamepad: { buttons: [PAD.up], axes: [STICK_UP] },
      gamepadLabel: "D-pad ↑",
      group: "steer",
    },
    "steer-down": {
      kind: "press",
      keys: ["ArrowDown"],
      label: "Steer down",
      context: "park",
      repeat: true,
      preventDefault: true,
      gamepad: { buttons: [PAD.down], axes: [STICK_DOWN] },
      gamepadLabel: "D-pad ↓",
      group: "steer",
    },
    package: {
      kind: "press",
      keys: ["KeyD"],
      label: "Get the package",
      group: "door",
    },
    pause: {
      kind: "press",
      keys: ["KeyP"],
      label: "Pause",
      // The pause overlay focuses its Resume button, and P must still resume.
      onControls: true,
      gamepad: { buttons: [PAD.start] },
      gamepadLabel: "Start",
    },
    escape: {
      kind: "press",
      keys: ["Escape"],
      label: "Pause",
      onControls: true,
      // In fullscreen the cabinet takes Escape first, to leave fullscreen.
      yieldsToCabinet: true,
    },
    "drag-up": {
      kind: "press",
      keys: ["ArrowUp"],
      label: "Carry Duck up",
      context: "room",
      repeat: true,
      preventDefault: true,
      gamepad: { buttons: [PAD.up], axes: [STICK_UP] },
      group: "carry",
    },
    "drag-down": {
      kind: "press",
      keys: ["ArrowDown"],
      label: "Carry Duck down",
      context: "room",
      repeat: true,
      preventDefault: true,
      gamepad: { buttons: [PAD.down], axes: [STICK_DOWN] },
      group: "carry",
    },
    // Left and right carry in the room and do nothing in the park, where
    // they are still kept from scrolling the page.
    "drag-left": {
      kind: "press",
      keys: ["ArrowLeft"],
      label: "Carry Duck left",
      repeat: true,
      preventDefault: true,
      gamepad: { buttons: [PAD.left], axes: [STICK_LEFT] },
      group: "carry",
    },
    "drag-right": {
      kind: "press",
      keys: ["ArrowRight"],
      label: "Carry Duck right",
      repeat: true,
      preventDefault: true,
      gamepad: { buttons: [PAD.right], axes: [STICK_RIGHT] },
      group: "carry",
    },
    drop: {
      kind: "press",
      keys: ["Enter", "NumpadEnter"],
      label: "Drop Duck",
      gamepad: { buttons: [PAD.lb] },
      gamepadLabel: "LB",
      group: "carry",
    },
  },
  {
    groups: {
      toys: { label: "Toss Toys / Trade Treats", keyLabel: "1-3 / 4" },
      work: { label: "Work Sprint (Park: Jump)" },
      steer: { label: "Steer in the Park", keyLabel: "W / ↑ ↓" },
    },
  }
);

/** An action of Working With Duck. */
export type DuckActionName = ActionName<typeof DUCK_ACTIONS>;

/** The groups the cabinet's control list shows, in order. */
export const DUCK_CABINET_GROUPS = ["toys", "work", "steer", "tricks"] as const;

/**
 * The input context of a game state: the park steers, the office and the
 * bathtub (the room) carry Duck and take tricks.
 *
 * @param state - Whether Duck is in the dog park.
 * @returns `park` or `room`.
 */
export function duckInputContext(state: {
  inDogPark: boolean;
}): "park" | "room" {
  return state.inDogPark ? "park" : "room";
}
