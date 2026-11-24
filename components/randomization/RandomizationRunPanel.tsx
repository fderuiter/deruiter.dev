"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_DISPLAY_PROFILE,
  computePlanDigest,
  decideRandomizationExport,
  presentAllocationRows,
  resolvePresentation,
  type AllocationRow,
  type DisplayProfile,
  type RandomizationRequest,
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
import { BUTTON } from "./RandomizationStageEditors";

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

/** "R7" to 7, for the client's revision guard. */
function revisionNumber(id: string): number {
  const n = Number.parseInt(id.replace(/^\D+/, ""), 10);
  return Number.isSafeInteger(n) ? n : 0;
}

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Run, cancel and review one ready randomization request (#4006). Run
 * freezes the request as it is at that moment; any later edit marks the
 * result stale instead of changing it. Results are shown through the
 * disclosure policy (#4005), masked by default, and the CSV export goes
 * through the single export gate with the study metadata in its header.
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
}) {
  const { announce } = useAnnouncer();
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

  useEffect(() => () => client.dispose(), [client]);

  const running = state.status === "running";
  const summary =
    state.status === "complete" && state.summary ? state.summary : null;
  const currency: Currency | null =
    summary && frozen ? checkCurrency(frozen, binding) : null;
  const presentation = resolvePresentation(profile);

  const run = () => {
    if (!request) return;
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

  const exportDecision = decideRandomizationExport({
    kind: "csv",
    lifecycle,
    disclosure: presentation.maskTreatment ? "masked" : "full",
    fullDisclosureAcknowledged: false,
    useNoticeAcknowledged: acknowledged,
  });

  const downloadCsv = async () => {
    if (!summary || !frozen || !exportDecision.allowed) return;
    const rows: AllocationRow[] = [];
    for (let offset = 0; offset < summary.rowCount; offset += 500) {
      const next = await client.page(offset, 500);
      rows.push(...next.rows);
    }
    const shown = presentAllocationRows(rows, presentation);
    const header = [
      `# Protocol ID: ${metadata.protocolId || "not stated"}`,
      `# Study name: ${metadata.studyName || "not stated"}`,
      `# Phase: ${metadata.phase || "not stated"}`,
      `# Plan: ${frozen.name} (${frozen.id})`,
      `# Seed: ${frozen.seed.value} (${frozen.seed.source})`,
      `# Plan digest: ${computePlanDigest(frozen)}`,
      `# Content digest: ${summary.contentDigest}`,
      `# Disclosure: ${exportDecision.metadata.label}, policy ${exportDecision.metadata.disclosurePolicyVersion}`,
    ];
    const lines = [
      ...header,
      "sequence,subject_id,site_id,stratum_key,arm_code",
      ...shown.map((row) =>
        [row.sequence, row.subjectId, row.siteId, row.stratumKey, row.armCode]
          .map(csvCell)
          .join(",")
      ),
    ];
    downloadFile(lines.join("\n"), `${frozen.id}-schedule.csv`, {
      mimeType: "text/csv",
    });
  };

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
          <DisclosureControls profile={profile} onChange={setProfile} />
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

          <div className="space-y-1">
            <button
              type="button"
              className={`${BUTTON} min-w-12`}
              disabled={!exportDecision.allowed}
              onClick={() => void downloadCsv()}
            >
              Download CSV
            </button>
            <p className="text-sm text-slate-400">
              The full schedule: all {summary.rowCount} rows in generated order.
              Filters and sorting above don&apos;t apply to it.
            </p>
            {!exportDecision.allowed && (
              <p className="text-sm text-slate-400">
                {exportDecision.code === "EXPLORATION_EXPORT_BLOCKED"
                  ? "An exploration cannot be exported. Promote it to a plan for this study first."
                  : exportDecision.code === "USE_NOTICE_REQUIRED"
                    ? "Acknowledge the use notice before exporting."
                    : "Masked export only. Mask the treatment column to download."}
              </p>
            )}
          </div>
        </div>
      )}

      {request && (
        <SimulationPanel
          plan={request}
          workspaceRevision={revisionNumber(revisionId)}
        />
      )}
    </div>
  );
}
