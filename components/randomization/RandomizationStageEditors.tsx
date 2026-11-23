"use client";

import { useId, useState } from "react";
import {
  RANDOMIZATION_RESOURCE_LIMITS,
  enumerateStratumIntersections,
  generateRandomSeed,
  previewBlockComposition,
  previewSubjectIdMask,
  type BlockCapConfig,
  type BlockSettings,
  type ManualIntersectionCap,
  type MarginalLevelCap,
  type SiteSpec,
  type StratificationFactorSpec,
} from "@/lib/randomization";
import type { RandomizationDesignDraft } from "@/lib/randomization/presets";

/**
 * The editors for stages four to six of the Randomization work area
 * (#4006): sites and factors, mechanics, and caps. Each takes the current
 * draft and hands a whole new draft back, so the work area decides whether
 * it lands in the study workspace or in an exploration draft.
 */

/** Hands a whole new draft back to the work area. */
type Change = (next: RandomizationDesignDraft) => void;

export const BUTTON =
  "min-h-12 rounded border border-white/[0.08] bg-[#0d0e11] px-3 py-1.5 text-sm text-[#f4f4f6] hover:border-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";
export const FIELD =
  "min-h-12 min-w-0 rounded border border-white/[0.08] bg-[#0d0e11] px-2 py-1.5 text-sm text-[#f4f4f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400";
export const MONO = "font-[family-name:var(--font-geist-mono)]";

