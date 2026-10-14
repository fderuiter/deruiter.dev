// @vitest-environment jsdom
//
// #2049: Echo, the Meme Vault's repeat-the-sequence game. The pure engine
// (seeded sequence, input rules, tempo) and the best-streak storage.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ECHO_PAD_COUNT,
  ECHO_TEMPO,
  beginEchoInput,
  createEchoRound,
  echoPadAt,
  echoSequence,
  echoStepMs,
  isNewEchoBest,
  parseEchoBest,
  submitEchoInput,
  type EchoRound,
} from "@/lib/meme-echo";
import {
  MEME_STORAGE_KEYS,
  getEchoBest,
  recordEchoStreak,
} from "@/lib/meme-data";
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

/** Repeats the round's whole sequence correctly. */
function repeatAll(round: EchoRound): EchoRound {
  let current = beginEchoInput(round);
  for (const pad of round.sequence) {
    current = submitEchoInput(current, pad).round;
  }
  return current;
}

describe("Echo sequence engine", () => {
  it("draws the same pads for the same seed and different pads for another", () => {
    expect(echoSequence("vault-1", 24)).toEqual(echoSequence("vault-1", 24));
    expect(echoSequence("vault-1", 24)).not.toEqual(
      echoSequence("vault-2", 24)
    );
  });

  it("only ever extends a sequence, so earlier pads never change", () => {
    const long = echoSequence("grow", 30);
    for (let n = 0; n <= 30; n++) {
      expect(echoSequence("grow", n)).toEqual(long.slice(0, n));
    }
    expect(echoPadAt("grow", 7)).toBe(long[7]);
  });

  it("keeps every pad in range and reaches all eight", () => {
    const seq = echoSequence("range", 400);
    for (const pad of seq) {
      expect(Number.isInteger(pad)).toBe(true);
      expect(pad).toBeGreaterThanOrEqual(0);
      expect(pad).toBeLessThan(ECHO_PAD_COUNT);
    }
    expect(new Set(seq).size).toBe(ECHO_PAD_COUNT);
  });

  it("treats a bad length as empty", () => {
    expect(echoSequence("x", -3)).toEqual([]);
    expect(echoSequence("x", Number.NaN)).toEqual([]);
    expect(echoSequence("x", 2.9)).toHaveLength(2);
  });

  it("starts a round one pad long, with the vault playing", () => {
    const round = createEchoRound("start");
    expect(round.sequence).toEqual(echoSequence("start", 1));
    expect(round.phase).toBe("showing");
    expect(round.streak).toBe(0);
    expect(round.inputIndex).toBe(0);
  });

  it("ignores presses while the vault plays and after the round ends", () => {
    const round = createEchoRound("ignore");
    const shown = submitEchoInput(round, round.sequence[0]);
    expect(shown.outcome).toBe("ignored");
    expect(shown.round).toBe(round);

    const over = submitEchoInput(
      beginEchoInput(round),
      (round.sequence[0] + 1) % ECHO_PAD_COUNT
    ).round;
    expect(over.phase).toBe("over");
    const after = submitEchoInput(over, round.sequence[0]);
    expect(after.outcome).toBe("ignored");
    expect(after.round).toBe(over);
  });

  it("only hands over input from the showing phase", () => {
    const round = createEchoRound("begin");
    const input = beginEchoInput(round);
    expect(input.phase).toBe("input");
    expect(beginEchoInput(input)).toBe(input);
  });

  it("grows the streak and the sequence when the player repeats it", () => {
    let round = createEchoRound("grow-streak");
    for (let i = 1; i <= 10; i++) {
      round = repeatAll(round);
      expect(round.phase).toBe("showing");
      expect(round.streak).toBe(i);
      expect(round.sequence).toEqual(echoSequence("grow-streak", i + 1));
    }
  });

  it("reports correct presses until the last pad completes the sequence", () => {
    let round = createEchoRound("steps");
    round = repeatAll(round);
    round = repeatAll(round); // now three pads long
    let current = beginEchoInput(round);
    const outcomes = round.sequence.map((pad) => {
      const result = submitEchoInput(current, pad);
      current = result.round;
      return result.outcome;
    });
    expect(outcomes).toEqual(["correct", "correct", "complete"]);
  });

  it("ends the round on the first wrong pad and remembers the expected one", () => {
    let round = createEchoRound("fail");
    round = repeatAll(round);
    round = repeatAll(round);
    let current = beginEchoInput(round);
    current = submitEchoInput(current, round.sequence[0]).round;
    const expected = round.sequence[1];
    const wrong = (expected + 3) % ECHO_PAD_COUNT;
    const result = submitEchoInput(current, wrong);
    expect(result.outcome).toBe("fail");
    expect(result.round.phase).toBe("over");
    expect(result.round.streak).toBe(2);
    expect(result.round.expectedPad).toBe(expected);
  });

  it("counts an out-of-range pad as a mistake", () => {
    const round = beginEchoInput(createEchoRound("oob"));
    expect(submitEchoInput(round, 99).outcome).toBe("fail");
    expect(submitEchoInput(round, -1).outcome).toBe("fail");
  });

  it("never mutates the round it is given", () => {
    const round = beginEchoInput(createEchoRound("immutable"));
    const snapshot = JSON.stringify(round);
    submitEchoInput(round, round.sequence[0]);
    submitEchoInput(round, (round.sequence[0] + 1) % ECHO_PAD_COUNT);
    expect(JSON.stringify(round)).toBe(snapshot);
  });
});

