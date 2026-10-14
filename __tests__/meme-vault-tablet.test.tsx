// @vitest-environment jsdom
//
// #2071: Meme Vault on an iPad. A finger or Pencil presses a pad on
// pointerdown and its trailing click is dropped; a mouse and the keyboard
// press on click. Echo stops its playback timers while the page is hidden and
// replays the sequence when it comes back.
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
} from "@testing-library/react";

const audio = vi.hoisted(() => ({
  muted: false,
  bypassActive: false,
  setMuted: vi.fn(),
}));

const meme = vi.hoisted(() => ({
  playMemeSound: vi.fn(),
  unlockMemeAudio: vi.fn(),
}));

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      muted: audio.muted,
      bypassActive: audio.bypassActive,
      setMuted: audio.setMuted,
      playHover: vi.fn(),
    }),
  };
});

vi.mock("@/lib/meme-audio", () => ({
  playMemeSound: meme.playMemeSound,
  unlockMemeAudio: meme.unlockMemeAudio,
  getMemeSoundDuration: () => 400,
  isSoundAllowed: () => true,
  connectMemeAnalyser: () => null,
  releaseMemeAnalyser: vi.fn(),
}));

import { MemeVaultClient } from "@/components/arcade/MemeVaultClient";
import { A11yProvider } from "@/components/providers/A11yProvider";
import { ToastProvider } from "@/hooks/useToast";
import { MEME_STORAGE_KEYS, SOUNDBOARD_BUTTONS } from "@/lib/meme-data";
import { safeRemoveItem } from "@/lib/safe-storage";

class MockStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length() {
    return this.store.size;
  }
}

function renderVault() {
  return render(
    <A11yProvider>
      <ToastProvider>
        <MemeVaultClient />
      </ToastProvider>
    </A11yProvider>
  );
}

const status = () => screen.getByTestId("meme-echo-status").textContent ?? "";
const pad = (index: number) =>
  screen.getByRole("button", {
    name: `Play ${SOUNDBOARD_BUTTONS[index].label}`,
  });

