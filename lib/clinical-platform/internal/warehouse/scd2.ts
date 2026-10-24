/**
 * Slowly changing dimension type 2: turns a member's dated attribute
 * changes into versions with half-open validity ranges.
 */
import { SCD2_OPEN_END } from "../../presets";
import type { Scd2Change, Scd2Version, WarehouseValue } from "../../types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Builds the versions of one dimension member. The first version starts on
 * `initial.effectiveOn` with `initial.attributes`. Each change takes effect
 * on its own day and opens a new version; changes on the same day merge into
 * one version, and a change that alters no value opens none. Each version
 * is in force from `validFrom` up to, not including, `validTo`; the last one
 * ends at `SCD2_OPEN_END` and is current.
 *
 * @param initial - First day the member exists, and its attributes then.
 * @param changes - Dated changes, in any order.
 * @returns Versions in date order, numbered from 1.
 * @throws RangeError when a date is not ISO 8601 or a change precedes the first day.
 */
export function buildScd2Versions(
  initial: Scd2Change,
  changes: readonly Scd2Change[]
): Scd2Version[] {
  for (const { effectiveOn } of [initial, ...changes]) {
    if (!ISO_DATE.test(effectiveOn)) {
      throw new RangeError(`"${effectiveOn}" is not an ISO 8601 date`);
    }
    if (effectiveOn < initial.effectiveOn) {
      throw new RangeError(
        `change on ${effectiveOn} precedes the first day ${initial.effectiveOn}`
      );
    }
  }
  // Stable sort keeps same-day changes in the order given, so the last wins.
  const ordered = [...changes].sort((a, b) =>
    a.effectiveOn < b.effectiveOn ? -1 : a.effectiveOn > b.effectiveOn ? 1 : 0
  );
  const drafts: {
    validFrom: string;
    attributes: Record<string, WarehouseValue>;
  }[] = [
    { validFrom: initial.effectiveOn, attributes: { ...initial.attributes } },
  ];
  for (const change of ordered) {
    const last = drafts[drafts.length - 1];
    const next = { ...last.attributes, ...change.attributes };
    const changed = Object.keys(next).some(
      (name) => next[name] !== last.attributes[name]
    );
    if (!changed) continue;
    if (change.effectiveOn === last.validFrom) {
      last.attributes = next;
    } else {
      drafts.push({ validFrom: change.effectiveOn, attributes: next });
    }
  }
  // A same-day merge can make two neighbours equal again; fold them.
  const merged: typeof drafts = [];
  for (const draft of drafts) {
    const previous = merged[merged.length - 1];
    const differs =
      previous === undefined ||
      Object.keys(draft.attributes).some(
        (name) => draft.attributes[name] !== previous.attributes[name]
      );
    if (differs) merged.push(draft);
  }
  return merged.map((draft, index) => ({
    version: index + 1,
    validFrom: draft.validFrom,
    validTo:
      index + 1 < merged.length ? merged[index + 1].validFrom : SCD2_OPEN_END,
    isCurrent: index + 1 === merged.length,
    attributes: draft.attributes,
  }));
}

/**
 * Finds the version in force on a day.
 *
 * @param versions - Versions from `buildScd2Versions`.
 * @param day - ISO 8601 date.
 * @returns The version whose range holds the day, or `undefined` before the first.
 */
export function versionOn<T extends Pick<Scd2Version, "validFrom" | "validTo">>(
  versions: readonly T[],
  day: string
): T | undefined {
  return versions.find((v) => v.validFrom <= day && day < v.validTo);
}
