/**
 * The only source of randomness in Study Director (ADR 0054): a counter-based
 * PRNG. The value at a draw index is a pure function of the run seed and that
 * index, so a saved run needs only its cursor to resume, and the same seed
 * and decisions always replay to the same study.
 */

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(state: number): number {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** The uniform value in [0, 1) at `drawIndex` for `seed`. */
export function uniformAt(seed: string, drawIndex: number): number {
  if (!Number.isInteger(drawIndex) || drawIndex < 0) {
    throw new RangeError(
      `draw index must be a non-negative integer: ${drawIndex}`
    );
  }
  return mulberry32(fnv1a(`${seed}#${drawIndex}`)) / 0x100000000;
}
