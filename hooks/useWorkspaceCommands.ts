"use client";

import { useSyncExternalStore } from "react";
import {
  workspaceCommandRegistry,
  type WorkspaceAction,
} from "@/lib/workspace-command-registry";

const subscribe = (callback: () => void) =>
  workspaceCommandRegistry.subscribe(callback);

const getSnapshot = () => workspaceCommandRegistry.getActions();
const getServerSnapshot = (): WorkspaceAction[] => [];

export function useWorkspaceCommands(): WorkspaceAction[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
