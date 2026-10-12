/**
 * Run codes for For Better or Bulk: one finished run in one string, so a link
 * can replay it strictly (ADR 0060).
 *
 * A code is `f1.` followed by base64url of a binary body and a four-byte
 * FNV-1a checksum of that body. The body holds the setup, the frames as
 * run-length-encoded symbols (a symbol packs both people's inputs, the
 * assisted person and any brothers decision into one number), and the result
 * a strict replay must reproduce: placements, the finish time and the end
 * time. Decoding never throws. Anything damaged, from another version or
 * too large is refused with a typed reason and one fixed message.
 */

import { validateSetup } from "./level";
import { replayLevel } from "./sim";
import type {
  CapabilityId,
  Commitment,
  Frame,
  FoodTier,
  GameState,
  PlayerId,
  PlayerInput,
  PresenceDecision,
  RoseTier,
  Setup,
} from "../types";

/** The version prefix every run code starts with. */
export const RUN_CODE_PREFIX = "f1.";

/** The longest run code the decoder will read, in characters. */
export const MAX_RUN_CODE_LENGTH = 200_000;

/** The most engine ticks a shared run may hold: about 11 minutes of game clock. */
export const MAX_RUN_TICKS = 20_000;

/** The message every refused run code shows. */
export const RUN_CODE_REFUSAL =
  "This run code is damaged or from another version, so it cannot be replayed.";

/** The message for a code that decodes but does not replay to its own result. */
export const RUN_REPLAY_REFUSAL =
  "This run code does not replay to the same result, so it cannot be shown.";

/** The fragment that carries a run code in a link. */
const HASH_PREFIX = "#run=";

/** Something that looks like another version's prefix, such as "f2.". */
const VERSION_PATTERN = /^[a-z][0-9]+\./;

const ROSE_ORDER: readonly RoseTier[] = ["modest", "full", "yes"];
const FOOD_ORDER: readonly FoodTier[] = ["enough", "lots", "feed-rochester"];
const CAPABILITY_ORDER: readonly CapabilityId[] = [
  "faq",
  "admin",
  "registry",
  "intro3d",
];
const COMMITMENT_ORDER: readonly Commitment[] = [
  "chairs",
  "lanterns",
  "buffet",
  "flowers",
];
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** One player's input has 72 combinations: 3 x 3 moves, 2 x 2 buttons, interact held or not. */
const PLAYER_CODES = 72;
/** The assisted person (3) times the brothers decision (7). */
const EXTRA_CODES = 21;

/** Why a code was refused. The message is the same for every reason. */
export type RunCodeError = "damaged" | "version" | "too-long" | "invalid-setup";

/** A finished run's result, the numbers a strict replay must reproduce. */
export interface RunResult {
  /** Items placed across every target. */
  readonly placements: number;
  /** When everything was ready, in milliseconds of level time, if it was. */
  readonly finishedMs: number | null;
  /** The level time the run ended at, in milliseconds. */
  readonly endMs: number;
}

/** A run as it travels in a code: its setup, every tick's frame and result. */
export interface SharedRun {
  readonly setup: Setup;
  readonly frames: readonly Frame[];
  readonly result: RunResult;
}

/** The outcome of decoding: the run, or a refusal with its reason. */
export type RunCodeResult =
  | { readonly ok: true; readonly run: SharedRun }
  | {
      readonly ok: false;
      readonly reason: RunCodeError;
      readonly message: string;
    };

/** The outcome of a strict replay against a run's own result. */
export type RunVerification =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly message: string };

/** A decode failure carrying its reason; never escapes `decodeRunCode`. */
class RunCodeFailure extends Error {
  readonly reason: RunCodeError;

  constructor(reason: RunCodeError) {
    super(reason);
    this.name = "RunCodeFailure";
    this.reason = reason;
  }
}

/** Accumulates the body's bytes, with varints for the numbers. */
class Writer {
  private readonly out: number[] = [];

  byte(value: number): void {
    this.out.push(value & 0xff);
  }

  varint(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError("Run values must be whole, non-negative numbers.");
    }
    let rest = value;
    while (rest >= 0x80) {
      this.out.push((rest % 0x80) | 0x80);
      rest = Math.floor(rest / 0x80);
    }
    this.out.push(rest);
  }

  bytes(): number[] {
    return this.out;
  }
}

