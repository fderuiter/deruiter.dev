/**
 * Per-device lap bests for Monkey C Mayhem, kept in localStorage. Separate from
 * lib/garmin/splits.ts because the engine imports that module and the
 * standalone watch bundle cannot carry the storage layer's logger.
 */

import { normalizeBests, type GarminBests } from "./splits";
import { safeGetRawItem, safeSetRawItem } from "../safe-storage";

/** localStorage key holding the bests of every device, as one JSON object. */
export const SPLITS_STORAGE_KEY = "garmin_best_splits";

/** Every device's stored entry, or an empty object when storage is unreadable or not an object. */
function readAllBests(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(
      safeGetRawItem(SPLITS_STORAGE_KEY) ?? "null"
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Unreadable storage or JSON: treat as nothing saved.
  }
  return {};
}

/**
 * The storage key for a run's bests. Dev Mode runs keep their own bests, apart
 * from the fitness 5K, so a run with infinite lives never sets a race record.
 */
export function bestsKey(device: string, fitness: boolean): string {
  return fitness ? device : `${device}-dev`;
}

/**
 * Loads the bests for a device key. Corrupt JSON and wrong shapes are dropped,
 * and invalid split entries end the list early, so only the valid leading
 * splits are kept. Never throws.
 */
export function loadBests(device: string): GarminBests {
  try {
    const all = readAllBests();
    if (Object.prototype.hasOwnProperty.call(all, device)) {
      return normalizeBests(all[device]);
    }
  } catch {
    // Fall through to the empty bests.
  }
  return { splits: [] };
}

/**
 * Saves the bests for a device, keeping every other device's entry. Returns
 * whether the write reached storage. Never throws.
 */
export function saveBests(device: string, bests: GarminBests): boolean {
  try {
    const all = readAllBests();
    const next = { ...all, [device]: normalizeBests(bests) };
    return safeSetRawItem(SPLITS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
}
