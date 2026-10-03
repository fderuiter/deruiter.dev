#!/usr/bin/env node
/**
 * CRF Studio workload benchmark (#682).
 *
 * Measures the authoring workflows (edit, Grid, scenario run, save/reopen,
 * baseline comparison, export) on the three deterministic synthetic workloads
 * from lib/dx/crf-workloads.ts, in two phases:
 *
 * - engine: the public lib/crf functions the studio calls, in Node via tsx;
 * - browser: the real /crf page of a production build in headless Chromium.
 *
 * Every measurement records its outcome. A step that throws is "failed", a
 * step that could not run is "skipped" with the reason, and neither is ever
 * counted as passed. No step asserts a latency budget: the report states what
 * was observed on the recorded machine and nothing more.
 *
 * Usage:
 *   npm run bench:crf                       # both phases, all workloads
 *   npm run bench:crf -- --phase engine     # Node-only measurements
 *   npm run bench:crf -- --workloads small,typical --iterations 3
 *   npm run bench:crf -- --base-url http://localhost:3200   # existing server
 *
 * The browser phase starts `next start` on --port (default 3200) against the
 * existing `.next` build unless --base-url is given; run `npm run build`
 * first. Results go to .benchmark-results/crf/ (git-ignored).
 */

import fs from "fs";
import os from "os";
import path from "path";
import {
  CRF_WORKLOAD_SPECS,
  amendCrfWorkload,
  generateCrfWorkload,
  summarizeCrfWorkload,
  type CrfWorkloadId,
  type CrfWorkloadSummary,
} from "../lib/dx/crf-workloads";
import { inspectSourceState } from "../lib/dx/source-state";
import { BUILD_PROVENANCE_FILE } from "../lib/dx/benchmark-runner";
import {
  StudyProtocolEngine,
  compareStudyToBaseline,
  deterministicStringify,
  exportFormToSas,
  exportStudyToCdiscOdmXml,
  exportStudyToFhirQuestionnaire,
  exportStudyToR,
  exportStudyToSas,
  exportStudyToUsdm,
  exportUniversalCrfJson,
  exportUniversalCrfYaml,
  fillSampleValues,
  generateStudyAcrfBookHtml,
  generateStudyDocx,
  generateStudyPdf,
  loadStudyDraft,
  parseUniversalCrf,
  runFormTest,
  runScenariosForForm,
  saveStudyBaseline,
  saveStudyDraft,
  serializeBaselineDiffToCsv,
  validateStudyCompliance,
  STUDY_DRAFT_CORRUPT_BACKUP_KEY,
  STUDY_DRAFT_STORAGE_KEY,
  type StudyProtocol,
} from "../lib/crf";
import type { RawStorage } from "../lib/safe-storage";
import {
  summarizeTimings,
  type CrfBenchmarkOptions,
  type StepResult,
  type StepTiming,
} from "./benchmark-crf-shared";

export interface WorkloadEngineResult {
  workload: CrfWorkloadId;
  summary: CrfWorkloadSummary;
  documentBytes: number;
  retainedHeapBytes: number | null;
  steps: StepResult[];
}

const DEFAULT_OUTPUT = path.join(".benchmark-results", "crf");

