import type { ScenarioId } from "../../types";

/**
 * CDISC CORE's recorded findings (#2992).
 *
 * `.github/workflows/study-data-core.yml` runs the open-source CDISC Rules
 * Engine over the default run and every "Inject an issue" scenario, and
 * `scripts/study-data-core.ts record` commits what it found to
 * `recorded-findings.json` beside this file. Nothing runs CORE at request
 * time: the page reads the file, and only for a run that matches a recorded
 * view (the default study, seed and subject count).
 */

/** A view CORE validated: the default run or one injected scenario. */
export type CoreView = "default" | ScenarioId;

/** One rule's outcome in a CORE run, from its `Rules_Report`. */
export interface RecordedRule {
  /** SUCCESS, ISSUE REPORTED, SKIPPED (not applicable) or EXECUTION ERROR. */
  readonly status: string;
  /** The CDISC conformance rule ids CORE cites (CG, TIG), comma separated. */
  readonly cdisc: string;
  /** The FDA Business or Validator Rule ids CORE cites, comma separated. */
  readonly fda: string;
  readonly message: string;
}

/** The pinned engine and inputs every recorded finding came from. */
export interface RecordedLock {
  readonly engine: string;
  readonly tag: string;
  readonly commit: string;
  readonly standards: Readonly<Record<"sdtm" | "adam" | "usdm", string>>;
  readonly ct: { readonly declared: string; readonly validated: string };
}

/** Sorted finding lines, capped per rule and dataset, with full counts. */
export interface RecordedLines {
  readonly lines: readonly string[];
  /** Findings per "rule dataset", before the cap. */
  readonly counts: Readonly<Record<string, number>>;
}

/** The default view's findings. */
export interface RecordedDefaultView {
  readonly inputSha256: string;
  readonly sdtm: RecordedLines;
  readonly usdm: RecordedLines;
}

/** A scenario view, as its change to the default view's SDTM findings. */
export interface RecordedScenarioView {
  readonly inputSha256: string;
  readonly added: RecordedLines;
  readonly removed: RecordedLines;
  /** SDTM rules whose status differs from the default view's. */
  readonly status: Readonly<Record<string, string>>;
}

/** One CRF Studio preset's USDM export (#3051). */
export interface RecordedCrfPreset {
  readonly inputSha256: string;
  readonly usdm: RecordedLines;
  /** USDM rules whose status differs from the default view's. */
  readonly status: Readonly<Record<string, string>>;
}

/** Why a default-view finding is accepted, from the CORE allowlist. */
export interface RecordedExplanation {
  /** by-design, core-limitation or defect. */
  readonly category: string;
  readonly reason: string;
  /** The issue tracking a defect. */
  readonly issue?: number;
}

/** The CORE rules that report the same defect as one local rule. */
export interface RecordedTwin {
  /** same-defect: CORE reports the planted defect; related: a consequence. */
  readonly coverage: "same-defect" | "related";
  readonly core: readonly string[];
}

/** The file `record` writes and the site reads (#2992). */
export interface RecordedFindings {
  readonly $comment: string;
  readonly lock: RecordedLock;
  readonly rules: {
    readonly sdtm: Readonly<Record<string, RecordedRule>>;
    readonly usdm: Readonly<Record<string, RecordedRule>>;
  };
  /** Allowlist reasons by target, then by "CORE-id dataset". */
  readonly explained: {
    readonly sdtm: Readonly<Record<string, RecordedExplanation>>;
    readonly usdm: Readonly<Record<string, RecordedExplanation>>;
  };
  /** Local rule ids with the CORE rules measured to catch their defect. */
  readonly twins: Readonly<Record<string, RecordedTwin>>;
  readonly views: {
    readonly default: RecordedDefaultView;
  } & Readonly<Partial<Record<ScenarioId, RecordedScenarioView>>>;
  /** Every CRF Studio preset's USDM export, by preset id. */
  readonly crf: Readonly<Record<string, RecordedCrfPreset>>;
}

/** One example record behind a CORE finding. */
export interface CoreFindingExample {
  /** USUBJID#SEQ for a dataset row, or the USDM instance id. */
  readonly record: string;
  /** The variables and the values CORE saw, as written in the line. */
  readonly values: string;
}

/** One CORE rule's findings on one dataset or USDM entity, in one view. */
export interface CoreFinding {
  readonly target: "sdtm" | "usdm";
  readonly coreId: string;
  readonly dataset: string;
  readonly count: number;
  /** Findings beyond the default view's for the same rule and dataset. */
  readonly addedByScenario: number;
  readonly rule: RecordedRule;
  readonly explanation?: RecordedExplanation;
  readonly examples: readonly CoreFindingExample[];
}

