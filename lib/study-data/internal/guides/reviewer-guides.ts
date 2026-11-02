/**
 * cSDRG-lite and ADRG-lite: reviewer guides generated from a pipeline run.
 *
 * The PHUSE Clinical Study Data Reviewer's Guide and Analysis Data
 * Reviewer's Guide templates describe a submission's tabulation and analysis
 * data for the reviewer who opens it. These "lite" guides carry the sections
 * a run can state as facts: the data flow, the standards and versions, the
 * datasets, the conformance findings with an explanation of each, the
 * derivation methods and, for ADaM, the analysis outputs. Everything is read
 * from the run, so the guides change when the run does and the same run
 * always gives the same guide.
 */
import { PIPELINE_STAGES, SYNTHETIC_DATA_NOTICE } from "../../presets";
import type {
  ArsReportingEvent,
  DataLayer,
  Dataset,
  FindingSeverity,
  PipelineRun,
  PipelineStageId,
  StandardId,
} from "../../types";
import { ADAM_METHODS } from "../adam/specs";
import { IDS } from "../tlf/plan";
import { SDTM_METHODS } from "../sdtm/methods";
import { MESSY_DATA_SCENARIOS } from "../synth/scenarios";

/** Which guide: the tabulation guide or the analysis guide. */
export type ReviewerGuideKind = "csdrg" | "adrg";

/** One step of the data flow, in run order. */
export interface ReviewerGuideFlowStep {
  readonly stage: PipelineStageId;
  readonly label: string;
  readonly summary: string;
}

/** One dataset the guide describes. */
export interface ReviewerGuideDataset {
  readonly name: string;
  readonly label: string;
  readonly class: string;
  readonly structure: string;
  readonly keys: readonly string[];
  readonly records: number;
  /** The XPT file beside the guide, for example `dm.xpt`. */
  readonly file: string;
}

/** The findings of one conformance rule on one dataset, explained. */
export interface ReviewerGuideIssue {
  readonly ruleId: string;
  readonly dataset: string;
  readonly severity: FindingSeverity;
  readonly count: number;
  readonly message: string;
  readonly citation: string;
  /** True when the synthetic generator produces these records on purpose. */
  readonly expected: boolean;
  readonly explanation: string;
}

/** One derivation method and the variables derived with it. */
export interface ReviewerGuideDerivation {
  readonly id: string;
  readonly text: string;
  /** `DATASET.VARIABLE` names, in dataset and column order. */
  readonly variables: readonly string[];
}

/** One analysis of an output, as the ARS reporting event defines it. */
export interface ReviewerGuideAnalysis {
  readonly id: string;
  readonly name: string;
  readonly dataset: string;
  readonly variable: string;
  readonly population: string;
  readonly method: string;
}

/** One table or figure and the analyses it displays. */
export interface ReviewerGuideOutput {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly analyses: readonly ReviewerGuideAnalysis[];
}

/**
 * A reviewer's note on the win ratio analysis of a hierarchical composite:
 * what it estimates, the hierarchy, how pairs are formed and decided, the
 * statistics, and what the analysis cannot tell a reader.
 */
export interface ReviewerGuideWinRatioNote {
  /** The comparisons, each as the effect of one arm against the comparator. */
  readonly estimand: readonly string[];
  /** The components, most important first, each with its comparison rule. */
  readonly hierarchy: readonly string[];
  /** The randomisation strata pairs are formed within; empty when unstratified. */
  readonly strata: readonly string[];
  /** How pairs are formed and decided, from the ARS pairing method. */
  readonly pairing: string;
  /** The statistics and their variances, from the ARS win statistics method. */
  readonly statistics: string;
  readonly limitations: readonly string[];
  readonly references: readonly string[];
}

