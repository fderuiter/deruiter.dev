import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { workspaceCommandRegistry } from "@/lib/workspace-command-registry";
import { useWorkspaceAction } from "@/hooks/useWorkspaceAction";
import { emitAppEvent } from "@/lib/event-bus";
import { logger } from "@/lib/logger";

describe("WorkspaceCommandRegistry", () => {
  beforeEach(() => {
    workspaceCommandRegistry.clearActions();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("registers actions via method or event bus", () => {
    const handler = vi.fn();
    workspaceCommandRegistry.registerAction({
      id: "action-1",
      title: "Action 1",
      subToolId: "tool-1",
      subToolName: "Tool 1",
      handler,
    });

    expect(workspaceCommandRegistry.getActions()).toHaveLength(1);
    expect(workspaceCommandRegistry.getAction("action-1")?.title).toBe(
      "Action 1"
    );

    emitAppEvent("workspace:register_action", {
      id: "action-2",
      title: "Action 2",
      subToolId: "tool-1",
      subToolName: "Tool 1",
    });

    expect(workspaceCommandRegistry.getActions()).toHaveLength(2);
  });

  it("unregisters actions via method or event bus", () => {
    workspaceCommandRegistry.registerAction({
      id: "action-1",
      title: "Action 1",
      subToolId: "tool-1",
      subToolName: "Tool 1",
    });

    expect(workspaceCommandRegistry.getActions()).toHaveLength(1);

    emitAppEvent("workspace:unregister_action", { id: "action-1" });
    expect(workspaceCommandRegistry.getActions()).toHaveLength(0);
  });

  it("executes registered action handler asynchronously", async () => {
    const handler = vi.fn().mockResolvedValue(true);
    workspaceCommandRegistry.registerAction({
      id: "action-1",
      title: "Action 1",
      subToolId: "tool-1",
      subToolName: "Tool 1",
      handler,
    });

    const success = await workspaceCommandRegistry.executeAction("action-1");
    expect(success).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("logs warning diagnostics for unregistered actions without throwing", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => ({
      level: "warn",
      message: "",
      timestamp: "",
    }));

    const success =
      await workspaceCommandRegistry.executeAction("unknown-action");
    expect(success).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("logs warning diagnostics for dead or missing handlers without throwing", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => ({
      level: "warn",
      message: "",
      timestamp: "",
    }));

    workspaceCommandRegistry.registerAction({
      id: "action-no-handler",
      title: "Action No Handler",
      subToolId: "tool-1",
      subToolName: "Tool 1",
    });

    const success =
      await workspaceCommandRegistry.executeAction("action-no-handler");
    expect(success).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("automatically unregisters actions on component unmount via useWorkspaceAction", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useWorkspaceAction({
        id: "hook-action",
        title: "Hook Action",
        subToolId: "tool-1",
        subToolName: "Tool 1",
        handler,
      })
    );

    expect(workspaceCommandRegistry.getAction("hook-action")).toBeDefined();

    unmount();

    expect(workspaceCommandRegistry.getAction("hook-action")).toBeUndefined();
  });
});
