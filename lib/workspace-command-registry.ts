import { logger } from "@/lib/logger";
import {
  onAppEvent,
  emitAppEvent,
  type WorkspaceActionPayload,
} from "@/lib/event-bus";

export type WorkspaceAction = WorkspaceActionPayload;

export type WorkspaceRegistryListener = () => void;

const EMPTY_ACTIONS: WorkspaceAction[] = [];

export class WorkspaceCommandRegistry {
  private actions = new Map<string, WorkspaceAction>();
  private listeners = new Set<WorkspaceRegistryListener>();
  private isInitialized = false;
  private cachedActionsArray: WorkspaceAction[] = EMPTY_ACTIONS;

  constructor() {
    this.initEventListeners();
  }

  private initEventListeners() {
    if (typeof window === "undefined" || this.isInitialized) return;
    this.isInitialized = true;

    onAppEvent("workspace:register_action", (payload) => {
      if (payload && payload.id) {
        this.registerAction(payload);
      }
    });

    onAppEvent("workspace:unregister_action", (payload) => {
      if (payload && payload.id) {
        this.unregisterAction(payload.id);
      }
    });

    onAppEvent("workspace:execute_action", (payload) => {
      if (payload && payload.id) {
        this.executeAction(payload.id, payload.args);
      }
    });
  }

  /**
   * Registers a contextual workspace action.
   */
  public registerAction(action: WorkspaceAction): void {
    if (!action || !action.id) return;
    this.actions.set(action.id, { ...action });
    this.updateCache();
    this.notify();
  }

  /**
   * Unregisters a workspace action by ID.
   */
  public unregisterAction(id: string): void {
    if (!id) return;
    if (this.actions.has(id)) {
      this.actions.delete(id);
      this.updateCache();
      this.notify();
    }
  }

  /**
   * Executes a registered workspace action asynchronously on the main thread.
   *
   * If the handler is missing or dead, logs a warning diagnostic without
   * throwing uncaught exceptions.
   */
  public async executeAction(
    id: string,
    args?: Record<string, unknown>
  ): Promise<boolean> {
    const action = this.actions.get(id);

    if (!action) {
      logger.warn(
        `WorkspaceCommandRegistry: Action "${id}" is not registered.`
      );
      return false;
    }

    if (typeof action.handler !== "function") {
      logger.warn(
        `WorkspaceCommandRegistry: Action "${id}" handler is missing or dead.`
      );
      return false;
    }

    try {
      // Execute asynchronously on main thread without blocking
      await Promise.resolve().then(() => action.handler!(args));

      // If step execution succeeded, notify macro recording channel
      emitAppEvent("macro:record_step", {
        actionId: id,
        timestamp: Date.now(),
        args,
      });

      return true;
    } catch (err) {
      logger.warn(
        `WorkspaceCommandRegistry: Action "${id}" execution threw an error:`,
        err
      );
      return false;
    }
  }

  /**
   * Retrieves all currently registered workspace actions.
   * Returns a stable cached array reference for useSyncExternalStore.
   */
  public getActions(): WorkspaceAction[] {
    return this.cachedActionsArray;
  }

  /**
   * Retrieves a single registered workspace action by ID.
   */
  public getAction(id: string): WorkspaceAction | undefined {
    return this.actions.get(id);
  }

  /**
   * Registers a dynamic CLI command definition into the workspace registry.
   */
  public registerCommand(action: WorkspaceAction): void {
    this.registerAction(action);
  }

  /**
   * Finds a registered command by its CLI name or ID.
   */
  public findCommandByCli(cliNameOrId: string): WorkspaceAction | undefined {
    if (!cliNameOrId) return undefined;
    const trimmed = cliNameOrId.trim();
    const directMatch = this.actions.get(trimmed);
    if (directMatch) return directMatch;

    for (const action of this.actions.values()) {
      if (
        action.cliName &&
        (action.cliName.toLowerCase() === trimmed.toLowerCase() ||
          trimmed.toLowerCase().startsWith(action.cliName.toLowerCase()))
      ) {
        return action;
      }
    }
    return undefined;
  }

  /**
   * Clears all registered workspace actions.
   */
  public clearActions(): void {
    if (this.actions.size > 0) {
      this.actions.clear();
      this.updateCache();
      this.notify();
    }
  }

  /**
   * Subscribes to changes in the command registry.
   */
  public subscribe(listener: WorkspaceRegistryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateCache() {
    this.cachedActionsArray =
      this.actions.size === 0
        ? EMPTY_ACTIONS
        : Array.from(this.actions.values());
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        logger.warn("WorkspaceCommandRegistry listener error:", err);
      }
    }
  }
}

export const workspaceCommandRegistry = new WorkspaceCommandRegistry();