function parseOptions(args: string[]): CrfBenchmarkOptions | null {
  const options: CrfBenchmarkOptions = {
    phases: new Set(["engine", "browser"]),
    workloads: CRF_WORKLOAD_SPECS.map((spec) => spec.id),
    iterations: 5,
    browserRuns: 3,
    baseUrl: null,
    port: 3200,
    outputDirectory: DEFAULT_OUTPUT,
    stepTimeoutMs: 120_000,
  };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    const next = () => {
      const value = args[++index];
      if (value === undefined) throw new Error(`${argument} needs a value.`);
      return value;
    };
    if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: npm run bench:crf -- [--phase engine|browser|all] [--workloads small,typical,stress] [--iterations N] [--browser-runs N] [--base-url URL] [--port N] [--out DIR] [--step-timeout MS]"
      );
      return null;
    } else if (argument === "--phase") {
      const phase = next();
      if (phase === "all") options.phases = new Set(["engine", "browser"]);
      else if (phase === "engine" || phase === "browser")
        options.phases = new Set([phase]);
      else throw new Error(`Unknown phase '${phase}'.`);
    } else if (argument === "--workloads") {
      const ids = next()
        .split(",")
        .map((id) => id.trim());
      for (const id of ids) {
        if (!CRF_WORKLOAD_SPECS.some((spec) => spec.id === id))
          throw new Error(`Unknown workload '${id}'.`);
      }
      options.workloads = ids as CrfWorkloadId[];
    } else if (argument === "--iterations") {
      options.iterations = Math.max(1, Number.parseInt(next(), 10) || 1);
    } else if (argument === "--browser-runs") {
      options.browserRuns = Math.max(1, Number.parseInt(next(), 10) || 1);
    } else if (argument === "--base-url") {
      options.baseUrl = next();
    } else if (argument === "--port") {
      options.port = Number.parseInt(next(), 10);
    } else if (argument === "--out") {
      options.outputDirectory = next();
    } else if (argument === "--step-timeout") {
      options.stepTimeoutMs = Number.parseInt(next(), 10);
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  return options;
}

/** Unbounded in-memory storage, so engine timings exclude browser quota. */
class MemoryStorage implements RawStorage {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }
  get length(): number {
    return this.data.size;
  }
}

type Measured = Record<string, string | number | boolean | null> | void;

/**
 * Runs `body` once as warm-up and then `iterations` times, timing each run.
 * A throw on any run marks the whole step failed with the error message.
 */
async function measure(
  workflow: string,
  step: string,
  iterations: number,
  body: () => Measured | Promise<Measured>
): Promise<StepResult> {
  const result = await measureQuietly(workflow, step, iterations, body);
  console.log(
    `  ${result.status.padEnd(7)} ${workflow} / ${step}: ${formatMs(result.timing)} ms ${result.reason ? `(${result.reason})` : formatFacts(result.facts)}`
  );
  return result;
}

async function measureQuietly(
  workflow: string,
  step: string,
  iterations: number,
  body: () => Measured | Promise<Measured>
): Promise<StepResult> {
  const samples: number[] = [];
  let facts: Measured;
  try {
    facts = await body();
    for (let run = 0; run < iterations; run++) {
      const started = performance.now();
      facts = await body();
      samples.push(performance.now() - started);
    }
  } catch (error) {
    return {
      workflow,
      step,
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
      ...(samples.length ? { timing: summarizeTimings(samples) } : {}),
    };
  }
  return {
    workflow,
    step,
    status: "passed",
    timing: summarizeTimings(samples),
    ...(facts ? { facts } : {}),
  };
}

function collectGarbage(): boolean {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (typeof gc !== "function") return false;
  gc();
  gc();
  return true;
}

function measureRetainedHeap(build: () => unknown): number | null {
  if (!collectGarbage()) return null;
  const before = process.memoryUsage().heapUsed;
  const retained = build();
  collectGarbage();
  const after = process.memoryUsage().heapUsed;
  // Keep the document reachable until after the second measurement.
  if (!retained) return null;
  return Math.max(0, after - before);
}

function largestForm(study: StudyProtocol) {
  return [...study.forms].sort(
    (a, b) =>
      b.sections.reduce((n, s) => n + s.fields.length, 0) -
      a.sections.reduce((n, s) => n + s.fields.length, 0)
  )[0];
}

