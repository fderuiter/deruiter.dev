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
