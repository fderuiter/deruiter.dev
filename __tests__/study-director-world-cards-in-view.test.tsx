import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { StudyDirectorWorld } from "@/components/study-director-world/StudyDirectorWorld";
import {
  PriorityCard,
  revealInView,
} from "@/components/study-director-world/DayCards";
import { feedbackBetween } from "@/components/study-director-world/feedback-model";
import {
  HARD_STOP,
  WORLD_SAVE_KEY,
  answerInterruption,
  ignoreCall,
  newWorld,
  pendingInterruption,
  phoneCalls,
  ringingCall,
  sendToVoicemail,
  serializeWorld,
  startDay,
  type PlayerState,
  type WorldState,
} from "@/lib/study-director-world";

// probe-2 has an interruption waiting at 10:02 on day 1.
const day1 = (seed = "probe-2"): WorldState =>
  startDay(newWorld(seed, "standard")).world;

const texts = (prev: WorldState, next: WorldState) =>
  feedbackBetween(prev, next)
    .filter((f) => f.kind === "stamp")
    .map((f) => f.text);

function at(minute: number): { world: WorldState; asked: string } {
  const world = { ...day1(), minute };
  const pending = pendingInterruption(world);
  if (!pending) throw new Error("nothing pending");
  return { world, asked: pending.title };
}

describe("toasts say Done only for what was done (#2252)", () => {
  it("says Let it ring, not Done, when the phone is left to ring", () => {
    const base = day1("ui-team");
    const [call] = phoneCalls(base);
    const ringing = { ...base, minute: call.ringAt };
    const live = ringingCall(ringing);
    if (!live) throw new Error("not ringing");
    const after = texts(ringing, ignoreCall(ringing, live.eventId));
    expect(after).toEqual([`Let it ring: ${live.from}`]);
    expect(after.join()).not.toMatch(/Done/);
  });

  it("says Voicemail when the call is sent there", () => {
    const base = day1("ui-team");
    const [call] = phoneCalls(base);
    const ringing = { ...base, minute: call.ringAt };
    const live = ringingCall(ringing);
    if (!live) throw new Error("not ringing");
    expect(texts(ringing, sendToVoicemail(ringing, live.eventId))).toEqual([
      `Voicemail: ${live.from}`,
    ]);
  });

  it("says Done for an interruption answered", () => {
    const { world, asked } = at(10 * 60 + 2);
    const pending = pendingInterruption(world);
    const answered = answerInterruption(world, pending!.options[0].id);
    if (!answered.ok) throw new Error("refused");
    expect(texts(world, answered.world)).toContain(`Done: ${asked}`);
  });

  it("says Missed for an interruption that lapsed", () => {
    const { world, asked } = at(10 * 60 + 2);
    const lapsed = { ...world, minute: 10 * 60 + 2 + 95 };
    expect(pendingInterruption(lapsed)?.title).not.toBe(asked);
    const said = texts(world, lapsed);
    expect(said).toContain(`Missed: ${asked}`);
    expect(said.join()).not.toMatch(/Done/);
  });

  it("says Waiting for an interruption a meeting holds back", () => {
    const { world, asked } = at(10 * 60 + 2);
    const inMeeting: WorldState = {
      ...world,
      meeting: {
        kind: "sponsor",
        attendees: [],
        startedAt: world.minute,
        logStart: world.study.log.length,
      },
    };
    const said = texts(world, inMeeting);
    expect(said).toContain(`Waiting: ${asked}`);
    expect(said.join()).not.toMatch(/Done/);
  });

  it("says nothing of a meeting ending: its report says it", () => {
    const base = day1();
    const inMeeting: WorldState = {
      ...base,
      meeting: {
        kind: "sponsor",
        attendees: [],
        startedAt: base.minute,
        logStart: base.study.log.length,
      },
    };
    const said = texts(inMeeting, { ...base, minute: base.minute + 45 });
    expect(said.join()).not.toMatch(/is in progress/);
  });
});

