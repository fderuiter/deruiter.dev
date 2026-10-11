// @vitest-environment node
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  IDLE_INPUT,
  MAX_RUN_CODE_LENGTH,
  MAX_SEED,
  RUN_CODE_PREFIX,
  RUN_CODE_REFUSAL,
  RUN_REPLAY_REFUSAL,
  createLevel,
  decodeRunCode,
  encodeRunCode,
  runCodeFromHash,
  runLinkFor,
  recordedFrame,
  runResultOf,
  stepGame,
  validateSetup,
  verifyRun,
  DEFAULT_SETUP,
  type Frame,
  type GameState,
  type PlayerId,
  type PresenceDecision,
  type Setup,
  type SharedRun,
} from "@/lib/for-better-or-bulk";

const CAPABILITIES = ["faq", "admin", "registry", "intro3d"] as const;
const ROSES = ["modest", "full", "yes"] as const;
const FOODS = ["enough", "lots", "feed-rochester"] as const;
const COMMITMENTS = ["chairs", "lanterns", "buffet", "flowers"] as const;
const MOVES = [-1, 0, 1] as const;

const playerInput = fc.record({
  moveX: fc.constantFrom(...MOVES),
  moveY: fc.constantFrom(...MOVES),
  interact: fc.boolean(),
  work: fc.boolean(),
});

const decision = fc.oneof(
  fc.constant<PresenceDecision>({ choice: "stay", commitment: null }),
  fc.constant<PresenceDecision>({ choice: "leave", commitment: null }),
  fc
    .constantFrom(...COMMITMENTS)
    .map((commitment): PresenceDecision => ({ choice: "break", commitment }))
);

const frame = fc
  .record({
    inputs: fc.record({ fred: playerInput, abbi: playerInput }),
    assisted: fc.option(fc.constantFrom<PlayerId>("fred", "abbi"), {
      nil: undefined,
    }),
    decision: fc.option(decision, { nil: undefined }),
  })
  .map((value): Frame => {
    const { assisted, decision: chosen, ...rest } = value;
    return {
      ...rest,
      ...(assisted ? { assisted } : {}),
      ...(chosen ? { decision: chosen } : {}),
    };
  });

/** Frames in short repeated runs, so the run-length encoding is exercised. */
const frameStream = fc
  .array(fc.tuple(frame, fc.integer({ min: 1, max: 6 })), { maxLength: 60 })
  .map((runs) =>
    runs.flatMap(([value, count]) => Array.from({ length: count }, () => value))
  );

const setup = fc
  .record({
    capabilities: fc.subarray([...CAPABILITIES], {
      minLength: 2,
      maxLength: 2,
    }),
    cart: fc.record({
      roses: fc.constantFrom(...ROSES),
      food: fc.constantFrom(...FOODS),
      lanterns: fc.boolean(),
    }),
    relaxed: fc.boolean(),
    assist: fc.boolean(),
    seed: fc.integer({ min: 0, max: MAX_SEED }),
  })
  .filter((value) => validateSetup(value).ok);

const result = fc.record({
  placements: fc.nat({ max: 200 }),
  finishedMs: fc.option(fc.nat({ max: 400_000 }), { nil: null }),
  endMs: fc.nat({ max: 400_000 }),
});

/**
 * A scripted run played through the engine: Fred walks back and forth, works
 * and interacts, and the brothers' text is answered with "stay". It always
 * reaches the end of the level, so its result is the engine's own.
 */
function scriptedRun(): SharedRun {
  const setupValue: Setup = DEFAULT_SETUP;
  let state: GameState = createLevel(setupValue);
  const frames: Frame[] = [];
  for (let tick = 0; tick < 8000 && state.phase !== "done"; tick++) {
    const next: Frame = {
      inputs: {
        fred: {
          moveX: tick % 40 < 20 ? 1 : -1,
          moveY: tick % 90 < 30 ? 1 : 0,
          interact: tick % 45 === 0,
          work: tick % 7 < 3,
        },
        abbi: {
          moveX: tick % 30 < 15 ? -1 : 1,
          moveY: 0,
          interact: tick % 60 === 0,
          work: false,
        },
      },
      ...(state.phase === "brothers"
        ? { decision: { choice: "stay", commitment: null } as const }
        : {}),
    };
    frames.push(next);
    state = stepGame(state, next).state;
  }
  return { setup: setupValue, frames, result: runResultOf(state) };
}

