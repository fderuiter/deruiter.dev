import { describe, expect, it, vi } from "vitest";
import {
  createPauseController,
  resolveEscape,
  showsPauseOverlay,
} from "@/components/arcade/pause";

describe("pause controller (#2357)", () => {
  it("combines reasons: resuming user does not resume hidden", () => {
    const controller = createPauseController();
    controller.pause("user");
    controller.pause("hidden");
    controller.resume("user");
    expect(controller.getState().paused).toBe(true);
    expect([...controller.getState().reasons]).toEqual(["hidden"]);
    controller.resume("hidden");
    expect(controller.getState().paused).toBe(false);
  });

  it("Resume clears the player's and the automatic reasons, but not a sheet or Setup", () => {
    const controller = createPauseController();
    controller.pause("hidden");
    controller.pause("blur");
    controller.pause("view-swap");
    controller.pause("sheet");
    controller.pause("setup");
    controller.resume();
    expect(controller.getState().reasons).toEqual(new Set(["sheet", "setup"]));
  });

  it("hears every pause request, and resumes once when the last reason clears", () => {
    const controller = createPauseController();
    const onPause = vi.fn();
    const onResume = vi.fn();
    const onChange = vi.fn();
    controller.onPause(onPause);
    controller.onResume(onResume);
    controller.subscribe(onChange);

    controller.pause("blur");
    controller.pause("blur");
    controller.pause("rotate");
    expect(onPause.mock.calls).toEqual([["blur"], ["blur"], ["rotate"]]);
    // A repeated reason does not change the state.
    expect(onChange).toHaveBeenCalledTimes(2);

    controller.resume("blur");
    expect(onResume).not.toHaveBeenCalled();
    controller.resume("rotate");
    expect(onResume).toHaveBeenCalledTimes(1);
    controller.resume("rotate");
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("keeps the same state object until something changes", () => {
    const controller = createPauseController();
    const before = controller.getState();
    controller.resume("user");
    expect(controller.getState()).toBe(before);
    controller.setRunning(true);
    expect(controller.getState()).not.toBe(before);
    expect(controller.getState().running).toBe(true);
  });

  it("tells suspend listeners, and a listener can unsubscribe", () => {
    const controller = createPauseController();
    const save = vi.fn();
    const stop = controller.onSuspend(save);
    controller.suspend();
    stop();
    controller.suspend();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("tolerates a listener that resumes during a pause", () => {
    const controller = createPauseController();
    controller.onPause(() => controller.resume());
    const other = vi.fn();
    controller.onPause(other);
    controller.pause("hidden");
    expect(other).toHaveBeenCalledWith("hidden");
    expect(controller.getState().paused).toBe(false);
  });

  it("collects the game's menu items per owner", () => {
    const controller = createPauseController();
    const a = Symbol("a");
    const b = Symbol("b");
    const itemA = { id: "a", label: "Codex", onSelect: vi.fn() };
    const itemB = { id: "b", label: "Map", onSelect: vi.fn() };
    const removeA = controller.setMenuItems(a, [itemA]);
    controller.setMenuItems(b, [itemB]);
    expect(controller.getMenuItems()).toEqual([itemA, itemB]);
    removeA();
    expect(controller.getMenuItems()).toEqual([itemB]);
  });

  it("shows the overlay for the player's and automatic reasons only", () => {
    expect(showsPauseOverlay(new Set(["sheet"]))).toBe(false);
    expect(showsPauseOverlay(new Set(["setup"]))).toBe(false);
    expect(showsPauseOverlay(new Set(["sheet", "hidden"]))).toBe(true);
    expect(showsPauseOverlay(new Set(["user"]))).toBe(true);
  });

  it("Escape closes the top sheet, then pauses, then offers exit", () => {
    expect(
      resolveEscape({ sheetOpen: true, overlayOpen: false, exitOffered: false })
    ).toBe("close-sheet");
    expect(
      resolveEscape({
        sheetOpen: false,
        overlayOpen: false,
        exitOffered: false,
      })
    ).toBe("pause");
    expect(
      resolveEscape({ sheetOpen: false, overlayOpen: true, exitOffered: false })
    ).toBe("offer-exit");
    expect(
      resolveEscape({ sheetOpen: false, overlayOpen: true, exitOffered: true })
    ).toBe("none");
  });
});