describe("revealInView (#2252)", () => {
  const card = (top: number, height: number) => {
    const el = document.createElement("section");
    el.getBoundingClientRect = () =>
      ({
        top,
        bottom: top + height,
        height,
        left: 0,
        right: 300,
        width: 300,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
    const scroll = vi.fn();
    el.scrollIntoView = scroll;
    return { el, scroll };
  };
  const motion = (reduce: boolean) =>
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: reduce && query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

  beforeEach(() => {
    vi.stubGlobal("innerHeight", 800);
    motion(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("scrolls a card that opened below the fold up to the bottom edge", () => {
    const { el, scroll } = card(718, 300);
    revealInView(el);
    expect(scroll).toHaveBeenCalledWith({ block: "end", behavior: "smooth" });
  });

  it("scrolls a card that opened above the viewport down to its top", () => {
    const { el, scroll } = card(-200, 150);
    revealInView(el);
    expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "smooth" });
  });

  it("brings a card taller than the viewport in by its top", () => {
    const { el, scroll } = card(500, 900);
    revealInView(el);
    expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "smooth" });
  });

  it("leaves a card already on screen where it is", () => {
    const { el, scroll } = card(200, 300);
    revealInView(el);
    expect(scroll).not.toHaveBeenCalled();
  });

  it("jumps instead of gliding when the visitor asks for less motion", () => {
    motion(true);
    const { el, scroll } = card(718, 300);
    revealInView(el);
    expect(scroll).toHaveBeenCalledWith({ block: "end", behavior: "auto" });
  });
});

describe("the world UI (#2252)", () => {
  const renderAt = (player: PlayerState, patch: Partial<WorldState> = {}) => {
    const world = {
      ...day1("ui-team"),
      player,
      location: "office" as const,
      ...patch,
    };
    globalThis.localStorage.setItem(WORLD_SAVE_KEY, serializeWorld(world));
    render(<StudyDirectorWorld onExit={vi.fn()} />);
    return world;
  };

  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    globalThis.localStorage?.setItem?.("study_director_world_intro_seen", "1");
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the refusal inside the phone when answering at the hard stop", () => {
    renderAt({ x: 20, y: 8, facing: "left" }, { minute: HARD_STOP - 2 });
    const phone = screen.getByRole("alertdialog", {
      name: "The phone is ringing",
    });
    fireEvent.click(within(phone).getByRole("button", { name: "Answer" }));
    const still = screen.getByRole("alertdialog", {
      name: "The phone is ringing",
    });
    expect(within(still).getByRole("alert").textContent).toMatch(
      /It is too late for that\. Go home\./
    );
    // Letting it ring closes the phone; the card to go home is there.
    fireEvent.click(within(still).getByRole("button", { name: "Let it ring" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    const outcome = screen.getByTestId("world-outcome");
    expect(outcome.textContent).toMatch(/Time to go home/);
    expect(document.activeElement).toBe(
      within(outcome).getByRole("button", { name: "Go home" })
    );
  });

  it("brings the stuck card into view and focuses Go home", () => {
    const scroll = vi.fn();
    const proto = window.HTMLElement.prototype as HTMLElement;
    const had = proto.scrollIntoView;
    proto.scrollIntoView = scroll;
    try {
      vi.stubGlobal("innerHeight", 800);
      const rect = vi
        .spyOn(window.HTMLElement.prototype, "getBoundingClientRect")
        .mockReturnValue({
          top: 900,
          bottom: 1100,
          height: 200,
          left: 0,
          right: 300,
          width: 300,
          x: 0,
          y: 900,
          toJSON: () => ({}),
        } as DOMRect);
      renderAt({ x: 4, y: 4, facing: "down" }, { minute: HARD_STOP });
      const ring = screen.queryByRole("button", { name: "Let it ring" });
      if (ring) fireEvent.click(ring);
      fireEvent.keyDown(screen.getByTestId("world-playfield"), {
        key: "ArrowLeft",
      });
      const outcome = screen.getByTestId("world-outcome");
      expect(outcome.textContent).toMatch(/Time to go home/);
      expect(scroll).toHaveBeenCalled();
      expect(document.activeElement?.textContent).toBe("Go home");
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      expect(screen.queryByTestId("world-outcome")).toBeNull();
      rect.mockRestore();
    } finally {
      proto.scrollIntoView = had;
      vi.unstubAllGlobals();
    }
  });

  it("leaves the keys on the floor for any other card", () => {
    renderAt({ x: 4, y: 4, facing: "down" }, { minute: 9 * 60 });
    const ring = screen.queryByRole("button", { name: "Let it ring" });
    if (ring) fireEvent.click(ring);
    const playfield = screen.getByTestId("world-playfield");
    playfield.focus();
    fireEvent.keyDown(playfield, { key: "f" });
    expect(screen.getByTestId("world-outcome")).toBeTruthy();
    expect(document.activeElement).toBe(playfield);
  });

  it("puts the morning cards ahead of the study pickers", () => {
    // A fresh run, so the study length and conditions can still be set.
    render(<StudyDirectorWorld onExit={vi.fn()} />);
    const priority = screen.getByTestId("world-priority");
    const pickers = screen.getByTestId("world-conditions");
    expect(
      priority.compareDocumentPosition(pickers) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("cues an interruption on the desk screen, with a way to it", () => {
    const base = day1("probe-2");
    const world = {
      ...base,
      player: { x: 4, y: 3, facing: "up" as const },
      location: "office" as const,
      minute: 10 * 60 + 2,
    };
    const pending = pendingInterruption(world);
    if (!pending) throw new Error("nothing pending");
    globalThis.localStorage.setItem(WORLD_SAVE_KEY, serializeWorld(world));
    render(<StudyDirectorWorld onExit={vi.fn()} />);
    const ring = screen.queryByRole("button", { name: "Let it ring" });
    if (ring) fireEvent.click(ring);
    fireEvent.keyDown(screen.getByTestId("world-playfield"), { key: "e" });
    const desk = screen.getByRole("dialog", { name: "Your desk" });
    const cue = within(desk).getByTestId("world-overlay-interruption");
    expect(cue.textContent).toContain(`Something needs you: ${pending.title}`);
    fireEvent.click(within(cue).getByRole("button", { name: "Go to it" }));
    expect(screen.queryByRole("dialog", { name: "Your desk" })).toBeNull();
    expect(screen.getByTestId("world-interruption").textContent).toContain(
      pending.title
    );
  });
});

describe("the priority card (#2252)", () => {
  it("stacks by its own width, not the viewport's", () => {
    render(<PriorityCard onChoose={vi.fn()} />);
    const card = screen.getByTestId("world-priority");
    expect(card.className).toMatch(/@container/);
    const list = within(card).getByRole("list");
    expect(list.className).toMatch(/@lg:grid-cols-3/);
    expect(list.className).not.toMatch(/(^|\s)sm:grid-cols-3/);
    cleanup();
  });
});
