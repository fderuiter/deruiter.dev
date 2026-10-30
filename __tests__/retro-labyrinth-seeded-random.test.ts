// @vitest-environment node
import { describe, expect, it } from "vitest";
import { installSeededRandom } from "./e2e/helpers/seeded-random";
import { createRunSeed } from "@/lib/dungeon";

/**
 * The seeded randomness the Retro Labyrinth walk installs in the page (#3463).
 * It replaces `Math.random` and `crypto.getRandomValues` on the global it is
 * given, so one seed gives one run seed and one patrol sequence.
 */

function fakeGlobal() {
  return {
    Math: { random: () => 0.5 },
    crypto: { getRandomValues: undefined as unknown },
  };
}

function draw(seed: number) {
  const g = fakeGlobal();
  installSeededRandom(seed, g);
  const getRandomValues = g.crypto.getRandomValues as (
    a: Uint32Array
  ) => Uint32Array;
  return {
    randoms: Array.from({ length: 5 }, () => g.Math.random()),
    words: Array.from(getRandomValues(new Uint32Array(3))),
  };
}

describe("installSeededRandom", () => {
  it("gives the same sequence for the same seed", () => {
    expect(draw(3463)).toEqual(draw(3463));
  });

  it("gives a different sequence for another seed", () => {
    expect(draw(3463).randoms).not.toEqual(draw(2032).randoms);
  });

  it("keeps Math.random in [0, 1)", () => {
    for (const value of draw(7).randoms) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("fills every byte of the typed array it is given, and returns it", () => {
    const g = fakeGlobal();
    installSeededRandom(1, g);
    const fill = g.crypto.getRandomValues as (a: Uint8Array) => Uint8Array;
    const array = new Uint8Array(64);
    expect(fill(array)).toBe(array);
    expect(new Set(array).size).toBeGreaterThan(16);
  });

  it("makes createRunSeed draw the same run seed", () => {
    const seeds = [3463, 3463].map((seed) => {
      const g = fakeGlobal();
      installSeededRandom(seed, g);
      const fill = g.crypto.getRandomValues as (a: Uint32Array) => Uint32Array;
      return createRunSeed(fill(new Uint32Array(1))[0]);
    });
    expect(seeds[0]).toBe(seeds[1]);
  });

  it("leaves a global without crypto with only Math.random replaced", () => {
    const g = { Math: { random: () => 0.5 } };
    installSeededRandom(5, g);
    expect(g.Math.random()).not.toBe(0.5);
  });
});
