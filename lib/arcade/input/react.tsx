"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
} from "react";
import { logger } from "@/lib/logger";
import {
  CABINET_KEYS,
  findActionConflicts,
  type ActionConflict,
  type ActionHandler,
  type ActionInput,
  type ActionMap,
} from "./actions";
import {
  ActionInputController,
  type ActionInputControllerOptions,
  type GamepadLike,
} from "./controller";

/** Options for `useActionInput`. */
export interface UseActionInputOptions {
  /** Whether the listeners are attached. Defaults to true. */
  enabled?: boolean;
  /**
   * Only keys pressed while focus is inside this element act, so a game
   * leaves the rest of the page its keys.
   */
  scopeRef?: React.RefObject<HTMLElement | null>;
  /** The game's current context, read on every key. See `ActionDefinition.context`. */
  getContext?: () => string | undefined;
  /** See `ActionInputControllerOptions.modifiers`. Defaults to `none`. */
  modifiers?: ActionInputControllerOptions["modifiers"];
  /** See `ActionInputControllerOptions.ignoreControls`. Defaults to true. */
  ignoreControls?: boolean;
  /**
   * The keys the cabinet takes, for the conflict check. Defaults to F and
   * Escape; a cabinet with `fullscreenKey={false}` passes `["Escape"]`.
   */
  reservedKeys?: readonly string[];
  /**
   * Called once per map with any binding conflicts. Without it, conflicts
   * are logged as a console warning.
   */
  onConflict?: (conflicts: readonly ActionConflict[]) => void;
}

/** Maps already reported, so a conflict is logged once, not on every mount. */
const reportedMaps = new WeakSet<object>();

function hasGamepadBindings(map: ActionMap): boolean {
  return map.names.some((name) => {
    const definition = map.actions[name];
    return definition.kind !== "pointer" && definition.gamepad !== undefined;
  });
}

function readGamepads(): readonly (GamepadLike | null)[] {
  if (typeof navigator === "undefined") return [];
  if (typeof navigator.getGamepads !== "function") return [];
  try {
    return Array.from(navigator.getGamepads());
  } catch {
    // A permissions policy can forbid the Gamepad API.
    return [];
  }
}

/**
 * Binds an action map to the keyboard and any gamepad for the life of the
 * component. Keys are matched by `KeyboardEvent.code`, so the bindings follow
 * the key's position on any layout. A key typed into a text field is left to
 * it, a key on a focused button is left to the button unless the action says
 * otherwise, and only actions with `repeat` act on a held key. Every held
 * action is released when the window blurs, the page hides or the hook is
 * disabled. The handler is always the latest one, so it never re-binds; a
 * new map, or a change to `enabled`, `modifiers` or `ignoreControls`,
 * re-binds. Conflicts with the cabinet's own keys are reported once per map.
 *
 * @example
 * ```tsx
 * useActionInput(ACTIONS, (input) => {
 *   if (input.action === "jump" && input.phase === "down") session.dispatch("jump");
 * });
 * ```
 *
 * @param map - The action map from `defineActions`.
 * @param onAction - Receives each action input.
 * @param options - When and where the bindings act.
 */
