import { uniformAt } from "./rng";

/**
 * Shareable run seeds (#949, #1528). A seed is eight Crockford base32
 * characters shown as `XXXX-XXXX`: 40 bits, easy to read aloud and to type,
 * with no I, L, O or U to confuse. Parsing forgives case, spaces, hyphens
 * and the usual look-alikes. Named seeds such as `fold-change` predate the
 * codec and still replay, so old saves and links keep working.
 */

/** Crockford's base32 alphabet. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const SEED_CHARS = 8;
/** A named seed from before the codec: letters, digits and hyphens. */
const LEGACY_SEED = /^[A-Za-z0-9-]{1,32}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** How a run's seed was chosen, for the end screen and run history. */
export type RunOrigin =
  | { kind: "RANDOM" }
  /** Typed in, or opened from a challenge link. */
  | { kind: "SEEDED" }
  /** The Daily Protocol for a UTC date, `YYYY-MM-DD`. */
  | { kind: "DAILY"; date: string };

/** Eight base32 digits, grouped as `XXXX-XXXX`. */
function format(digits: string): string {
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

/**
 * The seed for 40 bits of entropy, given as five bytes (extra bytes are
 * ignored). The browser draws the bytes; the domain never draws one itself.
 */
export function seedFromBytes(bytes: ArrayLike<number>): string {
  if (bytes.length < 5) {
    throw new RangeError(`seedFromBytes needs 5 bytes, got ${bytes.length}`);
  }
  // 40 bits as eight 5-bit digits, most significant first. 40 bits fit a
  // double exactly, so plain arithmetic is safe.
  let bits = 0;
  for (let i = 0; i < 5; i += 1) bits = bits * 256 + (bytes[i] & 0xff);
  let digits = "";
  for (let i = SEED_CHARS - 1; i >= 0; i -= 1) {
    digits += ALPHABET[Math.floor(bits / 32 ** i) % 32];
  }
  return format(digits);
}

/**
 * A codec seed in its canonical `XXXX-XXXX` form, or null when `input` is
 * not eight base32 characters. Case, spaces and hyphens are ignored, and
 * I and L read as 1, O as 0.
 */
export function normalizeSeed(input: string): string | null {
  const compact = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
  if (compact.length !== SEED_CHARS) return null;
  for (const char of compact) if (!ALPHABET.includes(char)) return null;
  return format(compact);
}

/**
 * The seed a player or a link asked for: a codec seed in canonical form, a
 * named seed from before the codec as it was written, or null when neither.
 */
export function parseSeed(input: string): string | null {
  const trimmed = input.trim();
  return normalizeSeed(trimmed) ?? (LEGACY_SEED.test(trimmed) ? trimmed : null);
}

/** True for a real calendar date written `YYYY-MM-DD`. */
export function isIsoDate(date: string): boolean {
  const match = ISO_DATE.exec(date);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const time = Date.UTC(year, month - 1, day);
  return new Date(time).toISOString().slice(0, 10) === date;
}

/** The UTC calendar date of an instant, `YYYY-MM-DD`. */
export function utcDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/**
 * The Daily Protocol seed for a UTC date, `YYYY-MM-DD`. Everyone playing on
 * the same UTC day gets the same seed, wherever they are. Pure: it takes the
 * date and never reads the clock. Throws on anything but a real date.
 */
export function dailySeed(isoDate: string): string {
  if (!isIsoDate(isoDate)) {
    throw new RangeError(`dailySeed needs a YYYY-MM-DD date, got ${isoDate}`);
  }
  const bytes = Array.from({ length: 5 }, (_, i) =>
    Math.floor(uniformAt(`daily-protocol:${isoDate}`, i) * 256)
  );
  return seedFromBytes(bytes);
}

/** What a challenge link carries. */
export interface Challenge {
  seed: string;
  /** Set when the link is a Daily Protocol run, and only if the seed is that day's. */
  daily: string | null;
}

/**
 * The URL hash for a challenge link, e.g. `#seed=7K3M-Q9PX`, with
 * `&daily=2026-09-30` for a Daily Protocol run.
 */
export function challengeHash(seed: string, origin: RunOrigin): string {
  const params = new URLSearchParams({ seed });
  if (origin.kind === "DAILY") params.set("daily", origin.date);
  return `#${params.toString()}`;
}

/**
 * The challenge in a URL hash, or null when it names no valid seed. Unknown
 * parameters are ignored, so later links can add more. A `daily` date is
 * kept only when the seed really is that day's Daily Protocol, so a link
 * cannot pass another seed off as one.
 */
export function parseChallengeHash(hash: string): Challenge | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const raw = params.get("seed");
  const seed = raw === null ? null : parseSeed(raw);
  if (!seed) return null;
  const date = params.get("daily");
  const daily =
    date !== null && isIsoDate(date) && dailySeed(date) === seed ? date : null;
  return { seed, daily };
}

/** The origin a challenge's run should record. */
export function challengeOrigin(challenge: Challenge): RunOrigin {
  return challenge.daily
    ? { kind: "DAILY", date: challenge.daily }
    : { kind: "SEEDED" };
}
