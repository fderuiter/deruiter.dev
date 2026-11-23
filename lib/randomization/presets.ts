/**
 * Synthetic UI presets for the Randomization work area (#4006,
 * RND-WORKS-004 to RND-WORKS-007, ADR 0073).
 *
 * Three starting designs, Simple, Standard and Complex, for exploring the
 * engine without an imported study. They are the work area's presets, not
 * the domain preset registry, and every value in them is synthetic.
 *
 * The replacement contract: a preset owns every field of a
 * {@link RandomizationDesignDraft}. Applying one replaces the method and
 * algorithm, arms, sites, factors, caps, block or minimization settings
 * (with all site and intersection overrides), subject ID mask and
 * enrollment target together, and clears the seed, so no stale override or
 * incompatible method field survives. It never touches what sits outside
 * the draft: the study metadata (protocol ID, study name, phase), the use
 * acknowledgment, or the plan's name and state. A preset is exploration
 * input; moving it into an imported study is an explicit promotion step in
 * the work area, never a side effect of applying it.
 */

import { canonicalizeAuditValue } from "./internal/integrity/canonical-digest";
import { enumerateStratumIntersections } from "./internal/engines/caps";
import {
  MT19937_BLOCK_ALGORITHM_ID,
  type ArmSpec,
  type BlockCapConfig,
  type BlockSettings,
  type MinimizationCapConfig,
  type MinimizationSettings,
  type OptInRandomizationAlgorithmId,
  type SeedConfig,
  type SiteSpec,
  type StratificationFactorSpec,
  type SubjectIdMaskConfig,
} from "./types";

/** Identifiers of the work area's UI presets, in the order they are offered. */
export const RANDOMIZATION_PRESET_IDS = [
  "simple",
  "standard",
  "complex",
] as const;

/** One of the work area's UI presets. */
export type RandomizationPresetId = (typeof RANDOMIZATION_PRESET_IDS)[number];

/**
 * The outcome-affecting design the work area edits: an engine request
 * without its envelope (id, name, provenance). The seed is null until one
 * is typed or generated.
 */
export interface RandomizationDesignDraft {
  readonly method: "BLOCK" | "MINIMIZATION";
  readonly algorithmId: OptInRandomizationAlgorithmId;
  readonly arms: readonly ArmSpec[];
  readonly sites: readonly SiteSpec[];
  readonly factors: readonly StratificationFactorSpec[];
  readonly caps: BlockCapConfig | MinimizationCapConfig;
  readonly blockSettings?: BlockSettings;
  readonly minimizationSettings?: MinimizationSettings;
  readonly seed: SeedConfig | null;
  readonly subjectIdMask: SubjectIdMaskConfig;
  readonly enrollmentTarget: number;
}

/** Every draft field a preset replaces, in the order the stages show them. */
export const PRESET_REPLACED_FIELDS = [
  "method",
  "algorithmId",
  "arms",
  "sites",
  "factors",
  "blockSettings",
  "minimizationSettings",
  "caps",
  "seed",
  "subjectIdMask",
  "enrollmentTarget",
] as const satisfies readonly (keyof RandomizationDesignDraft)[];

/** A field a preset replaces. */
export type PresetReplacedField = (typeof PRESET_REPLACED_FIELDS)[number];

/** How a preset is described where it is offered. */
export interface RandomizationPresetSummary {
  readonly id: RandomizationPresetId;
  readonly title: string;
  readonly description: string;
}

/** Titles and one-line descriptions of the presets. */
export const RANDOMIZATION_PRESET_SUMMARIES: readonly RandomizationPresetSummary[] =
  Object.freeze([
    Object.freeze({
      id: "simple",
      title: "Simple",
      description:
        "Treatment and Control at 1:1, Site A and Site B, no factors, block sizes 2 and 4.",
    }),
    Object.freeze({
      id: "standard",
      title: "Standard",
      description:
        "Active and Placebo at 1:1, sites 101 to 103, stratified by age group, block sizes 4 and 6.",
    }),
    Object.freeze({
      id: "complex",
      title: "Complex",
      description:
        "High, Low and Placebo at 1:1:1, four sites, three two-level factors, block sizes 3, 6 and 9, and a random ID suffix.",
    }),
  ]);

function arm(id: string, code: string, label: string): ArmSpec {
  return { id, code, label, allocationRatio: 1 };
}

function site(id: string, code: string, label: string): SiteSpec {
  return { id, code, label, recruitmentWeight: 1 };
}

function factor(
  id: string,
  code: string,
  label: string,
  levels: readonly [string, string, string][]
): StratificationFactorSpec {
  return {
    id,
    code,
    label,
    levels: levels.map(([levelId, levelCode, levelLabel]) => ({
      id: levelId,
      code: levelCode,
      label: levelLabel,
    })),
  };
}

const AGE_LEVELS: readonly [string, string, string][] = [
  ["age-under-65", "LT65", "<65"],
  ["age-65-plus", "GE65", ">=65"],
];

/**
 * Builds a permuted-block draft whose manual per-site caps give every
 * intersection the same capacity, a multiple of every block size. Block
 * sizes are drawn at random, so the last block in a cell can still be cut
 * short by its cap; the presets allow that partial final block.
 */
