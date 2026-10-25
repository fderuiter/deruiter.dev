/**
 * Session replay characterisation (#2708, ADR 0062).
 *
 * Before a game's session seam is extracted, a few short runs are recorded on
 * `main`: a seed, an action stream and a number of fixed loop steps, with the
 * final engine state written to a fixture by the code itself. The seam PR must
 * then reproduce every fixture exactly. The expected state is never written by
 * hand.
 *
 * - {@link recordReplay} drives a session headlessly and returns the run.
 * - {@link expectReplayFixture} compares a run with its fixture under
 *   `__tests__/fixtures/replays/<slug>/<run>.json`.
 *
 * Fixtures are written only on request: run the test with
 * `UPDATE_REPLAY_FIXTURES=1`. Without it a missing fixture fails, and writing
 * is refused when `CI` is set, so CI can never create or refresh one.
 *
 * While a run is recorded, the helper follows the recording method in
 * `lib/arcade/rng.ts`: `Math.random` draws from `createRng(seed)`, and
 * `requestAnimationFrame`, `performance.now` and `Date.now` run on a virtual
 * clock that moves one `SESSION_STEP_MS` per step. Everything is restored
 * when the run ends, even if it throws.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, vi } from "vitest";
import {
  SESSION_STEP_MS,
  createRng,
  rngStateFromSeed,
  type RngSeed,
} from "@/lib/arcade";

/** The fixture file's format version. Bump it if the document shape changes. */
export const REPLAY_FIXTURE_FORMAT = 1;

/** The environment variable that allows fixtures to be written. */
export const REPLAY_UPDATE_ENV = "UPDATE_REPLAY_FIXTURES";

/** What `Date.now` returns at step 0 of a recording: 2026-01-01T00:00:00Z. */
export const REPLAY_EPOCH_MS: number = Date.UTC(2026, 0, 1);

/** Where fixtures live, resolved from the workspace root. */
export function replayFixturesRoot(): string {
  return path.resolve(process.cwd(), "__tests__", "fixtures", "replays");
}

/**
 * A value as it is stored in a fixture: plain JSON with stable key order.
 * Values JSON cannot hold are tagged objects, such as `{ "$map": [...] }`.
 */
export type ReplayValue =
  | null
  | boolean
  | number
  | string
  | readonly ReplayValue[]
  | { readonly [key: string]: ReplayValue };

/**
 * What the helper needs from a session. Any `ArcadeSession` from
 * `components/arcade/views` fits; `step` and `rng` are optional.
 */
export interface ReplaySession<State, Intent> {
  readonly getState: () => State;
  readonly dispatch: (intent: Intent) => void;
  /**
   * Runs one fixed loop step. Without it, each step is one animation frame
   * of `SESSION_STEP_MS`, which suits an engine that still runs its own
   * `requestAnimationFrame` loop.
   */
  readonly step?: () => void;
  /** The session's gameplay stream. The helper moves it to the run's seed. */
  readonly rng?: { readonly setState: (state: number) => void };
  /**
   * Wraps each intent and each step, e.g. in React's `act`, so a game that
   * still lives in a component settles its renders before the next input.
   * Without it, the work runs as is.
   */
  readonly act?: (work: () => void) => void;
}

/** One input in the action stream. */
export interface ReplayAction<Intent> {
  /**
   * The step the intent is sent before, from 0. An action at `steps` is sent
   * after the last step. Actions are listed in step order; actions at the
   * same step are sent in list order.
   */
  readonly at: number;
  /** The intent, ideally an action map name, such as `"jump"`. */
  readonly intent: Intent;
}

/** Options for {@link recordReplay}. */
export interface RecordReplayOptions<State> {
  /** The run's seed, for the session's `rng` and the `Math.random` stub. */
  readonly seed: RngSeed;
  /** How many fixed loop steps to run. */
  readonly steps: number;
  /**
   * Picks the gameplay state to keep. Leave out cosmetic fields (particles,
   * shake, pulse phases), so moving cosmetics into a view does not break the
   * fixture. Defaults to the whole state.
   */
  readonly select?: (state: State) => unknown;
}

/** A recorded run: its inputs and its final state, serialised. */
export interface ReplayRun {
  readonly seed: RngSeed;
  readonly steps: number;
  readonly actions: readonly {
    readonly at: number;
    readonly intent: ReplayValue;
  }[];
  readonly state: ReplayValue;
}

/**
 * Drives a session headlessly: seeds it, sends the action stream and runs a
 * fixed number of loop steps, then returns the final state serialised by
 * {@link toReplayValue}.
 *
 * Pass a factory rather than a session when the session draws or reads the
 * clock while it is created, so those draws are seeded too.
 *
 * @param session - A fresh session, or a function that creates one.
 * @param actions - The action stream.
 * @param options - The seed, the step count and an optional state selector.
 * @returns The run.
 */
