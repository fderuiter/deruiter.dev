import {
  actionKeyCodes,
  codeForKeyEvent,
  type ActionDefinition,
  type ActionHandler,
  type ActionMap,
  type ActionSource,
  type ActionVector,
  type AxisActionDefinition,
  type ButtonActionDefinition,
} from "./actions";
import { clamp } from "../utils";

/** The fields of a gamepad the controller reads, so tests can pass plain objects. */
export interface GamepadLike {
  readonly index: number;
  readonly connected?: boolean;
  readonly buttons: readonly { readonly pressed: boolean }[];
  readonly axes: readonly number[];
}

/** When the controller takes a key, beyond its own text-field check. */
export interface ActionInputControllerOptions {
  /**
   * The game's current context, read on every key, such as "park". Only
   * actions with no context or this context are live.
   */
  getContext?: () => string | undefined;
  /**
   * `none` (the default) leaves keys pressed with Ctrl, Alt or Meta to the
   * browser and the system. `any` takes them as the bare key.
   */
  modifiers?: "none" | "any";
  /**
   * Leave keys to a focused button, link, select or tab, so Space and Enter
   * activate it (the default). An action with `onControls` still acts.
   */
  ignoreControls?: boolean;
  /**
   * A last gate for each key down, such as "focus is inside the game". Keys
   * it refuses are neither handled nor prevented.
   */
  accepts?: (event: KeyboardEvent) => boolean;
}

/** Input types a person types text into. */
const TEXT_INPUT_TYPES = new Set([
  "",
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

const CONTROL_ROLES = new Set(["button", "link", "menuitem", "tab"]);

/**
 * Whether a key landed in a text-like field: a text input, a textarea or a
 * contenteditable region. A checkbox, range or button is not one.
 *
 * @param target - The event target.
 * @returns True when the key belongs to the field.
 */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return false;
  }
  if (target.tagName === "TEXTAREA") return true;
  if (target.tagName === "INPUT") {
    const type = (target.getAttribute("type") ?? "").toLowerCase();
    return TEXT_INPUT_TYPES.has(type);
  }
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  // JSDOM does not implement isContentEditable, so also read the attribute.
  return Boolean(
    target.closest('[contenteditable]:not([contenteditable="false"])')
  );
}

/**
 * Whether a key landed on a control that owns Space and Enter: a button, a
 * link, a select, a non-text input, or an element with a button, link, menu
 * item or tab role.
 *
 * @param target - The event target.
 * @returns True when the focused element is such a control.
 */
export function isControlTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === "BUTTON" || tag === "A" || tag === "SELECT") return true;
  if (tag === "INPUT") return !isTextEntryTarget(target);
  return CONTROL_ROLES.has(target.getAttribute("role") ?? "");
}

/** Time before a held gamepad button first repeats. */
const GAMEPAD_REPEAT_DELAY_MS = 300;
/** Time between gamepad repeats while held. */
const GAMEPAD_REPEAT_INTERVAL_MS = 100;
/** How far an axis must move to count as a button. */
const AXIS_BUTTON_THRESHOLD = 0.5;
/** Stick travel ignored around the centre. */
const STICK_DEADZONE = 0.2;

const DPAD = { up: 12, down: 13, left: 14, right: 15 } as const;

const noop = () => {};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampUnit(value: number): number {
  return clamp(value, -1, 1);
}

interface AxisState {
  readonly up: Set<string>;
  readonly down: Set<string>;
  readonly left: Set<string>;
  readonly right: Set<string>;
  pad: ActionVector;
  last: ActionVector;
}

/**
 * Reads the keyboard and gamepads into action inputs for one action map. It
 * holds no DOM: the caller forwards key events and gamepad snapshots, which
 * keeps it testable and lets `useActionInput` own the listeners.
 */
export class ActionInputController<A extends string = string> {
  private readonly held = new Map<A, Set<string>>();
  private readonly axes = new Map<A, AxisState>();
  /** Gamepad bindings pressed at the last poll, by action and pad. */
  private readonly padDown = new Map<string, number>();

  constructor(
    private readonly map: ActionMap<A>,
    private readonly emit: ActionHandler<A>,
    private readonly options: ActionInputControllerOptions = {}
  ) {}

  /** The live actions bound to a key in the current context, in definition order. */
  private actionsForCode(code: string): A[] {
    const context = this.options.getContext?.();
    return this.map.names.filter((name) => {
      const definition = this.map.actions[name];
      if (definition.kind === "pointer") return false;
      if (definition.context !== undefined && definition.context !== context) {
        return false;
      }
      return actionKeyCodes(definition).includes(code);
    });
  }

