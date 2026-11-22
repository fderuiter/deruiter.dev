import {
  SEED_MAX_LENGTH,
  type DerivedSeedComponents,
  type EntropySource,
  type PrngStream,
  type RandomizationStreams,
  type SeedValidationResult,
  type ValidationFinding,
} from "../../types";
import { createMt19937Stream } from "./mt19937";
import { sha256BytesHex } from "./sha256";

const ASCII_ALPHANUMERIC_SEED = /^[A-Za-z0-9]+$/;
const HEX_32_SEED = /^[0-9a-fA-F]{32}$/;
const FNV1A_OFFSET = 2166136261 >>> 0;
const FNV1A_PRIME = 16777619;
const SEED_MODULO = 2147483647;

function asciiToBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    bytes[i] = text.charCodeAt(i);
  }
  return bytes;
}

function fnv1aHexToUint31(hex32: string): number {
  let hash = FNV1A_OFFSET;
  for (let i = 0; i < hex32.length; i += 1) {
    hash ^= hex32.charCodeAt(i);
    hash = Math.imul(hash, FNV1A_PRIME) >>> 0;
  }
  return hash % SEED_MODULO;
}

/**
 * Validates that a user-supplied or persisted seed is 1 to 128 ASCII letters
 * or digits (`[A-Za-z0-9]`).
 */
export function validateSeedValue(seed: string): SeedValidationResult {
  const findings: ValidationFinding[] = [];
  if (seed.length === 0 || seed.length > SEED_MAX_LENGTH) {
    findings.push({
      code: "INVALID_SEED",
      severity: "error",
      fieldPath: "seed.value",
      message: `Seed must be between 1 and ${SEED_MAX_LENGTH} ASCII alphanumeric characters.`,
    });
  } else if (!ASCII_ALPHANUMERIC_SEED.test(seed)) {
    findings.push({
      code: "INVALID_SEED",
      severity: "error",
      fieldPath: "seed.value",
      message:
        "Seed may contain only ASCII letters and digits (A-Z, a-z, 0-9).",
    });
  }

  return {
    ok: findings.length === 0,
    findings,
  };
}

/**
 * Generates a 32-character lowercase hexadecimal seed from four cryptographic
 * uint32 values. Accepts an optional entropy source for deterministic tests.
 */
export function generateRandomSeed(
  entropy: EntropySource = (buffer) => globalThis.crypto.getRandomValues(buffer)
): string {
  const words = new Uint32Array(4);
  entropy(words);
  return Array.from(words, (word) =>
    (word >>> 0).toString(16).padStart(8, "0")
  ).join("");
}

/**
 * Derives the 32-char lowercase hex seed and FNV-1a 31-bit numeric seed from
 * a validated ASCII alphanumeric seed.
 */
export function deriveSeedComponents(seed: string): DerivedSeedComponents {
  const validation = validateSeedValue(seed);
  if (!validation.ok) {
    throw new Error(validation.findings[0].message);
  }

  const compressedHex = HEX_32_SEED.test(seed)
    ? seed.toLowerCase()
    : sha256BytesHex(asciiToBytes(seed)).slice(0, 32);

  return Object.freeze({
    seed,
    compressedHex,
    numericSeed: fnv1aHexToUint31(compressedHex),
  });
}

/**
 * Creates domain-separated MT19937 allocation and identifier PRNG streams.
 * The identifier stream is seeded from `${seed}-id` so identifier mask changes
 * never perturb treatment allocations.
 */
export function createRandomizationStreams(seed: string): RandomizationStreams {
  const allocationSeed = deriveSeedComponents(seed);
  const identifierHex = sha256BytesHex(asciiToBytes(`${seed}-id`)).slice(0, 32);
  const identifierNumericSeed = fnv1aHexToUint31(identifierHex);

  return Object.freeze({
    allocationSeed,
    identifierNumericSeed,
    allocation: createMt19937Stream(allocationSeed.numericSeed),
    identifier: createMt19937Stream(identifierNumericSeed),
  });
}

/**
 * Creates the MT19937 stream that samples sites and profiles for a
 * minimization virtual cohort (#4002), seeded from `${seed}-cohort`. Keeping
 * it apart from the allocation stream means replaying the same profiles
 * through a session reproduces the same arms.
 */
export function createCohortStream(seed: string): PrngStream {
  deriveSeedComponents(seed); // validates the seed
  const cohortHex = sha256BytesHex(asciiToBytes(`${seed}-cohort`)).slice(0, 32);
  return createMt19937Stream(fnv1aHexToUint31(cohortHex));
}
