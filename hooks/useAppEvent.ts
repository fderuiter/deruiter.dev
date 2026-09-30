"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import {
  onAppEvent,
  type AppEventHandler,
  type AppEventMap,
  type AppEventName,
} from "@/lib/event-bus";

export type { AppEventHandler, AppEventMap, AppEventName };

/**
 * Subscribes the component to a registered application event on `window` for
 * as long as it is mounted, removing the listener on unmount.
 *
 * Each dispatch invokes the latest `handler`, so it reads current props and
 * state without re-subscribing when the handler's identity changes. Only a
 * change of `event` re-subscribes.
 *
 * @param event - The registered event name from `AppEventMap`.
 * @param handler - Called with the event's detail payload.
 */
export function useAppEvent<K extends AppEventName>(
  event: K,
  handler: AppEventHandler<K>
): void {
  const handlerRef = useRef(handler);

  useLayoutEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(
    () => onAppEvent(event, (detail) => handlerRef.current(detail)),
    [event]
  );
}