  private live(definition: ActionDefinition): boolean {
    return (
      definition.context === undefined ||
      definition.context === this.options.getContext?.()
    );
  }

  /**
   * Handles a key going down. A key typed into a text field, pressed with a
   * modifier the options refuse, or landing on a focused control is left
   * alone. Otherwise the first live action bound to the key fires.
   *
   * @param event - The keydown event.
   */
  handleKeyDown(event: KeyboardEvent): void {
    if (event.isComposing) return;
    const code = codeForKeyEvent(event);
    if (!code) return;
    if (isTextEntryTarget(event.target)) return;
    if (
      (this.options.modifiers ?? "none") === "none" &&
      (event.ctrlKey || event.metaKey || event.altKey)
    ) {
      return;
    }
    const name = this.actionsForCode(code)[0];
    if (name === undefined) return;
    const definition = this.map.actions[name];
    if (
      (this.options.ignoreControls ?? true) &&
      !definition.onControls &&
      isControlTarget(event.target)
    ) {
      return;
    }
    if (this.options.accepts && !this.options.accepts(event)) return;
    if (definition.preventDefault) event.preventDefault();

    const preventDefault = () => event.preventDefault();
    if (definition.kind === "axis2d") {
      this.pressAxis(name, definition, code, true);
      return;
    }
    if (definition.kind !== "press" && definition.kind !== "hold") return;
    const set = this.held.get(name) ?? new Set<string>();
    const repeat = event.repeat || set.has(code);
    if (repeat) {
      if (definition.repeat) {
        this.fire(name, "down", "keyboard", true, preventDefault, code);
      }
      return;
    }
    if (definition.kind === "press") {
      this.fire(name, "down", "keyboard", false, preventDefault, code);
      return;
    }
    const first = set.size === 0;
    set.add(code);
    this.held.set(name, set);
    if (first) this.fire(name, "down", "keyboard", false, preventDefault, code);
  }

  /**
   * Handles a key going up. A release always counts, wherever focus is now,
   * so a hold never sticks.
   *
   * @param event - The keyup event.
   */
  handleKeyUp(event: KeyboardEvent): void {
    const code = codeForKeyEvent(event);
    if (!code) return;
    for (const [name, set] of this.held) {
      if (set.delete(code) && set.size === 0) {
        this.held.delete(name);
        this.fire(name, "up", "keyboard", false, noop, code);
      }
    }
    for (const [name, state] of this.axes) {
      const definition = this.map.actions[name];
      if (definition.kind !== "axis2d") continue;
      this.pressAxis(name, definition, code, false, state);
    }
  }

  /**
   * Releases every held action and centres every axis, as when the window
   * loses focus or the page is hidden. A gamepad button still down must be
   * let go before it presses again.
   */
  releaseAll(): void {
    for (const [name] of this.held) {
      this.fire(name, "up", "keyboard", false, noop);
    }
    this.held.clear();
    for (const [name, state] of this.axes) {
      state.up.clear();
      state.down.clear();
      state.left.clear();
      state.right.clear();
      state.pad = { x: 0, y: 0 };
      if (state.last.x !== 0 || state.last.y !== 0) {
        state.last = { x: 0, y: 0 };
        this.fire(name, "change", "keyboard", false, noop, undefined, {
          x: 0,
          y: 0,
        });
      }
    }
    for (const key of this.padDown.keys()) this.padDown.set(key, Infinity);
  }

  /**
   * Reads one frame of gamepad state. Buttons and axes bound to `press` and
   * `hold` actions fire on their edges, and repeat while held for actions
   * that ask for it; sticks and the D-pad drive `axis2d` actions.
   *
   * @param pads - `navigator.getGamepads()`, or test doubles.
   * @param now - The frame time in milliseconds.
   */
  pollGamepads(pads: readonly (GamepadLike | null)[], now: number): void {
    const connected = pads.filter(
      (pad): pad is GamepadLike => !!pad && pad.connected !== false
    );
    for (const name of this.map.names) {
      const definition = this.map.actions[name];
      if (definition.kind === "press" || definition.kind === "hold") {
        if (definition.gamepad) {
          this.pollButtons(name, definition, connected, now);
        }
      } else if (definition.kind === "axis2d" && definition.gamepad) {
        this.pollStick(name, definition, connected);
      }
    }
  }

