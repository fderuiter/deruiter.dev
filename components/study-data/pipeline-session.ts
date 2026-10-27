/**
 * The pipeline session the worker runs: one run at a time, kept in memory,
 * answering the page's requests (see `protocol.ts`). It imports the engine
 * through the public `@/lib/study-data` entry and never imports the module
 * that constructs the worker (chunk cycle guard, #853).
 *
 * Where Workers are unavailable (jsdom tests, very old browsers) the client
 * loads this same module on demand and runs it on the main thread.
 */
import { standardCitation } from "@/lib/clinical-standards";
import { clamp } from "@/lib/game-utils";
import { validateUsdmV4Document } from "@/lib/clinical-standards";
import {
  DEFAULT_SEED,
  DEFAULT_SUBJECT_COUNT,
  DEMO_301_STUDY,
  MESSY_DATA_SCENARIOS,
  PACKAGE_FIXED_TIMESTAMP,
  SYNTHETIC_DATA_NOTICE,
  StudyDefinitionError,
  buildDefine,
  buildReviewerGuides,
  buildStudyDataPackage,
  buildTlfOutputs,
  createLineageIndex,
  prepareStudyHandoff,
  recordedCoreView,
  renderReviewerGuideHtml,
  runPipeline,
  sha256Hex,
  writeTlfFiles,
  zipStudyDataPackage,
  type Dataset,
  type DefineDocument,
  type LineageIndex,
  type PipelineRun,
  type ScenarioId,
  type StudyDefinition,
  type TlfOutputs,
} from "@/lib/study-data";
import {
  FINDING_SAMPLE_SIZE,
  ROW_PAGE_SIZE,
  SCHEMA_ISSUE_SAMPLE_SIZE,
  type DatasetSummary,
  type InjectedIssue,
  type PackageFileResult,
  type PreparedStudy,
  type RowWindow,
  type RunSummary,
  type StageCounts,
  type StudyDataRequest,
} from "./protocol";
import { toDefinitionCounts, toScheduleDesign } from "./schedule-design";

interface ActiveRun {
  readonly runId: number;
  readonly run: PipelineRun;
  readonly outputs: TlfOutputs;
  readonly lineage: LineageIndex;
  readonly byKey: ReadonlyMap<string, Dataset>;
}

/** The largest row window one request may ask for. */
const MAX_ROW_WINDOW = ROW_PAGE_SIZE * 5;

