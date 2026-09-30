// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  getSoundEngine,
  type SoundEngine,
  type ToneOptions,
} from "@/lib/audio/sound-engine";
import {
  evaluateHand,
  scoreTimeline,
  type TimelineStep,
} from "@/lib/trial-and-error";
import {
  CUE_RECIPES,
  TE_CUES,
  TeMusicLoop,
  cueForStep,
} from "@/components/trial-and-error/teAudio";
import {
  useTeMusic,
  useTeSound,
} from "@/components/trial-and-error/useTeSound";
import {
  LoudLayer,
  MAX_SHAKE_PX,
  shakeAmplitude,
} from "@/components/trial-and-error/LoudLayer";
import { CardTable } from "@/components/trial-and-error/CardTable";

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: () => {} }),
}));
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: () => <button type="button">Manual</button>,
}));

// A minimal Web Audio stand-in that records every node it creates.
const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
});
const node = (kind: string, log: string[]) => {
  log.push(kind);
  return {
    kind,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
    frequency: param(),
    gain: param(),
    Q: param(),
    pan: param(),
    detune: param(),
    type: "",
    buffer: null,
    context: null as unknown,
  };
};
class FakeAudioContext {
  static instances = 0;
  static nodes: string[] = [];
  currentTime = 0;
  state = "running";
  sampleRate = 44100;
  destination = node("destination", []);
  constructor() {
    FakeAudioContext.instances += 1;
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
  createOscillator() {
    return node("osc", FakeAudioContext.nodes);
  }
  createGain() {
    const gain = node("gain", FakeAudioContext.nodes);
    gain.context = this;
    return gain;
  }
  createBiquadFilter() {
    return node("filter", FakeAudioContext.nodes);
  }
  createStereoPanner() {
    return node("pan", FakeAudioContext.nodes);
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    return node("noise", FakeAudioContext.nodes);
  }
}

function mockMedia({ reduced = false, compact = false } = {}) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches:
        (query.includes("reduce") && reduced) ||
        (query.includes("max-width") && compact),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

let visibility: DocumentVisibilityState = "visible";
Object.defineProperty(document, "visibilityState", {
  configurable: true,
  get: () => visibility,
});

beforeEach(() => {
  vi.stubGlobal("AudioContext", FakeAudioContext);
  visibility = "visible";
  window.localStorage.clear();
  mockMedia();
  getSoundEngine().close();
  // Unmuting eagerly resumes (and so creates) a context; start counting after.
  getSoundEngine().setMuted(false);
  getSoundEngine().close();
  FakeAudioContext.instances = 0;
  FakeAudioContext.nodes = [];
});
afterEach(() => {
  cleanup();
  getSoundEngine().close();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useTeSound", () => {
  // Runs first: the gesture flag is page-wide and sticks once set.
  it("makes no sound, and no AudioContext, before a user gesture", () => {
    const { result } = renderHook(() => useTeSound());
    result.current.play("chipTick");
    expect(FakeAudioContext.instances).toBe(0);
    fireEvent.pointerDown(window);
    result.current.play("chipTick");
    expect(FakeAudioContext.instances).toBe(1);
    expect(FakeAudioContext.nodes).toContain("osc");
  });

  it("does no AudioContext work at all while sound is muted", () => {
    getSoundEngine().setMuted(true);
    const { result } = renderHook(() => useTeSound());
    for (const cue of TE_CUES) result.current.play(cue);
    expect(FakeAudioContext.instances).toBe(0);
    expect(FakeAudioContext.nodes).toEqual([]);
  });

  it("stays silent under reduced motion, the engine's accessibility bypass", () => {
    mockMedia({ reduced: true });
    const { result } = renderHook(() => useTeSound());
    result.current.play("zeroSlam");
    expect(FakeAudioContext.instances).toBe(0);
  });

  it("makes every named cue callable and audible", () => {
    const { result } = renderHook(() => useTeSound());
    for (const cue of TE_CUES) {
      const before = FakeAudioContext.nodes.length;
      result.current.play(cue);
      expect(FakeAudioContext.nodes.length, cue).toBeGreaterThan(before);
    }
  });

  it("raises chipTick's pitch with each consecutive chip step", () => {
    const tone = vi.spyOn(getSoundEngine(), "playTone");
    const { result } = renderHook(() => useTeSound());
    [0, 1, 2, 20].forEach((step) => result.current.play("chipTick", { step }));
    // playTone is overloaded; every cue uses the options form.
    const freqs = tone.mock.calls.map(
      ([arg]) => fromAny<ToneOptions, unknown>(arg).frequency
    );
    expect(freqs[1]).toBeGreaterThan(freqs[0]);
    expect(freqs[2]).toBeGreaterThan(freqs[1]);
    // Clamped at an octave so long hands do not climb out of range.
    expect(freqs[3]).toBeCloseTo(1760);
  });

  it("persists the SFX and Music switches, and SFX off silences cues", () => {
    const { result } = renderHook(() => useTeSound());
    expect(result.current).toMatchObject({
      sfxEnabled: true,
      musicEnabled: false,
    });
    act(() => result.current.setSfxEnabled(false));
    expect(window.localStorage.getItem("te:audio")).toBe("sfx=0;music=0");
    expect(result.current.sfxEnabled).toBe(false);
    result.current.play("chipTick");
    expect(FakeAudioContext.instances).toBe(0);
    act(() => result.current.setMusicEnabled(true));
    expect(window.localStorage.getItem("te:audio")).toBe("sfx=0;music=1");
  });

  it("ignores invalid stored settings and survives unavailable storage", () => {
    window.localStorage.setItem("te:audio", "garbage");
    const { result } = renderHook(() => useTeSound());
    expect(result.current.sfxEnabled).toBe(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result: blocked } = renderHook(() => useTeSound());
    expect(blocked.current.musicEnabled).toBe(false);
    expect(() =>
      act(() => blocked.current.setMusicEnabled(true))
    ).not.toThrow();
    // The switch holds for the page (#925); a successful write hands it
    // back to storage so later tests start from the defaults.
    expect(blocked.current.musicEnabled).toBe(true);
    vi.restoreAllMocks();
    act(() => blocked.current.setMusicEnabled(false));
    expect(blocked.current.musicEnabled).toBe(false);
  });
});

describe("cueForStep", () => {
  const steps: TimelineStep[] = scoreTimeline(
    evaluateHand({
      handType: "TLF_PAIR",
      cards: [
        { id: "T", chips: 30, mult: 1 },
        { id: "L", chips: 20, mult: 0 },
      ],
      ruleResults: [
        {
          ruleId: "R-CHIP",
          passed: true,
          chipsDelta: 12,
          multDelta: 0,
          evidence: "e",
        },
        {
          ruleId: "R-PEN",
          passed: false,
          chipsDelta: 0,
          multDelta: -1,
          evidence: "e",
        },
        {
          ruleId: "R-BON",
          passed: true,
          chipsDelta: 0,
          multDelta: 2,
          evidence: "e",
        },
        {
          ruleId: "R-X",
          passed: true,
          chipsDelta: 0,
          multDelta: 0,
          multMultiplier: 2,
          evidence: "e",
        },
      ],
      modifiers: [
        { sourceId: "RELIC-X", label: "x", chips: 0, plusMult: 0, xMult: 1.5 },
        { sourceId: "RELIC-M", label: "m", chips: 0, plusMult: 3, xMult: 1 },
        { sourceId: "RELIC-C", label: "c", chips: 5, plusMult: 0, xMult: 1 },
      ],
    }),
    { roundScoreBefore: 0, target: 100 }
  );
  const cues = steps.map((_, i) => cueForStep(steps, i));

  it("maps every step kind to its cue, climbing through the chip steps", () => {
    const byKind = (kind: TimelineStep["kind"]) =>
      steps.flatMap((s, i) => (s.kind === kind ? [cues[i]] : []));
    expect(byKind("HAND_BASE")).toEqual([{ cue: "chipTick", step: 0 }]);
    expect(byKind("CARD_SCORED")).toEqual([
      { cue: "chipTick", step: 1 },
      { cue: "chipTick", step: 2 },
    ]);
    expect(byKind("RULE")).toEqual([
      { cue: "chipTick", step: 3 },
      { cue: "cardDeselect" },
      { cue: "multThunk" },
    ]);
    const relicCue = (id: string) =>
      cues[steps.findIndex((st) => st.kind === "RELIC" && st.relicId === id)];
    expect(relicCue("RELIC-X")).toEqual({ cue: "xMultFlare" });
    expect(relicCue("RELIC-M")).toEqual({ cue: "multThunk" });
    expect(relicCue("RELIC-C")).toMatchObject({ cue: "chipTick" });
    // ×2 and ×1.5 flare; the relics' ×1 factors are no step at all.
    expect(byKind("X_MULT")).toEqual([
      { cue: "xMultFlare" },
      { cue: "xMultFlare" },
    ]);
    expect(byKind("TOTAL")).toEqual([null]);
    expect(byKind("BLIND_PROGRESS")).toEqual([{ cue: "fireIgnite" }]);
    expect(cueForStep(steps, 999)).toBeNull();
  });

  it("slams on a zero rule, shows no ×1 step, and is quiet for a Blind not crossed", () => {
    const zeroed = scoreTimeline(
      evaluateHand({
        handType: "HIGH_TABLE",
        cards: [{ id: "T", chips: 30, mult: 1 }],
        ruleResults: [
          {
            ruleId: "Z",
            passed: false,
            chipsDelta: 0,
            multDelta: 0,
            multMultiplier: 0,
            evidence: "e",
          },
        ],
        modifiers: [
          { sourceId: "R1", label: "r", chips: 0, plusMult: 0, xMult: 1 },
        ],
      }),
      { roundScoreBefore: 0, target: 300 }
    );
    const mapped = zeroed.map((s, i) => [
      s.kind,
      cueForStep(zeroed, i)?.cue ?? null,
    ]);
    expect(mapped).toContainEqual(["ZERO_RULE", "zeroSlam"]);
    expect(mapped.map(([kind]) => kind)).not.toContain("X_MULT");
    expect(mapped).toContainEqual(["BLIND_PROGRESS", null]);
  });
});

describe("TeMusicLoop", () => {
  const engineWith = (allowed: () => boolean) => {
    const ctx = new FakeAudioContext();
    const engine = {
      isSoundAllowed: allowed,
      getAudioContext: () => ctx,
      getVolume: () => 1,
      trackSource: <T,>(s: T) => s,
    };
    return { ctx, engine: fromPartial<SoundEngine>(engine) };
  };

  it("schedules beats on the audio clock and stops cleanly", () => {
    vi.useFakeTimers();
    const { ctx, engine } = engineWith(() => true);
    const loop = new TeMusicLoop(engine);
    loop.start();
    expect(loop.running).toBe(true);
    act(() => vi.advanceTimersByTime(40));
    const oscillators = FakeAudioContext.nodes.filter(
      (n) => n === "osc"
    ).length;
    expect(oscillators).toBeGreaterThan(0);
    ctx.currentTime = 1;
    act(() => vi.advanceTimersByTime(40));
    expect(
      FakeAudioContext.nodes.filter((n) => n === "osc").length
    ).toBeGreaterThan(oscillators);
    loop.stop();
    expect(loop.running).toBe(false);
    const after = FakeAudioContext.nodes.length;
    ctx.currentTime = 5;
    act(() => vi.advanceTimersByTime(200));
    expect(FakeAudioContext.nodes.length).toBe(after);
  });

  it("does not start when sound is not allowed, and stops itself on mute", () => {
    vi.useFakeTimers();
    let allowed = false;
    const { engine } = engineWith(() => allowed);
    const loop = new TeMusicLoop(engine);
    loop.start();
    expect(loop.running).toBe(false);
    allowed = true;
    loop.start(true);
    expect(loop.running).toBe(true);
    allowed = false;
    act(() => vi.advanceTimersByTime(40));
    expect(loop.running).toBe(false);
  });

  it("opens the filter in boss Blinds and ducks under resolution", () => {
    const { ctx, engine } = engineWith(() => true);
    const loop = new TeMusicLoop(engine);
    const filters: { frequency: { value: number } }[] = [];
    const gains: ReturnType<typeof param>[] = [];
    const makeFilter = ctx.createBiquadFilter.bind(ctx);
    ctx.createBiquadFilter = () => {
      const f = makeFilter();
      filters.push(f);
      return f;
    };
    const makeGain = ctx.createGain.bind(ctx);
    ctx.createGain = () => {
      const g = makeGain();
      gains.push(g.gain);
      return g;
    };
    loop.start(true);
    expect(filters[0].frequency.value).toBe(1800);
    loop.duck(true);
    expect(gains[0].setTargetAtTime).toHaveBeenCalledWith(0.02, 0, 0.08);
    loop.duck(false);
    expect(gains[0].setTargetAtTime).toHaveBeenLastCalledWith(0.06, 0, 0.08);
    loop.stop();
    expect(() => loop.duck(true)).not.toThrow();
  });
});

describe("useTeMusic", () => {
  it("plays only when enabled and unmuted, pauses when hidden, stops on unmount, with no re-render per beat", () => {
    vi.useFakeTimers();
    let renders = 0;
    const { rerender, unmount } = renderHook(
      (props: { enabled: boolean; siteMuted: boolean }) => {
        renders += 1;
        useTeMusic({ ...props, boss: false, ducked: false });
      },
      { initialProps: { enabled: false, siteMuted: false } }
    );
    act(() => vi.advanceTimersByTime(200));
    expect(FakeAudioContext.instances).toBe(0);

    rerender({ enabled: true, siteMuted: true });
    act(() => vi.advanceTimersByTime(200));
    expect(FakeAudioContext.instances).toBe(0);

    rerender({ enabled: true, siteMuted: false });
    const rendersAtStart = renders;
    act(() => vi.advanceTimersByTime(300));
    expect(FakeAudioContext.nodes).toContain("osc");
    expect(renders).toBe(rendersAtStart);

    visibility = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    const hidden = FakeAudioContext.nodes.length;
    act(() => vi.advanceTimersByTime(300));
    expect(FakeAudioContext.nodes.length).toBe(hidden);

    visibility = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    unmount();
    const unmounted = FakeAudioContext.nodes.length;
    act(() => vi.advanceTimersByTime(300));
    expect(FakeAudioContext.nodes.length).toBe(unmounted);
  });
});

describe("LoudLayer", () => {
  it("renders nothing at rest, below 768px or under reduced motion", () => {
    expect(render(<LoudLayer loud={false} enabled />).container.innerHTML).toBe(
      ""
    );
    expect(render(<LoudLayer loud enabled={false} />).container.innerHTML).toBe(
      ""
    );
    const { container } = render(<LoudLayer loud enabled />);
    expect(
      Array.from(container.querySelectorAll("[data-te-loud-layer]")).map((el) =>
        el.getAttribute("data-te-loud-layer")
      )
    ).toEqual(["swirl", "crt"]);
    for (const el of container.querySelectorAll("[data-te-loud-layer]")) {
      expect(el.getAttribute("aria-hidden")).toBe("true");
      expect(el.className).toContain("pointer-events-none");
    }
  });

  it("caps the screen-shake amplitude", () => {
    expect(shakeAmplitude(3)).toBe("3px");
    expect(shakeAmplitude(99)).toBe(`${MAX_SHAKE_PX}px`);
    expect(shakeAmplitude(-2)).toBe("0px");
    expect(shakeAmplitude(Number.NaN)).toBe("0px");
  });
});

describe("the Card Table's cues and loud layer", () => {
  const card = (id: string) =>
    document.querySelector<HTMLButtonElement>(`[data-card-id="${id}"]`)!;

  it("plays card cues, scoring cues and the loud layer only during resolution", () => {
    vi.useFakeTimers();
    const spies = Object.fromEntries(
      (
        [
          "cardSelect",
          "cardDeselect",
          "discardWhoosh",
          "cardDeal",
          "chipTick",
          "zeroSlam",
        ] as const
      ).map((cue) => [cue, vi.spyOn(CUE_RECIPES, cue)])
    );
    render(<CardTable />);
    fireEvent.click(card("C-T14.1.2"));
    expect(spies.cardSelect).toHaveBeenCalledTimes(1);
    fireEvent.click(card("C-T14.1.2"));
    expect(spies.cardDeselect).toHaveBeenCalledTimes(1);
    fireEvent.click(card("C-T14.1.2"));
    fireEvent.click(screen.getByRole("button", { name: /Discard/ }));
    expect(spies.discardWhoosh).toHaveBeenCalledTimes(1);
    expect(spies.cardDeal).toHaveBeenCalledTimes(1);

    expect(document.querySelector("[data-te-loud-layer]")).toBeNull();
    fireEvent.click(card("C-T14.1.1-A"));
    fireEvent.click(card("C-L16.2.4"));
    fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
    expect(document.querySelectorAll("[data-te-loud-layer]")).toHaveLength(2);
    for (let t = 0; t < 5000; t += 10) act(() => vi.advanceTimersByTime(10));
    expect(spies.chipTick.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(spies.zeroSlam).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-te-loud-layer]")).toBeNull();
  });

  it("offers the cabinet audio switches and a site unmute", () => {
    render(<CardTable />);
    const sfx = screen.getByRole("button", { name: "SFX" });
    expect(sfx.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(sfx);
    expect(sfx.getAttribute("aria-pressed")).toBe("false");
    const music = screen.getByRole("button", { name: "Music" });
    expect(music.getAttribute("aria-pressed")).toBe("false");
    // Without an AudioProvider the site reads as muted.
    expect(screen.getByRole("button", { name: /Unmute/ })).toBeTruthy();
  });
});