/** Reads the body back; running off the end is a damaged code. */
class Reader {
  private pos = 0;
  private readonly data: readonly number[];

  constructor(data: readonly number[]) {
    this.data = data;
  }

  byte(): number {
    const value = this.data[this.pos];
    if (value === undefined) throw new RunCodeFailure("damaged");
    this.pos += 1;
    return value;
  }

  /** Reads a varint. Only the minimal encoding is accepted, so one value has one byte form. */
  varint(): number {
    let result = 0;
    let scale = 1;
    for (let i = 0; i < 6; i++) {
      const value = this.byte();
      result += (value & 0x7f) * scale;
      if ((value & 0x80) === 0) {
        // A last byte of zero after a continuation pads the number.
        if (i > 0 && value === 0) throw new RunCodeFailure("damaged");
        return result;
      }
      scale *= 0x80;
    }
    throw new RunCodeFailure("damaged");
  }

  done(): boolean {
    return this.pos === this.data.length;
  }
}

/** FNV-1a over the first `end` bytes, as an unsigned 32-bit number. */
function fnv1a(bytes: readonly number[], end: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < end; i++) {
    hash ^= bytes[i] ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Base64url without padding. */
function toBase64Url(bytes: readonly number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

/** Decodes base64url, or null for any character outside the alphabet. */
function fromBase64Url(text: string): number[] | null {
  if (text.length % 4 === 1) return null;
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of text) {
    const value = B64.indexOf(ch);
    if (value < 0) return null;
    buffer = ((buffer << 6) | value) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

/** Picks an enum by its code, refusing a code that names nothing. */
function pick<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new RunCodeFailure("damaged");
  return value;
}

/**
 * The 36 button combinations, one per number, and the same 36 again while
 * interact is held down (a floor drop needs the hold, ADR 0060 amendment).
 */
const BUTTON_CODES = 36;

/** The 72 input combinations one person can make in a tick. */
function playerCode(input: PlayerInput): number {
  for (const move of [input.moveX, input.moveY]) {
    if (move !== -1 && move !== 0 && move !== 1) {
      throw new RangeError("Moves must be -1, 0 or 1.");
    }
  }
  return (
    (input.moveX + 1) * 12 +
    (input.moveY + 1) * 4 +
    (input.interact ? 2 : 0) +
    (input.work ? 1 : 0) +
    (input.interactHeld ? BUTTON_CODES : 0)
  );
}

function inputFromCode(code: number): PlayerInput {
  const held = code >= BUTTON_CODES;
  const buttons = code % BUTTON_CODES;
  const rest = buttons % 12;
  const bits = rest % 4;
  return {
    moveX: Math.floor(buttons / 12) - 1,
    moveY: Math.floor(rest / 4) - 1,
    interact: (bits & 2) !== 0,
    interactHeld: held,
    work: (bits & 1) !== 0,
  };
}

/** 0 for no decision; stay 1, leave 2, then break with each commitment. */
function decisionCode(decision: PresenceDecision | undefined): number {
  if (!decision) return 0;
  if (decision.choice === "stay" && !decision.commitment) return 1;
  if (decision.choice === "leave" && !decision.commitment) return 2;
  if (decision.choice === "break" && decision.commitment) {
    const index = COMMITMENT_ORDER.indexOf(decision.commitment);
    if (index >= 0) return 3 + index;
  }
  throw new RangeError("That brothers decision cannot be shared.");
}

function decisionFromCode(code: number): PresenceDecision | undefined {
  if (code === 0) return undefined;
  if (code === 1) return { choice: "stay", commitment: null };
  if (code === 2) return { choice: "leave", commitment: null };
  return { choice: "break", commitment: pick(COMMITMENT_ORDER, code - 3) };
}

/** One frame as a single number: both inputs, the assisted person, a decision. */
function symbolOf(frame: Frame): number {
  const assisted =
    frame.assisted === undefined ? 0 : frame.assisted === "fred" ? 1 : 2;
  const inputs =
    playerCode(frame.inputs.fred) * PLAYER_CODES +
    playerCode(frame.inputs.abbi);
  return inputs * EXTRA_CODES + assisted * 7 + decisionCode(frame.decision);
}

function frameFromSymbol(symbol: number): Frame {
  const extra = symbol % EXTRA_CODES;
  const inputs = Math.floor(symbol / EXTRA_CODES);
  if (inputs >= PLAYER_CODES * PLAYER_CODES) {
    throw new RunCodeFailure("damaged");
  }
  const assistedCode = Math.floor(extra / 7);
  const assisted: PlayerId | undefined =
    assistedCode === 0 ? undefined : assistedCode === 1 ? "fred" : "abbi";
  const decision = decisionFromCode(extra % 7);
  return {
    inputs: {
      fred: inputFromCode(Math.floor(inputs / PLAYER_CODES)),
      abbi: inputFromCode(inputs % PLAYER_CODES),
    },
    ...(assisted ? { assisted } : {}),
    ...(decision ? { decision } : {}),
  };
}

function writeSetup(w: Writer, setup: Setup): void {
  const check = validateSetup(setup);
  if (!check.ok) throw new RangeError(check.reason);
  w.byte(
    (setup.relaxed ? 1 : 0) |
      (setup.assist ? 2 : 0) |
      (setup.cart.lanterns ? 4 : 0)
  );
  w.byte(ROSE_ORDER.indexOf(setup.cart.roses));
  w.byte(FOOD_ORDER.indexOf(setup.cart.food));
  w.varint(setup.seed ?? 0);
  w.byte(setup.capabilities.length);
  for (const id of setup.capabilities) {
    w.byte(CAPABILITY_ORDER.indexOf(id));
  }
}

function readSetup(r: Reader): Setup {
  const flags = r.byte();
  if (flags > 7) throw new RunCodeFailure("damaged");
  const roses = pick(ROSE_ORDER, r.byte());
  const food = pick(FOOD_ORDER, r.byte());
  const seed = r.varint();
  const count = r.byte();
  if (count > CAPABILITY_ORDER.length) throw new RunCodeFailure("damaged");
  const capabilities: CapabilityId[] = [];
  for (let i = 0; i < count; i++) {
    capabilities.push(pick(CAPABILITY_ORDER, r.byte()));
  }
  const setup: Setup = {
    capabilities,
    cart: { roses, food, lanterns: (flags & 4) !== 0 },
    relaxed: (flags & 1) !== 0,
    assist: (flags & 2) !== 0,
    seed,
  };
  if (!validateSetup(setup).ok) throw new RunCodeFailure("invalid-setup");
  return setup;
}

/** Run-length encodes identical consecutive frames: symbol, then count. */
function writeFrames(w: Writer, frames: readonly Frame[]): void {
  if (frames.length > MAX_RUN_TICKS) {
    throw new RangeError("The run is too long to share.");
  }
  const runs: { symbol: number; length: number }[] = [];
  for (const frame of frames) {
    const symbol = symbolOf(frame);
    const last = runs[runs.length - 1];
    if (last && last.symbol === symbol) {
      last.length += 1;
    } else {
      runs.push({ symbol, length: 1 });
    }
  }
  w.varint(runs.length);
  for (const run of runs) {
    w.varint(run.symbol);
    w.varint(run.length);
  }
}

function readFrames(r: Reader): Frame[] {
  const runCount = r.varint();
  if (runCount > MAX_RUN_TICKS) throw new RunCodeFailure("too-long");
  const frames: Frame[] = [];
  let previous: number | null = null;
  for (let i = 0; i < runCount; i++) {
    const symbol = r.varint();
    const length = r.varint();
    if (length < 1) throw new RunCodeFailure("damaged");
    // The encoder merges identical neighbours, so two in a row are not canonical.
    if (symbol === previous) throw new RunCodeFailure("damaged");
    previous = symbol;
    if (frames.length + length > MAX_RUN_TICKS) {
      throw new RunCodeFailure("too-long");
    }
    const frame = frameFromSymbol(symbol);
    for (let tick = 0; tick < length; tick++) frames.push(frame);
  }
  return frames;
}

function writeResult(w: Writer, result: RunResult): void {
  w.varint(result.placements);
  w.varint(result.finishedMs === null ? 0 : result.finishedMs + 1);
  w.varint(result.endMs);
}

function readResult(r: Reader): RunResult {
  const placements = r.varint();
  const finished = r.varint();
  const endMs = r.varint();
  return {
    placements,
    finishedMs: finished === 0 ? null : finished - 1,
    endMs,
  };
}

/** The result a finished state reports: the numbers a code carries. */
export function runResultOf(state: GameState): RunResult {
  return {
    placements: state.targets.reduce((sum, t) => sum + t.filled.length, 0),
    finishedMs:
      state.finishedAt === null ? null : Math.round(state.finishedAt * 1000),
    endMs: Math.round(state.time * 1000),
  };
}

/**
 * Encodes a run as a `f1.` code. Throws a RangeError only for a run the game
 * could never have produced (an invalid setup or an unsupported frame), so the
 * caller can decide not to offer a code.
 */
export function encodeRunCode(run: SharedRun): string {
  const w = new Writer();
  writeSetup(w, run.setup);
  writeFrames(w, run.frames);
  writeResult(w, run.result);
  const body = w.bytes();
  const sum = fnv1a(body, body.length);
  const bytes = [
    ...body,
    (sum >>> 24) & 0xff,
    (sum >>> 16) & 0xff,
    (sum >>> 8) & 0xff,
    sum & 0xff,
  ];
  const code = RUN_CODE_PREFIX + toBase64Url(bytes);
  if (code.length > MAX_RUN_CODE_LENGTH) {
    throw new RangeError("The run is too long to share.");
  }
  return code;
}

function parseRunCode(code: unknown): SharedRun {
  if (typeof code !== "string") throw new RunCodeFailure("damaged");
  if (code.length > MAX_RUN_CODE_LENGTH) throw new RunCodeFailure("too-long");
  if (!code.startsWith(RUN_CODE_PREFIX)) {
    throw new RunCodeFailure(
      VERSION_PATTERN.test(code) ? "version" : "damaged"
    );
  }
  const text = code.slice(RUN_CODE_PREFIX.length);
  const bytes = fromBase64Url(text);
  // Re-encoding must give back the same text, which rejects stray padding bits.
  if (!bytes || bytes.length < 5 || toBase64Url(bytes) !== text) {
    throw new RunCodeFailure("damaged");
  }
  const end = bytes.length - 4;
  const stored =
    (bytes[end] ?? 0) * 0x1000000 +
    ((bytes[end + 1] ?? 0) << 16) +
    ((bytes[end + 2] ?? 0) << 8) +
    (bytes[end + 3] ?? 0);
  if (fnv1a(bytes, end) !== stored) throw new RunCodeFailure("damaged");
  const reader = new Reader(bytes.slice(0, end));
  const setup = readSetup(reader);
  const frames = readFrames(reader);
  const result = readResult(reader);
  if (!reader.done()) throw new RunCodeFailure("damaged");
  return { setup, frames, result };
}

/**
 * Decodes a run code. Never throws: a code that is not a valid run, whatever
 * its input type, comes back as a refusal with a reason and the shared message.
 */
export function decodeRunCode(code: unknown): RunCodeResult {
  try {
    return { ok: true, run: parseRunCode(code) };
  } catch (error) {
    const reason =
      error instanceof RunCodeFailure ? error.reason : ("damaged" as const);
    return { ok: false, reason, message: RUN_CODE_REFUSAL };
  }
}

/**
 * Replays a run strictly and checks the replay reproduces its own result. A
 * strict replay refuses the first decision that does not fit the state.
 */
export function verifyRun(run: SharedRun): RunVerification {
  try {
    const { state } = replayLevel(run.setup, run.frames, { mode: "strict" });
    const actual = runResultOf(state);
    const same =
      actual.placements === run.result.placements &&
      actual.finishedMs === run.result.finishedMs &&
      actual.endMs === run.result.endMs;
    return same
      ? { ok: true, state }
      : { ok: false, message: RUN_REPLAY_REFUSAL };
  } catch {
    return { ok: false, message: RUN_REPLAY_REFUSAL };
  }
}

/** The run code in a `#run=` fragment, or null when the fragment has none. */
export function runCodeFromHash(hash: string): string | null {
  return hash.startsWith(HASH_PREFIX) ? hash.slice(HASH_PREFIX.length) : null;
}

/** The link that opens a run: the page's address with the code as its fragment. */
export function runLinkFor(pageUrl: string, code: string): string {
  return `${pageUrl}${HASH_PREFIX}${code}`;
}
