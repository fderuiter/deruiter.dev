/**
 * Build-time deterministic evidence loader for `/clinical/ai-governance`.
 *
 * Runs on the server during static page generation and in unit tests so the
 * browser receives compact, reproducible governance evidence without shipping
 * `recorded-findings.json` or running archive compression on the client.
 */

import type {
  AiFailureModeCard,
  AiGovernanceWorkspaceEvidence,
  GovernanceDigestEntry,
  GovernanceScenarioEvidence,
  GovernanceStandardPin,
} from "@/lib/clinical-ai-governance";
import {
  CLINICAL_STANDARDS_PROFILE,
  controlledTerminologyCitation,
  standardCitation,
} from "@/lib/clinical-standards";
import {
  STANDARD_CODELISTS,
  scaffoldCdashDomain,
  validateStudyCompliance,
  type ComplianceViolation,
  type StudyProtocol,
} from "@/lib/crf";
import {
  CONFORMANCE_RULES,
  CONFORMANCE_RULES_VERSION,
  DEFAULT_SEED,
  DEFAULT_SUBJECT_COUNT,
  DEMO_301_STUDY,
  MESSY_DATA_SCENARIOS,
  PACKAGE_FIXED_TIMESTAMP,
  buildStudyDataPackage,
  coreViewReport,
  loadRecordedCoreFindings,
  recordedCoreView,
  runPipeline,
  type ConformanceRule,
  type RecordedFindings,
  type ScenarioId,
} from "@/lib/study-data";

const SYNTHETIC_PACKAGE_GENERATED_AT = "2026-01-01T00:00:00Z";

const WATCHED_PACKAGE_PATHS: readonly string[] = [
  "README.txt",
  "m5/datasets/tabulations/sdtm/define.xml",
  "m5/datasets/tabulations/sdtm/dm.json",
  "m5/datasets/tabulations/sdtm/ex.json",
  "m5/datasets/tabulations/sdtm/ae.json",
  "m5/datasets/analysis/adam/define.xml",
  "m5/datasets/analysis/adam/adsl.json",
  "m5/datasets/analysis/adam/adae.json",
];

const SELECTED_DEFECT_SCENARIOS: readonly ScenarioId[] = [
  "impossible-date",
  "randomized-not-dosed",
  "off-codelist-non-extensible",
];

function buildSyntheticAiDraftStudy(): StudyProtocol {
  const baseAe = scaffoldCdashDomain("AE", 301);
  const baseVs = scaffoldCdashDomain("VS", 302);

  const modifiedAeSections = baseAe.sections.map((section, sectionIdx) => ({
    ...section,
    fields: [
      ...section.fields
        .filter((field) => field.variableName.toUpperCase() !== "AETERM")
        .map((field) => {
          const upper = field.variableName.toUpperCase();
          if (upper === "AESER") {
            return {
              ...field,
              dataType: "radio" as const,
              codelistId: undefined,
              customOptions: [],
            };
          }
          if (upper === "AESTDTC") {
            return {
              ...field,
              dataType: "date" as const,
              defaultValue: "02/30/2026",
            };
          }
          return field;
        }),
      ...(sectionIdx === 0
        ? [
            {
              id: "field_demo301_overlong_sev",
              variableName: "AE_SEVERITY_GRADE",
              label: "Invented Adverse Event Severity Grade",
              dataType: "text" as const,
              columnSpan: 6,
              required: false,
            },
          ]
        : []),
    ],
  }));

  return {
    id: "study_demo_301_ai_audit",
    protocolNumber: "DEMO-301",
    studyName: "DEMO-301 Synthetic AI Draft Audit",
    phase: "Phase II",
    sponsor: "Fictional Northstar Therapeutics",
    therapeuticArea: "Cardiometabolic",
    version: "1.0",
    lastModified: "2026-09-01",
    codelists: [...STANDARD_CODELISTS],
    visits: [
      {
        id: "visit_demo301_scrn",
        oid: "SE.SCRN",
        name: "Screening",
        visitType: "Scheduled",
        targetDay: -14,
        windowBefore: 7,
        windowAfter: 0,
        assignedFormIds: ["form_demo301_ae"],
      },
    ],
    forms: [
      {
        ...baseAe,
        id: "form_demo301_ae",
        name: "Adverse Events",
        isLogForm: true,
        sections: modifiedAeSections,
      },
      {
        ...baseVs,
        id: "form_demo301_vs_orphan",
        name: "Vital Signs",
        isLogForm: false,
      },
    ],
  };
}