function move<T>(list: readonly T[], index: number, by: -1 | 1): T[] {
  const next = [...list];
  const target = index + by;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function nextId(prefix: string, used: readonly { id: string }[]): string {
  const ids = new Set(used.map((item) => item.id));
  let n = used.length + 1;
  while (ids.has(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

function toNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

/**
 * A text or number field that keeps what is typed and hands it back on
 * blur or Enter, so one edit is one change. It remounts when the saved
 * value changes, so undo shows the restored value.
 */
export function CommitField({
  label,
  value,
  onCommit,
  type = "text",
  inputMode,
  describedBy,
  invalid,
}: {
  readonly label: string;
  readonly value: string;
  readonly onCommit: (value: string) => void;
  readonly type?: "text" | "number";
  readonly inputMode?: "numeric" | "decimal";
  readonly describedBy?: string;
  readonly invalid?: boolean;
}) {
  return (
    <CommitInput
      key={value}
      label={label}
      value={value}
      onCommit={onCommit}
      type={type}
      inputMode={inputMode}
      describedBy={describedBy}
      invalid={invalid}
    />
  );
}

function CommitInput({
  label,
  value,
  onCommit,
  type,
  inputMode,
  describedBy,
  invalid,
}: {
  readonly label: string;
  readonly value: string;
  readonly onCommit: (value: string) => void;
  readonly type: "text" | "number";
  readonly inputMode?: "numeric" | "decimal";
  readonly describedBy?: string;
  readonly invalid?: boolean;
}) {
  const [text, setText] = useState(value);
  const commit = () => {
    if (text !== value) onCommit(text);
  };
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-300">
      {label}
      <input
        className={FIELD}
        type={type}
        inputMode={inputMode}
        value={text}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
    </label>
  );
}

function ReorderButtons({
  name,
  index,
  count,
  onMove,
  onRemove,
  removeDisabled,
}: {
  readonly name: string;
  readonly index: number;
  readonly count: number;
  readonly onMove: (by: -1 | 1) => void;
  readonly onRemove: () => void;
  readonly removeDisabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={`${BUTTON} min-w-12`}
        aria-label={`Move ${name} up`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        Up
      </button>
      <button
        type="button"
        className={`${BUTTON} min-w-12`}
        aria-label={`Move ${name} down`}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        Down
      </button>
      <button
        type="button"
        className={`${BUTTON} min-w-12`}
        aria-label={`Remove ${name}`}
        disabled={removeDisabled}
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
  );
}

/**
 * Drops caps, overrides and level caps that name a site, factor or level
 * the draft no longer has, so a removed site never leaves a stale rule.
 */
function pruneDependents(
  draft: RandomizationDesignDraft
): RandomizationDesignDraft {
  const siteIds = new Set(draft.sites.map((site) => site.id));
  const keys = new Set(
    enumerateStratumIntersections(draft.factors).map((i) => i.stratumKey)
  );
  const levels = new Set(
    draft.factors.flatMap((f) => f.levels.map((l) => `${f.id}\u0000${l.id}`))
  );
  const siteOk = (siteId?: string) =>
    siteId === undefined || siteIds.has(siteId);
  const caps = draft.caps;
  let nextCaps = caps;
  if (caps.strategy === "manual") {
    nextCaps = {
      ...caps,
      intersectionCaps: caps.intersectionCaps.filter(
        (cap) => keys.has(cap.stratumKey) && siteOk(cap.siteId)
      ),
    };
  } else if (caps.strategy === "marginal") {
    nextCaps = {
      ...caps,
      levelCaps: caps.levelCaps.filter(
        (cap) =>
          levels.has(`${cap.factorId}\u0000${cap.levelId}`) &&
          siteOk(cap.siteId)
      ),
    };
  }
  const block = draft.blockSettings;
  const blockSettings: BlockSettings | undefined = block && {
    ...block,
    ...(block.siteOverrides
      ? {
          siteOverrides: block.siteOverrides.filter((o) =>
            siteIds.has(o.siteId)
          ),
        }
      : {}),
    ...(block.intersectionOverrides
      ? {
          intersectionOverrides: block.intersectionOverrides.filter(
            (o) => keys.has(o.stratumKey) && siteOk(o.siteId)
          ),
        }
      : {}),
  };
  return {
    ...draft,
    caps: nextCaps,
    ...(blockSettings ? { blockSettings } : {}),
  };
}

/** Stage four: ordered sites with recruitment weights, and ordered factors. */
export function SitesFactorsStage({
  draft,
  onChange,
}: {
  readonly draft: RandomizationDesignDraft;
  readonly onChange: Change;
}) {
  const setSites = (sites: SiteSpec[]) =>
    onChange(pruneDependents({ ...draft, sites }));
  const setFactors = (factors: StratificationFactorSpec[]) =>
    onChange(pruneDependents({ ...draft, factors }));
  const intersections = enumerateStratumIntersections(draft.factors).length;
  const limits = RANDOMIZATION_RESOURCE_LIMITS;
  return (
    <div className="space-y-6">
      <fieldset className="min-w-0 space-y-3">
        <legend className="font-semibold">Sites</legend>
        <p className="text-sm text-slate-400">
          Sites and their recruitment weights are simulation assumptions, not
          facts of the study. Their order is part of the design.
        </p>
        <ol className="space-y-3">
          {draft.sites.map((site, index) => (
            <li
              key={site.id}
              className="grid min-w-0 gap-2 rounded border border-white/[0.08] p-3 @md:grid-cols-[1fr_1fr_8rem_auto]"
            >
              <CommitField
                label={`Site ${index + 1} code`}
                value={site.code}
                onCommit={(code) =>
                  setSites(
                    draft.sites.map((s, i) =>
                      i === index ? { ...s, code } : s
                    )
                  )
                }
              />
              <CommitField
                label={`Site ${index + 1} label`}
                value={site.label}
                onCommit={(label) =>
                  setSites(
                    draft.sites.map((s, i) =>
                      i === index ? { ...s, label } : s
                    )
                  )
                }
              />
              <CommitField
                label="Weight"
                type="number"
                inputMode="decimal"
                value={String(site.recruitmentWeight)}
                onCommit={(weight) =>
                  setSites(
                    draft.sites.map((s, i) =>
                      i === index
                        ? { ...s, recruitmentWeight: toNumber(weight) }
                        : s
                    )
                  )
                }
              />
              <ReorderButtons
                name={`site ${site.code || index + 1}`}
                index={index}
                count={draft.sites.length}
                onMove={(by) => setSites(move(draft.sites, index, by))}
                onRemove={() =>
                  setSites(draft.sites.filter((_, i) => i !== index))
                }
              />
            </li>
          ))}
        </ol>
        <button
          type="button"
          className={`${BUTTON} min-w-12`}
          disabled={draft.sites.length >= limits.maxSites}
          onClick={() => {
            const id = nextId("site", draft.sites);
            setSites([
              ...draft.sites,
              {
                id,
                code: `S${draft.sites.length + 1}`,
                label: `Site ${draft.sites.length + 1}`,
                recruitmentWeight: 1,
              },
            ]);
          }}
        >
          Add a site
        </button>
      </fieldset>

      <fieldset className="min-w-0 space-y-3">
        <legend className="font-semibold">Stratification factors</legend>
        <p className={`${MONO} text-xs text-slate-400`} aria-live="polite">
          {intersections} stratum intersection{intersections === 1 ? "" : "s"}
        </p>
        <ol className="space-y-3">
          {draft.factors.map((factor, index) => (
            <li
              key={factor.id}
              className="min-w-0 space-y-3 rounded border border-white/[0.08] p-3"
            >
              <div className="grid min-w-0 gap-2 @md:grid-cols-[1fr_1fr_auto]">
                <CommitField
                  label={`Factor ${index + 1} code`}
                  value={factor.code}
                  onCommit={(code) =>
                    setFactors(
                      draft.factors.map((f, i) =>
                        i === index ? { ...f, code } : f
                      )
                    )
                  }
                />
                <CommitField
                  label={`Factor ${index + 1} name`}
                  value={factor.label}
                  onCommit={(label) =>
                    setFactors(
                      draft.factors.map((f, i) =>
                        i === index ? { ...f, label } : f
                      )
                    )
                  }
                />
                <ReorderButtons
                  name={`factor ${factor.label || index + 1}`}
                  index={index}
                  count={draft.factors.length}
                  onMove={(by) => setFactors(move(draft.factors, index, by))}
                  onRemove={() =>
                    setFactors(draft.factors.filter((_, i) => i !== index))
                  }
                />
              </div>
              <LevelsEditor
                factor={factor}
                onChange={(next) =>
                  setFactors(
                    draft.factors.map((f, i) => (i === index ? next : f))
                  )
                }
              />
            </li>
          ))}
        </ol>
        <button
          type="button"
          className={`${BUTTON} min-w-12`}
          disabled={draft.factors.length >= limits.maxFactors}
          onClick={() => {
            const id = nextId("factor", draft.factors);
            setFactors([
              ...draft.factors,
              {
                id,
                code: `F${draft.factors.length + 1}`,
                label: `Factor ${draft.factors.length + 1}`,
                levels: [
                  { id: `${id}-level-1`, code: "L1", label: "Level 1" },
                  { id: `${id}-level-2`, code: "L2", label: "Level 2" },
                ],
              },
            ]);
          }}
        >
          Add a factor
        </button>
      </fieldset>
    </div>
  );
}

function LevelsEditor({
  factor,
  onChange,
}: {
  readonly factor: StratificationFactorSpec;
  readonly onChange: (next: StratificationFactorSpec) => void;
}) {
  const setLevels = (levels: StratificationFactorSpec["levels"]) =>
    onChange({ ...factor, levels });
  return (
    <div className="space-y-2 pl-0 @md:pl-4">
      <p className="text-sm text-slate-400">Levels, in order</p>
      <ol className="space-y-2">
        {factor.levels.map((level, index) => (
          <li
            key={level.id}
            className="grid min-w-0 gap-2 @md:grid-cols-[1fr_1fr_auto]"
          >
            <CommitField
              label={`${factor.label} level ${index + 1} code`}
              value={level.code}
              onCommit={(code) =>
                setLevels(
                  factor.levels.map((l, i) =>
                    i === index ? { ...l, code } : l
                  )
                )
              }
            />
            <CommitField
              label={`${factor.label} level ${index + 1} label`}
              value={level.label}
              onCommit={(label) =>
                setLevels(
                  factor.levels.map((l, i) =>
                    i === index ? { ...l, label } : l
                  )
                )
              }
            />
            <ReorderButtons
              name={`level ${level.label || index + 1}`}
              index={index}
              count={factor.levels.length}
              onMove={(by) => setLevels(move(factor.levels, index, by))}
              onRemove={() =>
                setLevels(factor.levels.filter((_, i) => i !== index))
              }
              removeDisabled={factor.levels.length <= 1}
            />
          </li>
        ))}
      </ol>
      <button
        type="button"
        className={`${BUTTON} min-w-12`}
        disabled={
          factor.levels.length >=
          RANDOMIZATION_RESOURCE_LIMITS.maxLevelsPerFactor
        }
        onClick={() => {
          const id = nextId(`${factor.id}-level`, factor.levels);
          setLevels([
            ...factor.levels,
            {
              id,
              code: `L${factor.levels.length + 1}`,
              label: `Level ${factor.levels.length + 1}`,
            },
          ]);
        }}
      >
        Add a level to {factor.label}
      </button>
    </div>
  );
}

function parseSizes(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((part) => Number(part));
}

/** Stage five: block rules or minimization settings, seed, mask and target. */
export function MechanicsStage({
  draft,
  onChange,
}: {
  readonly draft: RandomizationDesignDraft;
  readonly onChange: Change;
}) {
  const maskHelp = useId();
  const preview = previewSubjectIdMask(draft.subjectIdMask.pattern, {
    siteCode: draft.sites[0]?.code,
  });
  const block = draft.blockSettings;
  return (
    <div className="space-y-6">
      {draft.method === "BLOCK" && block && (
        <fieldset className="min-w-0 space-y-3">
          <legend className="font-semibold">Block rules</legend>
          <CommitField
            label="Block sizes, separated by commas"
            value={block.defaultRule.sizes.join(", ")}
            onCommit={(text) =>
              onChange({
                ...draft,
                blockSettings: {
                  ...block,
                  defaultRule: {
                    ...block.defaultRule,
                    sizes: parseSizes(text),
                  },
                },
              })
            }
          />
          <ul className="space-y-1 text-sm">
            {block.defaultRule.sizes.map((size, index) => {
              const composition = previewBlockComposition(draft.arms, size);
              return (
                <li key={`${size}-${index}`} className={MONO}>
                  Size {size}:{" "}
                  {composition.legal
                    ? draft.arms
                        .map(
                          (arm, i) =>
                            `${composition.slotsPerArm[i]} ${arm.code || arm.label}`
                        )
                        .join(", ")
                    : `not a multiple of the reduced ratio sum (${composition.remainderSlots} left over)`}
                </li>
              );
            })}
          </ul>
          <div className="grid gap-3 @md:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-300">
              How sizes are chosen
              <select
                className={FIELD}
                value={block.defaultRule.mode}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    blockSettings: {
                      ...block,
                      defaultRule: {
                        ...block.defaultRule,
                        mode: event.target
                          .value as BlockSettings["defaultRule"]["mode"],
                      },
                    },
                  })
                }
              >
                <option value="random-pool">At random from the list</option>
                <option value="fixed-sequence">In the order listed</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-300">
              Block counters are kept
              <select
                className={FIELD}
                value={block.trackingScope}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    blockSettings: {
                      ...block,
                      trackingScope: event.target
                        .value as BlockSettings["trackingScope"],
                    },
                  })
                }
              >
                <option value="per-intersection">Per site and stratum</option>
                <option value="per-site">Per site</option>
                <option value="global">Across the study</option>
              </select>
            </label>
          </div>
          <label className="flex min-h-12 items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={block.allowPartialFinalBlock}
              onChange={(event) =>
                onChange({
                  ...draft,
                  blockSettings: {
                    ...block,
                    allowPartialFinalBlock: event.target.checked,
                  },
                })
              }
            />
            Allow a cap to cut the last block short
          </label>
          <OverrideSummary block={block} />
        </fieldset>
      )}

      {draft.method === "MINIMIZATION" && draft.minimizationSettings && (
        <fieldset className="min-w-0 space-y-3">
          <legend className="font-semibold">Minimization</legend>
          <div className="grid gap-3 @md:grid-cols-2">
            <CommitField
              label="Virtual cohort size"
              type="number"
              inputMode="numeric"
              value={String(draft.minimizationSettings.virtualCohortSize)}
              onCommit={(text) =>
                onChange({
                  ...draft,
                  minimizationSettings: {
                    ...draft.minimizationSettings!,
                    virtualCohortSize: toNumber(text),
                  },
                })
              }
            />
            <CommitField
              label="Biased coin probability (0.5 to 1)"
              type="number"
              inputMode="decimal"
              value={String(draft.minimizationSettings.biasedCoinProbability)}
              onCommit={(text) =>
                onChange({
                  ...draft,
                  minimizationSettings: {
                    ...draft.minimizationSettings!,
                    biasedCoinProbability: toNumber(text),
                  },
                })
              }
            />
          </div>
        </fieldset>
      )}

      <fieldset className="min-w-0 space-y-3">
        <legend className="font-semibold">Seed, subject IDs and target</legend>
        <div className="grid gap-3 @md:grid-cols-[1fr_auto]">
          <CommitField
            label="Seed"
            value={draft.seed?.value ?? ""}
            onCommit={(value) =>
              onChange({
                ...draft,
                seed: value.trim()
                  ? { value: value.trim(), source: "custom" }
                  : null,
              })
            }
          />
          <div className="flex items-end">
            <button
              type="button"
              className={`${BUTTON} min-w-12`}
              onClick={() =>
                onChange({
                  ...draft,
                  seed: { value: generateRandomSeed(), source: "generated" },
                })
              }
            >
              Generate a seed
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          {draft.seed
            ? `The ${draft.seed.source} seed is kept with the plan, so a rerun gives the same schedule.`
            : "No seed yet. Type one or generate one; it is kept before anything runs."}
        </p>
        <CommitField
          label="Subject ID mask"
          value={draft.subjectIdMask.pattern}
          describedBy={maskHelp}
          invalid={!preview.ok}
          onCommit={(pattern) =>
            onChange({
              ...draft,
              subjectIdMask: { ...draft.subjectIdMask, pattern },
            })
          }
        />
        <p id={maskHelp} className="text-sm text-slate-400">
          Tokens: {"{SITE}"}, {"{STRATUM}"}, {"{SEQ:n}"}, {"{RND:n}"} and{" "}
          {"{CHECK}"}.{" "}
          {preview.ok ? (
            <>
              Example: <span className={MONO}>{preview.exampleId}</span> (a
              preview that draws no IDs from the schedule)
            </>
          ) : (
            <span className="text-amber-200">
              {preview.findings[0]?.message}
            </span>
          )}
        </p>
        <CommitField
          label="Enrollment target"
          type="number"
          inputMode="numeric"
          value={String(draft.enrollmentTarget)}
          onCommit={(text) =>
            onChange({ ...draft, enrollmentTarget: toNumber(text) })
          }
        />
      </fieldset>
    </div>
  );
}

