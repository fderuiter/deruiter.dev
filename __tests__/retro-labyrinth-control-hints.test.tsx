// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { resolveControlHint, useControlHint } from "@/components/arcade/mobile";
import {
  FINAL_ROOM_HINT,
  RETRY_HINT,
  ROOM_CLEAR_HINT,
} from "@/components/retro-labyrinth/control-hints";

const COARSE = "(pointer: coarse)";

function installMatchMedia(matching: string[]) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matching.includes(query),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const KEY_WORDS = /\b(Enter|Esc|Space|R|P)\b/;

describe("Retro Labyrinth control hints", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([
    ["the trace card", RETRY_HINT, "Tap Retry Breach", "Enter or R to retry"],
    [
      "the room-cleared card",
      ROOM_CLEAR_HINT,
      "Tap Next Room to continue",
      "Enter to continue · R to retry this room",
    ],
    [
      "the run-finished card",
      FINAL_ROOM_HINT,
      "Tap New Run to start over from Room 01",
      "Enter for a new run from Room 01 · R to retry this room",
    ],
  ])(
    "%s says the gesture on touch and the keys elsewhere",
    (_name, hint, touch, desktop) => {
      expect(resolveControlHint(hint, true)).toBe(touch);
      expect(resolveControlHint(hint, false)).toBe(desktop);
    }
  );

  it("never names a keyboard key in the touch copy", () => {
    for (const hint of [RETRY_HINT, ROOM_CLEAR_HINT, FINAL_ROOM_HINT]) {
      expect(hint.touch).toMatch(/^Tap /);
      expect(hint.touch).not.toMatch(KEY_WORDS);
    }
  });

  it("switches the phrase on a coarse pointer in the hook", () => {
    installMatchMedia([COARSE]);
    const { result } = renderHook(() => useControlHint(RETRY_HINT));
    expect(result.current).toBe("Tap Retry Breach");
  });

  it("keeps the keyboard phrase on a fine pointer in the hook", () => {
    installMatchMedia([]);
    const { result } = renderHook(() => useControlHint(RETRY_HINT));
    expect(result.current).toBe("Enter or R to retry");
  });
});