function requireViolation(
  violations: readonly ComplianceViolation[],
  ruleId: string
): ComplianceViolation {
  const match = violations.find((item) => item.ruleId === ruleId);
  if (!match) {
    throw new Error(`Expected deterministic CRF violation ${ruleId}.`);
  }
  return match;
}

function requirePipelineRule(
  predicate: (rule: ConformanceRule) => boolean,
  label: string
): ConformanceRule {
  const match = CONFORMANCE_RULES.find(predicate);
  if (!match) {
    throw new Error(`Expected pipeline conformance rule for ${label}.`);
  }
  return match;
}

function toBinarySeverity(
  severity: "error" | "warning" | "notice"
): "error" | "warning" {
  return severity === "error" ? "error" : "warning";
}

function toCrfCheck(
  violation: ComplianceViolation
): AiFailureModeCard["crfCheck"] {
  if (!violation.suggestedFix) {
    throw new Error(
      `Expected suggestedFix on deterministic CRF violation ${violation.ruleId}.`
    );
  }
  return {
    ruleId: violation.ruleId,
    severity: toBinarySeverity(violation.severity),
    message: violation.message,
    suggestedFix: violation.suggestedFix,
  };
}

function toPipelineCheck(
  rule: ConformanceRule
): AiFailureModeCard["pipelineCheck"] {
  return {
    ruleId: rule.id,
    severity: toBinarySeverity(rule.severity),
    layer: rule.scope.layer,
    domain: rule.scope.domain,
    citation: rule.citation,
  };
}