export function recordReplay<State, Intent>(
  session: ReplaySession<State, Intent> | (() => ReplaySession<State, Intent>),
  actions: readonly ReplayAction<Intent>[],
  options: RecordReplayOptions<State>
): ReplayRun {
  const { seed, steps, select } = options;
  if (!Number.isSafeInteger(steps) || steps < 0) {
    throw new RangeError(`steps must be a non-negative integer, got ${steps}`);
  }
  actions.forEach((action, index) => {
    if (
      !Number.isSafeInteger(action.at) ||
      action.at < 0 ||
      action.at > steps
    ) {
      throw new RangeError(
        `actions[${index}].at must be an integer in [0, ${steps}], got ${action.at}`
      );
    }
    if (index > 0 && action.at < actions[index - 1].at) {
      throw new RangeError(
        `actions must be in step order: actions[${index}].at is ${action.at}, after ${actions[index - 1].at}`
      );
    }
  });

  const environment = installReplayEnvironment(seed);
  try {
    const live = typeof session === "function" ? session() : session;
    live.rng?.setState(rngStateFromSeed(seed));

    const settle = live.act ?? ((work: () => void) => work());
    let next = 0;
    const sendDue = (step: number) => {
      while (next < actions.length && actions[next].at === step) {
        const { intent } = actions[next];
        settle(() => live.dispatch(intent));
        next += 1;
      }
    };

    for (let step = 0; step < steps; step += 1) {
      sendDue(step);
      environment.advance();
      settle(() => {
        if (live.step) live.step();
        else environment.flushFrame();
      });
    }
    sendDue(steps);

    const state = live.getState();
    return {
      seed,
      steps,
      actions: actions.map((action, index) => ({
        at: action.at,
        intent: toReplayValue(action.intent, `actions[${index}].intent`),
      })),
      state: toReplayValue(select ? select(state) : state, "state"),
    };
  } finally {
    environment.restore();
  }
}

/** Options for {@link expectReplayFixture}, mainly for the helper's own tests. */
export interface ReplayFixtureOptions {
  /** The fixtures folder. Defaults to {@link replayFixturesRoot}. */
  readonly root?: string;
  /** Whether to write the fixture. Defaults to `UPDATE_REPLAY_FIXTURES`. */
  readonly update?: boolean;
}

const FIXTURE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/**
 * Compares a run with its fixture, `<root>/<slug>/<run>.json`. With
 * `UPDATE_REPLAY_FIXTURES=1` it writes the fixture instead, formatted as the
 * pre-commit Prettier pass would leave it. A missing fixture fails, and a
 * mismatch fails with the differing paths and a full diff.
 *
 * @param name - `<slug>/<run>`, such as `retro-labyrinth/normal-run`.
 * @param run - The run from {@link recordReplay}.
 * @param options - The folder and update override.
 */
