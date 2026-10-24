/**
 * The pipeline session the worker runs: one run at a time, kept in memory,
 * answering the page's requests (see `protocol.ts`). It imports the engine
 * through the public `@/lib/study-data` entry and never imports the module
 * that constructs the worker (chunk cycle guard, #853).
 *
 * Where Workers are unavailable (jsdom tests, very old browsers) the client
 * loads this same module on demand and runs it on the main thread.
 */
import { clamp } from "@/lib/game-utils";
import {
  DEMO_301_STUDY,
  PACKAGE_FIXED_TIMESTAMP,
  SYNTHETIC_DATA_NOTICE,
  buildDefine,
  buildStudyDataPackage,
  buildTlfOutputs,
  createLineageIndex,
  runPipeline,
  sha256Hex,
  writeTlfFiles,
  zipStudyDataPackage,
  type Dataset,
  type DefineDocument,
  type LineageIndex,
  type PipelineRun,
  type TlfOutputs,
} from "@/lib/study-data";
import {
  FINDING_SAMPLE_SIZE,
  ROW_PAGE_SIZE,
  type DatasetSummary,
  type PackageFileResult,
  type RowWindow,
  type RunSummary,
  type StageCounts,
  type StudyDataRequest,
} from "./protocol";

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

  const run = (seed: number, nSubjects: number): RunSummary => {
    const started = performance.now();
    const result = runPipeline(DEMO_301_STUDY, { seed, nSubjects });
    const outputs = buildTlfOutputs(DEMO_301_STUDY, result);
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
    lastRunId += 1;
    active = {
      runId: lastRunId,
      run: result,
      outputs,
      lineage: createLineageIndex(DEMO_301_STUDY, result, outputs),
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
      define,
      tables: outputs.tables,
      figures: outputs.figures,
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
      "ars-reporting-event.json holds every analysis result in an ARS 1.0-shaped model, with the ADaM rows each result was computed from.",
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
      case "run":
        return run(request.seed, request.nSubjects);
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