describe("Echo tempo schedule", () => {
  it("starts at the base step and speeds up every few pads", () => {
    expect(echoStepMs(1)).toBe(ECHO_TEMPO.baseMs);
    expect(echoStepMs(ECHO_TEMPO.every)).toBe(ECHO_TEMPO.baseMs);
    expect(echoStepMs(ECHO_TEMPO.every + 1)).toBe(
      ECHO_TEMPO.baseMs - ECHO_TEMPO.stepMs
    );
  });

  it("never gets slower as the sequence grows and stops at the floor", () => {
    let previous = Infinity;
    for (let n = 1; n <= 200; n++) {
      const step = echoStepMs(n);
      expect(step).toBeLessThanOrEqual(previous);
      expect(step).toBeGreaterThanOrEqual(ECHO_TEMPO.minMs);
      // Gentle: one change is never more than one stepMs.
      if (previous !== Infinity) {
        expect(previous - step).toBeLessThanOrEqual(ECHO_TEMPO.stepMs);
      }
      previous = step;
    }
    expect(echoStepMs(200)).toBe(ECHO_TEMPO.minMs);
  });

  it("treats a bad length as one pad", () => {
    expect(echoStepMs(0)).toBe(ECHO_TEMPO.baseMs);
    expect(echoStepMs(Number.NaN)).toBe(ECHO_TEMPO.baseMs);
  });
});

describe("Echo best streak", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MockStorage());
    safeRemoveItem(MEME_STORAGE_KEYS.ECHO_BEST);
  });

  afterEach(() => {
    safeRemoveItem(MEME_STORAGE_KEYS.ECHO_BEST);
    vi.unstubAllGlobals();
  });

  it("parses stored values defensively", () => {
    expect(parseEchoBest(null)).toBe(0);
    expect(parseEchoBest("7")).toBe(7);
    expect(parseEchoBest("junk")).toBe(0);
    expect(parseEchoBest("-4")).toBe(0);
  });

  it("only calls a positive streak above the best a new best", () => {
    expect(isNewEchoBest(0, 0)).toBe(false);
    expect(isNewEchoBest(1, 0)).toBe(true);
    expect(isNewEchoBest(5, 5)).toBe(false);
    expect(isNewEchoBest(6, 5)).toBe(true);
    expect(isNewEchoBest(Number.NaN, 0)).toBe(false);
  });

  it("stores a new best under its own key and keeps the higher one", () => {
    expect(getEchoBest()).toBe(0);
    expect(recordEchoStreak(0)).toBe(false);
    expect(recordEchoStreak(4)).toBe(true);
    expect(localStorage.getItem(MEME_STORAGE_KEYS.ECHO_BEST)).toBe("4");
    expect(recordEchoStreak(3)).toBe(false);
    expect(recordEchoStreak(4)).toBe(false);
    expect(getEchoBest()).toBe(4);
    expect(recordEchoStreak(9)).toBe(true);
    expect(getEchoBest()).toBe(9);
    // Echo does not touch the trophy list that scores the vault.
    expect(localStorage.getItem(MEME_STORAGE_KEYS.ACHIEVEMENTS)).toBeNull();
  });

  it("does not throw when storage refuses writes", () => {
    vi.stubGlobal("localStorage", {
      ...new MockStorage(),
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    });
    expect(() => recordEchoStreak(2)).not.toThrow();
  });
});
