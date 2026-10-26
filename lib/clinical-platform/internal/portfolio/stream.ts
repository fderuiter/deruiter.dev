/**
 * Seeded draw streams for the portfolio generator, read from the shared
 * counter-based PRNG in `lib/utils/prng`.
 *
 * Each stream is keyed by the seed and a label (a study and a feed), and
 * draw `i` of a stream is `uniformAt(key, i)`. The draws one feed makes
 * never shift another feed's draws, so adding a field to the eTMF feed
 * leaves the EDC feed byte-identical.
 */
import { uniformAt } from "@/lib/utils/prng";

/** A deterministic sequence of uniform draws for one seed and label. */
export class Stream {
  private readonly key: string;
  private index = 0;

  constructor(seed: number, label: string) {
    this.key = `portfolio:${seed}:${label}`;
  }

  /** The next uniform draw in [0, 1). */
  next(): number {
    const value = uniformAt(this.key, this.index);
    this.index += 1;
    return value;
  }

  /** An integer in [min, max], both inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** A uniform real in [min, max). */
  real(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** `true` with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** One element of a non-empty list. */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** The index of a weight, drawn in proportion to the weights. */
  weighted(weights: readonly number[]): number {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let target = this.next() * total;
    for (let i = 0; i < weights.length; i += 1) {
      target -= weights[i];
      if (target < 0) return i;
    }
    return weights.length - 1;
  }

  /** An exponential draw with the given mean, rounded down to an integer. */
  expInt(mean: number): number {
    return Math.floor(-Math.log(1 - this.next()) * mean);
  }

  /**
   * A normal draw with the given mean and standard deviation (Box-Muller,
   * two uniform draws per call, the sine half discarded).
   */
  normal(mean: number, sd: number): number {
    const radius = Math.sqrt(-2 * Math.log(1 - this.next()));
    return mean + sd * radius * Math.cos(2 * Math.PI * this.next());
  }

  /** A Poisson count with the given mean (Knuth's method, for small means). */
  poisson(mean: number): number {
    const limit = Math.exp(-mean);
    let product = this.next();
    let count = 0;
    while (product > limit) {
      count += 1;
      product *= this.next();
    }
    return count;
  }

  /** A shuffled copy of a list (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