async function runEngineWorkload(
  id: CrfWorkloadId,
  iterations: number
): Promise<WorkloadEngineResult> {
  const study = generateCrfWorkload(id);
  const summary = summarizeCrfWorkload(study);
  const documentBytes = Buffer.byteLength(JSON.stringify(study));
  const retainedHeapBytes = measureRetainedHeap(() => generateCrfWorkload(id));
  const steps: StepResult[] = [];
  const middleForm = study.forms[Math.floor(study.forms.length / 2)];
  const middleField = middleForm.sections[0].fields[6];
  // The weight field feeds the form's calculated field, so a rename has to
  // rewrite the formula that references it.
  const weightField = middleForm.sections[0].fields[1];
  const amendCount = Math.min(10, study.forms.length);
  const amended = amendCrfWorkload(study, amendCount);

  steps.push(
    await measure("generate", "generateCrfWorkload", iterations, () => {
      generateCrfWorkload(id);
    })
  );

  // --- Edit ---------------------------------------------------------------
  steps.push(
    await measure("edit", "updateField (label)", iterations, () => {
      const result = StudyProtocolEngine.updateField(
        study,
        middleForm.id,
        middleField.id,
        { label: "Edited label" }
      );
      if (result.error) throw new Error(result.error);
    })
  );
  steps.push(
    await measure(
      "edit",
      "renameFieldEverywhere (formula-referenced)",
      iterations,
      () => {
        const result = StudyProtocolEngine.renameFieldEverywhere(
          study,
          middleForm.id,
          weightField.id,
          "WEIGHTKG"
        );
        if (result.error) throw new Error(result.error);
        return { affectedReferences: result.affectedReferencesCount };
      }
    )
  );
  steps.push(
    await measure("edit", "addField", iterations, () => {
      const result = StudyProtocolEngine.addField(study, middleForm.id, {
        variableName: "NEWFLD",
        label: "New field",
        dataType: "text",
      });
      if (result.error) throw new Error(result.error);
    })
  );
  steps.push(
    await measure(
      "edit",
      "validateStudyCompliance (header diagnostics)",
      iterations,
      () => ({
        violations: validateStudyCompliance(study).length,
      })
    )
  );

  // --- Scenario run ---------------------------------------------------------
  steps.push(
    await measure(
      "scenario",
      "runScenariosForForm x all forms",
      iterations,
      () => {
        let passed = 0;
        let failed = 0;
        for (const form of study.forms) {
          for (const item of runScenariosForForm(study, form.id).summaries) {
            if (item.failed === 0) passed++;
            else failed++;
          }
        }
        if (failed > 0) throw new Error(`${failed} saved scenarios failed`);
        return { scenariosPassed: passed, scenariosFailed: failed };
      }
    )
  );
  const biggest = largestForm(study);
  steps.push(
    await measure(
      "scenario",
      "fillSampleValues + runFormTest (largest form)",
      iterations,
      () => {
        const values = fillSampleValues(
          biggest,
          {},
          { subjectId: "SUBJ-001", visitId: "v01" },
          study.codelists
        );
        const report = runFormTest(biggest, values, {
          subjectId: "SUBJ-001",
          visitId: "v01",
        });
        return { fieldsVisible: report.summary.fieldsVisible };
      }
    )
  );

  // --- Save / reopen ----------------------------------------------------------
  const storage = new MemoryStorage();
  steps.push(
    await measure("save-reopen", "saveStudyDraft", iterations, () => {
      const result = saveStudyDraft(study, storage);
      if (result.status !== "saved") throw new Error(`draft ${result.status}`);
      return {
        bytes: Buffer.byteLength(
          storage.getItem(STUDY_DRAFT_STORAGE_KEY) || ""
        ),
      };
    })
  );
  steps.push(
    await measure(
      "save-reopen",
      "loadStudyDraft + fidelity",
      iterations,
      () => {
        const result = loadStudyDraft(storage);
        if (result.status !== "recovered")
          throw new Error(`draft ${result.status}`);
        const identical =
          deterministicStringify(result.study) ===
          deterministicStringify(study);
        if (!identical)
          throw new Error("reopened draft differs from saved study");
        return { identical };
      }
    )
  );
  let nativeJson = "";
  steps.push(
    await measure(
      "save-reopen",
      "exportUniversalCrfJson (native file)",
      iterations,
      () => {
        nativeJson = exportUniversalCrfJson(study);
        return { bytes: Buffer.byteLength(nativeJson) };
      }
    )
  );
  steps.push(
    await measure(
      "save-reopen",
      "parseUniversalCrf (native reopen, schema-validated)",
      iterations,
      () => {
        const reopened = parseUniversalCrf(nativeJson);
        const same = summarizeCrfWorkload(reopened);
        if (JSON.stringify(same) !== JSON.stringify(summary))
          throw new Error("native reopen lost structure");
        return { structurePreserved: true };
      }
    )
  );
  steps.push(
    await measure("save-reopen", "corrupt draft recovery", iterations, () => {
      const corrupt = new MemoryStorage();
      const raw = JSON.stringify({ envelopeVersion: 1, savedAt: "x", study });
      corrupt.setItem(
        STUDY_DRAFT_STORAGE_KEY,
        raw.slice(0, Math.floor(raw.length / 2))
      );
      const result = loadStudyDraft(corrupt);
      const backedUp = corrupt.getItem(STUDY_DRAFT_CORRUPT_BACKUP_KEY) !== null;
      if (result.status !== "corrupt" || !backedUp)
        throw new Error(
          `truncated draft reported ${result.status}, backup ${backedUp}`
        );
      return { reported: result.status, backupPreserved: backedUp };
    })
  );

  // --- Baseline comparison ---------------------------------------------------
  let tagCounter = 0;
  steps.push(
    await measure(
      "baseline",
      "saveStudyBaseline (clone + checksum + persist)",
      iterations,
      () => {
        const baselineStorage = new MemoryStorage();
        const result = saveStudyBaseline(
          study,
          {
            versionTag: `v1.${tagCounter++}`,
            label: "Benchmark",
            actor: { name: "Benchmark" },
          },
          baselineStorage
        );
        if (result.status !== "saved")
          throw new Error(`baseline ${result.status}`);
        return {
          bytes: Buffer.byteLength(
            baselineStorage.getItem("crf_studio_baselines_v1") || ""
          ),
        };
      }
    )
  );
  steps.push(
    await measure(
      "baseline",
      "compareStudyToBaseline (amended study)",
      iterations,
      () => {
        const result = compareStudyToBaseline(amended.study, study, {
          id: "b1",
          versionTag: "v1.0",
          label: "Benchmark",
        });
        const fieldChanges = result.entries.filter(
          (entry) => entry.category === "field"
        ).length;
        if (fieldChanges !== amendCount)
          throw new Error(
            `expected ${amendCount} field changes, found ${fieldChanges}`
          );
        return { totalChanges: result.summary.totalChanges, fieldChanges };
      }
    )
  );
  steps.push(
    await measure("baseline", "serializeBaselineDiffToCsv", iterations, () => {
      const result = compareStudyToBaseline(amended.study, study, {
        id: "b1",
        versionTag: "v1.0",
        label: "Benchmark",
      });
      return { bytes: Buffer.byteLength(serializeBaselineDiffToCsv(result)) };
    })
  );

  // --- Export ------------------------------------------------------------------
  steps.push(
    await measure("export", "ODM-XML", iterations, () => ({
      bytes: Buffer.byteLength(exportStudyToCdiscOdmXml(study)),
    }))
  );
  // The ODM parser needs the browser's DOMParser. A jsdom stand-in measured
  // jsdom rather than the parser (28 s for the typical study), so the
  // reimport is measured in the browser phase through the studio's importer.
  steps.push({
    workflow: "export",
    step: "ODM-XML reimport",
    status: "skipped",
    reason: "needs a browser DOMParser; measured in the browser phase",
  });
  steps.push(
    await measure("export", "USDM JSON", iterations, () => ({
      bytes: Buffer.byteLength(exportStudyToUsdm(study)),
    }))
  );
  steps.push(
    await measure("export", "YAML", iterations, () => ({
      bytes: Buffer.byteLength(exportUniversalCrfYaml(study)),
    }))
  );
  steps.push(
    await measure("export", "SAS (whole study)", iterations, () => ({
      bytes: Buffer.byteLength(
        exportStudyToSas(study, {
          includeSampleData: true,
          includeProcContents: true,
          includeProcFreq: true,
        })
      ),
    }))
  );
  steps.push(
    await measure("export", "SAS (largest form)", iterations, () => ({
      bytes: Buffer.byteLength(
        exportFormToSas(biggest, study, { includeSampleData: true })
      ),
    }))
  );
  steps.push(
    await measure("export", "R (whole study)", iterations, () => ({
      bytes: Buffer.byteLength(
        exportStudyToR(study, {
          includeSampleData: true,
          includeGlimpse: true,
          useLabelledPackage: true,
        })
      ),
    }))
  );
  steps.push(
    await measure("export", "FHIR Questionnaire bundle", iterations, () => ({
      bytes: Buffer.byteLength(
        JSON.stringify(exportStudyToFhirQuestionnaire(study))
      ),
    }))
  );
  steps.push(
    await measure("export", "aCRF HTML book", iterations, () => ({
      bytes: Buffer.byteLength(generateStudyAcrfBookHtml(study)),
    }))
  );
  steps.push(
    await measure(
      "export",
      "DOCX (annotated, all forms)",
      iterations,
      async () => {
        const blob = await generateStudyDocx(study, {
          mode: "annotated",
          scope: "all",
          includeTableOfContents: true,
          includeSdtmAppendix: true,
          includeRulesSummary: true,
        });
        return { bytes: blob.size };
      }
    )
  );
  steps.push(
    await measure(
      "export",
      "PDF (annotated, all forms)",
      iterations,
      async () => {
        const blob = await generateStudyPdf(study, {
          mode: "annotated",
          scope: "all",
          includeTableOfContents: true,
          includeSdtmAppendix: true,
        });
        return { bytes: blob.size };
      }
    )
  );

  return { workload: id, summary, documentBytes, retainedHeapBytes, steps };
}