function buildFailureModes(): readonly AiFailureModeCard[] {
  const violations = validateStudyCompliance(buildSyntheticAiDraftStudy());
  const sd0001 = requireViolation(violations, "SD0001");
  const sd0002 = requireViolation(violations, "SD0002");
  const sd0003 = requireViolation(violations, "SD0003");
  const sd0004 = requireViolation(violations, "SD0004");
  const sd0005 = requireViolation(violations, "SD0005");

  const requiredAeRule = requirePipelineRule(
    (r) => r.kind === "required" && r.scope.domain === "AE",
    "required AE variables"
  );
  const studyDayAeRule = requirePipelineRule(
    (r) => r.kind === "study-day" && r.scope.domain === "AE",
    "AE study day"
  );
  const ctAesRule = requirePipelineRule(
    (r) => r.kind === "ct" && r.scope.domain === "AE" && r.severity === "error",
    "non-extensible AE codelist"
  );
  const isoDateRule = requirePipelineRule(
    (r) => r.kind === "iso" && r.scope.layer === "sdtm",
    "ISO 8601 SDTM date"
  );
  const sdtmLineageRule = requirePipelineRule(
    (r) => r.kind === "lineage" && r.scope.layer === "sdtm",
    "SDTM source lineage"
  );
  const adamLineageRule = requirePipelineRule(
    (r) => r.kind === "lineage" && r.scope.layer === "adam",
    "ADaM SRCDOM/SRCSEQ lineage"
  );

  return [
    {
      id: "fm-overlong-variable",
      category: "schema-naming",
      title: "Invented variable names exceeding 8-character SDTM limit",
      aiFailureSummary:
        "A model drafts human-readable variable identifiers such as AE_SEVERITY_GRADE that break SAS XPORT v5 and SDTM variable-length rules.",
      demoExample:
        "Synthetic DEMO-301 AE draft introduces 17-character variable AE_SEVERITY_GRADE.",
      crfCheck: toCrfCheck(sd0001),
      pipelineCheck: toPipelineCheck(studyDayAeRule),
      humanReviewGate:
        "Clinical Data Manager reviews target SDTM variable mapping before accepting any rename.",
    },
    {
      id: "fm-missing-core-var",
      category: "schema-naming",
      title: "Omitted required CDASH and SDTM core domain variables",
      aiFailureSummary:
        "Summarising a protocol section into a form drops mandatory collection fields such as the reported adverse event term (AETERM).",
      demoExample:
        "Synthetic DEMO-301 AE draft omits AETERM while keeping secondary fields.",
      crfCheck: toCrfCheck(sd0002),
      pipelineCheck: toPipelineCheck(requiredAeRule),
      humanReviewGate:
        "Standards Reviewer and CDM verify required domain variables against the study schedule.",
    },
    {
      id: "fm-unbound-codelist",
      category: "terminology-dates",
      title: "Free-text or invented option labels on non-extensible codelists",
      aiFailureSummary:
        "Prompted form generation emits ad-hoc radio choices (Yes/No/Maybe) instead of binding NCI controlled terminology codes.",
      demoExample:
        "Choice field AESER on DEMO-301 lacks codelist C66742 binding, risking off-codelist values.",
      crfCheck: toCrfCheck(sd0003),
      pipelineCheck: toPipelineCheck(ctAesRule),
      humanReviewGate:
        "Standards Reviewer confirms codelist extensibility and submission values against the pinned CT subset.",
    },
    {
      id: "fm-invalid-iso-date",
      category: "terminology-dates",
      title: "Locale-formatted or impossible calendar dates",
      aiFailureSummary:
        "Generated defaults or synthetic examples insert US-formatted strings (02/30/2026) or nonexistent calendar days.",
      demoExample:
        "Date field AESTDTC defaults to 02/30/2026 instead of ISO 8601 YYYY-MM-DD.",
      crfCheck: toCrfCheck(sd0004),
      pipelineCheck: toPipelineCheck(isoDateRule),
      humanReviewGate:
        "Pipeline leaves derived study day missing rather than rolling invalid dates forward; CDM resolves source query.",
    },
    {
      id: "fm-orphaned-visit-form",
      category: "lineage-schedule",
      title: "Orphaned forms disconnected from the Schedule of Activities",
      aiFailureSummary:
        "An assistant creates a Vital Signs form definition without assigning it to any scheduled visit in the study matrix.",
      demoExample:
        "Non-log Vital Signs form on DEMO-301 has zero visit assignments.",
      crfCheck: toCrfCheck(sd0005),
      pipelineCheck: toPipelineCheck(sdtmLineageRule),
      humanReviewGate:
        "Clinical Operations and CDM review Visit Matrix impact preview before changing schedule bindings.",
    },
    {
      id: "fm-untraced-derivation",
      category: "lineage-schedule",
      title: "Fabricated derived rows without collected source lineage",
      aiFailureSummary:
        "If a model wrote ADaM or SDTM rows directly, derived records could lack valid SRCID or SRCDOM and SRCSEQ pointers back to collected records.",
      demoExample:
        "ADaM analysis row references an absent SDTM sequence or missing collected SRCID.",
      crfCheck: {
        ruleId: sd0002.ruleId,
        severity: "error",
        message:
          "Authoring boundary keeps model proposals in CRF metadata only; dataset rows are never model-authored (ADR 0065, ADR 0067).",
        suggestedFix:
          "Generate SDTM and ADaM exclusively through the deterministic pipeline",
      },
      pipelineCheck: toPipelineCheck(adamLineageRule),
      humanReviewGate:
        "Biostatistician verifies row-level lineage from analysis tables back to SDTM and collected source records.",
    },
  ];
}

function buildPinnedStandards(): readonly GovernanceStandardPin[] {
  return [
    {
      code: "USDM",
      citation: standardCitation("USDM"),
      scopeNote:
        "Study design, arms, epochs, visits and schedule of activities.",
    },
    {
      code: "CDASHIG",
      citation: standardCitation("CDASHIG"),
      scopeNote:
        "CRF domain scaffolds and design linter rules SD0001 to SD0005.",
    },
    {
      code: "SDTMIG",
      citation: `${standardCitation("SDTM")} / ${standardCitation("SDTMIG")}`,
      scopeNote:
        "Tabulation domains checked by local rules and recorded CDISC CORE.",
    },
    {
      code: "ADaMIG",
      citation: `${standardCitation("ADaM")} / ${standardCitation("ADaMIG")}`,
      scopeNote:
        "Analysis datasets (ADSL, ADAE, ADVS, ADLB, ADEG) with SRCDOM lineage.",
    },
    {
      code: "Define-XML & Dataset-JSON",
      citation: `${standardCitation("Define-XML")} / ${standardCitation("Dataset-JSON")}`,
      scopeNote: "eCTD module 5 metadata and dataset exchange files.",
    },
    {
      code: "Controlled Terminology",
      citation: controlledTerminologyCitation(),
      scopeNote: `Hand-curated ${CLINICAL_STANDARDS_PROFILE.CT.scope} checked against NCI EVS release.`,
    },
  ];
}

