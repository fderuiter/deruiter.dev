// @vitest-environment jsdom
//
// #2049: Echo in the Meme Vault room. The vault plays a sequence on the
// pads, the player repeats it with keys 1 to 8 or clicks, one mistake ends
// the round, and the best streak is stored and celebrated.
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
  getMemeSoundDuration: () => 400,
  isSoundAllowed: () => true,
  connectMemeAnalyser: () => null,
  releaseMemeAnalyser: vi.fn(),
  unlockMemeAudio: vi.fn(),
}));

import { MemeVaultClient } from "@/components/arcade/MemeVaultClient";
import { A11yProvider } from "@/components/providers/A11yProvider";
import { ToastProvider } from "@/hooks/useToast";
import { MEME_STORAGE_KEYS, SOUNDBOARD_BUTTONS } from "@/lib/meme-data";
import { safeRemoveItem, safeSetRawItem } from "@/lib/safe-storage";

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

/** Runs timers until the player's turn, returning the pads the vault played. */
function watchPlayback(): number[] {
  meme.playMemeSound.mockClear();
  for (let i = 0; i < 200 && !status().startsWith("Your turn"); i++) {
    act(() => {
      vi.advanceTimersByTime(50);
    });
  }
  expect(status()).toMatch(/^Your turn/);
  return meme.playMemeSound.mock.calls.map(([type]) =>
    SOUNDBOARD_BUTTONS.findIndex((b) => b.synthType === type)
  );
}

function pressKey(index: number, target: Window | HTMLElement = window) {
  act(() => {
    fireEvent.keyDown(target, { key: String(index + 1) });
  });
}

