/**
 * The only source of randomness in Study Director (ADR 0054): a counter-based
 * PRNG. The value at a draw index is a pure function of the run seed and that
 * index, so a saved run needs only its cursor to resume, and the same seed
 * and decisions always replay to the same study.
 */

export { drawInt, fnv1a, mulberry32, uniformAt } from "../../utils/prng";
