/**
 * The arcade's one input action layer (#2356, ADR 0062). A game names what the
 * player can do once, in an action map, and every input reaches it through
 * that map: keys by physical position (`KeyboardEvent.code`, so AZERTY and
 * Dvorak players press the same keys), gamepad buttons and sticks, and touch
 * controls that send the action itself. The cabinet's control list, the key
 * hints and the field manual's control table are generated from the same
 * map, so they cannot drift from the bindings.
 *
 * This file is framework-free: definitions, labels, conflict checks and the
 * generated copy. The keyboard and gamepad reader is `ActionInputController`
 * and the React binding is `useActionInput`.
 */

/**
 * How an action behaves over time.
 *
 * `press` fires once when a key goes down. `hold` fires `down` when the first
 * bound key goes down and `up` when the last one is released. `axis2d` is a
 * direction vector built from four key sets or a stick, sent as `change`.
 * `pointer` is a mouse, touch or Pencil gesture the view handles itself; it
 * has no keys and exists so hints and the manual can name it.
 */
export type ActionKind = "press" | "hold" | "axis2d" | "pointer";

/** The phase of one action input. */
export type ActionPhase = "down" | "up" | "change";

/** Where an action input came from. */
export type ActionSource = "keyboard" | "gamepad" | "touch" | "pointer";

/**
 * The device a hint is written for: a finger, a Pencil, a hardware keyboard,
 * a mouse or a gamepad.
 */
export type HintModality = "touch" | "pen" | "keyboard" | "mouse" | "gamepad";

/** One gamepad axis read as a button: past the threshold in one direction. */
export interface GamepadAxisBinding {
  /** Axis index in the standard mapping (0 and 1 left stick, 2 and 3 right). */
  readonly index: number;
  /** Which way along the axis counts. */
  readonly direction: -1 | 1;
}

/** Gamepad bindings for a `press` or `hold` action, in the standard mapping. */
export interface GamepadButtonBinding {
  /** Button indices, such as 0 for A or Cross and 12 for D-pad up. */
  readonly buttons?: readonly number[];
  /** Axes read as buttons, such as the left stick pushed up. */
  readonly axes?: readonly GamepadAxisBinding[];
}

/** Gamepad bindings for an `axis2d` action. */
export interface GamepadStickBinding {
  /** The stick that drives the vector. */
  readonly stick?: "left" | "right";
  /** Whether the D-pad drives it too. */
  readonly dpad?: boolean;
}

/** The four key sets of an `axis2d` action, as `KeyboardEvent.code` values. */
export interface AxisKeys {
  readonly up: readonly string[];
  readonly down: readonly string[];
  readonly left: readonly string[];
  readonly right: readonly string[];
}

/** What every action carries, whatever its kind. */
interface ActionDefinitionBase {
  /** What the action does, such as "Jump". The control list and manual use it. */
  readonly label: string;
  /** The key as players read it, such as "Space". Defaults to names derived from `keys`. */
  readonly keyLabel?: string;
  /** The touch hint, such as "Tap Jump". Defaults to "Tap" and the label. */
  readonly touchLabel?: string;
  /** The gamepad button as players read it, such as "A". */
  readonly gamepadLabel?: string;
  /** The manual and control-list group this action belongs to. */
  readonly group?: string;
  /**
   * The game context in which the action's keys are live, such as "park".
   * Two actions may share a key when their contexts differ. An action with no
   * context is live everywhere.
   */
  readonly context?: string;
  /** Whether a held key repeats the action. Off by default. */
  readonly repeat?: boolean;
  /** Whether the key's browser default (scrolling, for Space and the arrows) is prevented. */
  readonly preventDefault?: boolean;
  /**
   * Whether the key still acts while a button, link or tab has focus. Off by
   * default, so Space and Enter activate the focused control instead.
   */
  readonly onControls?: boolean;
  /**
   * Set on an action that binds a key the cabinet also uses (F or Escape),
   * to say the game accepts that the cabinet takes the key first where it
   * does. The conflict check then lets it through.
   */
  readonly yieldsToCabinet?: boolean;
}

/** A `press` or `hold` action. */
export interface ButtonActionDefinition extends ActionDefinitionBase {
  readonly kind: "press" | "hold";
  /** `KeyboardEvent.code` values, such as `KeyW`, `Space` or `ArrowUp`. */
  readonly keys: readonly string[];
  readonly gamepad?: GamepadButtonBinding;
}