  private pollButtons(
    name: A,
    definition: ButtonActionDefinition,
    pads: readonly GamepadLike[],
    now: number
  ): void {
    const binding = definition.gamepad!;
    for (const pad of pads) {
      const pressed =
        (binding.buttons ?? []).some((index) => pad.buttons[index]?.pressed) ||
        (binding.axes ?? []).some(
          ({ index, direction }) =>
            (pad.axes[index] ?? 0) * direction >= AXIS_BUTTON_THRESHOLD
        );
      const id = `pad${pad.index}`;
      const key = `${name}\u0000${id}`;
      const nextRepeat = this.padDown.get(key);
      if (!pressed) {
        if (nextRepeat === undefined) continue;
        this.padDown.delete(key);
        const set = this.held.get(name);
        if (definition.kind === "hold" && set?.delete(id) && set.size === 0) {
          this.held.delete(name);
          this.fire(name, "up", "gamepad", false, noop);
        }
        continue;
      }
      if (nextRepeat !== undefined) {
        if (definition.repeat && now >= nextRepeat && this.live(definition)) {
          this.padDown.set(key, now + GAMEPAD_REPEAT_INTERVAL_MS);
          this.fire(name, "down", "gamepad", true, noop);
        }
        continue;
      }
      if (!this.live(definition)) continue;
      this.padDown.set(key, now + GAMEPAD_REPEAT_DELAY_MS);
      if (definition.kind === "press") {
        this.fire(name, "down", "gamepad", false, noop);
        continue;
      }
      const set = this.held.get(name) ?? new Set<string>();
      const first = set.size === 0;
      set.add(id);
      this.held.set(name, set);
      if (first) this.fire(name, "down", "gamepad", false, noop);
    }
  }

  private pollStick(
    name: A,
    definition: AxisActionDefinition,
    pads: readonly GamepadLike[]
  ): void {
    const binding = definition.gamepad!;
    const offset = binding.stick === "right" ? 2 : 0;
    let vector: ActionVector = { x: 0, y: 0 };
    for (const pad of pads) {
      let x = 0;
      let y = 0;
      if (binding.stick) {
        const sx = pad.axes[offset] ?? 0;
        const sy = pad.axes[offset + 1] ?? 0;
        if (Math.hypot(sx, sy) >= STICK_DEADZONE) {
          x = sx;
          y = sy;
        }
      }
      if (binding.dpad) {
        if (pad.buttons[DPAD.left]?.pressed) x -= 1;
        if (pad.buttons[DPAD.right]?.pressed) x += 1;
        if (pad.buttons[DPAD.up]?.pressed) y -= 1;
        if (pad.buttons[DPAD.down]?.pressed) y += 1;
      }
      if (x !== 0 || y !== 0) {
        vector = { x: round(clampUnit(x)), y: round(clampUnit(y)) };
        break;
      }
    }
    const state = this.axisState(name);
    state.pad = this.live(definition) ? vector : { x: 0, y: 0 };
    this.emitAxis(name, state, "gamepad", noop);
  }

  private axisState(name: A): AxisState {
    let state = this.axes.get(name);
    if (!state) {
      state = {
        up: new Set(),
        down: new Set(),
        left: new Set(),
        right: new Set(),
        pad: { x: 0, y: 0 },
        last: { x: 0, y: 0 },
      };
      this.axes.set(name, state);
    }
    return state;
  }

  private pressAxis(
    name: A,
    definition: AxisActionDefinition,
    code: string,
    down: boolean,
    existing?: AxisState
  ): void {
    const state = existing ?? this.axisState(name);
    for (const direction of ["up", "down", "left", "right"] as const) {
      if (!definition.keys[direction].includes(code)) continue;
      if (down) state[direction].add(code);
      else state[direction].delete(code);
    }
    this.emitAxis(name, state, "keyboard", noop, code);
  }

  private emitAxis(
    name: A,
    state: AxisState,
    source: ActionSource,
    preventDefault: () => void,
    code?: string
  ): void {
    const keyX = (state.right.size > 0 ? 1 : 0) - (state.left.size > 0 ? 1 : 0);
    const keyY = (state.down.size > 0 ? 1 : 0) - (state.up.size > 0 ? 1 : 0);
    const next = {
      x: round(clampUnit(keyX + state.pad.x)),
      y: round(clampUnit(keyY + state.pad.y)),
    };
    if (next.x === state.last.x && next.y === state.last.y) return;
    state.last = next;
    this.fire(name, "change", source, false, preventDefault, code, next);
  }

  private fire(
    action: A,
    phase: "down" | "up" | "change",
    source: ActionSource,
    repeat: boolean,
    preventDefault: () => void,
    code?: string,
    value?: ActionVector
  ): void {
    this.emit({
      action,
      phase,
      source,
      repeat,
      preventDefault,
      ...(code !== undefined ? { code } : {}),
      ...(value !== undefined ? { value } : {}),
    });
  }
}