function OverrideSummary({ block }: { readonly block: BlockSettings }) {
  const sites = block.siteOverrides?.length ?? 0;
  const cells = block.intersectionOverrides?.length ?? 0;
  if (sites + cells === 0) {
    return (
      <p className="text-sm text-slate-400">
        Every site and stratum uses these rules.
      </p>
    );
  }
  return (
    <p className="text-sm text-slate-300">
      {sites} site override{sites === 1 ? "" : "s"} and {cells} stratum override
      {cells === 1 ? "" : "s"} replace these rules where they apply.
    </p>
  );
}

const CAP_COPY: Record<BlockCapConfig["strategy"], string> = {
  manual: "A cap for each stratum intersection",
  proportional: "Computed from a total and level percentages",
  marginal: "A cap for each factor level",
};

function defaultCaps(
  strategy: BlockCapConfig["strategy"],
  draft: RandomizationDesignDraft
): BlockCapConfig {
  const capScope = draft.caps.capScope;
  if (strategy === "manual") {
    return {
      strategy,
      capScope,
      intersectionCaps: enumerateStratumIntersections(draft.factors).map(
        (i) => ({ stratumKey: i.stratumKey, cap: 0 })
      ),
    };
  }
  if (strategy === "proportional") {
    return {
      strategy,
      capScope,
      totalEnrollment: draft.enrollmentTarget,
      factorLevelPercentages: Object.fromEntries(
        draft.factors.map((f) => [
          f.id,
          Object.fromEntries(
            f.levels.map((l) => [l.id, 100 / Math.max(1, f.levels.length)])
          ),
        ])
      ),
    };
  }
  return {
    strategy,
    capScope,
    levelCaps: [],
    ...(draft.method === "BLOCK" ? { sitePolicy: "round-robin-v1" } : {}),
    totalEnrollment: draft.enrollmentTarget,
  };
}