interface BaselineCounts {
  readonly errors: number;
  readonly warnings: number;
  readonly pkgFindings: number;
}

type ScenarioTarget =
  | { readonly kind: "baseline" }
  | {
      readonly kind: "injected";
      readonly scenarioId: ScenarioId;
      readonly baselineDigests: ReadonlyMap<string, string>;
      readonly baselineCounts: BaselineCounts;
    };

function requireScenarioMeta(scenarioId: ScenarioId) {
  const match = MESSY_DATA_SCENARIOS.find((item) => item.id === scenarioId);
  if (!match) {
    throw new Error(`Expected messy-data scenario metadata for ${scenarioId}.`);
  }
  return match;
}

function outcomeCount(
  outcomes: Readonly<Record<string, number>>,
  key: string
): number {
  return outcomes[key] ?? 0;
}

function appendPositiveOrNegativeDelta(
  parts: string[],
  diff: number,
  label: string
): void {
  if (diff !== 0) {
    const prefix = diff > 0 ? "+" : "";
    parts.push(`${prefix}${diff} ${label}`);
  }
}

async function buildScenarioEvidence(
  recorded: RecordedFindings,
  target: ScenarioTarget
): Promise<{
  readonly evidence: GovernanceScenarioEvidence;
  readonly digestMap: ReadonlyMap<string, string>;
}> {
  const isBaseline = target.kind === "baseline";
  const scenarioId = isBaseline ? "default" : target.scenarioId;
  const scenarioMeta = isBaseline
    ? null
    : requireScenarioMeta(target.scenarioId);

  const run = runPipeline(DEMO_301_STUDY, {
    seed: DEFAULT_SEED,
    nSubjects: DEFAULT_SUBJECT_COUNT,
    ...(isBaseline ? {} : { scenarios: [target.scenarioId] }),
  });

  const pkg = await buildStudyDataPackage(run, {
    generatedAt: SYNTHETIC_PACKAGE_GENERATED_AT,
  });

  const viewKey = recordedCoreView({
    defaultStudy: true,
    seed: DEFAULT_SEED,
    nSubjects: DEFAULT_SUBJECT_COUNT,
    ...(isBaseline ? {} : { scenario: target.scenarioId }),
    defaults: { seed: DEFAULT_SEED, nSubjects: DEFAULT_SUBJECT_COUNT },
  });
  const recordedView = viewKey ? recorded.views[viewKey] : undefined;
  if (!viewKey || !recordedView) {
    throw new Error(`Expected recorded CORE view for ${scenarioId}.`);
  }

  const coreReport = coreViewReport(recorded, viewKey);

  const digestMap = new Map<string, string>();
  for (const file of pkg.packageManifest.files) {
    digestMap.set(file.path, file.sha256);
  }

  const digests: readonly GovernanceDigestEntry[] =
    WATCHED_PACKAGE_PATHS.flatMap((path) => {
      const entry = pkg.packageManifest.files.find((f) => f.path === path);
      if (!entry) return [];
      const changedFromBaseline =
        target.kind === "injected" &&
        target.baselineDigests.get(path) !== entry.sha256;
      return [
        {
          path: entry.path,
          mediaType: entry.mediaType,
          bytes: entry.bytes,
          sha256: entry.sha256,
          changedFromBaseline,
        },
      ];
    });

  const localErrors = run.findings.filter((f) => f.severity === "error").length;
  const localWarnings = run.findings.filter(
    (f) => f.severity === "warning"
  ).length;
  const packageFindings = pkg.findings.length;
  const coreAddedFindings = coreReport.findings.reduce(
    (sum, item) => sum + item.addedByScenario,
    0
  );

  let localDeltaSummary: string;
  if (target.kind === "baseline") {
    localDeltaSummary =
      "Clean seeded DEMO-301 baseline: zero local errors across 90 synthetic subjects.";
  } else {
    const parts: string[] = [];
    appendPositiveOrNegativeDelta(
      parts,
      localErrors - target.baselineCounts.errors,
      "local error"
    );
    appendPositiveOrNegativeDelta(
      parts,
      localWarnings - target.baselineCounts.warnings,
      "local warning"
    );
    appendPositiveOrNegativeDelta(
      parts,
      packageFindings - target.baselineCounts.pkgFindings,
      "package finding"
    );
    parts.push(
      coreAddedFindings > 0
        ? `+${coreAddedFindings} recorded CORE finding`
        : "0 added CORE findings (caught by local gate)"
    );
    localDeltaSummary = parts.join(", ");
  }

  return {
    digestMap,
    evidence: {
      id: scenarioId,
      label: scenarioMeta
        ? `${scenarioMeta.title} (injected defect)`
        : "Baseline clean run (DEMO-301)",
      isBaseline,
      description: scenarioMeta
        ? scenarioMeta.description
        : "Default seeded DEMO-301 run (seed 301, 90 synthetic subjects) with no fault scenarios applied.",
      expectedBehavior: scenarioMeta
        ? scenarioMeta.expected.derivation
        : "Every dataset, Define-XML file and reviewer guide hashes to a reproducible SHA-256 digest.",
      inputSha256: recordedView.inputSha256,
      manifestSha256: pkg.manifestSha256,
      totalFiles: pkg.packageManifest.files.length,
      localErrors,
      localWarnings,
      packageFindings,
      localDeltaSummary,
      coreRuleCount: coreReport.ruleCount,
      corePassed: outcomeCount(coreReport.outcomes, "SUCCESS"),
      coreIssuesReported: outcomeCount(coreReport.outcomes, "ISSUE REPORTED"),
      coreSkipped: outcomeCount(coreReport.outcomes, "SKIPPED"),
      coreExecutionErrors: outcomeCount(coreReport.outcomes, "EXECUTION ERROR"),
      coreAddedFindings,
      topCoreFindings: coreReport.findings.slice(0, 5).map((finding) => ({
        coreId: finding.coreId,
        dataset: finding.dataset,
        count: finding.count,
        addedByScenario: finding.addedByScenario,
        message: finding.rule.message,
      })),
      digests,
    },
  };
}