export interface MachineProvenance {
  capturedAt: string;
  node: string;
  platform: string;
  arch: string;
  cpuCount: number;
  cpuModel: string;
  totalMemoryBytes: number;
  gcExposed: boolean;
  /** 1/5/15-minute load averages at start; a shared machine skews latency. */
  loadAverage: number[];
}

export interface SourceProvenance {
  revision: string | null;
  dirty: boolean | null;
  buildId: string | null;
  buildProvenance: unknown;
}

function readMachine(): MachineProvenance {
  const cpus = os.cpus();
  return {
    capturedAt: new Date().toISOString(),
    node: process.version,
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model?.trim() || "unknown",
    totalMemoryBytes: os.totalmem(),
    gcExposed: typeof (globalThis as { gc?: unknown }).gc === "function",
    loadAverage: os.loadavg().map((value) => Number(value.toFixed(2))),
  };
}

function readSource(): SourceProvenance {
  let revision: string | null = null;
  let dirty: boolean | null = null;
  try {
    const state = inspectSourceState(process.cwd());
    revision = state.revision;
    dirty = state.dirty;
  } catch {
    // Not a git checkout; provenance is recorded as unknown, not invented.
  }
  const read = (file: string) => {
    try {
      return fs.readFileSync(path.join(process.cwd(), file), "utf-8").trim();
    } catch {
      return null;
    }
  };
  const provenanceRaw = read(BUILD_PROVENANCE_FILE);
  let buildProvenance: unknown = null;
  try {
    buildProvenance = provenanceRaw ? JSON.parse(provenanceRaw) : null;
  } catch {
    buildProvenance = null;
  }
  return {
    revision,
    dirty,
    buildId: read(path.join(".next", "BUILD_ID")),
    buildProvenance,
  };
}