/** An `axis2d` action. */
export interface AxisActionDefinition extends ActionDefinitionBase {
  readonly kind: "axis2d";
  readonly keys: AxisKeys;
  readonly gamepad?: GamepadStickBinding;
}

/** A `pointer` action: named for hints and the manual, dispatched by the view. */
export interface PointerActionDefinition extends ActionDefinitionBase {
  readonly kind: "pointer";
  readonly keys?: readonly string[];
}

/** One action in an action map. */
export type ActionDefinition =
  ButtonActionDefinition | AxisActionDefinition | PointerActionDefinition;

/** How a group of actions is titled in the control list and the manual. */
export interface ActionGroup {
  /** The row's title. Defaults to the actions' labels joined with " / ". */
  readonly label?: string;
  /** The row's keys. Defaults to the actions' key labels joined with " / ". */
  readonly keyLabel?: string;
}

/** A game's actions, made by `defineActions`. */
export interface ActionMap<A extends string = string> {
  readonly actions: Readonly<Record<A, ActionDefinition>>;
  /** Action names in the order they were defined. */
  readonly names: readonly A[];
  readonly groups: Readonly<Record<string, ActionGroup>>;
}

/** The action names of an action map. */
export type ActionName<M> = M extends ActionMap<infer A> ? A : never;

/** A two-dimensional direction, each axis from -1 to 1. Screen y grows down. */
export interface ActionVector {
  readonly x: number;
  readonly y: number;
}

/** One action input, from any device. */
export interface ActionInput<A extends string = string> {
  readonly action: A;
  readonly phase: ActionPhase;
  readonly source: ActionSource;
  /** True for an auto-repeat of a held key or control. */
  readonly repeat: boolean;
  /** The vector of an `axis2d` action. */
  readonly value?: ActionVector;
  /** The physical key, for keyboard input. */
  readonly code?: string;
  /** Prevents the browser default of the key that caused it. A no-op elsewhere. */
  readonly preventDefault: () => void;
}

/** Receives action inputs. */
export type ActionHandler<A extends string = string> = (
  input: ActionInput<A>
) => void;

/**
 * Keys the arcade cabinet handles itself: F toggles fullscreen and Escape
 * leaves fullscreen or the touch cabinet.
 */
export const CABINET_KEYS: readonly string[] = Object.freeze([
  "KeyF",
  "Escape",
]);

/** Why two bindings clash. */
export type ActionConflictReason = "duplicate" | "cabinet";

/** A key bound twice in one context, or a key the cabinet takes. */
export interface ActionConflict {
  readonly code: string;
  readonly actions: readonly string[];
  readonly reason: ActionConflictReason;
}

/**
 * Builds a frozen action map. Names keep their literal types, so a handler
 * switches over exactly the actions the game defined.
 *
 * @example
 * ```ts
 * const ACTIONS = defineActions({
 *   jump: { kind: "press", keys: ["Space"], label: "Jump", gamepad: { buttons: [0] } },
 * });
 * ```
 *
 * @param actions - Each action by name.
 * @param options - Optional group titles for the control list and the manual.
 * @returns The action map.
 */
export function defineActions<
  const M extends Readonly<Record<string, ActionDefinition>>,
>(
  actions: M,
  options: { groups?: Readonly<Record<string, ActionGroup>> } = {}
): ActionMap<Extract<keyof M, string>> {
  const names = Object.keys(actions) as Extract<keyof M, string>[];
  return Object.freeze({
    actions: Object.freeze({ ...actions }) as Readonly<
      Record<Extract<keyof M, string>, ActionDefinition>
    >,
    names: Object.freeze(names),
    groups: Object.freeze({ ...(options.groups ?? {}) }),
  });
}

/**
 * Every `KeyboardEvent.code` an action binds, across all four directions for
 * an `axis2d` action.
 *
 * @param definition - The action.
 * @returns The codes, possibly empty.
 */
export function actionKeyCodes(definition: ActionDefinition): string[] {
  const keys = definition.keys;
  if (!keys) return [];
  if (isAxisKeys(keys)) {
    return [...keys.up, ...keys.down, ...keys.left, ...keys.right];
  }
  return [...keys];
}

function isAxisKeys(keys: readonly string[] | AxisKeys): keys is AxisKeys {
  return !Array.isArray(keys);
}

const KEY_NAMES: Readonly<Record<string, string>> = {
  Space: "Space",
  Enter: "Enter",
  NumpadEnter: "Enter",
  Escape: "Esc",
  Backspace: "Backspace",
  Tab: "Tab",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  ControlLeft: "Ctrl",
  ControlRight: "Ctrl",
  AltLeft: "Alt",
  AltRight: "Alt",
  MetaLeft: "Meta",
  MetaRight: "Meta",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  Backquote: "`",
};