/** One generated reviewer guide. */
export interface ReviewerGuide {
  readonly kind: ReviewerGuideKind;
  readonly title: string;
  readonly studyId: string;
  readonly seed: number;
  readonly nSubjects: number;
  readonly notice: string;
  /** What the guide covers and what it leaves out. */
  readonly scope: string;
  readonly dataFlow: readonly ReviewerGuideFlowStep[];
  readonly standards: readonly {
    readonly standard: StandardId;
    readonly version: string;
  }[];
  readonly datasets: readonly ReviewerGuideDataset[];
  readonly conformance: {
    readonly status: PipelineRun["conformance"]["status"];
    readonly rulesVersion: string;
    readonly terminologyVersion: string;
    readonly scopeNotice: string;
    readonly coreUrl: string;
    readonly rulesChecked: number;
    readonly issues: readonly ReviewerGuideIssue[];
  };
  readonly derivations: readonly ReviewerGuideDerivation[];
  /**
   * The ARS output index. ADRG only, and only when the reporting event was
   * passed to {@link buildReviewerGuides}.
   */
  readonly outputs?: readonly ReviewerGuideOutput[];
  /**
   * The win ratio method note. ADRG only, and only when the reporting event
   * passed to {@link buildReviewerGuides} has win ratio analyses.
   */
  readonly winRatio?: ReviewerGuideWinRatioNote;
}

/** Both guides of a run. */
export interface ReviewerGuides {
  readonly csdrg: ReviewerGuide;
  readonly adrg: ReviewerGuide;
}

/**
 * Why the generator produces the records each exception rule flags. These
 * are the findings a reviewer should expect from every run; any other
 * finding is a defect.
 */
const EXPECTED_FINDINGS: Readonly<Record<string, string>> = {
  "SD-031":
    "The generator moves about 7% of scheduled post-baseline visits two days past the end of their planned window, as happens in real studies. SVSTDY is correct: the visit happened late. ADaM assigns these records to analysis visits by the window rule (BDS_WINDOW).",
  "SD-032":
    "About 2.5% of laboratory results are generated at 1.8 times the expected value and flagged LBNRIND = HIGH, so that shift and abnormality summaries have something to count. The values are deliberate, not entry errors.",
  "SD-033":
    "About 12% of post-dose adverse events are given a month-only onset date, as a site might record when the day is unknown. AESTDY is left missing in SDTM; ADAE imputes the day and flags it (ADAE_IMPUTE).",
  "SD-034":
    "About 7% of randomized subjects have an adverse event two days before first dose. These records stay in AE and are not treatment-emergent in ADAE (ADAE_TEAE).",
};

const UNEXPECTED =
  "The synthetic generator does not produce this on purpose. Treat it as a defect in the run and investigate before using the data.";

/** Rule ids the run's messy-data scenarios set out to trigger, and by what. */
function injectedFindings(run: PipelineRun): Map<string, string[]> {
  const injected = new Map<string, string[]>();
  for (const applied of run.manifest.scenarios ?? []) {
    const scenario = MESSY_DATA_SCENARIOS.find(
      (item) => item.id === applied.id
    );
    if (!scenario || applied.subject === null) continue;
    for (const rule of scenario.expected.findings)
      injected.set(rule, [
        ...(injected.get(rule) ?? []),
        `${scenario.title} (${applied.subject})`,
      ]);
  }
  return injected;
}

const LAYER_STAGES: Readonly<
  Record<ReviewerGuideKind, readonly PipelineStageId[]>
> = {
  csdrg: ["usdm", "synth", "sdtm", "conformance", "define", "export"],
  adrg: ["sdtm", "adam", "define", "export", "tlf", "lineage"],
};

const LAYER_STANDARDS: Readonly<
  Record<ReviewerGuideKind, readonly StandardId[]>
> = {
  csdrg: ["USDM", "SDTM", "SDTMIG", "NCI-EVS-CT", "Define-XML", "Dataset-JSON"],
  adrg: [
    "SDTMIG",
    "ADaM",
    "ADaMIG",
    "NCI-EVS-CT",
    "Define-XML",
    "Dataset-JSON",
    "ARS",
  ],
};

const TITLES: Readonly<Record<ReviewerGuideKind, string>> = {
  csdrg: "Clinical Study Data Reviewer's Guide (lite)",
  adrg: "Analysis Data Reviewer's Guide (lite)",
};