export async function expectReplayFixture(
  name: string,
  run: ReplayRun,
  options: ReplayFixtureOptions = {}
): Promise<void> {
  if (!FIXTURE_NAME.test(name)) {
    throw new Error(
      `Replay fixture name must be "<slug>/<run>" in kebab case, got "${name}"`
    );
  }
  const root = options.root ?? replayFixturesRoot();
  const file = path.join(root, ...name.split("/")) + ".json";
  const shown = path.relative(process.cwd(), file) || file;
  const actual = toJsonValue({
    format: REPLAY_FIXTURE_FORMAT,
    name,
    seed: run.seed,
    steps: run.steps,
    actions: run.actions,
    state: run.state,
  });

  if (options.update ?? isReplayUpdateRequested()) {
    if (isCi()) {
      throw new Error(
        `Refusing to write replay fixture ${shown} in CI. Record fixtures locally on main with ${REPLAY_UPDATE_ENV}=1 and commit them.`
      );
    }
    await writeFixture(file, actual);
    return;
  }

  if (!fs.existsSync(file)) {
    throw new Error(
      `Replay fixture ${shown} does not exist. Record it on main, before the seam changes code, with ${REPLAY_UPDATE_ENV}=1 npx vitest run <this test file>, then commit it.`
    );
  }

  let expected: unknown;
  try {
    expected = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (error) {
    throw new Error(
      `Replay fixture ${shown} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const differences: string[] = [];
  // The state first, since that is what a seam change breaks, then the inputs.
  const expectedDocument = isJsonObject(expected) ? expected : {};
  const actualDocument = isJsonObject(actual) ? actual : {};
  diffJson(expectedDocument.state, actualDocument.state, "state", differences);
  diffJson(
    { ...expectedDocument, state: null },
    { ...actualDocument, state: null },
    "",
    differences
  );
  if (differences.length === 0) return;
  const listed = differences.slice(0, MAX_LISTED_DIFFERENCES);
  const more =
    differences.length > listed.length
      ? `\n  ...and ${differences.length - listed.length} more`
      : "";
  expect(
    actual,
    `Replay ${name} no longer matches ${shown}:\n  ${listed.join("\n  ")}${more}\n` +
      `A seam change must reproduce the fixture exactly. Re-record with ${REPLAY_UPDATE_ENV}=1 only for an intended gameplay change, and say why in the PR`
  ).toStrictEqual(expected);
}

/** Whether `UPDATE_REPLAY_FIXTURES` asks for fixtures to be written. */
export function isReplayUpdateRequested(): boolean {
  const flag = process.env[REPLAY_UPDATE_ENV];
  return flag === "1" || flag === "true";
}

function isCi(): boolean {
  const ci = process.env.CI;
  return ci !== undefined && ci !== "" && ci !== "0" && ci !== "false";
}

async function writeFixture(file: string, document: unknown): Promise<void> {
  const prettier = await import("prettier");
  const config = (await prettier.resolveConfig(file)) ?? {};
  const text = await prettier.format(JSON.stringify(document), {
    ...config,
    filepath: file,
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/**
 * Serialises a state deterministically, so two runs compare exactly:
 *
 * - object keys are sorted, and function, symbol and `undefined` properties
 *   are left out, as JSON does; a key starting with `$` gets one more `$`;
 * - numbers keep every bit: JSON's shortest round-trip form, with `NaN`,
 *   `Infinity`, `-Infinity` and `-0` tagged as `{ "$number": "-0" }`;
 * - `Map` and `Set` keep insertion order, as `{ "$map": [[k, v]] }` and
 *   `{ "$set": [v] }`; typed arrays become `{ "$typed": "Float32Array",
 *   "values": [...] }`; a `Date` becomes `{ "$date": iso }` and a bigint
 *   `{ "$bigint": "12" }`;
 * - `undefined` in an array becomes `{ "$undefined": true }`.
 *
 * A function outside an object property, or a cycle, throws a TypeError
 * naming its path.
 *
 * @param value - The state.
 * @param at - The path to report in errors.
 * @returns The serialised value.
 */
export function toReplayValue(value: unknown, at = "value"): ReplayValue {
  return encode(value, at, new Set());
}

function encode(
  value: unknown,
  at: string,
  ancestors: Set<object>
): ReplayValue {
  if (value === null) return null;
  switch (typeof value) {
    case "boolean":
    case "string":
      return value;
    case "number":
      return encodeNumber(value);
    case "bigint":
      return { $bigint: value.toString() };
    case "undefined":
      return { $undefined: true };
    case "function":
    case "symbol":
      throw new TypeError(
        `Replay state holds a ${typeof value} at ${at}; keep only data in the selected state`
      );
    default:
      break;
  }
  if (typeof value !== "object") return null;
  if (ancestors.has(value)) {
    throw new TypeError(`Replay state has a cycle at ${at}`);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item, index) =>
        encode(item, `${at}[${index}]`, ancestors)
      );
    }
    if (value instanceof Map) {
      return {
        $map: [...value.entries()].map(([key, item], index) => [
          encode(key, `${at}<key ${index}>`, ancestors),
          encode(item, `${at}<value ${index}>`, ancestors),
        ]),
      };
    }
    if (value instanceof Set) {
      return {
        $set: [...value].map((item, index) =>
          encode(item, `${at}<item ${index}>`, ancestors)
        ),
      };
    }
    if (value instanceof Date) {
      const time = value.getTime();
      return {
        $date: Number.isNaN(time) ? "Invalid Date" : value.toISOString(),
      };
    }
    if (value instanceof ArrayBuffer) {
      return { $typed: "ArrayBuffer", values: [...new Uint8Array(value)] };
    }
    if (ArrayBuffer.isView(value)) {
      const bytes =
        value instanceof DataView
          ? [
              ...new Uint8Array(
                value.buffer,
                value.byteOffset,
                value.byteLength
              ),
            ]
          : typedValues(value);
      return {
        $typed: value.constructor.name,
        values: bytes.map((item, index) =>
          encode(item, `${at}[${index}]`, ancestors)
        ),
      };
    }
    const out: Record<string, ReplayValue> = {};
    const record: Record<string, unknown> = { ...value };
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (
        item === undefined ||
        typeof item === "function" ||
        typeof item === "symbol"
      ) {
        continue;
      }
      out[key.startsWith("$") ? `$${key}` : key] = encode(
        item,
        `${at}.${key}`,
        ancestors
      );
    }
    return out;
  } finally {
    ancestors.delete(value);
  }
}

function typedValues(view: ArrayBufferView): unknown[] {
  const length: unknown = Reflect.get(view, "length");
  if (typeof length !== "number") return [];
  return Array.from({ length }, (_, index): unknown =>
    Reflect.get(view, index)
  );
}

function encodeNumber(value: number): ReplayValue {
  if (Number.isNaN(value)) return { $number: "NaN" };
  if (value === Number.POSITIVE_INFINITY) return { $number: "Infinity" };
  if (value === Number.NEGATIVE_INFINITY) return { $number: "-Infinity" };
  if (Object.is(value, -0)) return { $number: "-0" };
  return value;
}

function toJsonValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

const MAX_LISTED_DIFFERENCES = 20;

function preview(value: unknown): string {
  const text = JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function diffJson(
  expected: unknown,
  actual: unknown,
  at: string,
  out: string[]
): void {
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      out.push(
        `${at || "(root)"}: fixture has ${expected.length} items, run has ${actual.length}`
      );
    }
    const shared = Math.min(expected.length, actual.length);
    for (let index = 0; index < shared; index += 1) {
      diffJson(expected[index], actual[index], `${at}[${index}]`, out);
    }
    return;
  }
  if (isJsonObject(expected) && isJsonObject(actual)) {
    const keys = [
      ...new Set([...Object.keys(expected), ...Object.keys(actual)]),
    ].sort();
    for (const key of keys) {
      const child = at ? `${at}.${key}` : key;
      if (!(key in actual)) out.push(`${child}: missing from the run`);
      else if (!(key in expected)) out.push(`${child}: not in the fixture`);
      else diffJson(expected[key], actual[key], child, out);
    }
    return;
  }
  if (!Object.is(expected, actual)) {
    out.push(
      `${at || "(root)"}: fixture ${preview(expected)}, run ${preview(actual)}`
    );
  }
}

interface ReplayEnvironment {
  /** Moves the virtual clock on by one step. */
  readonly advance: () => void;
  /** Runs the animation frame callbacks queued before this frame. */
  readonly flushFrame: () => void;
  /** Puts back every stubbed global. */
  readonly restore: () => void;
}

const FRAME_GLOBALS = [
  "requestAnimationFrame",
  "cancelAnimationFrame",
] as const;

function installReplayEnvironment(seed: RngSeed): ReplayEnvironment {
  const random = createRng(seed);
  let now = 0;
  let nextFrameId = 1;
  let pending = new Map<number, FrameRequestCallback>();
  let running = new Map<number, FrameRequestCallback>();

  const requestFrame = (callback: FrameRequestCallback): number => {
    const id = nextFrameId;
    nextFrameId += 1;
    pending.set(id, callback);
    return id;
  };
  const cancelFrame = (id: number): void => {
    pending.delete(id);
    running.delete(id);
  };
  const stubs = {
    requestAnimationFrame: requestFrame,
    cancelAnimationFrame: cancelFrame,
  };

  // Under jsdom, `window` may be a separate object from `globalThis`.
  const targets: object[] = [globalThis];
  if (typeof window !== "undefined" && window !== globalThis)
    targets.push(window);
  const saved = targets.map((target) =>
    FRAME_GLOBALS.map((key) => Object.getOwnPropertyDescriptor(target, key))
  );
  for (const target of targets) {
    for (const key of FRAME_GLOBALS) {
      Object.defineProperty(target, key, {
        configurable: true,
        writable: true,
        value: stubs[key],
      });
    }
  }

  const spies = [
    vi.spyOn(Math, "random").mockImplementation(random.next),
    vi.spyOn(performance, "now").mockImplementation(() => now),
    vi
      .spyOn(Date, "now")
      .mockImplementation(() => Math.floor(REPLAY_EPOCH_MS + now)),
  ];

  return {
    advance() {
      now += SESSION_STEP_MS;
    },
    flushFrame() {
      running = pending;
      pending = new Map();
      for (const [id, callback] of running) {
        if (!running.has(id)) continue;
        running.delete(id);
        callback(now);
      }
    },
    restore() {
      pending.clear();
      running.clear();
      spies.forEach((spy) => spy.mockRestore());
      targets.forEach((target, index) => {
        FRAME_GLOBALS.forEach((key, keyIndex) => {
          const descriptor = saved[index][keyIndex];
          if (descriptor) Object.defineProperty(target, key, descriptor);
          else Reflect.deleteProperty(target, key);
        });
      });
    },
  };
}
