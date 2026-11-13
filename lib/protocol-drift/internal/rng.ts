/**
 * Seeded, counter-free randomness. Each draw is keyed by a stable string
 * (site, subject, visit, field, opportunity), so editing one site's inputs
 * never rerolls another site's behaviour.
 */

import { fnv1a, mulberry32 } from "../../utils/prng";

// One FNV-1a and one Mulberry32 serve every seeded module (#3479).
export { fnv1a, mulberry32 };

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
