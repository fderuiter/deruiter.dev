/**
 * Public entry point for the unified secret-scanning module.
 *
 * This module owns the single catalog of secret detectors consumed by every
 * scanning entrypoint in the repository (DX Doctor's repo scan, the
 * pre-commit staged-file guard, and the reachable-history/pickaxe audit),
 * plus the allowlisting, redaction, and fixture data that keep those
 * entrypoints from drifting apart. See `lib/README.md` for the deep-module
 * boundary rules: only this file and `types.ts` are public; `internal/*`
 * is private to this package.
 */

export * from "./types";
export { SECRET_DETECTORS } from "./internal/catalog";
export { SECRET_DETECTOR_FIXTURES } from "./internal/fixtures";
export { isAllowlistedSecretValue } from "./internal/allowlist";
export { formatFinding } from "./internal/redact";
export {
  getDetectorsForSurface,
  scanFile,
  scanHistorySnapshot,
  scanText,
  shouldScanFile,
} from "./internal/scan";

import { SECRET_DETECTORS } from "./internal/catalog";

/** The stable identifier of every detector in `SECRET_DETECTORS`. */
export type SecretDetectorId = (typeof SECRET_DETECTORS)[number]["id"];