const SCOPE: Readonly<Record<ReviewerGuideKind, string>> = {
  csdrg:
    "Generated from one pipeline run. It follows the section order of the PHUSE cSDRG template for the parts a run can state as facts: data flow, standards, datasets, conformance and derivations. Protocol and data collection narratives, and sponsor decisions on unresolved issues, are not generated. This is a demonstration of a deterministic pipeline on synthetic data, not a production submission workflow.",
  adrg: "Generated from one pipeline run. It follows the section order of the PHUSE ADRG template for the parts a run can state as facts: data flow, standards, analysis datasets, conformance, derivations and the analysis output index. Statistical analysis plan narratives and program listings are not generated. This is a demonstration of a deterministic pipeline on synthetic data, not a production submission workflow.",
};

function layerOf(kind: ReviewerGuideKind): Exclude<DataLayer, "collected"> {
  return kind === "csdrg" ? "sdtm" : "adam";
}

function describeDataset(dataset: Dataset): ReviewerGuideDataset {
  return {
    name: dataset.name,
    label: dataset.label,
    class: dataset.subClass
      ? `${dataset.class} (${dataset.subClass})`
      : dataset.class,
    structure: dataset.structure ?? "",
    keys: dataset.keys,
    records: dataset.rowCount,
    file: `${dataset.name.toLowerCase()}.xpt`,
  };
}

function issuesFor(
  run: PipelineRun,
  layer: Exclude<DataLayer, "collected">
): ReviewerGuideIssue[] {
  const byRule = new Map<
    string,
    { severity: FindingSeverity; message: string; count: number }
  >();
  for (const finding of run.findings) {
    if (finding.layer !== layer || !finding.dataset) continue;
    const key = `${finding.ruleId}\u0000${finding.dataset}`;
    const entry = byRule.get(key);
    if (entry) entry.count += 1;
    else
      byRule.set(key, {
        severity: finding.severity,
        message: finding.message,
        count: 1,
      });
  }
  const datasets = new Set(
    run.datasets.filter((d) => d.layer === layer).map((d) => d.name)
  );
  const injected = injectedFindings(run);
  return run.conformance.ruleResults
    .filter(
      (result) => result.status !== "pass" && datasets.has(result.dataset)
    )
    .map((result) => {
      const found = byRule.get(`${result.ruleId}\u0000${result.dataset}`);
      const generated =
        result.status === "warning"
          ? EXPECTED_FINDINGS[result.ruleId]
          : undefined;
      const scenarios = injected.get(result.ruleId);
      const explanation = [
        generated,
        scenarios &&
          `Injected on purpose by the messy-data scenario${scenarios.length > 1 ? "s" : ""} ${scenarios.join(", ")}; the finding is the check catching it.`,
      ]
        .filter(Boolean)
        .join(" ");
      return {
        ruleId: result.ruleId,
        dataset: result.dataset,
        severity:
          found?.severity ?? (result.status === "error" ? "error" : "warning"),
        count: result.findingCount,
        message: found?.message ?? "",
        citation: result.citation,
        expected: explanation !== "",
        explanation: explanation || UNEXPECTED,
      } satisfies ReviewerGuideIssue;
    });
}

function derivationsFor(
  datasets: readonly Dataset[],
  methods: Readonly<Record<string, string>>
): ReviewerGuideDerivation[] {
  const variables = new Map<string, string[]>();
  for (const dataset of datasets) {
    for (const variable of dataset.variables) {
      if (!variable.method) continue;
      const list = variables.get(variable.method) ?? [];
      list.push(`${dataset.name}.${variable.name}`);
      variables.set(variable.method, list);
    }
  }
  return [...variables].map(([id, names]) => {
    const text = methods[id];
    if (!text) {
      throw new RangeError(`Method ${id} has no derivation text.`);
    }
    return { id, text, variables: names };
  });
}