describe("Meme Vault Echo (#2049)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MockStorage());
    safeRemoveItem(MEME_STORAGE_KEYS.ECHO_BEST);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    audio.muted = false;
    audio.bypassActive = false;
    meme.playMemeSound.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    safeRemoveItem(MEME_STORAGE_KEYS.ECHO_BEST);
    vi.unstubAllGlobals();
  });

  it("starts from a plain focusable button, no canvas involved", () => {
    renderVault();
    const start = screen.getByRole("button", { name: "Start Echo" });
    expect(start.getAttribute("type")).toBe("button");
    expect(start.tabIndex).not.toBe(-1);
    // The only canvas is the oscilloscope readout, which takes no input.
    expect(start.closest("canvas")).toBeNull();
    act(() => {
      start.focus();
      fireEvent.click(start);
    });
    expect(status()).toMatch(/^Watch: 1 pad/);
    expect(screen.getByRole("button", { name: "Stop Echo" })).toBeTruthy();
  });

  it("lights each pad as it plays and then hands over to the player", () => {
    renderVault();
    fireEvent.click(screen.getByRole("button", { name: "Start Echo" }));
    let sawLit = false;
    for (let i = 0; i < 120 && !status().startsWith("Your turn"); i++) {
      act(() => {
        vi.advanceTimersByTime(25);
      });
      const lit = document.querySelectorAll('.meme-pad[data-lit="true"]');
      expect(lit.length).toBeLessThanOrEqual(1);
      if (lit.length === 1) sawLit = true;
    }
    expect(sawLit).toBe(true);
    expect(status()).toBe("Your turn: pad 1 of 1.");
    expect(
      document.querySelectorAll('.meme-pad[data-lit="true"]')
    ).toHaveLength(0);
  });

  it("grows the sequence as the player repeats it with keys and clicks", () => {
    renderVault();
    fireEvent.click(screen.getByRole("button", { name: "Start Echo" }));
    const first = watchPlayback();
    expect(first).toHaveLength(1);
    pressKey(first[0]);
    expect(screen.getByTestId("meme-echo-streak").textContent).toBe("1");

    const second = watchPlayback();
    expect(second).toHaveLength(2);
    expect(second[0]).toBe(first[0]);
    // A click answers as well as a key.
    const pads = screen.getAllByRole("button", { name: /^Play / });
    act(() => {
      fireEvent.click(pads[second[0]]);
    });
    expect(status()).toBe("Your turn: pad 2 of 2.");
    pressKey(second[1]);
    expect(screen.getByTestId("meme-echo-streak").textContent).toBe("2");
    expect(watchPlayback()).toHaveLength(3);
  });

  it("ignores pad keys while the vault is still playing", () => {
    renderVault();
    fireEvent.click(screen.getByRole("button", { name: "Start Echo" }));
    meme.playMemeSound.mockClear();
    pressKey(0);
    pressKey(5);
    expect(meme.playMemeSound).not.toHaveBeenCalled();
    expect(status()).toMatch(/^Watch/);
  });

  it("ends the round on one mistake with a fail sting, then stores and toasts a new best", () => {
    renderVault();
    fireEvent.click(screen.getByRole("button", { name: "Start Echo" }));
    const first = watchPlayback();
    pressKey(first[0]);
    const second = watchPlayback();
    meme.playMemeSound.mockClear();
    pressKey((second[0] + 1) % 8);

    expect(meme.playMemeSound).toHaveBeenCalledWith("echo-fail");
    expect(status()).toMatch(/^Wrong pad\. Streak 1\./);
    expect(screen.getByTestId("meme-echo").dataset.echoPhase).toBe("over");
    expect(screen.getByTestId("meme-echo-best").textContent).toBe("1");
    expect(localStorage.getItem(MEME_STORAGE_KEYS.ECHO_BEST)).toBe("1");
    expect(screen.getByText("New Echo best: 1")).toBeTruthy();
    // Echo never touches the trophy list that scores the vault.
    expect(localStorage.getItem(MEME_STORAGE_KEYS.ACHIEVEMENTS)).toBeNull();

    // After the round, keys play samples again.
    meme.playMemeSound.mockClear();
    pressKey(2);
    expect(meme.playMemeSound).toHaveBeenCalledWith(
      SOUNDBOARD_BUTTONS[2].synthType
    );
    expect(
      screen.getByRole("button", { name: "Play Echo again" })
    ).toBeTruthy();
  });

  it("does not toast when a round falls short of the stored best", () => {
    safeSetRawItem(MEME_STORAGE_KEYS.ECHO_BEST, "5");
    renderVault();
    expect(screen.getByTestId("meme-echo-best").textContent).toBe("5");
    fireEvent.click(screen.getByRole("button", { name: "Start Echo" }));
    const first = watchPlayback();
    pressKey((first[0] + 1) % 8);
    expect(status()).toMatch(/^Wrong pad\. Streak 0\./);
    expect(screen.queryByText(/New Echo best/)).toBeNull();
    expect(localStorage.getItem(MEME_STORAGE_KEYS.ECHO_BEST)).toBe("5");
  });

  it("does not take pad keys typed into an input", () => {
    renderVault();
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.click(screen.getByRole("button", { name: "Start Echo" }));
    const first = watchPlayback();
    pressKey((first[0] + 1) % 8, input);
    expect(status()).toBe("Your turn: pad 1 of 1.");
    input.remove();
  });

  it("stops cleanly and leaves no timers lighting pads", () => {
    renderVault();
    fireEvent.click(screen.getByRole("button", { name: "Start Echo" }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.click(screen.getByRole("button", { name: "Stop Echo" }));
    meme.playMemeSound.mockClear();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(meme.playMemeSound).not.toHaveBeenCalled();
    expect(
      document.querySelectorAll('.meme-pad[data-lit="true"]')
    ).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Start Echo" })).toBeTruthy();
  });

  it("plays with lights alone when sound is off and says so", () => {
    audio.muted = true;
    renderVault();
    fireEvent.click(screen.getByRole("button", { name: "Start Echo" }));
    expect(screen.getByTestId("meme-echo").textContent).toContain(
      "Echo is playing with lights only."
    );
  });
});
