import { readFileSync } from "fs";
import { join } from "path";

/**
 * Names `prisma/seed.ts` imports from `lib/case-studies-data` and references
 * inside SEED_PAYLOADS. They are stubbed with empty objects when the array is
 * evaluated; they only feed `commands_json` / `playback_json`.
 */
const SEED_PAYLOAD_STUB_NAMES = [
  "IMEDNET_COMMANDS_OBJ",
  "IMEDNET_PLAYBACK_OBJ",
  "DUCKDEPLOY_COMMANDS_OBJ",
  "DUCKDEPLOY_PLAYBACK_OBJ",
  "CARDIAC_RISK_COMMANDS_OBJ",
  "CARDIAC_RISK_PLAYBACK_OBJ",
  "FOUR_GLORY_COMMANDS_OBJ",
  "FOUR_GLORY_PLAYBACK_OBJ",
  "CRF_XL_COMMANDS_OBJ",
  "CRF_XL_PLAYBACK_OBJ",
  "PROMPTOPS_COMMANDS_OBJ",
  "PROMPTOPS_PLAYBACK_OBJ",
];

/** Reads `prisma/seed.ts` from the workspace root. */
export function readSeedSource(): string {
  return readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf-8");
}

/**
 * Extracts the SEED_PAYLOADS array literal from `prisma/seed.ts` and evaluates
 * it in isolation.
 *
 * Importing the module is not an option: `prisma/seed.ts` calls `main()` at
 * import time and would connect to, and write to, whatever database the
 * environment points at. The array is located by bracket matching instead.
 */
export function loadSeedPayloads(
  source: string = readSeedSource()
): Array<Record<string, string>> {
  const start = source.indexOf("const SEED_PAYLOADS");
  if (start === -1) {
    throw new Error("SEED_PAYLOADS should be declared in prisma/seed.ts");
  }

  const open = source.indexOf("[", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "[") depth++;
    else if (source[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end <= open) {
    throw new Error("SEED_PAYLOADS array should be bracket-balanced");
  }

  const factory = new Function(
    ...SEED_PAYLOAD_STUB_NAMES,
    `return ${source.slice(open, end + 1)}`
  );
  return factory(...SEED_PAYLOAD_STUB_NAMES.map(() => ({})));
}
