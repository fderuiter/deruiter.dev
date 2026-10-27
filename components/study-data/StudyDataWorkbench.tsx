"use client";

import { CLINICAL_STANDARDS_PROFILE } from "@/lib/clinical-standards";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  MESSY_DATA_SCENARIOS,
  coreViewReport,
  loadRecordedCoreFindings,
  type DataLayer,
  type LineageOrigin,
  type LineageRecord,
  type LineageResult,
  type LineageTrace,
  type RecordedFindings,
  type ScenarioId,
} from "@/lib/study-data";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import { ConformancePanel } from "./ConformancePanel";
import type { RailStageId } from "./copy";
import { DatasetViewer, type RowReveal } from "./DatasetViewer";
import { DefineViewer } from "./DefineViewer";
import {
  STUDY_DATA_HANDOFF_SOURCE,
  takeStudyHandoff,
  type TakenHandoff,
} from "./handoff-storage";
import { HandoffPanel } from "./HandoffPanel";
import { InjectedIssuePanel } from "./InjectedIssuePanel";
import { LineageExplorer } from "./LineageExplorer";
import {
  createPipelineClient,
  PipelineCancelledError,
  type PipelineClient,
} from "./pipeline-client";
import {
  ROW_PAGE_SIZE,
  TRACE_LIMIT,
  type InjectedIssue,
  type PackageKind,
  type PreparedStudy,
  type RunSummary,
} from "./protocol";
import { ReviewerGuidePanel } from "./ReviewerGuidePanel";
import { ScheduleViewer, type ScheduleDesign } from "./ScheduleViewer";
import { StageRail, type DefinitionCounts } from "./StageRail";
import { TlfPanel } from "./TlfPanel";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  EYEBROW,
  FIELD,
  HEADING,
  PANEL,
} from "./ui";

type TabId =
  "datasets" | "conformance" | "define" | "guides" | "tlf" | "schedule";

const TABS: readonly { id: TabId; label: string }[] = [
  { id: "tlf", label: "Tables and figures" },
  { id: "datasets", label: "Datasets" },
  { id: "conformance", label: "Conformance" },
  { id: "define", label: "Define-XML" },
  { id: "guides", label: "Reviewer guides" },
  { id: "schedule", label: "Study definition" },
];

const STAGE_TARGETS: Readonly<
  Record<RailStageId, { tab: TabId; dataset?: string }>
> = {
  usdm: { tab: "schedule" },
  collected: { tab: "datasets", dataset: "collected:DM" },
  sdtm: { tab: "datasets", dataset: "sdtm:DM" },
  conformance: { tab: "conformance" },
  adam: { tab: "datasets", dataset: "adam:ADSL" },
  define: { tab: "define" },
  tlf: { tab: "tlf" },
};

/** Inputs shown before any run, from the server page. */
interface StudyDataWorkbenchProps {
  readonly design: ScheduleDesign;
  readonly definitionCounts: DefinitionCounts;
  readonly limits: { readonly min: number; readonly max: number };
  readonly defaults: { readonly seed: number; readonly nSubjects: number };
}

type RunStatus = "running" | "ready" | "error" | "restoring" | "waiting";

/** A study handed over from CRF Studio, once checked. */
interface Handoff {
  readonly study: unknown;
  readonly prepared: Extract<PreparedStudy, { ok: true }>;
}

function handoffNotice(taken: TakenHandoff, prepared?: PreparedStudy): string {
  if (taken.status === "missing") {
    return "No study was handed over from CRF Studio in this tab, so the page runs DEMO-301. In CRF Studio, press Run Pipeline on a study.";
  }
  if (taken.status === "unreadable") {
    return "The study handed over from CRF Studio could not be read from this tab's storage, so the page runs DEMO-301.";
  }
  if (prepared && !prepared.ok) {
    const what =
      prepared.problem === "schema"
        ? `fails the USDM v${CLINICAL_STANDARDS_PROFILE.USDM} schema (${prepared.total.toLocaleString("en-US")} ${prepared.total === 1 ? "issue" : "issues"}, first: ${prepared.issues[0]})`
        : `cannot be read as a study: ${prepared.issues[0]}`;
    return `The study handed over from CRF Studio ${what}, so the page runs DEMO-301.`;
  }
  return "";
}

