// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  EMPTY_BESTS,
  LAPS_PER_RUN,
  MIN_PACE_METERS,
  WORLD_RECORD_SPLIT_MS,
  beatsBest,
  formatClock,
  formatDelta,
  formatPace,
  isNegativeSplit,
  mergeBests,
  paceSecondsPerKm,
  splitToast,
  type GarminBests,
} from "@/lib/garmin-splits";
import {
  SPLITS_STORAGE_KEY,
  bestsKey,
  loadBests,
  saveBests,
} from "@/lib/garmin-bests-store";
import { safeRemoveItem, safeSetRawItem } from "@/lib/safe-storage";

const store: Record<string, string> = {};

function installStorage(setItem: (k: string, v: string) => void): void {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem,
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    },
  });
}

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  installStorage((k, v) => {
    store[k] = String(v);
  });
  safeRemoveItem(SPLITS_STORAGE_KEY);
});

describe("formatClock", () => {
  it("formats zero", () => {
    expect(formatClock(0)).toBe("0:00.00");
  });

  it("formats minutes, seconds and hundredths", () => {
    expect(formatClock(64380)).toBe("1:04.38");
  });

  it("stays in minutes just under a minute", () => {
    expect(formatClock(59999)).toBe("0:59.99");
  });

  it("truncates hundredths rather than rounding up", () => {
    expect(formatClock(1239)).toBe("0:01.23");
  });

  it("keeps minutes above 59 until the hour mark", () => {
    expect(formatClock(3599999)).toBe("59:59.99");
  });

  it("shows hours from 3,600,000 ms", () => {
    expect(formatClock(3_600_000)).toBe("1:00:00.00");
    expect(formatClock(3_661_230)).toBe("1:01:01.23");
  });

  it("treats negative and non-finite values as zero", () => {
    expect(formatClock(-5)).toBe("0:00.00");
    expect(formatClock(Number.NaN)).toBe("0:00.00");
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe("0:00.00");
  });
});