/**
 * The name a player reads for a physical key: `KeyQ` is "Q", `Digit1` and
 * `Numpad1` are "1", `ArrowUp` is "↑".
 *
 * @param code - A `KeyboardEvent.code` value.
 * @returns The key's printed name.
 */
export function keyNameForCode(code: string): string {
  const named = KEY_NAMES[code];
  if (named) return named;
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1];
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(code);
  if (digit) return digit[1];
  return code;
}

/**
 * The keys of an action as players read them. An explicit `keyLabel` wins;
 * otherwise the distinct key names, joined with " / ".
 *
 * @param definition - The action.
 * @returns The key label, or an empty string for an action with no keys.
 */
export function actionKeyLabel(definition: ActionDefinition): string {
  if (definition.keyLabel) return definition.keyLabel;
  const names = actionKeyCodes(definition).map(keyNameForCode);
  return Array.from(new Set(names)).join(" / ");
}

/**
 * The physical key of a keyboard event. Some synthetic events and Android
 * soft keyboards send an empty `code`; for those the key's character stands
 * in, so "q" reads as `KeyQ`, "1" as `Digit1` and " " as `Space`.
 *
 * @param event - The keyboard event, or the two fields it needs.
 * @returns A `KeyboardEvent.code` value, or an empty string.
 */
export function codeForKeyEvent(
  event: Pick<KeyboardEvent, "code" | "key">
): string {
  if (event.code) return event.code;
  const key = event.key ?? "";
  if (key === " " || key === "Spacebar") return "Space";
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^\d$/.test(key)) return `Digit${key}`;
  if (key === "Esc") return "Escape";
  return key;
}

/** Whether two contexts can be live at once. No context overlaps every context. */
function contextsOverlap(a?: string, b?: string): boolean {
  return a === undefined || b === undefined || a === b;
}

/**
 * Finds the bindings that would clash: one key bound to two actions that can
 * be live at once, and keys the cabinet takes (F and Escape) bound by an
 * action that does not say it yields to the cabinet.
 *
 * @param map - The action map.
 * @param options - `reserved` replaces the cabinet's keys, such as `["Escape"]`
 *   for a cabinet that passes F to the game.
 * @returns Each conflict, in definition order. Empty when the map is clean.
 */
export function findActionConflicts(
  map: ActionMap,
  options: { reserved?: readonly string[] } = {}
): ActionConflict[] {
  const reserved = new Set(options.reserved ?? CABINET_KEYS);
  const conflicts: ActionConflict[] = [];
  const byCode = new Map<string, string[]>();
  for (const name of map.names) {
    const definition = map.actions[name];
    for (const code of new Set(actionKeyCodes(definition))) {
      const bound = byCode.get(code) ?? [];
      bound.push(name);
      byCode.set(code, bound);
      if (reserved.has(code) && !definition.yieldsToCabinet) {
        conflicts.push({ code, actions: [name], reason: "cabinet" });
      }
    }
  }
  for (const [code, names] of byCode) {
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = map.actions[names[i]];
        const b = map.actions[names[j]];
        if (contextsOverlap(a.context, b.context)) {
          conflicts.push({
            code,
            actions: [names[i], names[j]],
            reason: "duplicate",
          });
        }
      }
    }
  }
  return conflicts;
}

/** The three phrasings of a control, the shape `useControlHint` reads. */
export interface ActionHintText {
  readonly key: string;
  readonly touch: string;
  readonly desktop: string;
  readonly gamepad: string;
}

/**
 * The hint text for an action on each kind of device. The keyboard reads
 * "Press" and the key label, a touch screen the action's `touchLabel` (by
 * default "Tap" and the label), and a gamepad "Press" and its button name,
 * falling back to the keyboard phrase when the action names no button. A
 * pointer action reads its touch phrase everywhere but the gamepad.
 *
 * @param definition - The action.
 * @returns The key name and the phrase for each device.
 */
export function actionHintText(definition: ActionDefinition): ActionHintText {
  const key = actionKeyLabel(definition);
  const touch = definition.touchLabel ?? `Tap ${definition.label}`;
  const desktop = key ? `Press ${key}` : touch;
  const gamepad = definition.gamepadLabel
    ? `Press ${definition.gamepadLabel}`
    : desktop;
  return Object.freeze({ key, touch, desktop, gamepad });
}