describe("For Better or Bulk run codes", () => {
  it("round-trips any valid setup, frame stream and result exactly", () => {
    fc.assert(
      fc.property(setup, frameStream, result, (s, frames, outcome) => {
        const run: SharedRun = { setup: s, frames, result: outcome };
        expect(decodeRunCode(encodeRunCode(run))).toEqual({ ok: true, run });
      }),
      { numRuns: 150 }
    );
  });

  it("decodes any arbitrary string to a refusal and never throws", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ maxLength: 300 }),
          fc.string({ unit: "grapheme", maxLength: 300 }),
          fc
            .string({ maxLength: 300 })
            .map((text) => `${RUN_CODE_PREFIX}${text}`)
        ),
        (text) => {
          const decoded = decodeRunCode(text);
          expect(decoded.ok).toBe(false);
          if (!decoded.ok) expect(decoded.message).toBe(RUN_CODE_REFUSAL);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("refuses values that are not strings, without throwing", () => {
    for (const value of [undefined, null, 42, {}, [], true]) {
      expect(decodeRunCode(value)).toMatchObject({
        ok: false,
        message: RUN_CODE_REFUSAL,
      });
    }
  });

  it("refuses a code with any single character flipped", () => {
    const code = encodeRunCode(scriptedRun());
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    fc.assert(
      fc.property(
        fc.integer({ min: RUN_CODE_PREFIX.length, max: code.length - 1 }),
        fc.integer({ min: 1, max: alphabet.length - 1 }),
        (index, shift) => {
          const current = alphabet.indexOf(code[index] ?? "A");
          const replacement =
            alphabet[(current + shift) % alphabet.length] ?? "A";
          const flipped =
            code.slice(0, index) + replacement + code.slice(index + 1);
          expect(decodeRunCode(flipped)).toMatchObject({
            ok: false,
            message: RUN_CODE_REFUSAL,
          });
        }
      ),
      { numRuns: 200 }
    );
  });

  it("refuses a truncated code", () => {
    const code = encodeRunCode(scriptedRun());
    for (const cut of [
      RUN_CODE_PREFIX.length,
      RUN_CODE_PREFIX.length + 5,
      Math.floor(code.length / 2),
      code.length - 1,
    ]) {
      expect(decodeRunCode(code.slice(0, cut))).toMatchObject({
        ok: false,
        message: RUN_CODE_REFUSAL,
      });
    }
  });

  it("refuses a code from another version", () => {
    const code = encodeRunCode(scriptedRun());
    const other = `f2.${code.slice(RUN_CODE_PREFIX.length)}`;
    expect(decodeRunCode(other)).toEqual({
      ok: false,
      reason: "version",
      message: RUN_CODE_REFUSAL,
    });
  });

  it("refuses an over-long code before reading it", () => {
    const long = `${RUN_CODE_PREFIX}${"A".repeat(MAX_RUN_CODE_LENGTH)}`;
    expect(decodeRunCode(long)).toMatchObject({
      ok: false,
      reason: "too-long",
    });
  });

  it("replays a scripted run strictly to its own result", () => {
    const run = scriptedRun();
    const decoded = decodeRunCode(encodeRunCode(run));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(verifyRun(decoded.run).ok).toBe(true);
  });

  it("refuses a run whose claimed result the replay does not reproduce", () => {
    const run = scriptedRun();
    const forged: SharedRun = {
      ...run,
      result: { ...run.result, placements: run.result.placements + 1 },
    };
    expect(verifyRun(forged)).toEqual({
      ok: false,
      message: RUN_REPLAY_REFUSAL,
    });
  });

  it("refuses a strict replay at a decision that does not fit the state", () => {
    const run = scriptedRun();
    const bad: SharedRun = {
      ...run,
      frames: [
        {
          inputs: { fred: IDLE_INPUT, abbi: IDLE_INPUT },
          decision: { choice: "stay", commitment: null },
        },
        ...run.frames,
      ],
    };
    expect(verifyRun(bad).ok).toBe(false);
  });

  it("reads a run code only from a #run= fragment", () => {
    const code = encodeRunCode(scriptedRun());
    expect(runCodeFromHash(`#run=${code}`)).toBe(code);
    expect(runCodeFromHash("#other=1")).toBeNull();
    expect(runCodeFromHash("")).toBeNull();
    expect(
      runLinkFor("https://deruiter.dev/arcade/for-better-or-bulk", code)
    ).toBe(`https://deruiter.dev/arcade/for-better-or-bulk#run=${code}`);
  });
});

