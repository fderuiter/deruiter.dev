import { resolveEscape } from "./pause-controller";

/**
 * Phone Back and browser Back in a launched cabinet (#2545).
 *
 * Launch pushes one history entry with the same URL, so Back lands on the
 * page the player was already on and fires `popstate` instead of leaving.
 * The cabinet then walks its Escape ladder: close the top sheet, else pause,
 * else exit. Every step that leaves the cabinet open pushes the entry again,
 * so the next Back is caught too. Exiting from the toolbar pops the entry, so
 * the history the player goes back through stays as it was before Launch.
 *
 * What the page cannot catch: the iOS home-indicator swipe and an iOS back
 * swipe that starts inside the system's edge zone. Both leave the page
 * without a `popstate`, and the pause service pauses and saves the run
 * through `visibilitychange` and `pagehide` instead (ADR 0062).
 */

/** The key a cabinet's history entry carries, with the game's slug as value. */
export const CABINET_HISTORY_KEY = "arcadeCabinet";
/** The key that tells one launch's entry from an earlier one. */
export const CABINET_HISTORY_LAUNCH_KEY = "arcadeCabinetLaunch";

/** The parts of `window.history` the cabinet uses. */
export interface CabinetHistoryTarget {
  readonly state: unknown;
  pushState(data: unknown, unused: string): void;
  replaceState(data: unknown, unused: string): void;
  back(): void;
}

/** What one Back did: the cabinet stays open, or it has exited. */
export type BackOutcome = "stay" | "exit";

/** What one Back does in a cabinet that hosts views. */
export type BackAction = "close-sheet" | "pause" | "exit";

/**
 * The Back rung of the cabinet's Escape ladder. It is `resolveEscape` with
 * one difference: where a second Escape offers exit, a second Back exits, as
 * Back does everywhere else on a phone.
 *
 * @param input - Whether a sheet is open and whether the pause overlay is.
 * @returns What this Back does.
 */
export function resolveBack(input: {
  readonly sheetOpen: boolean;
  readonly overlayOpen: boolean;
}): BackAction {
  const action = resolveEscape({ ...input, exitOffered: false });
  if (action === "close-sheet" || action === "pause") return action;
  return "exit";
}

function asRecord(state: unknown): Record<string, unknown> | null {
  return typeof state === "object" && state !== null
    ? (state as Record<string, unknown>)
    : null;
}

/**
 * Whether a history state is a cabinet entry for `slug`.
 *
 * @param state - A `history.state` value.
 * @param slug - The game's id.
 * @returns True for an entry a cabinet for this game pushed.
 */
export function isCabinetHistoryState(state: unknown, slug: string): boolean {
  return asRecord(state)?.[CABINET_HISTORY_KEY] === slug;
}

/** Options for {@link createCabinetHistory}. */
export interface CabinetHistoryOptions {
  /** The game's id, stored in the entry. */
  readonly slug: string;
  /** The history to drive. Defaults to `window.history`, read when used. */
  readonly getHistory?: () => CabinetHistoryTarget | null;
}

/** The cabinet's history entry as a small state machine. */
export interface CabinetHistory {
  /** Whether the current launch's entry is in the history now. */
  readonly isPushed: () => boolean;
  /**
   * Strips a cabinet entry this launch did not push, such as the one a
   * reload while launched leaves behind, so it never traps Back. The URL and
   * any other state (the router's) are kept.
   */
  readonly discardStale: () => void;
  /** Pushes the launch's entry, once. Called on Launch. */
  readonly push: () => void;
  /**
   * The `popstate` listener. When Back popped the cabinet's entry it runs
   * `onBack`, one rung of the ladder, which says whether the cabinet is
   * still open; if it is, the entry is pushed again.
   */
  readonly handlePopState: (onBack: () => BackOutcome) => void;
  /** Pops the entry when the cabinet exits by its own controls. */
  readonly release: () => void;
  /**
   * Forgets the entry without touching history: the cabinet is unmounting,
   * perhaps because the player followed a link, which must not be undone.
   */
  readonly abandon: () => void;
}

function defaultHistory(): CabinetHistoryTarget | null {
  return typeof window === "undefined" ? null : window.history;
}

let launchCounter = 0;

/**
 * Makes the history state machine for one cabinet.
 *
 * Each step runs outside any React state updater (AGENTS.md section 4): the
 * cabinet calls `push` from its Launch handler, `release` from its exit
 * handler and `handlePopState` from a window listener.
 *
 * @param options - The game's slug and the history to drive.
 * @returns The state machine.
 */
export function createCabinetHistory(
  options: CabinetHistoryOptions
): CabinetHistory {
  const { slug, getHistory = defaultHistory } = options;
  let pushed = false;
  let launchId: string | null = null;
  // Pops the cabinet made itself (an exit from the toolbar), not the player.
  let pendingPops = 0;

  const isOwnEntry = (state: unknown) =>
    isCabinetHistoryState(state, slug) &&
    asRecord(state)?.[CABINET_HISTORY_LAUNCH_KEY] === launchId;

  const discardStale = () => {
    const history = getHistory();
    if (!history || !isCabinetHistoryState(history.state, slug)) return;
    if (pushed && isOwnEntry(history.state)) return;
    const rest = { ...asRecord(history.state) };
    delete rest[CABINET_HISTORY_KEY];
    delete rest[CABINET_HISTORY_LAUNCH_KEY];
    history.replaceState(rest, "");
  };

  const pushEntry = (history: CabinetHistoryTarget) => {
    // Keep the router's own state (Next.js reads `__NA` on popstate).
    history.pushState(
      {
        ...asRecord(history.state),
        [CABINET_HISTORY_KEY]: slug,
        [CABINET_HISTORY_LAUNCH_KEY]: launchId,
      },
      ""
    );
    pushed = true;
  };

  return {
    isPushed: () => pushed,
    discardStale,
    push() {
      const history = getHistory();
      if (!history || pushed) return;
      launchCounter += 1;
      launchId = `${slug}-${Date.now().toString(36)}-${launchCounter}`;
      pendingPops = 0;
      pushEntry(history);
    },
    handlePopState(onBack) {
      const history = getHistory();
      if (!history) return;
      if (pendingPops > 0) {
        pendingPops -= 1;
        return;
      }
      if (!pushed) {
        // Forward onto an old cabinet entry, with no cabinet open.
        discardStale();
        return;
      }
      // Forward back onto this launch's own entry: nothing was left.
      if (isOwnEntry(history.state)) return;
      pushed = false;
      if (onBack() === "stay") pushEntry(history);
    },
    release() {
      const history = getHistory();
      if (!history || !pushed) return;
      pushed = false;
      if (!isOwnEntry(history.state)) return;
      pendingPops += 1;
      history.back();
    },
    abandon() {
      pushed = false;
      pendingPops = 0;
    },
  };
}