describe("pace", () => {
  it("converts game ms and metres to seconds per km", () => {
    expect(paceSecondsPerKm(60000, 1000)).toBe(60);
    expect(paceSecondsPerKm(60000, 500)).toBe(120);
    expect(paceSecondsPerKm(0, 1000)).toBe(0);
  });

  it("returns null for zero or negative distance", () => {
    expect(paceSecondsPerKm(60000, 0)).toBeNull();
    expect(paceSecondsPerKm(60000, -5)).toBeNull();
  });

  it("returns null for non-finite inputs", () => {
    expect(paceSecondsPerKm(Number.NaN, 1000)).toBeNull();
    expect(paceSecondsPerKm(60000, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("formats pace as m:ss/km flooring seconds", () => {
    expect(formatPace(60)).toBe("1:00/km");
    expect(formatPace(59.9)).toBe("0:59/km");
    expect(formatPace(125.7)).toBe("2:05/km");
  });

  it("shows a placeholder when pace is unknown", () => {
    expect(formatPace(null)).toBe("--:--/km");
    expect(formatPace(Number.NaN)).toBe("--:--/km");
  });
});

describe("pace floor", () => {
  it("has no pace until the runner has covered the minimum distance", () => {
    expect(paceSecondsPerKm(5000, MIN_PACE_METERS - 1)).toBeNull();
    expect(paceSecondsPerKm(5000, MIN_PACE_METERS)).toBe(100);
  });
});

describe("bestsKey", () => {
  it("keeps Dev Mode bests apart from fitness bests", () => {
    expect(bestsKey("fenix", true)).toBe("fenix");
    expect(bestsKey("fenix", false)).toBe("fenix-dev");
  });
});

describe("formatDelta", () => {
  it("signs a faster time with a minus", () => {
    expect(formatDelta(63000, 64380)).toBe("-0:01.38");
  });

  it("signs a slower time with a plus", () => {
    expect(formatDelta(64830, 64380)).toBe("+0:00.45");
  });

  it("never shows a minus zero for a tie under a hundredth", () => {
    expect(formatDelta(64375, 64380)).toBe("+0:00.00");
    expect(formatDelta(64380, 64380)).toBe("+0:00.00");
  });

  it("is empty when there is no best", () => {
    expect(formatDelta(1000, undefined)).toBe("");
    expect(formatDelta(1000, Number.NaN)).toBe("");
  });
});

describe("beatsBest", () => {
  it("always beats a missing best", () => {
    expect(beatsBest(90000, undefined)).toBe(true);
  });

  it("is true only for strictly faster times", () => {
    expect(beatsBest(59999, 60000)).toBe(true);
    expect(beatsBest(60000, 60000)).toBe(false);
    expect(beatsBest(60001, 60000)).toBe(false);
  });
});

describe("isNegativeSplit", () => {
  it("needs at least two splits", () => {
    expect(isNegativeSplit([])).toBe(false);
    expect(isNegativeSplit([60000])).toBe(false);
  });

  it("requires every split to be strictly faster than the last", () => {
    expect(isNegativeSplit([62000, 61000, 60000])).toBe(true);
    expect(isNegativeSplit([60000, 60000])).toBe(false);
    expect(isNegativeSplit([60000, 61000])).toBe(false);
    expect(isNegativeSplit([62000, 61000, 61500])).toBe(false);
  });
});

describe("splitToast", () => {
  it("returns null for no splits", () => {
    expect(splitToast([])).toBeNull();
  });

  it("announces world record pace under the threshold", () => {
    expect(splitToast([WORLD_RECORD_SPLIT_MS - 1])).toBe("WORLD RECORD PACE");
  });

  it("prefers world record pace over a negative split", () => {
    expect(splitToast([60000, WORLD_RECORD_SPLIT_MS - 1])).toBe(
      "WORLD RECORD PACE"
    );
  });

  it("announces a negative split when faster than the previous lap", () => {
    expect(splitToast([60000, 58000])).toBe("NEGATIVE SPLIT");
  });

  it("announces a positive split when more than 5% slower", () => {
    expect(splitToast([60000, 63500])).toBe("POSITIVE SPLIT · EASE UP");
  });

  it("is silent for a lap within 5% slower of the previous lap", () => {
    expect(splitToast([60000, 62000])).toBeNull();
    expect(splitToast([60000, 60000])).toBeNull();
  });

  it("is silent for a first lap that is not world record pace", () => {
    expect(splitToast([60000])).toBeNull();
  });
});

describe("storage", () => {
  const bests: GarminBests = { totalMs: 300000, splits: [60000, 59000] };

  it("loads empty bests when nothing is saved", () => {
    expect(loadBests("fenix")).toStrictEqual(EMPTY_BESTS);
  });

  it("round trips bests for a device", () => {
    expect(saveBests("fenix", bests)).toBe(true);
    expect(loadBests("fenix")).toStrictEqual(bests);
  });

  it("keeps other devices' entries when saving", () => {
    saveBests("fenix", bests);
    saveBests("venu", { splits: [55000] });
    expect(loadBests("fenix")).toStrictEqual(bests);
    expect(loadBests("venu")).toStrictEqual({ splits: [55000] });
  });

  it("returns false when the write does not reach storage", () => {
    installStorage(() => {
      throw new Error("quota");
    });
    expect(saveBests("fenix", bests)).toBe(false);
  });

  it("falls back to empty bests for corrupt JSON", () => {
    safeSetRawItem(SPLITS_STORAGE_KEY, "{not json");
    expect(loadBests("fenix")).toStrictEqual(EMPTY_BESTS);
  });

  it("falls back to empty bests for wrong shapes", () => {
    const shapes = [
      "[1,2]",
      "null",
      "42",
      '{"fenix":"fast"}',
      '{"fenix":[60000]}',
      '{"fenix":{"splits":"nope","totalMs":"fast"}}',
    ];
    for (const raw of shapes) {
      safeSetRawItem(SPLITS_STORAGE_KEY, raw);
      expect(loadBests("fenix")).toStrictEqual(EMPTY_BESTS);
    }
  });

  it("keeps the valid leading splits and drops a bad total", () => {
    safeSetRawItem(
      SPLITS_STORAGE_KEY,
      '{"fenix":{"totalMs":-1,"splits":[60000,-1,55000,0.5]}}'
    );
    expect(loadBests("fenix")).toStrictEqual({ splits: [60000] });
  });

  it("caps loaded splits at a full run", () => {
    const seven = [1, 2, 3, 4, 5, 6, 7].map((n) => n * 10000);
    safeSetRawItem(
      SPLITS_STORAGE_KEY,
      JSON.stringify({ fenix: { splits: seven } })
    );
    expect(loadBests("fenix").splits).toHaveLength(LAPS_PER_RUN);
  });
});

describe("mergeBests", () => {
  it("records a finished first run", () => {
    expect(
      mergeBests({ splits: [] }, [60000, 61000], 121000, true)
    ).toStrictEqual({ totalMs: 121000, splits: [60000, 61000] });
  });

  it("does not set the total for an unfinished run", () => {
    expect(mergeBests({ splits: [] }, [60000], 60000, false)).toStrictEqual({
      splits: [60000],
    });
  });

  it("replaces a best with a faster lap and total", () => {
    const current: GarminBests = { totalMs: 121000, splits: [60000, 61000] };
    expect(mergeBests(current, [59000, 62000], 120000, true)).toStrictEqual({
      totalMs: 120000,
      splits: [59000, 61000],
    });
  });

  it("keeps bests when the run is slower", () => {
    const current: GarminBests = { totalMs: 121000, splits: [60000, 61000] };
    expect(mergeBests(current, [61000, 62000], 130000, true)).toStrictEqual({
      totalMs: 121000,
      splits: [60000, 61000],
    });
  });

  it("fills laps in order only", () => {
    expect(
      mergeBests({ splits: [60000] }, [70000, 55000, 50000], 175000, false)
    ).toStrictEqual({ splits: [60000, 55000, 50000] });
    expect(
      mergeBests({ splits: [] }, [Number.NaN, 55000], 55000, false)
    ).toStrictEqual({ splits: [] });
  });

  it("ignores non-finite and non-positive inputs", () => {
    const current: GarminBests = { totalMs: 121000, splits: [60000] };
    expect(
      mergeBests(current, [Number.NaN, -1, 0], Number.POSITIVE_INFINITY, true)
    ).toStrictEqual({ totalMs: 121000, splits: [60000] });
  });

  it("does not mutate its input", () => {
    const current: GarminBests = { splits: [60000] };
    mergeBests(current, [50000], 50000, true);
    expect(current).toStrictEqual({ splits: [60000] });
  });
});