/** CORE's outcome for one recorded view, ready to show. */
export interface CoreViewReport {
  readonly view: CoreView;
  readonly lock: RecordedLock;
  /**
   * The terminology release the datasets cite, and the one CORE checked them
   * against (the newest in CORE's cache, which can lag the cited release).
   */
  readonly terminology: { readonly cited: string; readonly checked: string };
  /** Findings, most first, then by rule id. */
  readonly findings: readonly CoreFinding[];
  /** SDTMIG rules by outcome, with the view's own statuses. */
  readonly outcomes: Readonly<Record<string, number>>;
  readonly ruleCount: number;
}

/** How many example records a finding shows. */
export const CORE_EXAMPLES_SHOWN = 5;

/** Loads the committed findings as their own chunk, off the page's bundle. */
export async function loadRecordedCoreFindings(): Promise<RecordedFindings> {
  const { default: findings } = await import("./recorded-findings.json");
  return findings as unknown as RecordedFindings;
}

/** The recorded view for a run, or null when CORE never saw its output. */
export function recordedCoreView(run: {
  readonly defaultStudy: boolean;
  readonly seed: number;
  readonly nSubjects: number;
  readonly scenario?: ScenarioId;
  readonly defaults: { readonly seed: number; readonly nSubjects: number };
}): CoreView | null {
  return run.defaultStudy &&
    run.seed === run.defaults.seed &&
    run.nSubjects === run.defaults.nSubjects
    ? (run.scenario ?? "default")
    : null;
}

const keyOf = (line: string) => line.split(" ", 2).join(" ");

function example(line: string): CoreFindingExample {
  const [, , record = "-", ...values] = line.split(" ");
  return { record, values: values.join(" ") };
}

function withoutLines(
  lines: readonly string[],
  removed: readonly string[]
): string[] {
  const left = new Map<string, number>();
  for (const line of removed) left.set(line, (left.get(line) ?? 0) + 1);
  return lines.filter((line) => {
    const n = left.get(line) ?? 0;
    if (n === 0) return true;
    left.set(line, n - 1);
    return false;
  });
}

/**
 * CORE's findings for one view. A scenario view is recorded as its change to
 * the default view, so its counts are the default's plus what the scenario
 * adds and less what it removes; its examples come from the same change.
 */
export function coreViewReport(
  recorded: RecordedFindings,
  view: CoreView
): CoreViewReport {
  const base = recorded.views.default;
  const scenario = view === "default" ? undefined : recorded.views[view];
  if (view !== "default" && !scenario) {
    throw new RangeError(`CORE has no recorded view ${view}.`);
  }
  const counts = new Map<string, number>(Object.entries(base.sdtm.counts));
  for (const [key, n] of Object.entries(scenario?.removed.counts ?? {})) {
    counts.set(key, (counts.get(key) ?? 0) - n);
  }
  for (const [key, n] of Object.entries(scenario?.added.counts ?? {})) {
    counts.set(key, (counts.get(key) ?? 0) + n);
  }
  const lines = [
    ...withoutLines(base.sdtm.lines, scenario?.removed.lines ?? []),
    ...(scenario?.added.lines ?? []),
  ].sort();
  const findingsOf = (
    target: "sdtm" | "usdm",
    byKey: ReadonlyMap<string, number>,
    from: readonly string[]
  ): CoreFinding[] =>
    [...byKey]
      .filter(([, count]) => count > 0)
      .map(([key, count]) => {
        const [coreId, dataset] = key.split(" ");
        const explanation = recorded.explained[target][key];
        return {
          target,
          coreId,
          dataset,
          count,
          addedByScenario:
            target === "sdtm" && scenario
              ? Math.max(0, count - (base.sdtm.counts[key] ?? 0))
              : 0,
          rule: recorded.rules[target][coreId] ?? {
            status: "ISSUE REPORTED",
            cdisc: "",
            fda: "",
            message: "",
          },
          ...(explanation ? { explanation } : {}),
          examples: from
            .filter((line) => keyOf(line) === key)
            .slice(0, CORE_EXAMPLES_SHOWN)
            .map(example),
        };
      });
  const findings = [
    ...findingsOf("sdtm", counts, lines),
    ...(view === "default"
      ? findingsOf(
          "usdm",
          new Map(Object.entries(base.usdm.counts)),
          base.usdm.lines
        )
      : []),
  ].sort(
    (a, b) =>
      b.addedByScenario - a.addedByScenario ||
      b.count - a.count ||
      a.coreId.localeCompare(b.coreId) ||
      a.dataset.localeCompare(b.dataset)
  );
  const outcomes: Record<string, number> = {};
  const rules = Object.entries(recorded.rules.sdtm);
  for (const [id, rule] of rules) {
    const status = scenario?.status[id] ?? rule.status;
    outcomes[status] = (outcomes[status] ?? 0) + 1;
  }
  return {
    view,
    lock: recorded.lock,
    terminology: {
      cited: recorded.lock.ct.declared,
      checked: recorded.lock.ct.validated,
    },
    findings,
    outcomes,
    ruleCount: rules.length,
  };
}
