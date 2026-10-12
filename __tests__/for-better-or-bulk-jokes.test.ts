// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  ACTUAL_NOTE_IDS,
  DEFAULT_SETUP,
  IDLE_FRAME,
  LINE_BANK,
  bankText,
  computeReceipt,
  createLevel,
  stepGame,
  type Frame,
  type GameEvent,
  type GameState,
  type PresenceDecision,
  type Setup,
} from "@/lib/for-better-or-bulk";
import { REAL_FACTS_FROM_DESIGN_DOC } from "./fixtures/for-better-or-bulk-real-facts";
import {
  JOKE_IDS,
  claimJokes,
  jokeLine,
  jokesFor,
  laptopBadgeShown,
  lineFor,
  noFaq,
  type JokeId,
} from "@/components/for-better-or-bulk/jokes";
import {
  ceremonyScenes,
  playbackSeconds,
  sceneMillis,
} from "@/components/for-better-or-bulk/playback";

const STAY: PresenceDecision = { choice: "stay", commitment: null };
const LEAVE: PresenceDecision = { choice: "leave", commitment: null };

/** Runs a level to its end, answering the brothers' text with `decision`. */
function runWith(
  setup: Setup,
  decision: PresenceDecision = STAY
): { events: GameEvent[]; state: GameState } {
  let state = createLevel(setup);
  const events: GameEvent[] = [];
  for (let i = 0; i < 20000 && state.phase !== "done"; i++) {
    const frame: Frame =
      state.phase === "brothers" ? { ...IDLE_FRAME, decision } : IDLE_FRAME;
    const result = stepGame(state, frame);
    events.push(...result.events);
    state = result.state;
  }
  return { events, state };
}

/** A standard level, with the given website features and roses tier. */
function withSetup(
  capabilities: Setup["capabilities"],
  roses: Setup["cart"]["roses"] = DEFAULT_SETUP.cart.roses
): Setup {
  return {
    ...DEFAULT_SETUP,
    capabilities,
    cart: { ...DEFAULT_SETUP.cart, roses },
  };
}

const FULL_FAQ = withSetup(["faq", "admin"]);
const NO_FAQ = withSetup(["admin", "registry"]);

