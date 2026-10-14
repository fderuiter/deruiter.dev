import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockStorage } from "../vitest.setup";
import { safeClear } from "@/lib/safe-storage";
import {
  COURSE_VERSION,
  SATURDAY_SEED,
  dailySeed,
  raceOutcomeOf,
  raceSetup,
  type BoardEntry,
  type RaceSetup,
} from "@/lib/garmin-race";
import {
  RACE_BOARDS_KEY,
  RACE_CATEGORY_KEY,
  RACE_COURSE_KEY,
  RACE_MODE_KEY,
  loadBoard,
  raceOverText,
  raceRecordOf,
  readRaceCategory,
  readRaceCourse,
  readRaceMode,
  saveResult,
  writeRacePref,
} from "@/lib/garmin-race-store";

const satSetup: RaceSetup = raceSetup(
  "saturday5k",
  "any",
  new Date(2026, 9, 14)
);
const storage = (): MockStorage =>
  window.localStorage as unknown as MockStorage;

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: new MockStorage(),
    writable: true,
    configurable: true,
  });
  // Through safe storage, so its in-memory copy is cleared too.
  safeClear();
});

describe("race board storage (#2019)", () => {
  it("reads an empty board when nothing is stored", () => {
    expect(loadBoard("saturday5k", "any", SATURDAY_SEED)).toEqual([]);
  });

  it("saves a result, ranks it first and keeps the board sorted", () => {
    const first = saveResult(
      satSetup,
      252_330,
      new Date("2026-10-14T10:00:00Z")
    );
    expect(first.place).toBe(1);
    const second = saveResult(
      satSetup,
      240_000,
      new Date("2026-10-15T10:00:00Z")
    );
    expect(second.place).toBe(1);
    expect(
      loadBoard("saturday5k", "any", SATURDAY_SEED).map((e) => e.timeMs)
    ).toEqual([240_000, 252_330]);
  });

  it("keeps the top five and reports place 0 for a slower time", () => {
    [300_000, 280_000, 260_000, 250_000, 245_000].forEach((t) =>
      saveResult(satSetup, t, new Date())
    );
    const slow = saveResult(satSetup, 400_000, new Date());
    expect(slow.place).toBe(0);
    expect(slow.board).toHaveLength(5);
    expect(loadBoard("saturday5k", "any", SATURDAY_SEED)).toHaveLength(5);
  });

  it("keeps each course and category on its own board", () => {
    saveResult(satSetup, 250_000, new Date());
    const allKudos = raceSetup("saturday5k", "allkudos", new Date());
    expect(loadBoard("saturday5k", "allkudos", SATURDAY_SEED)).toEqual([]);
    saveResult(allKudos, 260_000, new Date());
    expect(loadBoard("saturday5k", "any", SATURDAY_SEED)).toHaveLength(1);
    expect(loadBoard("saturday5k", "allkudos", SATURDAY_SEED)).toHaveLength(1);
  });

  it("starts a fresh Daily board on a new day and drops the old day's times", () => {
    const monday = raceSetup("daily", "any", new Date(2026, 9, 12));
    const tuesday = raceSetup("daily", "any", new Date(2026, 9, 13));
    expect(monday.seed).toBe(dailySeed(new Date(2026, 9, 12)));
    saveResult(monday, 200_000, new Date());
    expect(loadBoard("daily", "any", monday.seed)).toHaveLength(1);
    expect(loadBoard("daily", "any", tuesday.seed)).toEqual([]);
    const next = saveResult(tuesday, 300_000, new Date());
    expect(next.place).toBe(1);
    expect(loadBoard("daily", "any", monday.seed)).toEqual([]);
    expect(loadBoard("daily", "any", tuesday.seed)).toHaveLength(1);
  });

  it("drops entries from an older course version", () => {
    const stale: BoardEntry = {
      timeMs: 100_000,
      at: "2025-01-01T00:00:00.000Z",
      seed: SATURDAY_SEED,
      version: COURSE_VERSION - 1,
    };
    storage().setItem(
      RACE_BOARDS_KEY,
      JSON.stringify({ "saturday5k:any": [stale] })
    );
    expect(loadBoard("saturday5k", "any", SATURDAY_SEED)).toEqual([]);
    const saved = saveResult(satSetup, 250_000, new Date());
    expect(saved.board).toHaveLength(1);
    expect(saved.board[0].timeMs).toBe(250_000);
  });

  it("drops malformed entries from storage and keeps the valid ones", () => {
    const good: BoardEntry = {
      timeMs: 250_000,
      at: "2026-10-14T10:00:00.000Z",
      seed: SATURDAY_SEED,
      version: COURSE_VERSION,
    };
    storage().setItem(
      RACE_BOARDS_KEY,
      JSON.stringify({
        "saturday5k:any": [
          good,
          {
            timeMs: "fast",
            at: "x",
            seed: SATURDAY_SEED,
            version: COURSE_VERSION,
          },
          null,
          { timeMs: -5, at: "x", seed: SATURDAY_SEED, version: COURSE_VERSION },
          "nope",
        ],
      })
    );
    expect(loadBoard("saturday5k", "any", SATURDAY_SEED)).toEqual([good]);
  });

  it("treats corrupt JSON and wrong shapes as an empty board without throwing", () => {
    storage().setItem(RACE_BOARDS_KEY, "{not json");
    expect(loadBoard("saturday5k", "any", SATURDAY_SEED)).toEqual([]);
    expect(saveResult(satSetup, 250_000, new Date()).place).toBe(1);
    storage().setItem(RACE_BOARDS_KEY, "[1, 2]");
    expect(loadBoard("saturday5k", "any", SATURDAY_SEED)).toEqual([]);
    storage().setItem(
      RACE_BOARDS_KEY,
      JSON.stringify({ "saturday5k:any": "x" })
    );
    expect(loadBoard("saturday5k", "any", SATURDAY_SEED)).toEqual([]);
  });

  it("does not throw when storage itself throws", () => {
    vi.spyOn(storage(), "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadBoard("saturday5k", "any", SATURDAY_SEED)).toEqual([]);
    vi.restoreAllMocks();
  });
});

describe("race preferences (#2019)", () => {
  it("defaults to a Training Run, the Saturday 5K and Any%", () => {
    expect(readRaceMode()).toBe(false);
    expect(readRaceCourse()).toBe("saturday5k");
    expect(readRaceCategory()).toBe("any");
  });

  it("remembers the picked mode, course and category", () => {
    expect(writeRacePref(RACE_MODE_KEY, "1")).toBe(true);
    writeRacePref(RACE_COURSE_KEY, "daily");
    writeRacePref(RACE_CATEGORY_KEY, "negsplit");
    expect(readRaceMode()).toBe(true);
    expect(readRaceCourse()).toBe("daily");
    expect(readRaceCategory()).toBe("negsplit");
  });

  it("falls back to the defaults for unknown stored values", () => {
    writeRacePref(RACE_COURSE_KEY, "online-cup");
    writeRacePref(RACE_CATEGORY_KEY, "speedrun");
    expect(readRaceCourse()).toBe("saturday5k");
    expect(readRaceCategory()).toBe("any");
  });
});

describe("race outcome and announcements (#2019)", () => {
  it("builds the outcome from the run state", () => {
    expect(
      raceOutcomeOf({
        gameState: "summary",
        runClockMs: 252_330,
        lapSplits: [80_000, 85_000],
        kudosMissed: 2,
        gearTaken: true,
        medalsFound: [1, 2, 3],
      })
    ).toEqual({
      finished: true,
      timeMs: 252_330,
      lapSplits: [80_000, 85_000],
      kudosMissed: 2,
      gearTaken: true,
      medalsFound: 3,
    });
  });

  it("marks a crashed run as not finished, with defaults for missing fields", () => {
    const outcome = raceOutcomeOf({ gameState: "crashed" });
    expect(outcome.finished).toBe(false);
    expect(outcome.timeMs).toBe(0);
    expect(outcome.lapSplits).toEqual([]);
    expect(outcome.medalsFound).toBe(0);
  });

  it("records PR for beating the board's best, CR for a first record, and nothing else", () => {
    expect(raceRecordOf(1, 250_000, null)).toBe("CR");
    expect(raceRecordOf(1, 240_000, 250_000)).toBe("PR");
    expect(raceRecordOf(2, 260_000, 250_000)).toBeNull();
    expect(raceRecordOf(0, 400_000, 250_000)).toBeNull();
  });

  it("announces a time with its place and record", () => {
    const outcome = {
      finished: true,
      timeMs: 252_330,
      lapSplits: [],
      kudosMissed: 0,
      gearTaken: false,
      medalsFound: 0,
    };
    expect(raceOverText({ result: "time", reason: "" }, outcome, 1, "CR")).toBe(
      "Race over: 4:12.33, place 1 on this board, course record."
    );
    expect(raceOverText({ result: "time", reason: "" }, outcome, 1, "PR")).toBe(
      "Race over: 4:12.33, place 1 on this board, new personal record."
    );
    expect(raceOverText({ result: "time", reason: "" }, outcome, 0, null)).toBe(
      "Race over: 4:12.33, off the board."
    );
  });

  it("announces a DNQ with its reason", () => {
    const outcome = {
      finished: true,
      timeMs: 252_330,
      lapSplits: [],
      kudosMissed: 2,
      gearTaken: false,
      medalsFound: 0,
    };
    expect(
      raceOverText(
        { result: "dnq", reason: "2 Kudos missed" },
        outcome,
        0,
        null
      )
    ).toBe("Race over: DNQ, 2 Kudos missed.");
  });
});
