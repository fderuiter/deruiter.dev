/**
 * Typed contract for the custom events that decoupled components exchange on
 * `window`.
 *
 * Every event name and its `CustomEvent.detail` payload is declared once in
 * {@link AppEventMap}. Dispatch through {@link emitAppEvent} and listen through
 * {@link onAppEvent} (or the `useAppEvent` hook in React components) so that a
 * misspelled name or a mismatched payload fails to compile instead of silently
 * never firing.
 *
 * The events remain ordinary `CustomEvent`s on `window` with unchanged names,
 * so raw `window.addEventListener` listeners and tests keep working.
 */

/** Configuration for registering a workspace contextual command. */
export interface WorkspaceActionPayload {
  id: string;
  title: string;
  description?: string;
  subToolId: string;
  subToolName: string;
  badge?: string;
  tags?: string[];
  shortcut?: string;
  handler?: () => void | Promise<void>;
}

/** Payload for unregistering a workspace action. */
export interface WorkspaceUnregisterPayload {
  id: string;
}

/** Payload for executing a workspace action. */
export interface WorkspaceExecutePayload {
  id: string;
  args?: Record<string, unknown>;
}

/** Payload for macro step recording. */
export interface MacroRecordStepPayload {
  actionId: string;
  timestamp: number;
  args?: Record<string, unknown>;
}

/** Payload for saving a macro sequence. */
export interface MacroSavePayload {
  name: string;
  description?: string;
  steps: Array<{
    actionId: string;
    timestamp?: number;
    args?: Record<string, unknown>;
  }>;
}

/** Payload for executing a saved macro. */
export interface MacroExecutePayload {
  macroId: string;
}

/** Payload for macro state updates. */
export interface MacroStatePayload {
  isRecording: boolean;
  recordingName?: string;
  recordedStepsCount: number;
}

/**
 * Registry of application events, mapping each event name to the type of its
 * `detail` payload. An event whose payload type includes `undefined` may be
 * emitted without a detail.
 */
export interface AppEventMap {
  /** Opens the Retro Chaos overlay from a shortcut (Command Palette, terminal, Meme Vault). */
  trigger_retro_chaos: undefined;
  /** Opens the global photo gallery, optionally at a specific photo. */
  "open-photo-gallery": { photoId?: string } | undefined;
  /** Asks the on-page sandbox terminal to type and run a command. */
  "terminal:run": { command: string };
  /** A Meme Vault achievement was unlocked for the first time. */
  meme_achievement_unlocked: { id: string };
  /** The Meme Vault unlocked flag was written. */
  meme_vault_unlocked_change: { unlocked: boolean };
  /** The arcade CRT calibration was saved. */
  "crt-calibration-changed": undefined;
  /** An arcade game score or milestone was updated. */
  arcade_score_updated: {
    gameId: string;
    score: number;
    metadata?: Record<string, unknown>;
  };
  /** An arcade trophy or achievement was unlocked. */
  arcade_trophy_unlocked: {
    trophyId: string;
    gameId: string;
    title: string;
    unlockedAt: number;
  };

  /** Registers a sub-tool contextual workspace action. */
  "workspace:register_action": WorkspaceActionPayload;
  /** Unregisters a sub-tool contextual workspace action. */
  "workspace:unregister_action": WorkspaceUnregisterPayload;
  /** Triggers execution of a registered workspace action. */
  "workspace:execute_action": WorkspaceExecutePayload;
  /** Starts recording a new macro sequence. */
  "macro:start_recording": { name?: string } | undefined;
  /** Stops the active macro recording session. */
  "macro:stop_recording": undefined;
  /** Records a single action step into the active macro recording. */
  "macro:record_step": MacroRecordStepPayload;
  /** Saves a named macro sequence to persistent browser storage. */
  "macro:save": MacroSavePayload;
  /** Executes a saved macro by ID. */
  "macro:execute": MacroExecutePayload;
  /** Toggles macro recording mode on/off. */
  "macro:toggle_recording": { name?: string } | undefined;
  /** Emitted whenever macro recording state changes. */
  "macro:state_changed": MacroStatePayload;
}

/** Name of a registered application event. */
export type AppEventName = keyof AppEventMap;

/**
 * Trailing arguments of {@link emitAppEvent} for event `K`: the detail is
 * optional when the event's payload type admits `undefined`, required otherwise.
 */
export type AppEventArgs<K extends AppEventName> =
  undefined extends AppEventMap[K]
    ? [detail?: AppEventMap[K]]
    : [detail: AppEventMap[K]];

/** Handler invoked with the `detail` payload of event `K`. */
export type AppEventHandler<K extends AppEventName> = (
  detail: AppEventMap[K]
) => void;

/**
 * Dispatches a registered application event on `window` as a `CustomEvent`
 * carrying `detail`. Does nothing outside the browser.
 *
 * @param event - The registered event name.
 * @param args - The event's detail payload, optional when the payload type admits `undefined`.
 */
export function emitAppEvent<K extends AppEventName>(
  event: K,
  ...args: AppEventArgs<K>
): void {
  if (typeof window === "undefined") return;
  const [detail] = args;
  window.dispatchEvent(new CustomEvent(event, { detail }));
}

/**
 * Subscribes to a registered application event on `window`.
 *
 * The handler receives the event's `detail`; a detail-less dispatch (whose
 * `CustomEvent.detail` is `null`) is delivered as `undefined`. Outside the
 * browser this is a no-op.
 *
 * @param event - The registered event name.
 * @param handler - Called with the detail payload on every dispatch.
 * @returns A function that removes the listener.
 */
export function onAppEvent<K extends AppEventName>(
  event: K,
  handler: AppEventHandler<K>
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const detail = e instanceof CustomEvent ? e.detail : undefined;
    handler((detail ?? undefined) as AppEventMap[K]);
  };
  window.addEventListener(event, listener);
  return () => window.removeEventListener(event, listener);
}