function formatMs(timing?: StepTiming): string {
  if (!timing) return "n/a";
  return `${timing.median.toFixed(1)} / ${timing.p95.toFixed(1)}`;
}

function formatFacts(facts?: StepResult["facts"]): string {
  if (!facts) return "";
  return Object.entries(facts)
    .map(([key, value]) =>
      typeof value === "number" && /bytes/i.test(key)
        ? `${key}=${(value / 1024).toFixed(0)} KiB`
        : `${key}=${value}`
    )
    .join(", ");
}

/** Renders the engine results as a markdown section. */
export function renderEngineMarkdown(
  results: WorkloadEngineResult[],
  iterations: number
): string {
  const lines: string[] = [];
  lines.push(
    `### Engine phase (Node, ${iterations} measured iterations after 1 warm-up)`
  );
  lines.push("");
  lines.push(
    "| Workload | Forms | Fields | Repeat columns | Visits | Rules | Scenarios | JSON size | Retained heap |"
  );
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const result of results) {
    const s = result.summary;
    lines.push(
      `| ${result.workload} | ${s.forms} | ${s.fields} | ${s.repeatingColumns} | ${s.visits} | ${s.formRules + s.studyRules} | ${s.scenarios} | ${(result.documentBytes / 1024).toFixed(0)} KiB | ${result.retainedHeapBytes === null ? "not measured (run with --expose-gc)" : `${(result.retainedHeapBytes / 1048576).toFixed(1)} MiB`} |`
    );
  }
  lines.push("");
  const stepKeys =
    results[0]?.steps.map((step) => `${step.workflow}::${step.step}`) || [];
  lines.push(
    `| Workflow | Step | ${results.map((r) => `${r.workload} median / p95 ms`).join(" | ")} |`
  );
  lines.push(`| --- | --- | ${results.map(() => "---:").join(" | ")} |`);
  for (const key of stepKeys) {
    const [workflow, step] = key.split("::");
    const cells = results.map((result) => {
      const found = result.steps.find(
        (candidate) => `${candidate.workflow}::${candidate.step}` === key
      );
      if (!found) return "not run";
      if (found.status !== "passed")
        return `**${found.status}**: ${found.reason}`;
      return formatMs(found.timing);
    });
    lines.push(`| ${workflow} | ${step} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  lines.push("Facts recorded by the largest workload's steps:");
  lines.push("");
  const last = results[results.length - 1];
  for (const step of last?.steps || []) {
    if (step.facts)
      lines.push(
        `- ${step.workflow} / ${step.step}: ${formatFacts(step.facts)}`
      );
  }
  return lines.join("\n");
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parseOptions(args);
  if (!options) return;
  const machine = readMachine();
  const source = readSource();
  console.log(
    `CRF workload benchmark @ ${source.revision ?? "unknown revision"}${source.dirty ? " (dirty)" : ""}`
  );
  console.log(
    `Node ${machine.node}, ${machine.cpuCount} x ${machine.cpuModel}, gc exposed: ${machine.gcExposed}`
  );

  const engine: WorkloadEngineResult[] = [];
  if (options.phases.has("engine")) {
    for (const id of options.workloads) {
      console.log(`\n[engine] ${id}`);
      engine.push(await runEngineWorkload(id, options.iterations));
    }
  }

  let browser: unknown = null;
  let browserMarkdown = "";
  if (options.phases.has("browser")) {
    const { runBrowserPhase, renderBrowserMarkdown } =
      await import("./benchmark-crf-browser");
    const phase = await runBrowserPhase(options);
    browser = phase;
    browserMarkdown = renderBrowserMarkdown(phase);
  }

  const evidence = {
    version: 1,
    issue: 682,
    machine,
    source,
    options: { ...options, phases: Array.from(options.phases) },
    engine,
    browser,
  };
  fs.mkdirSync(options.outputDirectory, { recursive: true });
  const stamp = machine.capturedAt.replace(/[:.]/g, "-");
  const jsonPath = path.join(
    options.outputDirectory,
    `crf-workloads-${stamp}.json`
  );
  fs.writeFileSync(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
  const markdown = [
    `## CRF workload benchmark ${machine.capturedAt}`,
    "",
    `- Source: \`${source.revision ?? "unknown"}\`${source.dirty ? " (working tree dirty)" : ""}; build \`${source.buildId ?? "none"}\``,
    `- Machine: ${machine.cpuCount} x ${machine.cpuModel}, ${(machine.totalMemoryBytes / 1073741824).toFixed(1)} GiB, ${machine.platform} ${machine.arch}; Node ${machine.node}; load average at start ${machine.loadAverage.join(" / ")}, at end ${os
      .loadavg()
      .map((value) => value.toFixed(2))
      .join(" / ")}`,
    "",
    engine.length
      ? renderEngineMarkdown(engine, options.iterations)
      : "_Engine phase not run._",
    "",
    browserMarkdown || "_Browser phase not run._",
    "",
  ].join("\n");
  const markdownPath = path.join(
    options.outputDirectory,
    `crf-workloads-${stamp}.md`
  );
  fs.writeFileSync(markdownPath, markdown);
  console.log(
    `\nEvidence: ${path.relative(process.cwd(), jsonPath)}\nMarkdown: ${path.relative(process.cwd(), markdownPath)}`
  );
}

if (typeof process.env.VITEST === "undefined" && require.main === module) {
  main().catch((error: unknown) => {
    console.error(
      `CRF benchmark error: ${error instanceof Error ? error.stack || error.message : String(error)}`
    );
    process.exitCode = 1;
  });
}