/** FNV-1a over a body, the same checksum the codec seals a code with. */
function fnv(bytes: readonly number[]): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Seals a body with its checksum into a run code, for hand-built bodies. */
function sealed(body: readonly number[]): string {
  const sum = fnv(body);
  const bytes = [
    ...body,
    (sum >>> 24) & 0xff,
    (sum >>> 16) & 0xff,
    (sum >>> 8) & 0xff,
    sum & 0xff,
  ];
  return RUN_CODE_PREFIX + Buffer.from(bytes).toString("base64url");
}

/** The minimal varint bytes for a non-negative whole number. */
function varintBytes(value: number): number[] {
  const out: number[] = [];
  let rest = value;
  while (rest >= 0x80) {
    out.push((rest % 0x80) | 0x80);
    rest = Math.floor(rest / 0x80);
  }
  out.push(rest);
  return out;
}

/** Reads one varint at an offset, returning its value and byte length. */
function readVarintAt(
  bytes: readonly number[],
  at: number
): { value: number; length: number } {
  let value = 0;
  let scale = 1;
  for (let i = 0; ; i++) {
    const byte = bytes[at + i] ?? 0;
    value += (byte & 0x7f) * scale;
    if ((byte & 0x80) === 0) return { value, length: i + 1 };
    scale *= 0x80;
  }
}

/** The same number in a longer, non-minimal form: a zero byte appended. */
function padVarint(bytes: readonly number[]): number[] {
  const last = bytes.length - 1;
  return [...bytes.slice(0, last), (bytes[last] ?? 0) | 0x80, 0x00];
}

/** The body of a code, without its four checksum bytes. */
function bodyOf(code: string): number[] {
  const all = [...Buffer.from(code.slice(RUN_CODE_PREFIX.length), "base64url")];
  return all.slice(0, all.length - 4);
}

/** A decision for a tick: an invalid break while the text is up, a stay otherwise. */
function ignoredDecisionAt(
  state: GameState,
  tick: number
): PresenceDecision | undefined {
  if (state.phase === "brothers") {
    return tick % 2 === 0
      ? { choice: "break", commitment: null }
      : { choice: "stay", commitment: null };
  }
  return tick % 50 === 0 ? { choice: "stay", commitment: null } : undefined;
}

/**
 * A live run in which the engine is handed decisions it ignores: a stay while
 * nobody is texting, and a break with no promise while the text is on screen.
 * Each tick is recorded the way the page records it, so the recording is what
 * a share code carries.
 */
