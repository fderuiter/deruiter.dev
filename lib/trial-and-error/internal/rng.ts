/**
 * The game's only source of randomness (ADR 0046): a counter-based PRNG.
 * The value at a draw index is a pure function of the run seed and that
 * index, so there is no hidden generator state to carry or restore. The
 * same seed and the same draws always give the same numbers.
 */

export { drawInt, fnv1a, mulberry32, uniformAt } from "../../utils/prng";