export function useActionInput<A extends string>(
  map: ActionMap<A>,
  onAction: ActionHandler<A>,
  options: UseActionInputOptions = {}
): void {
  const {
    enabled = true,
    scopeRef,
    getContext,
    modifiers = "none",
    ignoreControls = true,
    reservedKeys,
    onConflict,
  } = options;

  const deliver = useEffectEvent((input: ActionInput<A>) => onAction(input));
  const readContext = useEffectEvent(() => getContext?.());
  const accepts = useEffectEvent((): boolean => {
    if (!scopeRef) return true;
    const scope = scopeRef.current;
    return (
      !!scope &&
      typeof document !== "undefined" &&
      scope.contains(document.activeElement)
    );
  });
  const report = useEffectEvent((conflicts: readonly ActionConflict[]) => {
    if (onConflict) {
      onConflict(conflicts);
      return;
    }
    if (reportedMaps.has(map)) return;
    reportedMaps.add(map);
    logger.warn(
      `[arcade input] ${conflicts.length} key binding conflict(s): ${conflicts
        .map((c) => `${c.code} (${c.reason}: ${c.actions.join(", ")})`)
        .join("; ")}`,
      { skipTelemetry: true }
    );
  });

  const reservedKey = (reservedKeys ?? CABINET_KEYS).join("\n");
  useEffect(() => {
    const conflicts = findActionConflicts(map, {
      reserved: reservedKey ? reservedKey.split("\n") : [],
    });
    if (conflicts.length > 0) report(conflicts);
  }, [map, reservedKey]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const controller = new ActionInputController<A>(
      map,
      (input) => deliver(input),
      {
        getContext: () => readContext(),
        modifiers,
        ignoreControls,
        accepts: () => accepts(),
      }
    );
    const onKeyDown = (event: KeyboardEvent) => controller.handleKeyDown(event);
    const onKeyUp = (event: KeyboardEvent) => controller.handleKeyUp(event);
    const release = () => controller.releaseAll();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") release();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);
    window.addEventListener("pagehide", release);
    document.addEventListener("visibilitychange", onVisibility);

    // Gamepads are polled once a frame while one is connected.
    let frame: number | null = null;
    const poll = () => {
      frame = null;
      const pads = readGamepads();
      controller.pollGamepads(pads, performance.now());
      if (pads.some((pad) => pad && pad.connected !== false)) {
        frame = window.requestAnimationFrame(poll);
      }
    };
    const startPolling = () => {
      if (
        frame === null &&
        typeof window.requestAnimationFrame === "function"
      ) {
        frame = window.requestAnimationFrame(poll);
      }
    };
    const pads = hasGamepadBindings(map);
    if (pads) {
      window.addEventListener("gamepadconnected", startPolling);
      // A pad connected before mount sends no event.
      if (readGamepads().some((pad) => pad && pad.connected !== false)) {
        startPolling();
      }
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
      window.removeEventListener("pagehide", release);
      document.removeEventListener("visibilitychange", onVisibility);
      if (pads) window.removeEventListener("gamepadconnected", startPolling);
      if (frame !== null) window.cancelAnimationFrame(frame);
      // A hold must not outlive the binding that started it.
      controller.releaseAll();
    };
  }, [enabled, map, modifiers, ignoreControls]);
}

const ActionSinkContext = createContext<ActionHandler | null>(null);

/** Props for `ActionSinkProvider`. */
export interface ActionSinkProviderProps<A extends string = string> {
  /** The session's action handler. Touch controls below send their actions here. */
  onAction: ActionHandler<A>;
  /**
   * The action map, when the sink should apply it: repeats of an action
   * without `repeat` are then dropped, as they are for keys.
   */
  actions?: ActionMap<A>;
  children: React.ReactNode;
}

/**
 * Hands a session's action handler to the touch controls below it, so a
 * `TouchButton` with an `action` sends that action, not a fake key.
 *
 * @param props - The handler, an optional action map and the controls.
 * @returns The children, with the handler in context.
 */
export function ActionSinkProvider<A extends string = string>({
  onAction,
  actions,
  children,
}: ActionSinkProviderProps<A>) {
  const handlerRef = useRef(onAction);
  const actionsRef = useRef(actions);
  useEffect(() => {
    handlerRef.current = onAction;
    actionsRef.current = actions;
  }, [onAction, actions]);
  const sink = useCallback<ActionHandler>((input) => {
    const map = actionsRef.current;
    if (map) {
      const definition = map.actions[input.action as A];
      if (!definition) return;
      if (input.repeat && !definition.repeat) return;
    }
    handlerRef.current(input as ActionInput<A>);
  }, []);
  return (
    <ActionSinkContext.Provider value={sink}>
      {children}
    </ActionSinkContext.Provider>
  );
}

/**
 * The nearest session's action handler, or null outside an
 * `ActionSinkProvider`.
 *
 * @returns The handler, or null.
 */
export function useActionSink(): ActionHandler | null {
  return useContext(ActionSinkContext);
}