function datasetKey(dataset: Dataset): string {
  return `${dataset.layer}:${dataset.name}`;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function stageCounts(
  run: PipelineRun,
  outputs: TlfOutputs,
  define: { sdtm: DefineDocument; adam: DefineDocument },
  nSubjects: number
): StageCounts {
  const layer = (name: Dataset["layer"]) =>
    run.datasets.filter((dataset) => dataset.layer === name);
  const records = (datasets: readonly Dataset[]) =>
    sum(datasets.map((dataset) => dataset.rowCount));
  const statuses = run.conformance.ruleResults;
  const docs = [define.sdtm, define.adam];
  return {
    collected: {
      records: records(layer("collected")),
      datasets: layer("collected").length,
      subjects: nSubjects,
    },
    sdtm: { records: records(layer("sdtm")), datasets: layer("sdtm").length },
    conformance: {
      checks: statuses.length,
      pass: statuses.filter((result) => result.status === "pass").length,
      warning: statuses.filter((result) => result.status === "warning").length,
      error: statuses.filter((result) => result.status === "error").length,
      findings: run.findings.length,
    },
    adam: { records: records(layer("adam")), datasets: layer("adam").length },
    define: {
      datasets: sum(docs.map((doc) => doc.itemGroups.length)),
      variables: sum(
        docs.map(
          (doc) =>
            doc.items.filter((item) => item.whereValue === undefined).length
        )
      ),
      codelists: new Set(
        docs.flatMap((doc) => doc.codeLists.map((list) => list.oid))
      ).size,
      methods: new Set(
        docs.flatMap((doc) => doc.methods.map((method) => method.oid))
      ).size,
    },
    tlf: {
      tables: outputs.tables.length,
      figures: outputs.figures.length,
      results: sum(
        outputs.reportingEvent.analyses.map(
          (analysis) => analysis.results.length
        )
      ),
    },
  };
}

function summarise(dataset: Dataset): DatasetSummary {
  return {
    key: datasetKey(dataset),
    name: dataset.name,
    label: dataset.label,
    layer: dataset.layer,
    datasetClass: dataset.subClass
      ? `${dataset.class} · ${dataset.subClass}`
      : dataset.class,
    ...(dataset.structure ? { structure: dataset.structure } : {}),
    keys: dataset.keys,
    rowCount: dataset.rowCount,
    variables: dataset.variables,
  };
}

async function zipOutputs(
  files: readonly { path: string; bytes: Uint8Array }[],
  readme: string
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const hashes = await Promise.all(files.map((file) => sha256Hex(file.bytes)));
  const manifest = {
    notice: SYNTHETIC_DATA_NOTICE,
    files: files.map((file, index) => ({
      path: file.path,
      bytes: file.bytes.length,
      sha256: hashes[index],
    })),
  };
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const date = new Date(PACKAGE_FIXED_TIMESTAMP);
  const options = { date, createFolders: false, binary: true } as const;
  zip.file("README.txt", encoder.encode(readme), options);
  zip.file(
    "MANIFEST.json",
    encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`),
    options
  );
  for (const file of files) zip.file(file.path, file.bytes, options);
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    platform: "DOS",
  });
}

/**
 * Checks a handed-off USDM document against the USDM v4.0.0 schema, then
 * narrows it to what the pipeline can run.
 */
async function prepare(study: unknown): Promise<PreparedStudy> {
  const issues = await validateUsdmV4Document(study);
  if (issues.length > 0) {
    return {
      ok: false,
      problem: "schema",
      issues: issues.slice(0, SCHEMA_ISSUE_SAMPLE_SIZE),
      total: issues.length,
    };
  }
  try {
    const { definition, report } = prepareStudyHandoff(study);
    return {
      ok: true,
      report,
      design: toScheduleDesign(definition),
      counts: toDefinitionCounts(definition),
    };
  } catch (error) {
    if (!(error instanceof StudyDefinitionError)) throw error;
    return {
      ok: false,
      problem: "definition",
      issues: [error.message],
      total: 1,
    };
  }
}

/**
 * Where the gate caught an injected scenario: the findings on the changed
 * subject from the rules the scenario declares, and the declared rules that
 * raised nothing there.
 */
function injectedIssue(result: PipelineRun, id: ScenarioId): InjectedIssue {
  const scenario = MESSY_DATA_SCENARIOS.find((item) => item.id === id);
  if (!scenario) throw new RangeError(`There is no scenario ${id}.`);
  const subject =
    result.manifest.scenarios?.find((item) => item.id === id)?.subject ?? null;
  const declared = new Set(scenario.expected.findings);
  const caught =
    subject === null
      ? []
      : result.findings.filter((finding) => {
          if (!declared.has(finding.ruleId) || finding.row === undefined) {
            return false;
          }
          const data = result.datasets.find(
            (item) =>
              item.layer === finding.layer && item.name === finding.dataset
          );
          return data?.columns.USUBJID?.[finding.row] === subject;
        });
  const raised = new Set(caught.map((finding) => finding.ruleId));
  return {
    scenario,
    subject,
    caught,
    missed: scenario.expected.findings.filter((rule) => !raised.has(rule)),
  };
}

/** Creates a session that holds at most one run. */
export function createStudyDataSession() {
  let active: ActiveRun | null = null;
  let lastRunId = 0;

  const current = (runId: number): ActiveRun => {
    if (!active || active.runId !== runId) {
      throw new Error(
        "That run has been replaced by a newer one. Run the pipeline again."
      );
    }
    return active;
  };

  const run = (
    seed: number,
    nSubjects: number,
    study: unknown,
    scenario: ScenarioId | undefined
  ): RunSummary => {
    const started = performance.now();
    const definition: StudyDefinition =
      study === undefined
        ? DEMO_301_STUDY
        : prepareStudyHandoff(study).definition;
    if (
      scenario !== undefined &&
      !MESSY_DATA_SCENARIOS.some((item) => item.id === scenario)
    ) {
      throw new RangeError(`There is no scenario ${scenario}.`);
    }
    const result = runPipeline(definition, {
      seed,
      nSubjects,
      ...(scenario === undefined ? {} : { scenarios: [scenario] }),
    });
    const outputs = buildTlfOutputs(definition, result);
    const define = {
      sdtm: buildDefine(result, {
        layer: "sdtm",
        createdAt: PACKAGE_FIXED_TIMESTAMP,
      }),
      adam: buildDefine(result, {
        layer: "adam",
        createdAt: PACKAGE_FIXED_TIMESTAMP,
      }),
    };
    const guides = buildReviewerGuides(result, outputs.reportingEvent);
    lastRunId += 1;
    active = {
      runId: lastRunId,
      run: result,
      outputs,
      lineage: createLineageIndex(definition, result, outputs),
      byKey: new Map(
        result.datasets.map((dataset) => [datasetKey(dataset), dataset])
      ),
    };
    return {
      runId: lastRunId,
      seed,
      nSubjects,
      elapsedMs: Math.round(performance.now() - started),
      counts: stageCounts(result, outputs, define, nSubjects),
      datasets: result.datasets.map(summarise),
      conformance: result.conformance,
      findings: {
        total: result.findings.length,
        items: result.findings.slice(0, FINDING_SAMPLE_SIZE),
      },
      ...(scenario === undefined
        ? {}
        : { injected: injectedIssue(result, scenario) }),
      coreView: recordedCoreView({
        defaultStudy: study === undefined,
        seed,
        nSubjects,
        scenario,
        defaults: { seed: DEFAULT_SEED, nSubjects: DEFAULT_SUBJECT_COUNT },
      }),
      define,
      tables: outputs.tables,
      figures: outputs.figures,
      guides: {
        csdrg: renderReviewerGuideHtml(guides.csdrg),
        adrg: renderReviewerGuideHtml(guides.adrg),
      },
    };
  };

  const rows = (
    runId: number,
    key: string,
    offset: number,
    limit: number
  ): RowWindow => {
    const dataset = current(runId).byKey.get(key);
    if (!dataset) throw new RangeError(`The run has no dataset ${key}.`);
    const start = Math.max(0, Math.floor(offset));
    const end = Math.min(
      dataset.rowCount,
      start + clamp(Math.floor(limit), 0, MAX_ROW_WINDOW)
    );
    const columns = dataset.variables.map(
      (variable) => dataset.columns[variable.name] ?? []
    );
    const window = [];
    for (let row = start; row < end; row += 1) {
      window.push(columns.map((column) => column[row] ?? null));
    }
    return { key, offset: start, rows: window };
  };

  const packageFile = async (
    runId: number,
    kind: "submission" | "outputs"
  ): Promise<PackageFileResult> => {
    const { run: result } = current(runId);
    const { studyId, seed, nSubjects } = result.manifest;
    const base = `${studyId.toLowerCase()}-seed-${seed}-n-${nSubjects}`;
    if (kind === "submission") {
      const pkg = await buildStudyDataPackage(result, {
        generatedAt: new Date().toISOString(),
        reportingEvent: current(runId).outputs.reportingEvent,
      });
      return {
        fileName: `${base}-datasets.zip`,
        bytes: await zipStudyDataPackage(pkg),
        fileCount: pkg.files.length,
      };
    }
    const files = writeTlfFiles(current(runId).outputs);
    const readme = [
      `Tables and figures for ${studyId}`,
      "",
      SYNTHETIC_DATA_NOTICE,
      "",
      `Seed ${seed}, ${nSubjects} subjects. The same study, seed and subject count give the same files, byte for byte.`,
      "",
      "Each table is written as accessible HTML and as RTF, and the Kaplan-Meier figure as SVG and as HTML with its data tables.",
      `ars-reporting-event.json holds every analysis result as an ${standardCitation("ARS")} reporting event, and ars-result-lineage.json the ADaM rows each result was computed from.`,
      "MANIFEST.json lists the SHA-256 of every other file.",
      "",
    ].join("\r\n");
    return {
      fileName: `${base}-tables-figures.zip`,
      bytes: await zipOutputs(files, readme),
      fileCount: files.length + 2,
    };
  };

  /** Answers one request; throws on a bad or stale request. */
  const handle = async (request: StudyDataRequest): Promise<unknown> => {
    switch (request.type) {
      case "prepare":
        return prepare(request.study);
      case "run":
        return run(
          request.seed,
          request.nSubjects,
          request.study,
          request.scenario
        );
      case "rows":
        return rows(request.runId, request.key, request.offset, request.limit);
      case "trace":
        return current(request.runId).lineage.trace(request.origin, {
          limit: request.limit,
        });
      case "package":
        return packageFile(request.runId, request.kind);
    }
  };

  return { handle };
}