const MAX_SEED = 4294967295;

/** One sentence on where the gate caught an injected scenario. */
function injectedAnnouncement(injected: InjectedIssue): string {
  const { scenario, subject, caught } = injected;
  if (subject === null) {
    return `${scenario.title}: no subject was eligible, so nothing was changed.`;
  }
  if (scenario.expected.findings.length === 0) {
    return `${scenario.title} injected into ${subject}; the gate raises no finding for it by design.`;
  }
  return caught.length > 0
    ? `${scenario.title} injected into ${subject}; the gate caught it with ${caught.length} ${caught.length === 1 ? "finding" : "findings"}.`
    : `${scenario.title} injected into ${subject}; the gate did not catch it.`;
}

function parseWhole(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

function saveFile(
  bytes: Uint8Array,
  fileName: string,
  type = "application/zip"
) {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const url = URL.createObjectURL(new Blob([copy.buffer], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The interactive part of /study-data: run controls, the stage rail, the
 * viewers and the lineage explorer. The pipeline itself runs in a Web
 * Worker that loads on the first run (see `pipeline-client.ts`).
 */
export function StudyDataWorkbench({
  design,
  definitionCounts,
  limits,
  defaults,
}: StudyDataWorkbenchProps) {
  const { announce } = useAnnouncer();
  const clientRef = useRef<PipelineClient | null>(null);
  const runToken = useRef(0);
  const lineageHeading = useRef<HTMLHeadingElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const pendingCellFocus = useRef<string | null>(null);
  const seedId = useId();
  const subjectsId = useId();
  const seedHelpId = useId();
  const subjectsHelpId = useId();
  const scenarioId = useId();
  const scenarioHelpId = useId();

  const [seedText, setSeedText] = useState(String(defaults.seed));
  const [subjectsText, setSubjectsText] = useState(String(defaults.nSubjects));
  const [scenario, setScenario] = useState<ScenarioId | "">("");
  const [inputError, setInputError] = useState<{
    seed?: string;
    subjects?: string;
  }>({});
  const [status, setStatus] = useState<RunStatus>("running");
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [handoffMessage, setHandoffMessage] = useState("");
  const handoffTaken = useRef<TakenHandoff | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [mode, setMode] = useState<"worker" | "main-thread" | "idle">("idle");
  const [tab, setTab] = useState<TabId>("tlf");
  const [datasetKey, setDatasetKey] = useState("adam:ADSL");
  const [reveal, setReveal] = useState<RowReveal | null>(null);
  const [tlfOutput, setTlfOutput] = useState<string | null>(null);
  const [trace, setTrace] = useState<LineageTrace | null>(null);
  const [traceBusy, setTraceBusy] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [download, setDownload] = useState<{
    busy: PackageKind | null;
    message: string;
  }>({ busy: null, message: "" });

  const [recorded, setRecorded] = useState<{
    findings: RecordedFindings | null;
    failed: boolean;
  }>({ findings: null, failed: false });

  // CORE's recorded findings load as their own chunk, and only once the
  // conformance tab is opened.
  useEffect(() => {
    if (tab !== "conformance" || recorded.findings || recorded.failed) return;
    let live = true;
    loadRecordedCoreFindings().then(
      (findings) => {
        if (live) setRecorded({ findings, failed: false });
      },
      () => {
        if (live) setRecorded({ findings: null, failed: true });
      }
    );
    return () => {
      live = false;
    };
  }, [tab, recorded.findings, recorded.failed]);

  const coreView = summary?.coreView ?? null;
  const coreReport = useMemo(
    () =>
      recorded.findings && coreView
        ? coreViewReport(recorded.findings, coreView)
        : null,
    [recorded.findings, coreView]
  );

  const client = useCallback((): PipelineClient => {
    clientRef.current ??= createPipelineClient();
    return clientRef.current;
  }, []);

  const startRun = useCallback(
    (
      seed: number,
      nSubjects: number,
      study: unknown,
      restoring = false,
      injected?: ScenarioId
    ) => {
      const token = ++runToken.current;
      const pipeline = client();
      pipeline
        .request<"run">({
          type: "run",
          seed,
          nSubjects,
          ...(study === undefined ? {} : { study }),
          ...(injected === undefined ? {} : { scenario: injected }),
        })
        .then((result) => {
          if (token !== runToken.current) return;
          setSummary(result);
          setMode(pipeline.mode());
          setStatus("ready");
          setRunError(null);
          setTrace(null);
          setTraceError(null);
          if (!restoring) {
            announce(
              `Pipeline run complete: ${nSubjects.toLocaleString("en-US")} subjects, seed ${seed}.${result.injected ? ` ${injectedAnnouncement(result.injected)}` : ""}`
            );
          }
        })
        .catch((error: unknown) => {
          if (token !== runToken.current) return;
          if (error instanceof PipelineCancelledError) return;
          setStatus("error");
          setRunError(error instanceof Error ? error.message : String(error));
        });
    },
    [announce, client]
  );

  useEffect(() => {
    const source = new URLSearchParams(window.location.search).get("source");
    if (source !== STUDY_DATA_HANDOFF_SOURCE) {
      startRun(defaults.seed, defaults.nSubjects, undefined);
      return () => clientRef.current?.dispose();
    }
    // Taking the study removes it, so keep what was taken across the
    // development double mount.
    const taken = (handoffTaken.current ??= takeStudyHandoff());
    let live = true;
    const fallBack = (message: string) => {
      if (!live) return;
      setHandoffMessage(message);
      startRun(defaults.seed, defaults.nSubjects, undefined);
    };
    if (taken.status !== "found") {
      fallBack(handoffNotice(taken));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("waiting");
      client()
        .request<"prepare">({ type: "prepare", study: taken.usdm })
        .then((prepared) => {
          if (!live) return;
          if (!prepared.ok) {
            setStatus("running");
            fallBack(handoffNotice(taken, prepared));
            return;
          }
          setHandoff({ study: taken.usdm, prepared });
          announce(
            `Study ${prepared.report.studyId} handed over from CRF Studio. Review what the pipeline will tabulate, then run it.`
          );
        })
        .catch((error: unknown) => {
          if (error instanceof PipelineCancelledError) return;
          setStatus("running");
          fallBack(
            `The study handed over from CRF Studio could not be checked (${error instanceof Error ? error.message : String(error)}), so the page runs DEMO-301.`
          );
        });
    }
    return () => {
      live = false;
      clientRef.current?.dispose();
    };
  }, [announce, client, defaults.seed, defaults.nSubjects, startRun]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const seed = parseWhole(seedText);
    const nSubjects = parseWhole(subjectsText);
    const errors: { seed?: string; subjects?: string } = {};
    if (seed === null || seed > MAX_SEED) {
      errors.seed = `Enter a whole number from 0 to ${MAX_SEED.toLocaleString("en-US")}.`;
    }
    if (
      nSubjects === null ||
      nSubjects < limits.min ||
      nSubjects > limits.max
    ) {
      errors.subjects = `Enter a whole number from ${limits.min} to ${limits.max.toLocaleString("en-US")}.`;
    }
    setInputError(errors);
    if (seed === null || nSubjects === null || errors.seed || errors.subjects) {
      return;
    }
    if (status === "running" || status === "restoring") client().cancel();
    setStatus("running");
    setRunError(null);
    announce(
      `Running the pipeline for ${nSubjects.toLocaleString("en-US")} subjects.`
    );
    startRun(seed, nSubjects, handoff?.study, false, scenario || undefined);
  };

  const onUseDemo = () => {
    if (status === "running" || status === "restoring") client().cancel();
    setHandoff(null);
    setHandoffMessage(
      "Showing DEMO-301. To run the CRF Studio study again, hand it over from CRF Studio."
    );
    setSummary(null);
    setTrace(null);
    setStatus("running");
    announce("Switched to the DEMO-301 study.");
    startRun(defaults.seed, defaults.nSubjects, undefined);
  };

  const onDownloadHandoff = () => {
    if (!handoff) return;
    saveFile(
      new TextEncoder().encode(`${JSON.stringify(handoff.study, null, 2)}\n`),
      `${handoff.prepared.report.studyId.toLowerCase()}.usdm.json`,
      "application/json"
    );
  };

  const onCancel = () => {
    client().cancel();
    runToken.current += 1;
    if (summary) {
      setStatus("restoring");
      announce("Run cancelled. Restoring the previous run.");
      startRun(
        summary.seed,
        summary.nSubjects,
        handoff?.study,
        true,
        summary.injected?.scenario.id
      );
    } else {
      setStatus("error");
      setRunError("The run was cancelled. Run the pipeline to start again.");
    }
  };

  const traceFrom = useCallback(
    (origin: LineageOrigin) => {
      if (!summary) return;
      setTraceBusy(true);
      setTraceError(null);
      client()
        .request<"trace">({
          type: "trace",
          runId: summary.runId,
          origin,
          limit: TRACE_LIMIT,
        })
        .then((result) => {
          setTrace(result);
          setTraceBusy(false);
          announce(
            `Traced ${result.title}: ${result.adam.total} ADaM rows, ${result.sdtm.total} SDTM records, ${result.collected.total} collected records, ${result.results.total} results.`
          );
          const heading = lineageHeading.current;
          if (heading) {
            heading.focus({ preventScroll: true });
            const reduced = window.matchMedia?.(
              "(prefers-reduced-motion: reduce)"
            ).matches;
            heading.scrollIntoView?.({
              behavior: reduced ? "auto" : "smooth",
              block: "start",
            });
          }
        })
        .catch((error: unknown) => {
          setTraceBusy(false);
          if (error instanceof PipelineCancelledError) return;
          setTraceError(error instanceof Error ? error.message : String(error));
        });
    },
    [announce, client, summary]
  );

  const loadRows = useCallback(
    (key: string, offset: number, limit: number) => {
      if (!summary) return Promise.reject(new Error("No run yet."));
      return client().request<"rows">({
        type: "rows",
        runId: summary.runId,
        key,
        offset,
        limit: Math.min(limit, ROW_PAGE_SIZE),
      });
    },
    [client, summary]
  );

  const onDownload = (kind: PackageKind) => {
    if (!summary) return;
    setDownload({ busy: kind, message: "Building the archive…" });
    client()
      .request<"package">({ type: "package", runId: summary.runId, kind })
      .then((file) => {
        saveFile(file.bytes, file.fileName);
        setDownload({
          busy: null,
          message: `Saved ${file.fileName}: ${file.fileCount} files, ${(file.bytes.length / 1024).toFixed(0)} KB.`,
        });
      })
      .catch((error: unknown) => {
        setDownload({
          busy: null,
          message:
            error instanceof Error
              ? `The download failed: ${error.message}`
              : "The download failed.",
        });
      });
  };

  const openStage = (stage: RailStageId) => {
    const target = STAGE_TARGETS[stage];
    setTab(target.tab);
    if (target.dataset) setDatasetKey(target.dataset);
    workspaceRef.current?.scrollIntoView({ block: "start" });
    document.getElementById(`study-data-tab-${target.tab}`)?.focus();
  };

  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((item) => item.id === tab);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    setTab(TABS[next].id);
    document.getElementById(`study-data-tab-${TABS[next].id}`)?.focus();
  };

  const revealRow = (layer: DataLayer, dataset: string, row: number) => {
    const key = `${layer}:${dataset}`;
    setTab("datasets");
    setDatasetKey(key);
    setReveal({ key, row, nonce: Date.now() });
  };

  const viewRecord = (record: LineageRecord) =>
    revealRow(record.layer, record.dataset, record.row);

  const showFindingRow = (layer: DataLayer, dataset: string, row: number) => {
    revealRow(layer, dataset, row);
    workspaceRef.current?.scrollIntoView({ block: "start" });
    document.getElementById("study-data-tab-datasets")?.focus();
  };

  const showResult = (result: LineageResult) => {
    if (!result.display) return;
    setTab("tlf");
    setTlfOutput(result.display.outputId);
    pendingCellFocus.current = result.display.resultIds.join(" ");
  };

  useEffect(() => {
    const ids = pendingCellFocus.current;
    if (!ids || tab !== "tlf") return;
    pendingCellFocus.current = null;
    workspaceRef.current
      ?.querySelector<HTMLElement>(`[data-ars-results="${CSS.escape(ids)}"]`)
      ?.focus();
  }, [tab, tlfOutput, trace]);

  const traceExample = () => {
    const table = summary?.tables.find((item) => item.number === "14.2.1");
    const section = table?.sections.find((item) =>
      item.label.startsWith("Week 12, observed")
    );
    const cell = section?.rows.find((row) => row.label === "Mean")?.cells[0];
    if (cell) traceFrom({ kind: "result", resultIds: cell.resultIds });
  };

  const origin = trace?.origin;
  const tracedResults = origin?.kind === "result" ? origin.resultIds : null;
  const tracedRow =
    origin?.kind === "record" &&
    `${origin.layer}:${origin.dataset}` === datasetKey
      ? origin.row
      : null;
  const tracedActivity =
    origin?.kind === "activity"
      ? { activityId: origin.activityId, visitId: origin.visitId }
      : null;
  const running = status === "running" || status === "restoring";
  const statusText =
    status === "waiting"
      ? handoff
        ? `Study ${handoff.prepared.report.studyId} is ready. Run the pipeline to generate its data.`
        : "Checking the study handed over from CRF Studio…"
      : status === "restoring"
        ? "Run cancelled. Restoring the previous run…"
        : status === "running"
          ? "Running the pipeline…"
          : status === "error"
            ? runError
            : summary
              ? `Run ${summary.runId}: ${summary.nSubjects.toLocaleString("en-US")} subjects, seed ${summary.seed}, ${(summary.elapsedMs / 1000).toFixed(1)} s ${mode === "worker" ? "in a Web Worker" : "on the main thread"}.`
              : "";

  return (
    <>
      <section
        aria-labelledby="run-title"
        className="border-b border-white/[0.08] py-12 sm:py-16"
      >
        <p className={EYEBROW}>Run / 01</p>
        <h2 id="run-title" className={`mt-2 ${HEADING}`}>
          Run the pipeline
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
          The engine runs in your browser, in a Web Worker, so nothing is sent
          to a server. The same seed and subject count always give the same
          datasets, tables and figures.
        </p>
        {handoffMessage ? (
          <p className="mt-4 max-w-3xl break-words border-l-2 border-amber-500 pl-4 text-xs leading-relaxed text-amber-100">
            {handoffMessage}
          </p>
        ) : null}
        {handoff ? (
          <HandoffPanel
            report={handoff.prepared.report}
            onUseDemo={onUseDemo}
            onDownload={onDownloadHandoff}
          />
        ) : null}
        <form
          onSubmit={onSubmit}
          noValidate
          className="mt-6 grid min-w-0 gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,12rem)_minmax(0,26rem)] sm:items-start"
        >
          <div className="min-w-0">
            <label
              htmlFor={seedId}
              className="mb-1 block font-mono text-xs uppercase tracking-[0.14em] text-slate-300"
            >
              Seed
            </label>
            <input
              id={seedId}
              inputMode="numeric"
              autoComplete="off"
              value={seedText}
              onChange={(event) => setSeedText(event.target.value)}
              aria-invalid={inputError.seed ? true : undefined}
              aria-describedby={seedHelpId}
              className={FIELD}
            />
            <p
              id={seedHelpId}
              className={`mt-1 text-xs ${inputError.seed ? "text-rose-300" : "text-slate-400"}`}
            >
              {inputError.seed ?? "Any whole number."}
            </p>
          </div>
          <div className="min-w-0">
            <label
              htmlFor={subjectsId}
              className="mb-1 block font-mono text-xs uppercase tracking-[0.14em] text-slate-300"
            >
              Subjects
            </label>
            <input
              id={subjectsId}
              inputMode="numeric"
              autoComplete="off"
              value={subjectsText}
              onChange={(event) => setSubjectsText(event.target.value)}
              aria-invalid={inputError.subjects ? true : undefined}
              aria-describedby={subjectsHelpId}
              className={FIELD}
            />
            <p
              id={subjectsHelpId}
              className={`mt-1 text-xs ${inputError.subjects ? "text-rose-300" : "text-slate-400"}`}
            >
              {inputError.subjects ??
                `${limits.min} to ${limits.max.toLocaleString("en-US")} screened subjects.`}
            </p>
          </div>
          <div className="min-w-0">
            <label
              htmlFor={scenarioId}
              className="mb-1 block font-mono text-xs uppercase tracking-[0.14em] text-slate-300"
            >
              Inject an issue
            </label>
            <select
              id={scenarioId}
              value={scenario}
              onChange={(event) =>
                setScenario(event.target.value as ScenarioId | "")
              }
              aria-describedby={scenarioHelpId}
              className={`${FIELD} font-sans`}
            >
              <option value="">None: the study as generated</option>
              {MESSY_DATA_SCENARIOS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <p
              id={scenarioHelpId}
              className="mt-1 break-words text-xs text-slate-400"
            >
              {scenario
                ? MESSY_DATA_SCENARIOS.find((item) => item.id === scenario)
                    ?.description
                : "Change one subject's records, then see whether the gate catches it."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            <button type="submit" className={`${BUTTON_PRIMARY} min-h-12`}>
              Run pipeline
            </button>
            {running ? (
              <button
                type="button"
                onClick={onCancel}
                className={`${BUTTON_SECONDARY} min-h-12`}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        <p
          role="status"
          className={`mt-4 min-h-6 font-mono text-xs ${status === "error" ? "text-rose-300" : "text-slate-300"}`}
        >
          {statusText}
        </p>
        {summary?.injected && !running ? (
          <InjectedIssuePanel
            injected={summary.injected}
            onShowRow={showFindingRow}
          />
        ) : null}
        <div className={`${PANEL} mt-6 p-4 sm:p-5`}>
          <h3 className="text-sm font-semibold text-white">Download the run</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">
            The datasets archive holds every SDTM and ADaM dataset as
            Dataset-JSON, CSV and XPT, a define.xml per layer, a README and a
            manifest of SHA-256 hashes. The outputs archive holds the tables as
            HTML and RTF, the figure as SVG and HTML, and the ARS reporting
            event as JSON.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!summary || running || download.busy !== null}
              onClick={() => onDownload("submission")}
              className={`${BUTTON_SECONDARY} min-h-12`}
            >
              {download.busy === "submission" ? "Building…" : "Datasets (.zip)"}
            </button>
            <button
              type="button"
              disabled={!summary || running || download.busy !== null}
              onClick={() => onDownload("outputs")}
              className={`${BUTTON_SECONDARY} min-h-12`}
            >
              {download.busy === "outputs"
                ? "Building…"
                : "Tables and figures (.zip)"}
            </button>
          </div>
          <p role="status" className="mt-3 min-h-5 text-xs text-slate-300">
            {download.message}
          </p>
        </div>
      </section>

      <section aria-labelledby="stages-title" className="py-12 sm:py-16">
        <p className={EYEBROW}>Stages / 02</p>
        <h2 id="stages-title" className={`mt-2 ${HEADING}`}>
          From protocol to tables
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
          One study definition flows through seven stages. Counts are for the
          current run.
        </p>
        <div className="mt-8">
          <StageRail
            definition={handoff?.prepared.counts ?? definitionCounts}
            counts={summary?.counts ?? null}
            onOpen={openStage}
          />
        </div>
      </section>

      <section
        aria-labelledby="workspace-title"
        className="border-t border-white/[0.08] py-12 sm:py-16"
      >
        <div ref={workspaceRef} className="scroll-mt-28">
          <p className={EYEBROW}>Outputs / 03</p>
          <h2 id="workspace-title" className={`mt-2 ${HEADING}`}>
            Inspect the run
          </h2>
        </div>
        <div
          role="tablist"
          aria-label="Run viewers"
          onKeyDown={onTabKey}
          className="mt-6 flex min-w-0 flex-wrap gap-1 border-b border-white/[0.08]"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              id={`study-data-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              aria-controls="study-data-panel"
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              className={`-mb-px min-h-12 border-b-2 px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-400 ${tab === item.id ? "border-amber-400 text-white" : "border-transparent text-slate-300 hover:text-white"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          id="study-data-panel"
          role="tabpanel"
          aria-labelledby={`study-data-tab-${tab}`}
          className="mt-6 min-h-[36rem] min-w-0"
        >
          {tab === "schedule" ? (
            <ScheduleViewer
              design={handoff?.prepared.design ?? design}
              selected={tracedActivity}
              onTrace={(activityId, visitId) =>
                traceFrom({
                  kind: "activity",
                  activityId,
                  ...(visitId ? { visitId } : {}),
                })
              }
            />
          ) : !summary ? (
            <div
              className={`${PANEL} flex min-h-[20rem] items-center justify-center p-6 text-sm text-slate-300`}
            >
              {status === "error"
                ? runError
                : status === "waiting"
                  ? "Run the pipeline to see the outputs for the handed-over study."
                  : "Generating synthetic subjects and building the datasets…"}
            </div>
          ) : tab === "datasets" ? (
            <DatasetViewer
              runId={summary.runId}
              datasets={summary.datasets}
              selectedKey={datasetKey}
              onSelectKey={setDatasetKey}
              loadRows={loadRows}
              onTrace={(layer: DataLayer, dataset: string, row: number) =>
                traceFrom({ kind: "record", layer, dataset, row })
              }
              tracedRow={tracedRow}
              reveal={reveal}
            />
          ) : tab === "conformance" ? (
            <ConformancePanel
              report={summary.conformance}
              findings={summary.findings}
              onTrace={(layer, dataset, row) =>
                traceFrom({ kind: "record", layer, dataset, row })
              }
              core={{
                report: coreReport,
                loading: recorded.findings === null && !recorded.failed,
                failed: recorded.failed,
                defaults,
                twins: recorded.findings?.twins ?? {},
              }}
            />
          ) : tab === "define" ? (
            <DefineViewer define={summary.define} />
          ) : tab === "guides" ? (
            <ReviewerGuidePanel guides={summary.guides} />
          ) : (
            <TlfPanel
              tables={summary.tables}
              figures={summary.figures}
              current={tlfOutput ?? summary.tables[0]?.outputId ?? ""}
              onCurrent={setTlfOutput}
              selected={tracedResults}
              onTrace={(resultIds) => traceFrom({ kind: "result", resultIds })}
            />
          )}
        </div>
      </section>

      <LineageExplorer
        trace={trace}
        busy={traceBusy}
        error={traceError}
        headingRef={lineageHeading}
        onTraceRecord={(record) =>
          traceFrom({
            kind: "record",
            layer: record.layer,
            dataset: record.dataset,
            row: record.row,
          })
        }
        onViewRecord={viewRecord}
        onTraceResult={(resultIds) => traceFrom({ kind: "result", resultIds })}
        onShowResult={showResult}
        onTraceActivity={(activityId, visitId) =>
          traceFrom({
            kind: "activity",
            activityId,
            ...(visitId ? { visitId } : {}),
          })
        }
        onExample={summary ? traceExample : null}
      />
    </>
  );
}