function outputIndex(event: ArsReportingEvent): ReviewerGuideOutput[] {
  const analyses = new Map(event.analyses.map((a) => [a.id, a]));
  const sets = new Map(event.analysisSets.map((s) => [s.id, s.label]));
  const methods = new Map(event.methods.map((m) => [m.id, m.name]));
  const outputs = new Map(event.outputs.map((o) => [o.id, o]));
  return event.mainListOfContents.contentsList.listItems.flatMap((item) => {
    const output = item.outputId ? outputs.get(item.outputId) : undefined;
    if (!output) return [];
    const ids = (item.sublist?.listItems ?? []).flatMap((child) =>
      child.analysisId ? [child.analysisId] : []
    );
    return [
      {
        id: output.id,
        name: output.name,
        title: output.displays[0]?.display.displayTitle ?? output.name,
        analyses: ids.flatMap((id) => {
          const analysis = analyses.get(id);
          if (!analysis) return [];
          return [
            {
              id: analysis.id,
              name: analysis.name,
              dataset: analysis.dataset,
              variable: analysis.variable,
              population:
                sets.get(analysis.analysisSetId) ?? analysis.analysisSetId,
              method: methods.get(analysis.methodId) ?? analysis.methodId,
            },
          ];
        }),
      },
    ];
  });
}

/**
 * What the win ratio cannot tell a reader, whatever the data: the three
 * limitations #3422 names.
 */
const WIN_RATIO_LIMITATIONS: readonly string[] = [
  "The statistics depend on follow-up. Under the Gehan rule a pair is compared on a time to an event only over the follow-up both subjects share, so a study with longer or shorter follow-up, or a different censoring pattern, gives different wins and losses for the same treatment effect. Censoring is assumed unrelated to outcome; the inverse-probability-of-censoring weighted statistics of Dong et al. are not computed here.",
  "The first component that decides a pair dominates. A component counts only for the pairs tied on every component above it, so the result can rest almost entirely on one component. The pairs decided on each component in Table 14.2.3 show where the result comes from.",
  "There is no inference on a single component. The wins and losses on each component describe where pairs were decided; they carry no confidence interval or test, and they are not the effect on that component, since which pairs reach a component depends on the components above it.",
];

const WIN_RATIO_REFERENCES: readonly string[] = [
  "Pocock SJ, Ariti CA, Collier TJ, Wang D. The win ratio: a new approach to the analysis of composite endpoints in clinical trials based on clinical priorities. Eur Heart J. 2012;33(2):176-182.",
  "Finkelstein DM, Schoenfeld DA. Combining mortality and longitudinal measures in clinical trials. Stat Med. 1999;18(11):1341-1354.",
  "Bebu I, Lachin JM. Large sample inference for a win ratio analysis of a composite outcome based on prioritized components. Biostatistics. 2016;17(1):178-187.",
  "Dong G, Li D, Ballerstedt S, Vandemeulebroecke M. A generalized analytic solution to the win ratio to analyze a composite endpoint considering the clinical importance order among components. Pharm Stat. 2016;15(5):430-437.",
  "Dong G, Qiu J, Wang D, Vandemeulebroecke M. The stratified win ratio. J Biopharm Stat. 2018;28(4):778-796.",
  "Dong G, Mao L, Huang B, Gamalo-Siebers M, Wang J, Yu G, Hoaglin DC. The inverse-probability-of-censoring weighting (IPCW) adjusted win ratio statistic: an unbiased estimator in the presence of independent censoring. J Biopharm Stat. 2020;30(5):882-899.",
];

/** The comparison an analysis names after its last colon, `A vs B`. */
function comparisonOf(name: string): string {
  return name.slice(name.lastIndexOf(":") + 1).trim();
}

/**
 * The win ratio note, read from the reporting event: the comparisons of the
 * win statistics analyses, the hierarchy and strata of their groupings and
 * the text of their methods. Null when the event has no such analysis.
 */