/**
 * The hint for an action on one device: a finger or a Pencil reads the touch
 * phrase, a gamepad its button, and a keyboard or mouse the key.
 *
 * @param definition - The action.
 * @param modality - The device the player used last.
 * @returns The phrase to show.
 */
export function resolveActionHint(
  definition: ActionDefinition,
  modality: HintModality
): string {
  const text = actionHintText(definition);
  switch (modality) {
    case "touch":
    case "pen":
      return text.touch;
    case "gamepad":
      return text.gamepad;
    default:
      return text.desktop;
  }
}

/** One row of the cabinet's control list, the shape `PlayCabinet` takes. */
export interface CabinetControl {
  readonly key: string;
  readonly action: string;
}

/** The actions of one group, in definition order. */
function groupActions(map: ActionMap, group: string): ActionDefinition[] {
  return map.names
    .map((name) => map.actions[name])
    .filter((definition) => definition.group === group);
}

/** The groups that have at least one action, in order of first appearance. */
function groupOrder(map: ActionMap): string[] {
  const order: string[] = [];
  for (const name of map.names) {
    const group = map.actions[name].group;
    if (group && !order.includes(group)) order.push(group);
  }
  return order;
}

function groupRow(map: ActionMap, group: string): CabinetControl {
  const actions = groupActions(map, group);
  const meta = map.groups[group] ?? {};
  const keys = Array.from(
    new Set(actions.map(actionKeyLabel).filter(Boolean))
  ).join(" / ");
  const labels = actions.map((definition) => definition.label).join(" / ");
  return Object.freeze({
    key: meta.keyLabel ?? keys,
    action: meta.label ?? labels,
  });
}

/**
 * The cabinet's control list, one row per group: the group's keys and what
 * they do. Pass it as `PlayCabinet`'s `controls`.
 *
 * @param map - The action map.
 * @param groups - The groups to list, in order. Defaults to every group.
 * @returns The rows.
 */
export function controlsFromActions(
  map: ActionMap,
  groups: readonly string[] = groupOrder(map)
): CabinetControl[] {
  return groups
    .filter((group) => groupActions(map, group).length > 0)
    .map((group) => groupRow(map, group));
}

/** What the field manual adds to a group's row: its title and its prose. */
export interface ManualControlSpec {
  readonly group: string;
  /** The row's title, such as "Training Tricks". */
  readonly action: string;
  readonly description: string;
  /** A non-key way to do the same, appended to the keys, such as "Door Click". */
  readonly alsoKey?: string;
}

/** One row of a field manual's control table, the shape `ManualControl` takes. */
export interface ManualControlRow {
  readonly key: string;
  readonly action: string;
  readonly description: string;
}

/**
 * Rows for a field manual's control table. The keys come from the map, so
 * the manual names the keys the game binds; the title and prose come from
 * the spec.
 *
 * @param map - The action map.
 * @param specs - One entry per row.
 * @returns The rows, in the order of `specs`.
 */
export function manualControlsFromActions(
  map: ActionMap,
  specs: readonly ManualControlSpec[]
): ManualControlRow[] {
  return specs.map((spec) => {
    const keys = groupRow(map, spec.group).key;
    return Object.freeze({
      key: spec.alsoKey ? `${keys} / ${spec.alsoKey}` : keys,
      action: spec.action,
      description: spec.description,
    });
  });
}

/**
 * Builds the input a touch control sends for an action.
 *
 * @param action - The action name.
 * @param phase - `down` on press, `up` on release.
 * @param repeat - True for a hold's repeat.
 * @returns An action input from the touch source.
 */
export function touchActionInput<A extends string>(
  action: A,
  phase: "down" | "up",
  repeat = false
): ActionInput<A> {
  return {
    action,
    phase,
    source: "touch",
    repeat,
    preventDefault: () => {},
  };
}

/**
 * Builds the input a touch stick or drag pad sends for an `axis2d` action:
 * phase `change` with the vector, as a keyboard or gamepad stick sends it.
 * A released stick sends `{ x: 0, y: 0 }`.
 *
 * @param action - The `axis2d` action name.
 * @param value - The direction, each axis from -1 to 1, screen y down.
 * @returns An action input from the touch source.
 */
export function touchAxisInput<A extends string>(
  action: A,
  value: ActionVector
): ActionInput<A> {
  return {
    action,
    phase: "change",
    source: "touch",
    repeat: false,
    value,
    preventDefault: () => {},
  };
}
