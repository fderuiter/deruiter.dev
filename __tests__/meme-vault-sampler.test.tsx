import { fromPartial } from "@total-typescript/shoehorn";
// @vitest-environment jsdom
//
// #1526: the Meme Vault sampler face. Pure geometry for the pads, ring and
// scope, then the rendered face: keys 1 to 8, the emerald lit state, an
// oscilloscope that reads the AnalyserNode only while a pad plays, the
// trophy shelf's silhouettes and unlock stamp, and the graphite hero ring.
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import {
  PAD_COUNT,
  findTriggerIndex,
  graticuleLines,
  padIndexForKey,
  padKeyLabel,
  ringDash,
  scopeGain,
  scopeTrace,
  MAX_SCOPE_GAIN,
} from "@/components/arcade/meme-vault/vault-geometry";

const audio = vi.hoisted(() => ({
  muted: false,
  bypassActive: false,
  setMuted: vi.fn(),
}));

const meme = vi.hoisted(() => ({
  analyser: null as AnalyserNode | null,
  playMemeSound: vi.fn(),
  releaseMemeAnalyser: vi.fn(),
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
    }),
  };
});

vi.mock("@/lib/meme-audio", () => ({
  playMemeSound: meme.playMemeSound,
  getMemeSoundDuration: () => 400,
  isSoundAllowed: () => true,
  connectMemeAnalyser: () => meme.analyser,
  releaseMemeAnalyser: meme.releaseMemeAnalyser,
}));

import { MemeVaultClient } from "@/components/arcade/MemeVaultClient";
import { A11yProvider } from "@/components/providers/A11yProvider";
import { ToastProvider } from "@/hooks/useToast";
import { SOUNDBOARD_BUTTONS, unlockAchievement } from "@/lib/meme-data";

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

describe("vault geometry", () => {
  it("maps keys 1 to 8 onto the eight pads and nothing else", () => {
    expect(PAD_COUNT).toBe(SOUNDBOARD_BUTTONS.length);
    for (let i = 0; i < PAD_COUNT; i++) {
      expect(padIndexForKey(String(i + 1))).toBe(i);
      expect(padKeyLabel(i)).toBe(String(i + 1));
    }
    for (const key of ["0", "9", "a", "Enter", "", "12", " "]) {
      expect(padIndexForKey(key)).toBeNull();
    }
  });

  it("computes the completion ring's dash and clamps bad input", () => {
    const r = 42;
    const c = 2 * Math.PI * r;
    expect(ringDash(0, 6, r)).toEqual({
      circumference: c,
      dashOffset: c,
      progress: 0,
    });
    expect(ringDash(3, 6, r).dashOffset).toBeCloseTo(c / 2);
    expect(ringDash(6, 6, r).dashOffset).toBeCloseTo(0);
    expect(ringDash(9, 6, r).progress).toBe(1);
    expect(ringDash(-1, 6, r).progress).toBe(0);
    expect(ringDash(0, 0, r).progress).toBe(0);
    expect(ringDash(1, Number.NaN, r).progress).toBe(0);
  });

  it("triggers on the first rising zero crossing in the first half", () => {
    expect(findTriggerIndex([0.5, -0.2, -0.1, 0.3, 0.6, -0.4, 0, 0])).toBe(3);
    expect(findTriggerIndex(new Float32Array(16))).toBe(0);
    // A crossing only in the second half is ignored.
    expect(findTriggerIndex([1, 1, 1, 1, -1, 1, 1, 1])).toBe(0);
  });

  it("maps samples onto the trace, decimated to the width and clipped", () => {
    const samples = new Float32Array(2048);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((i / 64) * Math.PI * 2) * 2; // clips at ±1
    }
    const points = scopeTrace(samples, 300, 100, 10);
    expect(points).toHaveLength(300);
    expect(points[0].x).toBe(0);
    expect(points[points.length - 1].x).toBeCloseTo(300);
    for (const p of points) {
      expect(p.y).toBeGreaterThanOrEqual(10);
      expect(p.y).toBeLessThanOrEqual(90);
    }
    // Silence is a flat line through the middle.
    const flat = scopeTrace(new Float32Array(64), 50, 100);
    expect(new Set(flat.map((p) => p.y))).toEqual(new Set([50]));
    expect(scopeTrace([], 100, 100)).toEqual([]);
    expect(scopeTrace([0, 1], 0, 100)).toEqual([]);
  });

  it("auto-ranges quiet signals and leaves silence flat", () => {
    expect(scopeGain(new Float32Array(32))).toBe(1);
    expect(scopeGain([0.1, -0.17, 0.05])).toBeCloseTo(5);
    expect(scopeGain([0.001, -0.002])).toBe(MAX_SCOPE_GAIN);
    expect(scopeGain([0.9, -1.2])).toBe(1);
    // The gain is applied before clipping.
    const trace = scopeTrace([0, 0.1, 0.1, 0.1], 4, 100, 0, 5);
    expect(trace[1].y).toBeCloseTo(50 - 0.5 * 50);
  });

  it("puts graticule lines on half pixels inside the frame", () => {
    const { xs, ys } = graticuleLines(200, 100, 10, 4);
    expect(xs).toHaveLength(9);
    expect(ys).toEqual([25.5, 50.5, 75.5]);
    for (const x of xs) {
      expect(x % 1).toBe(0.5);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(200);
    }
  });
});

