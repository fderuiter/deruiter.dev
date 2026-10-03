// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useTimelineState } from "@/hooks/useTimelineState";

function renderHookHelper<T>(useHook: () => T) {
  const result: { current: T } = { current: fromAny(null) };
  const container = document.createElement("div");

  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    result.current = useHook();
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      if (container.parentNode) {
        document.body.removeChild(container);
      }
    },
  };
}

describe("useTimelineState Hook - Complete Unit & Coverage Suite", () => {
  it("1. should initialize with default state", () => {
    const { result, unmount } = renderHookHelper(() => useTimelineState());

    expect(result.current.globalMode).toBe("behind-the-scenes");
    expect(result.current.cardOverrides).toEqual({});
    expect(result.current.getCardMode(0)).toBe("behind-the-scenes");
    expect(result.current.getCardMode(1)).toBe("behind-the-scenes");

    unmount();
  });

  it("2. should update global mode and clear all card overrides", () => {
    const { result, unmount } = renderHookHelper(() => useTimelineState());

    // Toggle card 1
    act(() => {
      result.current.handleCardToggle(1);
    });
    expect(result.current.cardOverrides).toEqual({ 1: "professional" });
    expect(result.current.getCardMode(1)).toBe("professional");

    // Toggle global mode to professional
    act(() => {
      result.current.handleGlobalToggle("professional");
    });
    expect(result.current.globalMode).toBe("professional");
    expect(result.current.cardOverrides).toEqual({});
    expect(result.current.getCardMode(1)).toBe("professional"); // Falls back to global professional because overrides are empty

    unmount();
  });

  it("3. should correctly toggle card-level override", () => {
    const { result, unmount } = renderHookHelper(() => useTimelineState());

    // Initially global mode is behind-the-scenes, card 2 is behind-the-scenes (fallback)
    expect(result.current.getCardMode(2)).toBe("behind-the-scenes");

    // Toggle card 2 -> overrides to professional
    act(() => {
      result.current.handleCardToggle(2);
    });
    expect(result.current.getCardMode(2)).toBe("professional");
    expect(result.current.cardOverrides[2]).toBe("professional");

    // Toggle card 2 again -> overrides to behind-the-scenes (opposite of previous override professional)
    act(() => {
      result.current.handleCardToggle(2);
    });
    expect(result.current.getCardMode(2)).toBe("behind-the-scenes");
    expect(result.current.cardOverrides[2]).toBe("behind-the-scenes");

    // Verify un-overridden card still falls back to global
    expect(result.current.getCardMode(5)).toBe("behind-the-scenes");

    unmount();
  });

  it("4. should fallback correctly to professional when global is professional and card toggle transitions are active", () => {
    const { result, unmount } = renderHookHelper(() => useTimelineState());

    act(() => {
      result.current.handleGlobalToggle("professional");
    });
    expect(result.current.getCardMode(3)).toBe("professional");

    // Toggle card 3 -> override to behind-the-scenes (opposite of global professional)
    act(() => {
      result.current.handleCardToggle(3);
    });
    expect(result.current.getCardMode(3)).toBe("behind-the-scenes");
    expect(result.current.cardOverrides[3]).toBe("behind-the-scenes");

    // Toggle card 3 again -> opposite of override behind-the-scenes is professional
    act(() => {
      result.current.handleCardToggle(3);
    });
    expect(result.current.getCardMode(3)).toBe("professional");
    expect(result.current.cardOverrides[3]).toBe("professional");

    unmount();
  });
});
