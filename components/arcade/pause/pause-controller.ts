import type { FormFactor } from "@/lib/arcade";

/**
 * Why the cabinet is paused (#2357). Reasons combine: the cabinet stays
 * paused while any one is set, so resuming `user` does not resume `hidden`.
 *
 * - `user`: the player paused, with P, Escape or a Pause button.
 * - `hidden`: the page was hidden or the WebGL context was lost.
 * - `blur`: the window lost focus, on a touch cabinet.
 * - `rotate`: a phone rotated.
 * - `sheet`: a bottom sheet is open over real-time play.
 * - `view-swap`: the cabinet is swapping to another view.
 * - `setup`: the cabinet's Setup is open.
 */
export type PauseReason =
  "user" | "hidden" | "blur" | "rotate" | "sheet" | "view-swap" | "setup";

/**
 * The reasons the player's Resume clears. Automatic pauses never resume on
 * their own; they wait for Resume. A sheet and Setup end when their own UI
 * closes, so Resume leaves them.
 */
export const RESUMABLE_REASONS: ReadonlySet<PauseReason> = new Set([
  "user",
  "hidden",
  "blur",
  "rotate",
  "view-swap",
]);

/** The automatic reasons: the ones the player did not ask for. */
export const AUTOMATIC_REASONS: ReadonlySet<PauseReason> = new Set([
  "hidden",
  "blur",
  "rotate",
  "view-swap",
]);

/** The pause state the cabinet shares with its game. */
export interface PauseState {
  readonly paused: boolean;
  readonly reasons: ReadonlySet<PauseReason>;
  /** Whether a real-time run is in progress, so the screen stays awake. */
  readonly running: boolean;
}

/** A menu item a game adds to the cabinet's pause overlay. */
export interface PauseMenuItem {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
}

/** Called for every pause request, with the reason it carried. */
export type PauseListener = (reason: PauseReason) => void;

/**
 * The cabinet's pause service as an external store. The cabinet makes one
 * per launch and provides it with `CabinetPauseProvider`.
 *
 * Methods do not rely on `this`, so callers can pass them around detached.
 */
export interface PauseController {
  readonly getState: () => PauseState;
  readonly subscribe: (listener: () => void) => () => void;
  /** Adds a reason. Listeners hear every request, even a repeated one. */
  readonly pause: (reason: PauseReason) => void;
  /**
   * Clears one reason, or with no argument does what the Resume button
   * does: clears the player's and the automatic reasons.
   */
  readonly resume: (reason?: PauseReason) => void;
  /** Calls `listener` on every pause request. Returns an unsubscribe. */
  readonly onPause: (listener: PauseListener) => () => void;
  /** Calls `listener` when the last reason clears. Returns an unsubscribe. */
  readonly onResume: (listener: () => void) => () => void;
  /**
   * Calls `listener` when the page is about to hide, the session's one
   * synchronous moment to save its run. Returns an unsubscribe.
   */
  readonly onSuspend: (listener: () => void) => () => void;
  /** Tells every `onSuspend` listener the page is hiding. */
  readonly suspend: () => void;
  /** Reports whether a real-time run is in progress. */
  readonly setRunning: (running: boolean) => void;
  /** The game the cabinet hosts and the view it shows, for saves. */
  readonly getInfo: () => PauseInfo;
  readonly setInfo: (info: Partial<PauseInfo>) => void;
  /** The game's own pause overlay items. */
  readonly getMenuItems: () => readonly PauseMenuItem[];
  /** Sets the items for one owner. Returns a function that removes them. */
  readonly setMenuItems: (
    owner: symbol,
    items: readonly PauseMenuItem[]
  ) => () => void;
}

/** The game and view a cabinet hosts. */
export interface PauseInfo {
  readonly gameId: string;
  readonly view: FormFactor;
}

function emitAll(listeners: Iterable<() => void>): void {
  // A copy, so a listener that unsubscribes does not skip the next one.
  [...listeners].forEach((listener) => listener());
}

/**
 * Makes a pause controller.
 *
 * @param info - The game the cabinet hosts and the view it shows.
 * @returns The controller.
 */
export function createPauseController(
  info: PauseInfo = { gameId: "arcade", view: "desktop" }
): PauseController {
  let state: PauseState = {
    paused: false,
    reasons: new Set(),
    running: false,
  };
  let currentInfo = info;
  const menu = new Map<symbol, readonly PauseMenuItem[]>();
  let menuItems: readonly PauseMenuItem[] = [];
  const changeListeners = new Set<() => void>();
  const pauseListeners = new Set<PauseListener>();
  const resumeListeners = new Set<() => void>();
  const suspendListeners = new Set<() => void>();

  const commit = (next: PauseState) => {
    state = next;
    emitAll(changeListeners);
  };
  const setReasons = (reasons: Set<PauseReason>) => {
    const wasPaused = state.paused;
    commit({ ...state, paused: reasons.size > 0, reasons });
    if (wasPaused && reasons.size === 0) emitAll(resumeListeners);
  };
  const add = <T>(set: Set<T>, listener: T) => {
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  };

  return {
    getState: () => state,
    subscribe: (listener) => add(changeListeners, listener),
    pause(reason) {
      if (!state.reasons.has(reason)) {
        setReasons(new Set([...state.reasons, reason]));
      }
      [...pauseListeners].forEach((listener) => listener(reason));
    },
    resume(reason) {
      const next = new Set(
        [...state.reasons].filter((held) =>
          reason ? held !== reason : !RESUMABLE_REASONS.has(held)
        )
      );
      if (next.size !== state.reasons.size) setReasons(next);
    },
    onPause: (listener) => add(pauseListeners, listener),
    onResume: (listener) => add(resumeListeners, listener),
    onSuspend: (listener) => add(suspendListeners, listener),
    suspend: () => emitAll(suspendListeners),
    setRunning(running) {
      if (running !== state.running) commit({ ...state, running });
    },
    getInfo: () => currentInfo,
    setInfo(next) {
      currentInfo = { ...currentInfo, ...next };
    },
    getMenuItems: () => menuItems,
    setMenuItems(owner, items) {
      const publish = () => {
        menuItems = [...menu.values()].flat();
        emitAll(changeListeners);
      };
      menu.set(owner, items);
      publish();
      return () => {
        if (menu.get(owner) !== items) return;
        menu.delete(owner);
        publish();
      };
    },
  };
}

/** Whether the shared pause overlay shows for these reasons. */
export function showsPauseOverlay(reasons: ReadonlySet<PauseReason>): boolean {
  for (const reason of reasons) if (RESUMABLE_REASONS.has(reason)) return true;
  return false;
}

/** What one Escape press does in a cabinet that hosts views. */
export type EscapeAction = "close-sheet" | "pause" | "offer-exit" | "none";

/**
 * The cabinet's one Escape rule: Escape closes the top sheet, then pauses,
 * then, pressed again on the pause overlay, offers exit.
 *
 * @param input - Whether a sheet is open, the cabinet is paused and exit is offered.
 * @returns What this press does.
 */
export function resolveEscape(input: {
  readonly sheetOpen: boolean;
  readonly overlayOpen: boolean;
  readonly exitOffered: boolean;
}): EscapeAction {
  if (input.sheetOpen) return "close-sheet";
  if (!input.overlayOpen) return "pause";
  return input.exitOffered ? "none" : "offer-exit";
}
