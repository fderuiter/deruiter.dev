/**
 * Seeded randomness for a Playwright page (#3463). A Retro Labyrinth run takes
 * its seed from `crypto.getRandomValues` and its patrols' confused steps from
 * `Math.random`, so a walk that replaces both with one seeded generator draws
 * the same run every time. It is installed by the test with
 * `page.addInitScript(installSeededRandom, seed)`, so the application has no
 * switch for it and production cannot reach it.
 *
 * The function is serialised into the page, so it must not refer to anything
 * outside its own body.
 *
 * @param seed - Any 32-bit integer; the same seed gives the same sequence.
 * @param target - The global to patch: the page's `globalThis` in a browser.
 */
export function installSeededRandom(
  seed: number,
  target: {
    Math: { random: () => number };
    crypto?: { getRandomValues?: unknown };
  } = globalThis
): void {
  let state = seed >>> 0;
  const next = () => {
    // Numerical Recipes LCG: fast, full period, and plenty for a test.
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  };
  target.Math.random = () => next() / 4294967296;
  if (target.crypto) {
    target.crypto.getRandomValues = <T extends ArrayBufferView | null>(
      array: T
    ): T => {
      if (array) {
        const bytes = new Uint8Array(
          array.buffer,
          array.byteOffset,
          array.byteLength
        );
        for (let i = 0; i < bytes.length; i++) bytes[i] = next() >>> 24;
      }
      return array;
    };
  }
}