describe("Meme Vault sampler face (#1526)", () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;

  function tick(ts: number) {
    const pending = Array.from(frames.entries());
    frames.clear();
    act(() => {
      for (const [, cb] of pending) cb(ts);
    });
  }

  function fakeAnalyser() {
    const getFloatTimeDomainData = vi.fn((buf: Float32Array) => {
      for (let i = 0; i < buf.length; i++) buf[i] = Math.sin(i / 8);
    });
    return {
      node: fromPartial<AnalyserNode>({
        fftSize: 256,
        context: { sampleRate: 48000 },
        getFloatTimeDomainData,
      }),
      getFloatTimeDomainData,
    };
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

  beforeEach(() => {
    vi.stubGlobal("localStorage", new MockStorage());
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    frames = new Map();
    nextFrame = 1;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      const id = nextFrame++;
      frames.set(id, cb);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      frames.delete(id);
    });
    audio.muted = false;
    audio.bypassActive = false;
    audio.setMuted.mockClear();
    meme.analyser = null;
    meme.playMemeSound.mockClear();
    meme.releaseMemeAnalyser.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders eight graphite pads with key caps and pictograms, no emoji", () => {
    const { container } = renderVault();
    const pads = screen.getAllByRole("button", { name: /^Play / });
    expect(pads).toHaveLength(8);
    pads.forEach((pad, i) => {
      expect(pad.getAttribute("aria-keyshortcuts")).toBe(String(i + 1));
      expect(pad.querySelector("kbd")?.textContent).toBe(String(i + 1));
      expect(pad.querySelector("svg")).not.toBeNull();
      expect(pad.className).not.toMatch(/from-|to-|purple|fuchsia|pink/);
    });
    for (const btn of SOUNDBOARD_BUTTONS) {
      expect(container.textContent).not.toContain(btn.emoji);
    }
  });

  it("plays the pad for keys 1 to 8 and lights it emerald while it plays", () => {
    renderVault();
    fireEvent.keyDown(window, { key: "3" });
    expect(meme.playMemeSound).toHaveBeenCalledWith(
      SOUNDBOARD_BUTTONS[2].synthType
    );
    const pad = screen.getByRole("button", {
      name: `Play ${SOUNDBOARD_BUTTONS[2].label}`,
    });
    expect(pad.getAttribute("data-lit")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(pad.getAttribute("data-lit")).toBe("false");
  });

  it("ignores pad keys with modifiers, repeats and while typing", () => {
    renderVault();
    fireEvent.keyDown(window, { key: "1", ctrlKey: true });
    fireEvent.keyDown(window, { key: "1", metaKey: true });
    fireEvent.keyDown(window, { key: "1", repeat: true });
    fireEvent.keyDown(window, { key: "9" });
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "1" });
    input.remove();
    expect(meme.playMemeSound).not.toHaveBeenCalled();
  });

  it("reads the analyser only while a pad plays, then stops the loop", () => {
    const { node, getFloatTimeDomainData } = fakeAnalyser();
    meme.analyser = node;
    renderVault();
    expect(frames.size).toBe(0);

    fireEvent.click(screen.getAllByRole("button", { name: /^Play / })[0]);
    const scope = screen.getByTestId("meme-oscilloscope");
    expect(scope.getAttribute("data-live")).toBe("true");
    expect(scope.textContent).toContain("48.0 kHz");
    expect(frames.size).toBe(1);
    tick(16);
    tick(32);
    expect(getFloatTimeDomainData).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(scope.getAttribute("data-live")).toBe("false");
    expect(frames.size).toBe(0);
  });

  it("says why the scope is flat when sound is off, and turns it on", () => {
    audio.muted = true;
    meme.analyser = fakeAnalyser().node;
    renderVault();
    fireEvent.click(screen.getAllByRole("button", { name: /^Play / })[0]);
    expect(
      screen.getByTestId("meme-oscilloscope").getAttribute("data-live")
    ).toBe("false");
    expect(frames.size).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Turn sound on" }));
    expect(audio.setMuted).toHaveBeenCalledWith(false);
  });

  it("releases the analyser when the vault unmounts", () => {
    const { unmount } = renderVault();
    unmount();
    expect(meme.releaseMemeAnalyser).toHaveBeenCalledTimes(1);
  });

  it("shows locked trophies as silhouettes and stamps one in on unlock", () => {
    renderVault();
    const card = screen.getByTestId("trophy-konami-hero");
    expect(card.getAttribute("data-unlocked")).toBe("false");
    expect(card.textContent).toContain("Locked");
    expect(card.querySelector(".meme-trophy-stamp")).toBeNull();

    act(() => {
      unlockAchievement("konami-hero");
    });
    expect(card.getAttribute("data-unlocked")).toBe("true");
    expect(card.textContent).toContain("Unlocked");
    expect(card.querySelector(".meme-trophy-stamp")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(card.querySelector(".meme-trophy-stamp")).toBeNull();
  });

  it("draws the hero's completion ring from the unlocked count", () => {
    renderVault();
    const ring = screen.getByTestId("meme-completion-ring");
    expect(ring.getAttribute("aria-label")).toBe(
      "Easter egg completion: 0 of 6 trophies (0%)"
    );
    act(() => {
      unlockAchievement("rfc-barista");
      unlockAchievement("duck-whisperer");
      unlockAchievement("konami-hero");
    });
    expect(ring.getAttribute("aria-label")).toBe(
      "Easter egg completion: 3 of 6 trophies (50%)"
    );
    const arc = ring.querySelectorAll("circle")[1];
    const c = Number(arc.getAttribute("stroke-dasharray"));
    expect(Number(arc.getAttribute("stroke-dashoffset"))).toBeCloseTo(c / 2);
  });
});