/** Stage six: cap strategy, scope and the values for each cell or level. */
export function CapsStage({
  draft,
  onChange,
}: {
  readonly draft: RandomizationDesignDraft;
  readonly onChange: Change;
}) {
  const caps = draft.caps as BlockCapConfig;
  const strategies: BlockCapConfig["strategy"][] =
    draft.method === "BLOCK"
      ? ["manual", "proportional", "marginal"]
      : ["manual", "marginal"];
  const intersections = enumerateStratumIntersections(draft.factors);
  const setCaps = (next: BlockCapConfig) => onChange({ ...draft, caps: next });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 @md:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-300">
          Cap strategy
          <select
            className={FIELD}
            value={caps.strategy}
            onChange={(event) =>
              setCaps(
                defaultCaps(
                  event.target.value as BlockCapConfig["strategy"],
                  draft
                )
              )
            }
          >
            {strategies.map((strategy) => (
              <option key={strategy} value={strategy}>
                {CAP_COPY[strategy]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-300">
          Caps apply
          <select
            className={FIELD}
            value={caps.capScope}
            onChange={(event) =>
              setCaps({
                ...caps,
                capScope: event.target.value as BlockCapConfig["capScope"],
              })
            }
          >
            <option value="per-site">At each site</option>
            <option value="study-wide">Across the study</option>
          </select>
        </label>
      </div>

      {caps.strategy === "manual" && (
        <div className="max-h-[32rem] overflow-auto rounded border border-white/[0.08]">
          <table className="w-full min-w-0 text-left text-sm">
            <caption className="sr-only">
              Cap for each stratum intersection
            </caption>
            <thead className="bg-[#13151a]">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Intersection
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Cap
                </th>
              </tr>
            </thead>
            <tbody>
              {intersections.map((intersection) => {
                const name =
                  intersection.labels.length > 0
                    ? intersection.labels.join(" / ")
                    : "Unstratified";
                const current = caps.intersectionCaps.find(
                  (cap) =>
                    cap.stratumKey === intersection.stratumKey &&
                    cap.siteId === undefined
                );
                return (
                  <tr
                    key={intersection.stratumKey}
                    className="border-t border-white/[0.08]"
                  >
                    <th scope="row" className="px-3 py-2 font-normal">
                      {name}
                    </th>
                    <td className="px-3 py-2">
                      <CommitField
                        label={`Cap for ${name}`}
                        type="number"
                        inputMode="numeric"
                        value={current ? String(current.cap) : ""}
                        invalid={!current}
                        onCommit={(text) => {
                          const rest: ManualIntersectionCap[] =
                            caps.intersectionCaps.filter(
                              (cap) =>
                                !(
                                  cap.stratumKey === intersection.stratumKey &&
                                  cap.siteId === undefined
                                )
                            );
                          setCaps({
                            ...caps,
                            intersectionCaps: [
                              ...rest,
                              {
                                stratumKey: intersection.stratumKey,
                                cap: toNumber(text),
                              },
                            ],
                          });
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {caps.strategy === "proportional" && (
        <div className="space-y-3">
          <CommitField
            label="Total enrollment the percentages split"
            type="number"
            inputMode="numeric"
            value={String(caps.totalEnrollment)}
            onCommit={(text) =>
              setCaps({ ...caps, totalEnrollment: toNumber(text) })
            }
          />
          {draft.factors.map((factor) => (
            <fieldset key={factor.id} className="min-w-0 space-y-2">
              <legend className="text-sm font-medium">{factor.label}</legend>
              <div className="grid gap-2 @md:grid-cols-2">
                {factor.levels.map((level) => (
                  <CommitField
                    key={level.id}
                    label={`${level.label} percent`}
                    type="number"
                    inputMode="decimal"
                    value={String(
                      caps.factorLevelPercentages[factor.id]?.[level.id] ?? ""
                    )}
                    onCommit={(text) =>
                      setCaps({
                        ...caps,
                        factorLevelPercentages: {
                          ...caps.factorLevelPercentages,
                          [factor.id]: {
                            ...caps.factorLevelPercentages[factor.id],
                            [level.id]: toNumber(text),
                          },
                        },
                      })
                    }
                  />
                ))}
              </div>
            </fieldset>
          ))}
          <p className="text-sm text-slate-400">
            The engine turns these into whole-number caps when the plan runs, so
            editing a factor or the total makes earlier computed caps stale.
          </p>
        </div>
      )}

      {caps.strategy === "marginal" && (
        <div className="space-y-3">
          {draft.factors.length === 0 && (
            <p className="text-sm text-amber-200">
              Marginal caps need at least one factor.
            </p>
          )}
          {draft.factors.map((factor) => (
            <fieldset key={factor.id} className="min-w-0 space-y-2">
              <legend className="text-sm font-medium">{factor.label}</legend>
              <div className="grid gap-2 @md:grid-cols-2">
                {factor.levels.map((level) => {
                  const current = caps.levelCaps.find(
                    (cap) =>
                      cap.factorId === factor.id &&
                      cap.levelId === level.id &&
                      cap.siteId === undefined
                  );
                  return (
                    <CommitField
                      key={level.id}
                      label={`${level.label} cap`}
                      type="number"
                      inputMode="numeric"
                      value={current ? String(current.cap) : ""}
                      onCommit={(text) => {
                        const rest: MarginalLevelCap[] = caps.levelCaps.filter(
                          (cap) =>
                            !(
                              cap.factorId === factor.id &&
                              cap.levelId === level.id &&
                              cap.siteId === undefined
                            )
                        );
                        setCaps({
                          ...caps,
                          levelCaps: text.trim()
                            ? [
                                ...rest,
                                {
                                  factorId: factor.id,
                                  levelId: level.id,
                                  cap: toNumber(text),
                                },
                              ]
                            : rest,
                        });
                      }}
                    />
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}
