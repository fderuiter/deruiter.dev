import type { PrngStream } from "../../types";

const MT_N = 624;
const MT_M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;
const UINT32_MODULO = 4294967296;

/**
 * Standard 624-word Mersenne Twister (MT19937) with explicit uint32 overflow,
 * 397-offset twist, tempering, and float conversion via division by 2^32.
 * Internal state stays private inside the closure.
 */
export function createMt19937Stream(seedUint32: number): PrngStream {
  const mt = new Uint32Array(MT_N);
  let index = MT_N;

  mt[0] = seedUint32 >>> 0;
  for (let i = 1; i < MT_N; i += 1) {
    const prev = mt[i - 1];
    mt[i] = (Math.imul(1812433253, prev ^ (prev >>> 30)) + i) >>> 0;
  }

  function twist(): void {
    for (let i = 0; i < MT_N; i += 1) {
      const y = (mt[i] & UPPER_MASK) | (mt[(i + 1) % MT_N] & LOWER_MASK);
      mt[i] =
        (mt[(i + MT_M) % MT_N] ^ (y >>> 1) ^ ((y & 1) !== 0 ? MATRIX_A : 0)) >>>
        0;
    }
    index = 0;
  }

  function nextUint32(): number {
    if (index >= MT_N) {
      twist();
    }
    let y = mt[index];
    index += 1;

    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  function nextFloat(): number {
    return nextUint32() / UINT32_MODULO;
  }

  return Object.freeze({
    nextUint32,
    nextFloat,
  });
}
