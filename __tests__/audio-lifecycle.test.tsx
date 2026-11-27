/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AudioProvider, useAudio } from "@/components/providers/AudioProvider";

class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(index: number) {
    return Object.keys(this.store)[index] ?? null;
  }
}

describe("Audio Provider Lifecycle and Guardrails Suite", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mockAudioContextInstance: any;
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    // Mock AudioContext
    mockAudioContextInstance = {
      state: "suspended",
      currentTime: 0,
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createOscillator: vi.fn().mockReturnValue({
        type: "sine",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      }),
      createGain: vi.fn().mockReturnValue({
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
      createStereoPanner: vi.fn().mockReturnValue({
        pan: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      }),
      destination: {},
    };

    const mockAudioContextClass = vi.fn().mockImplementation(function (
      this: any
    ) {
      return mockAudioContextInstance;
    });
    vi.stubGlobal("AudioContext", mockAudioContextClass);
    Object.defineProperty(window, "AudioContext", {
      writable: true,
      configurable: true,
      value: mockAudioContextClass,
    });

    // Mock matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mockStorage.clear();
  });

  it("should lazily initialize and then close the AudioContext on unmount", async () => {
    let playNoteFn: any;
    let setMutedFn: any;

    const TestComponent = () => {
      const { playNote, setMuted } = useAudio();
      playNoteFn = playNote;
      setMutedFn = setMuted;
      return <div>Test</div>;
    };

    await act(async () => {
      root.render(
        <AudioProvider>
          <TestComponent />
        </AudioProvider>
      );
    });

    // Initially AudioContext is NOT created because it is lazy
    expect(window.AudioContext).not.toHaveBeenCalled();

    // Directly unmute using the context setter under act
    await act(async () => {
      setMutedFn(false);
    });

    // Now trigger playNote
    await act(async () => {
      playNoteFn(440, 0.1);
    });

    // AudioContext should be created now
    expect(window.AudioContext).toHaveBeenCalled();
    expect(mockAudioContextInstance.createOscillator).toHaveBeenCalled();

    // Now unmount the provider and check if close was called
    act(() => {
      root.unmount();
    });

    expect(mockAudioContextInstance.close).toHaveBeenCalled();
  });

  it("should respect user mute option and play no sound", async () => {
    let playNoteFn: any;
    let setMutedFn: any;

    const TestComponent = () => {
      const { playNote, setMuted } = useAudio();
      playNoteFn = playNote;
      setMutedFn = setMuted;
      return <div>Test</div>;
    };

    await act(async () => {
      root.render(
        <AudioProvider>
          <TestComponent />
        </AudioProvider>
      );
    });

    // Explicitly mute
    await act(async () => {
      setMutedFn(true);
    });

    act(() => {
      playNoteFn(440, 0.1);
    });

    expect(window.AudioContext).not.toHaveBeenCalled();
  });

  it("should respect system reduced motion bypass setting and play no sound", async () => {
    // Mock reduced-motion to match
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    let playNoteFn: any;
    let setMutedFn: any;
    const TestComponent = () => {
      const { playNote, setMuted } = useAudio();
      playNoteFn = playNote;
      setMutedFn = setMuted;
      return <div>Test</div>;
    };

    await act(async () => {
      root.render(
        <AudioProvider>
          <TestComponent />
        </AudioProvider>
      );
    });

    // Try to unmute
    await act(async () => {
      setMutedFn(false);
    });

    act(() => {
      playNoteFn(440, 0.1);
    });

    // Should NOT have played the sound (createOscillator should not be called) because reduced-motion is bypassed
    expect(mockAudioContextInstance.createOscillator).not.toHaveBeenCalled();
  });
});
