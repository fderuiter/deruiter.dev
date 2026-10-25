/**
 * Clinical Data Platform: seeded synthetic portfolio types.
 */

/** Options for generating a portfolio. */
export interface PortfolioOptions {
  /** Seed: an integer from 0 to 4294967295. The same seed gives the same portfolio. */
  readonly seed: number;
}