let cachedEvidencePromise: Promise<AiGovernanceWorkspaceEvidence> | null = null;

/**
 * Computes and memoizes the deterministic evidence payload for `/clinical/ai-governance`.
 */
export function loadAiGovernanceEvidence(): Promise<AiGovernanceWorkspaceEvidence> {
  if (!cachedEvidencePromise) {
    cachedEvidencePromise = (async () => {
      const recorded = await loadRecordedCoreFindings();
      const failureModes = buildFailureModes();
      const pinnedStandards = buildPinnedStandards();

      const baseline = await buildScenarioEvidence(recorded, {
        kind: "baseline",
      });
      const baselineCounts: BaselineCounts = {
        errors: baseline.evidence.localErrors,
        warnings: baseline.evidence.localWarnings,
        pkgFindings: baseline.evidence.packageFindings,
      };

      const injected = await Promise.all(
        SELECTED_DEFECT_SCENARIOS.map((scenarioId) =>
          buildScenarioEvidence(recorded, {
            kind: "injected",
            scenarioId,
            baselineDigests: baseline.digestMap,
            baselineCounts,
          })
        )
      );

      return {
        studyId: DEMO_301_STUDY.studyId,
        seed: DEFAULT_SEED,
        subjectCount: DEFAULT_SUBJECT_COUNT,
        fixedTimestamp: PACKAGE_FIXED_TIMESTAMP,
        localRulesVersion: CONFORMANCE_RULES_VERSION,
        localRuleCount: CONFORMANCE_RULES.length,
        coreEngineName: recorded.lock.engine,
        coreEngineTag: recorded.lock.tag,
        coreEngineCommit: recorded.lock.commit,
        terminologyChecked: recorded.lock.ct.validated,
        terminologyCited: recorded.lock.ct.declared,
        pinnedStandards,
        failureModes,
        scenarios: [
          baseline.evidence,
          ...injected.map((item) => item.evidence),
        ],
      };
    })();
  }
  return cachedEvidencePromise;
}
