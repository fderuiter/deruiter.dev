import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getSoundEngine } from "@/lib/audio";
import {
  adjustTrust,
  drinkCoffee,
  newWorld,
  startDay,
  type WorldState,
} from "@/lib/study-director-world";
import {
  TOAST_THRESHOLD,
  cuesBetween,
  feedbackBetween,
} from "@/components/study-director-world/feedback-model";
import { FeedbackToasts } from "@/components/study-director-world/FeedbackToasts";
import {
  WORLD_SOUND_CUES,
  playWorldCue,
} from "@/components/study-director-world/world-sound";

const fresh = (): WorldState => startDay(newWorld("fb-1", "standard")).world;

afterEach(() => vi.restoreAllMocks());

describe("world sound cues", () => {
  it("plays every cue when sound is allowed", () => {
    const engine = getSoundEngine();
    vi.spyOn(engine, "isSoundAllowed").mockReturnValue(true);
    const tone = vi.spyOn(engine, "playTone").mockImplementation(() => {});
    for (const cue of WORLD_SOUND_CUES) {
      tone.mockClear();
      playWorldCue(cue);
      expect(tone, cue).toHaveBeenCalled();
    }
  });

  it("is silent for every cue while muted or bypassed", () => {
    const engine = getSoundEngine();
    vi.spyOn(engine, "isSoundAllowed").mockReturnValue(false);
    const tone = vi.spyOn(engine, "playTone").mockImplementation(() => {});
    for (const cue of WORLD_SOUND_CUES) playWorldCue(cue);
    expect(tone).not.toHaveBeenCalled();
  });

  it("drops the footstep, and only the footstep, on touch devices", () => {
    const engine = getSoundEngine();
    vi.spyOn(engine, "isSoundAllowed").mockReturnValue(true);
    const tone = vi.spyOn(engine, "playTone").mockImplementation(() => {});
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(hover: none)",
      media: query,
    }));
    playWorldCue("footstep");
    expect(tone).not.toHaveBeenCalled();
    playWorldCue("door");
    expect(tone).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("never throws when the engine does", () => {
    const engine = getSoundEngine();
    vi.spyOn(engine, "isSoundAllowed").mockReturnValue(true);
    vi.spyOn(engine, "playTone").mockImplementation(() => {
      throw new Error("no audio");
    });
    for (const cue of WORLD_SOUND_CUES)
      expect(() => playWorldCue(cue)).not.toThrow();
  });
});

describe("feedbackBetween", () => {
  it("toasts an energy or focus change of a few points, not a tick", () => {
    const w = fresh();
    expect(feedbackBetween(w, { ...w, energy: w.energy - 1 })).toEqual([]);
    const dropped = feedbackBetween(w, {
      ...w,
      energy: w.energy - TOAST_THRESHOLD,
      focus: w.focus - 10,
    });
    expect(dropped.map((f) => f.text)).toEqual([
      `Energy −${TOAST_THRESHOLD}`,
      "Focus −10",
    ]);
    expect(dropped.every((f) => f.tone === "bad")).toBe(true);
    const gained = feedbackBetween({ ...w, energy: 40 }, { ...w, energy: 70 });
    expect(gained[0]).toMatchObject({ text: "Energy +30", tone: "good" });
  });

  it("toasts a heart gained or lost", () => {
    const w = fresh();
    const member = w.study.team[0];
    let better = w;
    for (let i = 0; i < 12; i += 1)
      better = adjustTrust(better, member.id, "heard").world;
    const up = feedbackBetween(w, better).find((f) => f.kind === "heart");
    expect(up?.tone).toBe("good");
    expect(up?.text).toContain(member.name);
    const down = feedbackBetween(better, w).find((f) => f.kind === "heart");
    expect(down?.tone).toBe("bad");
  });

  it("says nothing across a new day or once the player is home", () => {
    const w = fresh();
    expect(
      feedbackBetween(w, {
        ...w,
        energy: 10,
        study: { ...w.study, day: w.study.day + 1 },
      })
    ).toEqual([]);
    expect(feedbackBetween(w, { ...w, energy: 10, location: "home" })).toEqual(
      []
    );
  });
});

describe("cuesBetween", () => {
  it("plays a footstep every second tile", () => {
    const w = { ...fresh(), walked: 3 };
    expect(cuesBetween(w, { ...w, walked: 4 })).toEqual(["footstep"]);
    expect(cuesBetween({ ...w, walked: 4 }, { ...w, walked: 5 })).toEqual([]);
  });

  it("plays a door sound when the room changes, but not going home", () => {
    const w = fresh();
    expect(cuesBetween(w, { ...w, location: "kitchen" })).toContain("door");
    expect(cuesBetween(w, { ...w, location: "home" })).not.toContain("door");
  });

  it("plays the coffee cue when a coffee is drunk", () => {
    const w = fresh();
    const drunk = drinkCoffee(w);
    if (!drunk.ok) throw new Error("coffee refused");
    expect(cuesBetween(w, drunk.world)).toContain("coffee");
  });

  it("is silent across a new day", () => {
    const w = fresh();
    expect(
      cuesBetween(w, {
        ...w,
        location: "kitchen",
        study: { ...w.study, day: w.study.day + 1 },
      })
    ).toEqual([]);
  });
});

describe("FeedbackToasts", () => {
  it("renders nothing without feedback and is hidden from assistive tech", () => {
    const { container, rerender } = render(<FeedbackToasts items={[]} />);
    expect(container.innerHTML).toBe("");
    rerender(
      <FeedbackToasts
        items={[
          {
            id: "a",
            kind: "stamp",
            text: "Done: 1 voicemail",
            tone: "neutral",
          },
        ]}
      />
    );
    const list = screen.getByTestId("world-feedback");
    expect(list.getAttribute("aria-hidden")).toBe("true");
    expect(list.textContent).toContain("Done: 1 voicemail");
  });
});