function winRatioNote(
  event: ArsReportingEvent
): ReviewerGuideWinRatioNote | null {
  const analyses = event.analyses.filter(
    (analysis) => analysis.methodId === IDS.winStat
  );
  const pairing = event.methods.find((method) => method.id === IDS.winComp);
  const statistics = event.methods.find((method) => method.id === IDS.winStat);
  if (analyses.length === 0 || !pairing || !statistics) return null;
  const sets = new Map(event.analysisSets.map((set) => [set.id, set.name]));
  const grouping = (id: string) =>
    event.analysisGroupings.find((factor) => factor.id === id);
  const groupLabels = (id: string) =>
    [...(grouping(id)?.groups ?? [])]
      .sort((a, b) => a.order - b.order)
      .map((group) => group.label ?? group.name);
  return {
    estimand: analyses.map((analysis) => {
      const [treatment, control] = comparisonOf(analysis.name).split(" vs ");
      const population =
        sets.get(analysis.analysisSetId) ?? analysis.analysisSetId;
      return `${treatment} against ${control} on the hierarchical composite, in the ${population}, summarised by the win ratio of ${treatment} over ${control}, with the net benefit and the win odds alongside.`;
    }),
    hierarchy: groupLabels(IDS.hceComponent),
    strata: groupLabels(IDS.hceStratum),
    pairing: pairing.description ?? "",
    statistics: statistics.description ?? "",
    limitations: WIN_RATIO_LIMITATIONS,
    references: WIN_RATIO_REFERENCES,
  };
}

function buildGuide(
  kind: ReviewerGuideKind,
  run: PipelineRun,
  reportingEvent: ArsReportingEvent | undefined
): ReviewerGuide {
  const layer = layerOf(kind);
  const { manifest, conformance } = run;
  const datasets = run.datasets.filter((dataset) => dataset.layer === layer);
  const names = new Set(datasets.map((dataset) => dataset.name));
  const stages = new Set(LAYER_STAGES[kind]);
  const winRatio =
    kind === "adrg" && reportingEvent ? winRatioNote(reportingEvent) : null;
  return {
    kind,
    title: `${TITLES[kind]}: ${manifest.studyId}`,
    studyId: manifest.studyId,
    seed: manifest.seed,
    nSubjects: manifest.nSubjects,
    notice: SYNTHETIC_DATA_NOTICE,
    scope: SCOPE[kind],
    dataFlow: PIPELINE_STAGES.filter((stage) => stages.has(stage.id)).map(
      (stage) => ({
        stage: stage.id,
        label: stage.label,
        summary: stage.summary,
      })
    ),
    standards: LAYER_STANDARDS[kind].map((standard) => ({
      standard,
      version: manifest.standards[standard],
    })),
    datasets: datasets.map(describeDataset),
    conformance: {
      status: conformance.status,
      rulesVersion: conformance.rulesVersion,
      terminologyVersion: conformance.terminologyVersion,
      scopeNotice: conformance.scopeNotice,
      coreUrl: conformance.coreUrl,
      rulesChecked: conformance.ruleResults.filter((result) =>
        names.has(result.dataset)
      ).length,
      issues: issuesFor(run, layer),
    },
    derivations: derivationsFor(
      datasets,
      kind === "csdrg" ? SDTM_METHODS : ADAM_METHODS
    ),
    ...(kind === "adrg" && reportingEvent
      ? { outputs: outputIndex(reportingEvent) }
      : {}),
    ...(winRatio ? { winRatio } : {}),
  };
}

/**
 * Builds the cSDRG-lite and ADRG-lite for a run.
 *
 * @param run - A pipeline run from `runPipeline`.
 * @param reportingEvent - The run's ARS reporting event, from
 *   `buildTlfOutputs`. When given, the ADRG lists every output and the
 *   analyses it displays.
 * @returns Both guides.
 * @throws RangeError when a derived variable names a method that has no
 *   derivation text.
 */
export function buildReviewerGuides(
  run: PipelineRun,
  reportingEvent?: ArsReportingEvent
): ReviewerGuides {
  return {
    csdrg: buildGuide("csdrg", run, reportingEvent),
    adrg: buildGuide("adrg", run, reportingEvent),
  };
}
