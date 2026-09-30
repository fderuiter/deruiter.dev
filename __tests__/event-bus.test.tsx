import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { emitAppEvent, onAppEvent } from "@/lib/event-bus";
import { useAppEvent } from "@/hooks/useAppEvent";

afterEach(() => {
  cleanup();
});

describe("emitAppEvent", () => {
  it("dispatches a CustomEvent on window with the given name and detail", () => {
    const listener = vi.fn();
    window.addEventListener("terminal:run", listener);
    emitAppEvent("terminal:run", { command: "help" });
    window.removeEventListener("terminal:run", listener);

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event.type).toBe("terminal:run");
    expect(event.detail).toEqual({ command: "help" });
  });

  it("allows detail-less events to be emitted without a payload", () => {
    const listener = vi.fn();
    window.addEventListener("trigger_retro_chaos", listener);
    emitAppEvent("trigger_retro_chaos");
    window.removeEventListener("trigger_retro_chaos", listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBeNull();
  });

  it("rejects unknown event names and mismatched payloads at compile time", () => {
    // @ts-expect-error -- unregistered event name
    emitAppEvent("not-a-real-event");
    // @ts-expect-error -- terminal:run requires a { command } detail
    emitAppEvent("terminal:run");
    // @ts-expect-error -- wrong payload shape
    emitAppEvent("meme_vault_unlocked_change", { unlocked: "yes" });
    expect(true).toBe(true);
  });
});

describe("onAppEvent", () => {
  it("delivers the detail payload and stops after unsubscribe", () => {
    const handler = vi.fn();
    const off = onAppEvent("meme_vault_unlocked_change", handler);

    emitAppEvent("meme_vault_unlocked_change", { unlocked: true });
    expect(handler).toHaveBeenCalledWith({ unlocked: true });

    off();
    emitAppEvent("meme_vault_unlocked_change", { unlocked: false });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("delivers undefined for a detail-less dispatch", () => {
    const handler = vi.fn();
    const off = onAppEvent("open-photo-gallery", handler);
    window.dispatchEvent(new Event("open-photo-gallery"));
    emitAppEvent("open-photo-gallery");
    off();

    expect(handler).toHaveBeenNthCalledWith(1, undefined);
    expect(handler).toHaveBeenNthCalledWith(2, undefined);
  });

  it("receives raw CustomEvents dispatched with the same name", () => {
    const handler = vi.fn();
    const off = onAppEvent("open-photo-gallery", handler);
    window.dispatchEvent(
      new CustomEvent("open-photo-gallery", { detail: { photoId: "p1" } })
    );
    off();
    expect(handler).toHaveBeenCalledWith({ photoId: "p1" });
  });
});

describe("useAppEvent", () => {
  it("subscribes while mounted and removes the listener on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useAppEvent("terminal:run", handler));

    act(() => emitAppEvent("terminal:run", { command: "clear" }));
    expect(handler).toHaveBeenCalledWith({ command: "clear" });

    unmount();
    act(() => emitAppEvent("terminal:run", { command: "help" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls the latest handler without re-subscribing", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ handler }) => useAppEvent("trigger_retro_chaos", handler),
      { initialProps: { handler: first } }
    );
    const subscriptions = () =>
      addSpy.mock.calls.filter(([name]) => name === "trigger_retro_chaos")
        .length;
    expect(subscriptions()).toBe(1);

    rerender({ handler: second });
    expect(subscriptions()).toBe(1);

    act(() => emitAppEvent("trigger_retro_chaos"));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    addSpy.mockRestore();
  });
});
