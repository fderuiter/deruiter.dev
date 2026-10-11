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