function blockDraft(input: {
  arms: readonly ArmSpec[];
  sites: readonly SiteSpec[];
  factors: readonly StratificationFactorSpec[];
  sizes: readonly number[];
  capPerIntersection: number;
  mask: string;
}): RandomizationDesignDraft {
  const intersections = enumerateStratumIntersections(input.factors);
  return {
    method: "BLOCK",
    algorithmId: MT19937_BLOCK_ALGORITHM_ID,
    arms: input.arms,
    sites: input.sites,
    factors: input.factors,
    blockSettings: {
      defaultRule: { mode: "random-pool", sizes: [...input.sizes] },
      trackingScope: "per-intersection",
      allowPartialFinalBlock: true,
    },
    caps: {
      strategy: "manual",
      capScope: "per-site",
      intersectionCaps: intersections.map((intersection) => ({
        stratumKey: intersection.stratumKey,
        cap: input.capPerIntersection,
      })),
    },
    seed: null,
    subjectIdMask: { pattern: input.mask },
    enrollmentTarget:
      input.capPerIntersection * intersections.length * input.sites.length,
  };
}

const BUILDERS: Readonly<
  Record<RandomizationPresetId, () => RandomizationDesignDraft>
> = {
  simple: () =>
    blockDraft({
      arms: [
        arm("arm-treatment", "T", "Treatment"),
        arm("arm-control", "C", "Control"),
      ],
      sites: [site("site-a", "A", "Site A"), site("site-b", "B", "Site B")],
      factors: [],
      sizes: [2, 4],
      capPerIntersection: 8,
      mask: "{SITE}-{SEQ:3}",
    }),
  standard: () =>
    blockDraft({
      arms: [
        arm("arm-active", "A", "Active"),
        arm("arm-placebo", "P", "Placebo"),
      ],
      sites: [
        site("site-101", "101", "Site 101"),
        site("site-102", "102", "Site 102"),
        site("site-103", "103", "Site 103"),
      ],
      factors: [factor("factor-age-group", "AGEGR", "Age Group", AGE_LEVELS)],
      sizes: [4, 6],
      capPerIntersection: 12,
      mask: "{SITE}-{SEQ:3}",
    }),
  complex: () =>
    blockDraft({
      arms: [
        arm("arm-high", "H", "High dose"),
        arm("arm-low", "L", "Low dose"),
        arm("arm-placebo", "P", "Placebo"),
      ],
      sites: [
        site("site-us-01", "US-01", "US-01"),
        site("site-us-02", "US-02", "US-02"),
        site("site-uk-01", "UK-01", "UK-01"),
        site("site-de-01", "DE-01", "DE-01"),
      ],
      factors: [
        factor("factor-age", "AGE", "Age", AGE_LEVELS),
        factor("factor-gender", "GENDER", "Gender", [
          ["gender-female", "F", "Female"],
          ["gender-male", "M", "Male"],
        ]),
        factor("factor-region", "REGION", "Region", [
          ["region-north-america", "NA", "North America"],
          ["region-europe", "EU", "Europe"],
        ]),
      ],
      sizes: [3, 6, 9],
      capPerIntersection: 18,
      mask: "{SITE}-{SEQ:3}-{RND:4}",
    }),
};

/** Whether a value names one of the work area's presets. */
export function isRandomizationPresetId(
  value: unknown
): value is RandomizationPresetId {
  return (
    typeof value === "string" &&
    (RANDOMIZATION_PRESET_IDS as readonly string[]).includes(value)
  );
}

/**
 * Returns a fresh copy of a preset's draft. Callers may keep or edit the
 * copy; the preset itself never changes.
 */
export function createRandomizationPreset(
  id: RandomizationPresetId
): RandomizationDesignDraft {
  return structuredClone(BUILDERS[id]());
}

function sameValue(left: unknown, right: unknown): boolean {
  return (
    canonicalizeAuditValue(left ?? null) ===
    canonicalizeAuditValue(right ?? null)
  );
}

/**
 * Lists the fields of `current` that differ from `baseline`, the draft as
 * it was last loaded or saved. An empty list means applying a preset loses
 * nothing the person typed.
 */
export function findEditedDraftFields(
  current: RandomizationDesignDraft,
  baseline: RandomizationDesignDraft | null
): readonly PresetReplacedField[] {
  return PRESET_REPLACED_FIELDS.filter((field) =>
    baseline === null
      ? current[field] !== undefined && current[field] !== null
      : !sameValue(current[field], baseline[field])
  );
}

/** Outcome of {@link applyRandomizationPreset}. */
export type RandomizationPresetApplication =
  | {
      readonly status: "applied";
      readonly presetId: RandomizationPresetId;
      readonly draft: RandomizationDesignDraft;
    }
  | {
      readonly status: "needs-confirmation";
      readonly presetId: RandomizationPresetId;
      /** Edited fields the preset would replace. */
      readonly editedFields: readonly PresetReplacedField[];
    };

/**
 * Applies a preset under the replacement contract. When the current draft
 * holds edits (it differs from `baseline`), nothing is replaced until the
 * call is repeated with `confirmed: true`, so the work area can warn first.
 * A missing current draft applies at once.
 */
export function applyRandomizationPreset(input: {
  readonly presetId: RandomizationPresetId;
  readonly current: RandomizationDesignDraft | null;
  readonly baseline: RandomizationDesignDraft | null;
  readonly confirmed?: boolean;
}): RandomizationPresetApplication {
  if (input.current !== null && input.confirmed !== true) {
    const editedFields = findEditedDraftFields(input.current, input.baseline);
    if (editedFields.length > 0) {
      return {
        status: "needs-confirmation",
        presetId: input.presetId,
        editedFields,
      };
    }
  }
  return {
    status: "applied",
    presetId: input.presetId,
    draft: createRandomizationPreset(input.presetId),
  };
}
