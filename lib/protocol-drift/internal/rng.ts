/**
 * Seeded, counter-free randomness. Each draw is keyed by a stable string
 * (site, subject, visit, field, opportunity), so editing one site's inputs
 * never rerolls another site's behaviour.
 */

/** A 32-bit FNV-1a hash of a string. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** One Mulberry32 step: mixes a 32-bit state into a well-spread output. */
export function mulberry32(state: number): number {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** A uniform value in [0, 1) for a seed and a stable draw key. */
export function seededDraw(seed: number, key: string): number {
  return mulberry32(fnv1a(`${seed}|${key}`)) / 0x100000000;
}

/** A stable hex digest of any JSON-serializable value. */
export function hashValue(value: unknown): string {
  const text = JSON.stringify(value);
  const a = fnv1a(text);
  const b = fnv1a(`${text.length}:${text}`);
  return `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
}