describe("the reactive jokes, one trigger each", () => {
  const level = createLevel(FULL_FAQ);
  const yesLevel = createLevel(withSetup(["faq", "admin"], "yes"));

  it("roses: the 'Yes' cart pays out when roses are picked up", () => {
    const pickup: GameEvent = {
      type: "picked-up",
      player: "abbi",
      item: "roses",
    };
    expect(jokesFor(pickup, yesLevel)).toEqual(["roses-yes"]);
    expect(jokesFor(pickup, level)).toEqual([]);
    expect(
      jokesFor({ type: "picked-up", player: "abbi", item: "mac" }, yesLevel)
    ).toEqual([]);
  });

  it("phone: a blocked call is blocked, an open one rings through", () => {
    expect(
      jokesFor(
        {
          type: "interruption",
          id: "garden-formal",
          player: "fred",
          blockedBy: "faq",
        },
        level
      )
    ).toEqual(["phone-blocked"]);
    expect(
      jokesFor(
        {
          type: "interruption",
          id: "garden-formal",
          player: "fred",
          blockedBy: null,
        },
        level
      )
    ).toEqual(["phone-open"]);
  });

  it("burning: the grill's burnt batch is the smoke", () => {
    expect(
      jokesFor({ type: "burnt", station: "grill-1", item: "hotdogs" }, level)
    ).toEqual(["burning"]);
  });

  it("shoes: Fred re-tying his shoes is the shoes joke", () => {
    expect(jokesFor({ type: "shoes-retied" }, level)).toEqual(["shoes"]);
  });

  it("leaving: only the leave choice opens the laptop", () => {
    expect(
      jokesFor({ type: "presence-decided", decision: LEAVE }, level)
    ).toEqual(["leaving"]);
    expect(
      jokesFor({ type: "presence-decided", decision: STAY }, level)
    ).toEqual([]);
  });

  it("simplify: a simplified use is the crumple", () => {
    expect(
      jokesFor(
        { type: "simplified", target: "petal-1", category: "petals" },
        level
      )
    ).toEqual(["simplify"]);
  });

  it("suit: the coat room joke lands at the end", () => {
    expect(jokesFor({ type: "level-finished", early: false }, level)).toEqual([
      "suit",
    ]);
  });

  it("no-faq: a missing FAQ is shown at the end, with the suit joke", () => {
    const { state } = runWith(NO_FAQ);
    expect(noFaq(state)).toBe(true);
    expect(jokesFor({ type: "level-finished", early: false }, state)).toEqual([
      "suit",
      "no-faq",
    ]);
    expect(noFaq(runWith(FULL_FAQ).state)).toBe(false);
  });

  it("covers every joke id from some trigger", () => {
    const seen = new Set<JokeId>();
    const events: GameEvent[] = [
      { type: "picked-up", player: "abbi", item: "roses" },
      {
        type: "interruption",
        id: "parking-note",
        player: "fred",
        blockedBy: "admin",
      },
      {
        type: "interruption",
        id: "parking-note",
        player: "fred",
        blockedBy: null,
      },
      { type: "burnt", station: "grill-1", item: "hotdogs" },
      { type: "shoes-retied" },
      { type: "presence-decided", decision: LEAVE },
      { type: "simplified", target: "petal-1", category: "petals" },
      { type: "level-finished", early: false },
    ];
    for (const event of events) {
      for (const state of [level, yesLevel, runWith(NO_FAQ).state]) {
        for (const id of jokesFor(event, state)) seen.add(id);
      }
    }
    expect([...seen].sort()).toEqual([...JOKE_IDS].sort());
    expect(JOKE_IDS).toHaveLength(9);
  });

  it("plays the roses joke once per level, on the first rose pickup", () => {
    const pickup: GameEvent = {
      type: "picked-up",
      player: "abbi",
      item: "roses",
    };
    const played = new Set<JokeId>();
    expect(claimJokes(jokesFor(pickup, yesLevel), played)).toEqual([
      "roses-yes",
    ]);
    expect(claimJokes(jokesFor(pickup, yesLevel), played)).toEqual([]);
    expect(
      lineFor(pickup, claimJokes(jokesFor(pickup, yesLevel), played))
    ).toBe(null);
    expect(claimJokes(["phone-open"], played)).toEqual(["phone-open"]);
  });
});

describe("the joke lines", () => {
  it("come from the line bank, tagged Fiction", () => {
    for (const id of ["joke-roses", "joke-leaving"]) {
      const line = LINE_BANK.find((entry) => entry.id === id);
      expect(line?.tag).toBe("Fiction");
      expect(line?.text).toBe(bankText(id));
    }
    expect(jokeLine("roses-yes")).toBe(bankText("joke-roses"));
    expect(jokeLine("leaving")).toBe(bankText("joke-leaving"));
    expect(jokeLine("shoes")).toBeNull();
  });

  it("puts the joke line in the toast instead of the plain line", () => {
    const yesLevel = createLevel(withSetup(["faq", "admin"], "yes"));
    const roses: GameEvent = {
      type: "picked-up",
      player: "abbi",
      item: "roses",
    };
    expect(lineFor(roses, jokesFor(roses, yesLevel))).toBe(
      bankText("joke-roses")
    );
    const leave: GameEvent = { type: "presence-decided", decision: LEAVE };
    expect(lineFor(leave, jokesFor(leave, yesLevel))).toBe(
      "Production: healthy. All systems operational."
    );
    expect(lineFor(roses, jokesFor(roses, createLevel(FULL_FAQ)))).toBeNull();
  });

  it("keeps every line a joke or scene uses in the line bank", () => {
    const ids = [
      "joke-roses",
      "joke-leaving",
      "joke-suit",
      "joke-suit-tip",
      "joke-sink",
      "guests-seated",
      "joke-faq",
      "joke-lanterns",
      ...ACTUAL_NOTE_IDS,
    ];
    for (const id of ids) {
      expect(
        LINE_BANK.some((line) => line.id === id),
        id
      ).toBe(true);
      expect(bankText(id).length, id).toBeGreaterThan(0);
    }
  });

  it("shows the laptop badge only once Fred has been sent off to leave", () => {
    expect(laptopBadgeShown(runWith(FULL_FAQ, LEAVE).state)).toBe(true);
    expect(laptopBadgeShown(runWith(FULL_FAQ, STAY).state)).toBe(false);
  });
});

