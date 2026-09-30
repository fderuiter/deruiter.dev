"use client";

import { useEffect, useRef } from "react";
import { emitAppEvent, type WorkspaceActionPayload } from "@/lib/event-bus";

export type { WorkspaceActionPayload };

/**
 * Registers a contextual workspace action on mount and automatically cleans up
 * the listener on unmount to prevent dangling handlers or memory leaks.
 *
 * Each dispatch invokes the latest `action.handler`, so reading current state or
 * props inside the handler always sees fresh values.
 */
export function useWorkspaceAction(action: WorkspaceActionPayload): void {
  const handlerRef = useRef(action.handler);

  useEffect(() => {
    handlerRef.current = action.handler;
  });

  const tagsKey = Array.isArray(action.tags) ? action.tags.join(",") : "";

  useEffect(() => {
    const actionToRegister: WorkspaceActionPayload = {
      ...action,
      handler: () => handlerRef.current?.(),
    };

    emitAppEvent("workspace:register_action", actionToRegister);

    return () => {
      emitAppEvent("workspace:unregister_action", { id: action.id });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    action.id,
    action.title,
    action.description,
    action.subToolId,
    action.subToolName,
    action.badge,
    action.shortcut,
    tagsKey,
  ]);
}