function liveRunWithIgnoredDecisions(): {
  recording: SharedRun;
  raw: Frame[];
} {
  let state: GameState = createLevel(DEFAULT_SETUP);
  const frames: Frame[] = [];
  const raw: Frame[] = [];
  for (let tick = 0; tick < 8000 && state.phase !== "done"; tick++) {
    const inputs: Frame["inputs"] = {
      fred: { ...IDLE_INPUT, work: tick % 7 < 3 },
      abbi: { ...IDLE_INPUT, moveX: tick % 30 < 15 ? -1 : 1 },
    };
    const decision = ignoredDecisionAt(state, tick);
    const frame: Frame = decision ? { inputs, decision } : { inputs };
    raw.push(frame);
    frames.push(recordedFrame(state, frame));
    state = stepGame(state, frame).state;
  }
  return {
    recording: { setup: DEFAULT_SETUP, frames, result: runResultOf(state) },
    raw,
  };
}

describe("For Better or Bulk run code canonical form", () => {
  it("gives a live run with ignored decisions a share code that verifies", () => {
    const { recording, raw } = liveRunWithIgnoredDecisions();
    // The raw frames carry decisions the engine ignored, so a strict replay of
    // them fails: that is why the page must not record them.
    expect(verifyRun({ ...recording, frames: raw }).ok).toBe(false);
    const decoded = decodeRunCode(encodeRunCode(recording));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(verifyRun(decoded.run).ok).toBe(true);
  });

  it("records a frame's decision only when the engine applies it", () => {
    const state = createLevel(DEFAULT_SETUP);
    const stay: PresenceDecision = { choice: "stay", commitment: null };
    const idle = { inputs: { fred: IDLE_INPUT, abbi: IDLE_INPUT } };
    expect(recordedFrame(state, { ...idle, decision: stay })).toEqual(idle);
    expect(recordedFrame(state, idle)).toBe(idle);
  });

  it("decodes a code and re-encodes it to the same string, for any run", () => {
    fc.assert(
      fc.property(setup, frameStream, result, (s, frames, outcome) => {
        const code = encodeRunCode({ setup: s, frames, result: outcome });
        const decoded = decodeRunCode(code);
        expect(decoded.ok).toBe(true);
        if (!decoded.ok) return;
        expect(encodeRunCode(decoded.run)).toBe(code);
      }),
      { numRuns: 150 }
    );
  });

  it("refuses a run count padded to a longer varint, for any run", () => {
    fc.assert(
      fc.property(setup, frameStream, result, (s, frames, outcome) => {
        const code = encodeRunCode({ setup: s, frames, result: outcome });
        const body = bodyOf(code);
        // Setup: flags, roses, food, the seed, the capability count, then the ids.
        const countAt =
          3 + varintBytes(s.seed ?? 0).length + 1 + s.capabilities.length;
        const count = readVarintAt(body, countAt);
        const padded = [
          ...body.slice(0, countAt),
          ...padVarint(body.slice(countAt, countAt + count.length)),
          ...body.slice(countAt + count.length),
        ];
        expect(decodeRunCode(sealed(body)).ok).toBe(true);
        expect(decodeRunCode(sealed(padded))).toMatchObject({
          ok: false,
          reason: "damaged",
        });
      }),
      { numRuns: 100 }
    );
  });

  it("refuses two identical frame runs in a row", () => {
    const run = scriptedRun();
    const code = encodeRunCode(run);
    const body = bodyOf(code);
    const countAt =
      3 +
      varintBytes(run.setup.seed ?? 0).length +
      1 +
      run.setup.capabilities.length;
    const count = readVarintAt(body, countAt);
    const firstPair = countAt + count.length;
    const symbol = readVarintAt(body, firstPair);
    const length = readVarintAt(body, firstPair + symbol.length);
    const pairEnd = firstPair + symbol.length + length.length;
    const duplicated = [
      ...body.slice(0, countAt),
      ...varintBytes(count.value + 1),
      ...body.slice(countAt + count.length, pairEnd),
      ...body.slice(firstPair, pairEnd),
      ...body.slice(pairEnd),
    ];
    expect(decodeRunCode(code).ok).toBe(true);
    expect(decodeRunCode(sealed(duplicated))).toMatchObject({
      ok: false,
      reason: "damaged",
    });
  });
});