describe("the playback scenes", () => {
  it("holds each scene for its game seconds, shortened by the speed with a floor", () => {
    const scene = ceremonyScenes(runWith(FULL_FAQ).state)[0];
    if (!scene) throw new Error("the playback has scenes");
    expect(sceneMillis(scene, 1)).toBe(scene.seconds * 1000);
    expect(sceneMillis(scene, 2)).toBe((scene.seconds * 1000) / 2);
    expect(sceneMillis(scene, 8)).toBe(1500);
  });

  it("plays the ceremony, tux, coat room, guests, buffet and closing scenes", () => {
    const { state } = runWith(FULL_FAQ);
    const ids = ceremonyScenes(state).map((scene) => scene.id);
    expect(ids).toEqual([
      "ceremony",
      "tux",
      "coat-room",
      "guests",
      "buffet",
      "after",
    ]);
  });

  it("adds the lanterns at dusk only when lantern targets were hung", () => {
    const { state } = runWith(FULL_FAQ);
    expect(ceremonyScenes(state).map((s) => s.id)).not.toContain("dusk");
    const hung: GameState = {
      ...state,
      targets: state.targets.map((target) =>
        target.category === "lanterns"
          ? { ...target, status: "filled" as const }
          : target
      ),
    };
    const scenes = ceremonyScenes(hung);
    expect(scenes.map((s) => s.id)).toContain("dusk");
    expect(scenes.find((s) => s.id === "dusk")?.line).toBe(
      bankText("joke-lanterns")
    );
  });

  it("sinks the guest during the ceremony only when the FAQ was missing", () => {
    const line = (state: GameState, id: string) =>
      ceremonyScenes(state).find((scene) => scene.id === id)?.line;
    const noFaqEnd = runWith(NO_FAQ).state;
    const faqEnd = runWith(FULL_FAQ).state;
    expect(line(noFaqEnd, "ceremony")).toBe(
      `${bankText("weather")} ${bankText("joke-sink")}`
    );
    expect(line(faqEnd, "ceremony")).toBe(bankText("weather"));
    expect(line(noFaqEnd, "guests")).toBe(bankText("guests-seated"));
    expect(line(faqEnd, "guests")).toBe(bankText("joke-faq"));
  });

  it("runs about thirty seconds and is the same for the same ending", () => {
    const { state } = runWith(FULL_FAQ);
    const scenes = ceremonyScenes(state);
    expect(playbackSeconds(scenes)).toBeGreaterThanOrEqual(25);
    expect(playbackSeconds(scenes)).toBeLessThanOrEqual(35);
    expect(ceremonyScenes(state)).toEqual(scenes);
  });
});

describe("the receipt's real note and smoke line", () => {
  it("quotes the real lines from the design doc and links to the wedding page", () => {
    const { state } = runWith(FULL_FAQ);
    const receipt = computeReceipt(state);
    expect(receipt.actual.heading).toBe("What actually happened");
    expect(receipt.actual.href).toBe("/wedding");
    expect(receipt.actual.lines).toEqual(ACTUAL_NOTE_IDS.map(bankText));
    expect(ACTUAL_NOTE_IDS).not.toContain("prep");
    expect(receipt.actual.lines.join(" ")).not.toContain("really thinking");
    for (const id of ACTUAL_NOTE_IDS) {
      const line = LINE_BANK.find((entry) => entry.id === id);
      expect(line?.tag).toBe("Real");
      const fact = REAL_FACTS_FROM_DESIGN_DOC.find((f) => f.id === id);
      expect(bankText(id)).toBe(fact?.text);
    }
  });

  it("says Extra smoky only when a batch burnt", () => {
    const { state } = runWith(FULL_FAQ);
    expect(computeReceipt(state).kitchen).toBeNull();
    expect(computeReceipt({ ...state, burntBatches: 2 }).kitchen).toContain(
      "Extra smoky"
    );
  });
});
