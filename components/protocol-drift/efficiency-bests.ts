/**
 * Per-measure efficiency bests, remembered in this browser under
 * `protocol_drift_efficiency_bests`, beside the `protocol_drift_high_score`
 * key (#2054). Storage goes through `lib/safe-storage`, which checks that
 * `window.localStorage` and its methods exist before touching them; anything
 * unreadable or malformed reads as no bests, and a write that cannot be kept
 * is dropped, so a blocked browser still shows this run's debrief.
 */
import {
  EFFICIENCY_BESTS_STORAGE_KEY,
  parseEfficiencyBests,
  recordEfficiencyBests,
  serializeEfficiencyBests,
  type EfficiencyBests,
  type EfficiencyMetricId,
  type Scorecard,
} from "@/lib/protocol-drift";
import { safeRawStorage } from "@/lib/safe-storage";

/** What the debrief shows: the bests including this run, and what improved. */
export interface EfficiencyBestsRecord {
  bests: EfficiencyBests;
  improved: EfficiencyMetricId[];
}

/** The stored bests, or none when storage is empty, blocked or malformed. */
export function readEfficiencyBests(): EfficiencyBests {
  try {
    return parseEfficiencyBests(
      safeRawStorage.getItem(EFFICIENCY_BESTS_STORAGE_KEY)
    );
  } catch {
    return {};
  }
}

/** Folds a locked run into the stored bests and saves any improvement. */
export function saveEfficiencyBests(
  scorecard: Pick<Scorecard, "efficiency">
): EfficiencyBestsRecord {
  const before = readEfficiencyBests();
  const record = recordEfficiencyBests(before, scorecard);
  if (record.bests !== before) {
    try {
      safeRawStorage.setItem(
        EFFICIENCY_BESTS_STORAGE_KEY,
        serializeEfficiencyBests(record.bests)
      );
    } catch {
      // The bests are a convenience: this debrief still shows them.
    }
  }
  return record;
}
