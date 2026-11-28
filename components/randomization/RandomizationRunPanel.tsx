"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_DISPLAY_PROFILE,
  RANDOMIZATION_DISCLOSURE_POLICY_VERSION,
  decideRandomizationExport,
  resolvePresentation,
  serializeRandomizationExport,
  type AllocationRow,
  type DisplayProfile,
  type RandomizationRequest,
  type SimulationReport,
  type TextRandomizationExportKind,
} from "@/lib/randomization";
import { downloadFile } from "@/lib/download";
import type { StudyRandomizationEvidenceBinding } from "@/lib/study-workspace";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import { DisclosureControls } from "./DisclosureControls";
import { SimulationPanel } from "./SimulationPanel";
import {
  createRandomizationClient,
  type RandomizationClient,
} from "./randomization-client";
import { ResultsPanel } from "./ResultsPanel";
import { BUTTON, MONO } from "./RandomizationStageEditors";

/** Study metadata written into every export (RND-WORKS-001). */
interface StudyMetadata {
  readonly protocolId: string;
  readonly studyName: string;
  readonly phase: string;
}

/** Whether results belong to the plan as it is now, and why not. */
type Currency =
  | { readonly status: "current" }
  | { readonly status: "provenance-changed" }
  | { readonly status: "stale"; readonly reasons: readonly string[] };

const EXPORT_BUNDLE_FORMATS: readonly {
  readonly kind: TextRandomizationExportKind;
  readonly label: string;
  readonly hint: string;
}[] = [
  {
    kind: "csv",
    label: "Download CSV",
    hint: "Masked or full schedule table with study metadata header",
  },
  {
    kind: "allocation-json",
    label: "Artifact JSON",
    hint: "Canonical immutable allocation artifact with SHA-256 digest",
  },
  {
    kind: "seed-config",
    label: "Seed & config",
    hint: "Deterministic seed, ratios, and request configuration",
  },
  {
    kind: "executable-code",
    label: "Reproduction script",
    hint: "Self-contained Node.js (.mjs) digest verification script",
  },
  {
    kind: "validation-manifest",
    label: "Validation manifest",
    hint: "Provenance digests, schedule counts, and Monte Carlo QA link",
  },
];

/** "R7" to 7, for the client's revision guard. */
function revisionNumber(id: string): number {
  const n = Number.parseInt(id.replace(/^\D+/, ""), 10);
  return Number.isSafeInteger(n) ? n : 0;
}

/**
 * Run, cancel and review one ready randomization request (#4006). Run
 * freezes the request as it is at that moment; any later edit marks the
 * result stale instead of changing it. Results are shown through the
 * disclosure policy (#4005), masked by default, and all five text/JSON
 * exports pass through `decideRandomizationExport` and `serializeRandomizationExport`.
 */
