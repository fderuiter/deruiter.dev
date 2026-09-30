/**
 * Core PRNG utility module providing deterministic counter-based PRNG functions.
 */

/**
 * A 32-bit FNV-1a hash of a string.
 */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * One Mulberry32 step: mixes a 32-bit state into a well-spread 32-bit output.
 */
export function mulberry32(state: number): number {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/**
 * The uniform value in [0, 1) at `drawIndex` for `seed`. Throws RangeError
 * on a negative or fractional draw index.
 */
export function uniformAt(seed: string, drawIndex: number): number {
  if (!Number.isInteger(drawIndex) || drawIndex < 0) {
    throw new RangeError(
      `draw index must be a non-negative integer, got ${drawIndex}`
    );
  }
  return mulberry32(fnv1a(`${seed}#${drawIndex}`)) / 0x100000000;
}

/**
 * An integer in [0, bound) at `drawIndex` for `seed`. Throws RangeError on a
 * bound below 1, non-integer bound, or a negative or fractional draw index.
 */
export function drawInt(
  seed: string,
  drawIndex: number,
  bound: number
): number {
  if (!Number.isInteger(bound) || bound < 1) {
    throw new RangeError(
      `drawInt needs a positive integer bound, got ${bound}`
    );
  }
  if (!Number.isInteger(drawIndex) || drawIndex < 0) {
    throw new RangeError(
      `drawInt needs a non-negative integer draw index, got ${drawIndex}`
    );
  }
  return Math.floor(uniformAt(seed, drawIndex) * bound);
}