/** One tap: pointerdown, pointerup, then the click a browser sends. */
function tap(el: HTMLElement, pointerType: "touch" | "pen" = "touch") {
  act(() => {
    fireEvent.pointerDown(el, { pointerType, button: 0 });
    fireEvent.pointerUp(el, { pointerType, button: 0 });
    fireEvent.click(el, { detail: 1 });
  });
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("Meme Vault pads by touch (#2071)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MockStorage());
    safeRemoveItem(MEME_STORAGE_KEYS.ECHO_BEST);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    audio.muted = false;
    audio.bypassActive = false;
    meme.playMemeSound.mockClear();
    meme.unlockMemeAudio.mockClear();
  });

  afterEach(() => {
    setHidden(false);
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    safeRemoveItem(MEME_STORAGE_KEYS.ECHO_BEST);
    vi.unstubAllGlobals();
  });

  it("plays a touch tap once, on pointerdown, and resumes audio on its click", () => {
    renderVault();
    act(() => {
      fireEvent.pointerDown(pad(0), { pointerType: "touch", button: 0 });
    });
    expect(meme.playMemeSound).toHaveBeenCalledTimes(1);
    expect(meme.playMemeSound).toHaveBeenCalledWith(
      SOUNDBOARD_BUTTONS[0].synthType
    );
    act(() => {
      fireEvent.pointerUp(pad(0), { pointerType: "touch", button: 0 });
      fireEvent.click(pad(0), { detail: 1 });
    });
    expect(meme.playMemeSound).toHaveBeenCalledTimes(1);
    expect(meme.unlockMemeAudio).toHaveBeenCalledTimes(1);
  });

  it("treats the Pencil like a finger", () => {
    renderVault();
    tap(pad(1), "pen");
    expect(meme.playMemeSound).toHaveBeenCalledTimes(1);
  });

  it("plays each of two fast taps and two simultaneous touches once", () => {
    renderVault();
    tap(pad(2));
    tap(pad(2));
    expect(meme.playMemeSound).toHaveBeenCalledTimes(2);
    meme.playMemeSound.mockClear();
    act(() => {
      fireEvent.pointerDown(pad(3), { pointerType: "touch", pointerId: 1 });
      fireEvent.pointerDown(pad(4), { pointerType: "touch", pointerId: 2 });
      fireEvent.pointerUp(pad(3), { pointerType: "touch", pointerId: 1 });
      fireEvent.pointerUp(pad(4), { pointerType: "touch", pointerId: 2 });
      fireEvent.click(pad(3), { detail: 1 });
      fireEvent.click(pad(4), { detail: 1 });
    });
    expect(meme.playMemeSound.mock.calls.map(([type]) => type)).toEqual([
      SOUNDBOARD_BUTTONS[3].synthType,
      SOUNDBOARD_BUTTONS[4].synthType,
    ]);
  });

  it("presses a mouse click on click, and a keyboard click, and a cancelled touch plays nothing more", () => {
    renderVault();
    act(() => {
      fireEvent.pointerDown(pad(0), { pointerType: "mouse", button: 0 });
    });
    expect(meme.playMemeSound).not.toHaveBeenCalled();
    act(() => {
      fireEvent.click(pad(0), { detail: 1 });
    });
    expect(meme.playMemeSound).toHaveBeenCalledTimes(1);
    // Space or Enter on a focused pad is a click with no detail.
    act(() => {
      fireEvent.click(pad(1), { detail: 0 });
    });
    expect(meme.playMemeSound).toHaveBeenCalledTimes(2);
    // A touch that becomes a scroll presses on pointerdown only.
    act(() => {
      fireEvent.pointerDown(pad(2), { pointerType: "touch", button: 0 });
      fireEvent.pointerCancel(pad(2), { pointerType: "touch" });
    });
    expect(meme.playMemeSound).toHaveBeenCalledTimes(3);
    expect(meme.unlockMemeAudio).not.toHaveBeenCalled();
  });

  it("answers an Echo round by touch", () => {
    renderVault();
    fireEvent.click(screen.getByRole("button", { name: "Start Echo" }));
    meme.playMemeSound.mockClear();
    for (let i = 0; i < 200 && !status().startsWith("Your turn"); i++) {
      act(() => {
        vi.advanceTimersByTime(50);
      });
    }
    const shown = SOUNDBOARD_BUTTONS.findIndex(
      (b) => b.synthType === meme.playMemeSound.mock.calls[0][0]
    );
    tap(pad(shown));
    expect(screen.getByTestId("meme-echo-streak").textContent).toBe("1");
  });
});

describe("Echo while the page is hidden (#2071)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MockStorage());
    safeRemoveItem(MEME_STORAGE_KEYS.ECHO_BEST);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    meme.playMemeSound.mockClear();
    meme.unlockMemeAudio.mockClear();
  });

  afterEach(() => {
    setHidden(false);
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    safeRemoveItem(MEME_STORAGE_KEYS.ECHO_BEST);
    vi.unstubAllGlobals();
  });

  it("stops the playback while hidden and replays it when visible", () => {
    renderVault();
    fireEvent.click(screen.getByRole("button", { name: "Start Echo" }));
    setHidden(true);
    meme.playMemeSound.mockClear();
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(meme.playMemeSound).not.toHaveBeenCalled();
    expect(status()).toMatch(/^Watch/);

    setHidden(false);
    expect(meme.unlockMemeAudio).toHaveBeenCalled();
    for (let i = 0; i < 200 && !status().startsWith("Your turn"); i++) {
      act(() => {
        vi.advanceTimersByTime(50);
      });
    }
    expect(status()).toMatch(/^Your turn/);
    expect(meme.playMemeSound).toHaveBeenCalledTimes(1);
  });

  it("leaves the player's turn alone", () => {
    renderVault();
    fireEvent.click(screen.getByRole("button", { name: "Start Echo" }));
    for (let i = 0; i < 200 && !status().startsWith("Your turn"); i++) {
      act(() => {
        vi.advanceTimersByTime(50);
      });
    }
    setHidden(true);
    setHidden(false);
    expect(status()).toBe("Your turn: pad 1 of 1.");
  });
});