export function RandomizationRunPanel({
  request,
  revisionId,
  lifecycle,
  acknowledged,
  metadata,
  bind,
  checkCurrency,
  createClient,
  onVerifyArtifact,
}: {
  /** The ready request, or null while the plan is not ready to run. */
  readonly request: RandomizationRequest | null;
  readonly revisionId: string;
  readonly lifecycle: "exploration" | "promoted";
  readonly acknowledged: boolean;
  readonly metadata: StudyMetadata;
  /** Records what a run is made from, at the moment it starts. */
  readonly bind: () => StudyRandomizationEvidenceBinding | null;
  /** Says whether a frozen run still matches the workspace. */
  readonly checkCurrency: (
    frozen: RandomizationRequest,
    binding: StudyRandomizationEvidenceBinding | null
  ) => Currency;
  readonly createClient?: () => RandomizationClient;
  /** Sends an exported allocation-json artifact straight to VerificationPanel. */
  readonly onVerifyArtifact?: (artifact: {
    readonly name: string;
    readonly content: string;
  }) => void;
}) {
  const { announce } = useAnnouncer();
  const exportHeadingId = useId();
  const [client] = useState<RandomizationClient>(
    () => createClient?.() ?? createRandomizationClient()
  );
  const state = useSyncExternalStore(
    client.subscribe,
    client.getState,
    client.getState
  );
  const [frozen, setFrozen] = useState<RandomizationRequest | null>(null);
  const [binding, setBinding] =
    useState<StudyRandomizationEvidenceBinding | null>(null);
  const [profile, setProfile] = useState<DisplayProfile>(
    DEFAULT_DISPLAY_PROFILE
  );
  const disclosureScopeKey = request?.id ?? "no-plan";
  const [acknowledgedScopeKey, setAcknowledgedScopeKey] = useState<
    string | null
  >(null);
  const fullDisclosureAcknowledged =
    acknowledgedScopeKey === disclosureScopeKey;
  const [simulationReport, setSimulationReport] =
    useState<SimulationReport | null>(null);

  useEffect(() => () => client.dispose(), [client]);

  const running = state.status === "running";
  const summary =
    state.status === "complete" && state.summary ? state.summary : null;
  const currency: Currency | null =
    summary && frozen ? checkCurrency(frozen, binding) : null;
  const presentation = resolvePresentation(profile);
  const disclosureMode = presentation.maskTreatment ? "masked" : "full";

  const run = () => {
    if (!request) return;
    setAcknowledgedScopeKey(null);
    setBinding(bind());
    // The seed is already on the request, so a rerun is reproducible.
    const snapshot = JSON.parse(
      JSON.stringify(request)
    ) as RandomizationRequest;
    setFrozen(snapshot);
    announce("Generating the schedule.");
    void client
      .generate({
        plan: snapshot,
        workspaceRevision: revisionNumber(revisionId),
      })
      .then((outcome) => {
        if (outcome.status === "complete") {
          announce(
            `Generated ${outcome.summary.rowCount} allocations.${outcome.summary.shortfall > 0 ? ` ${outcome.summary.shortfall} short of the target.` : ""}`
          );
        } else if (outcome.status === "canceled") {
          announce("Generation canceled.");
        } else {
          announce(`Generation failed: ${outcome.code}.`, "assertive");
        }
      });
  };

  const decideKind = (kind: TextRandomizationExportKind) =>
    decideRandomizationExport({
      kind,
      lifecycle,
      disclosure: disclosureMode,
      fullDisclosureAcknowledged,
      useNoticeAcknowledged: acknowledged,
    });

  const csvDecision = decideKind("csv");
  const artifactJsonDecision = decideKind("allocation-json");

  const collectAllRows = async (): Promise<AllocationRow[]> => {
    if (!summary) return [];
    const rows: AllocationRow[] = [];
    for (let offset = 0; offset < summary.rowCount; offset += 500) {
      const next = await client.page(offset, 500);
      rows.push(...next.rows);
    }
    return rows;
  };

  const buildExportBundleItem = async (kind: TextRandomizationExportKind) => {
    if (!summary || !frozen) return null;
    const decision = decideKind(kind);
    if (!decision.allowed) return null;
    const rows = await collectAllRows();
    const serialized = serializeRandomizationExport({
      kind,
      lifecycle,
      disclosure: disclosureMode,
      fullDisclosureAcknowledged,
      useNoticeAcknowledged: acknowledged,
      request: frozen,
      reducedRatios: summary.reducedRatios,
      rows,
      studyMetadata: metadata,
      counts: {
        allocatedCount: summary.rowCount,
        enrollmentTarget: summary.requestedRows,
        shortfall: summary.shortfall,
        partialBlockCount: summary.partialBlockCount ?? 0,
        exhaustedStrataCount: 0,
      },
      simulationReport,
    });
    return serialized.ok ? serialized : null;
  };

  const handleDownloadFormat = async (kind: TextRandomizationExportKind) => {
    const built = await buildExportBundleItem(kind);
    if (!built) return;
    downloadFile(built.content, built.filename, {
      mimeType: built.mimeType,
    });
    announce(`Exported ${built.filename}.`);
  };

  const handleVerifyGeneratedArtifact = async () => {
    if (!onVerifyArtifact) return;
    const built = await buildExportBundleItem("allocation-json");
    if (!built) return;
    onVerifyArtifact({ name: built.filename, content: built.content });
  };

  const canAcknowledgeFullDisclosure =
    lifecycle === "promoted" && acknowledged && !presentation.maskTreatment;

  return (
    <div className="space-y-4 border-t border-white/[0.08] pt-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`${BUTTON} min-w-12`}
          disabled={running || !request}
          onClick={run}
        >
          {summary ? "Run again" : "Run"}
        </button>
        <button
          type="button"
          className={`${BUTTON} min-w-12`}
          disabled={!running}
          onClick={() => client.cancel()}
        >
          Cancel
        </button>
      </div>
      <p role="status" aria-live="polite" className="text-sm text-slate-300">
        {running && "Generating the schedule…"}
        {state.status === "canceled" && "Canceled. Nothing was kept."}
        {state.status === "failed" &&
          `The run failed (${state.errorCode}). ${state.findings[0]?.message ?? ""}`}
        {summary &&
          `${summary.rowCount} of ${summary.requestedRows} allocations generated${summary.shortfall > 0 ? `, ${summary.shortfall} short because caps ran out` : ""}.`}
      </p>

      {summary && currency && currency.status !== "current" && (
        <p
          role="alert"
          className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
        >
          {currency.status === "stale"
            ? `These results are stale: ${currency.reasons.join(", ")}. Run again to match the plan.`
            : "The study has changed since this run, but not the plan's inputs. The allocations still apply; run again to bind them to this revision."}
        </p>
      )}

      {summary && (
        <div className="space-y-4">
          <DisclosureControls
            profile={profile}
            onChange={(next) => {
              setProfile(next);
              setAcknowledgedScopeKey(null);
            }}
          />
          {frozen && (
            <ResultsPanel
              key={state.identity?.operationId ?? 0}
              client={client}
              summary={summary}
              request={frozen}
              presentation={presentation}
              protocolId={metadata.protocolId}
              stale={currency?.status === "stale"}
            />
          )}

          <section
            aria-labelledby={exportHeadingId}
            data-testid="randomization-export-bundle"
            className="space-y-3 rounded border border-white/[0.08] bg-[#13151a] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h5 id={exportHeadingId} className="text-sm font-semibold">
                  Export and disclosure bundle
                </h5>
                <p className="text-xs text-slate-400">
                  Exports include all {summary.rowCount} rows in generated
                  order; table filters and sorting above do not alter them.
                </p>
              </div>
              <span
                className={`${MONO} rounded border border-white/[0.08] bg-[#0d0e11] px-2.5 py-1 text-xs text-slate-300`}
              >
                Mode: {disclosureMode} · policy v
                {RANDOMIZATION_DISCLOSURE_POLICY_VERSION}
                {simulationReport ? " · QA linked" : ""}
              </span>
            </div>

            {lifecycle === "exploration" ? (
              <p className="text-sm text-amber-200">
                An exploration cannot be exported. Promote it to a plan for this
                study first.
              </p>
            ) : !acknowledged ? (
              <p className="text-sm text-amber-200">
                Acknowledge the use notice before exporting.
              </p>
            ) : presentation.maskTreatment ? (
              <p className="text-xs text-slate-400">
                Masked mode allows CSV and validation manifest exports. To
                unlock full CSV, Artifact JSON, Seed &amp; config, and
                Reproduction script exports, switch to an unmasked view above
                (for example, Biostatistician + Show treatment values) and
                confirm full disclosure below.
              </p>
            ) : null}

            <label className="flex min-h-12 items-center gap-2.5 rounded border border-white/[0.08] bg-[#0d0e11] px-3 py-2 text-sm text-slate-200">
              <input
                type="checkbox"
                className="h-5 w-5 accent-amber-400 disabled:opacity-40"
                checked={
                  canAcknowledgeFullDisclosure && fullDisclosureAcknowledged
                }
                disabled={!canAcknowledgeFullDisclosure}
                onChange={(event) =>
                  setAcknowledgedScopeKey(
                    event.target.checked ? disclosureScopeKey : null
                  )
                }
              />
              <span>
                Confirm full-disclosure export: I understand unmasked schedules,
                seeds, and reproduction scripts reveal or rebuild every
                treatment assignment.
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              {EXPORT_BUNDLE_FORMATS.map((format) => {
                const decision = decideKind(format.kind);
                return (
                  <button
                    key={format.kind}
                    type="button"
                    title={format.hint}
                    className={`${BUTTON} min-w-12`}
                    disabled={!decision.allowed}
                    onClick={() => void handleDownloadFormat(format.kind)}
                  >
                    {format.label}
                  </button>
                );
              })}
              {onVerifyArtifact && (
                <button
                  type="button"
                  className={`${BUTTON} min-w-12 border-emerald-500/40 text-emerald-200 hover:border-emerald-400`}
                  disabled={!artifactJsonDecision.allowed}
                  onClick={() => void handleVerifyGeneratedArtifact()}
                >
                  Verify generated artifact
                </button>
              )}
            </div>

            {!csvDecision.allowed &&
              csvDecision.code === "FULL_DISCLOSURE_NOT_ACKNOWLEDGED" && (
                <p className="text-xs text-amber-200">
                  Check the full-disclosure confirmation above to enable all
                  five export formats and one-click artifact verification.
                </p>
              )}
          </section>
        </div>
      )}

      {request && (
        <SimulationPanel
          plan={request}
          workspaceRevision={revisionNumber(revisionId)}
          onReportChange={setSimulationReport}
        />
      )}
    </div>
  );
}
