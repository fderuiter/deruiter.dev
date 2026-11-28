"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  RANDOMIZATION_RESOURCE_LIMITS,
  sanitizeDisplayLabel,
  type VerificationCheckStatus,
  type VerificationFinding,
  type VerificationReport,
} from "@/lib/randomization";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import {
  createRandomizationClient,
  type RandomizationClient,
} from "./randomization-client";
import { BUTTON, MONO } from "./RandomizationStageEditors";

const MAX_BYTES = RANDOMIZATION_RESOURCE_LIMITS.maxImportBytes;

const REJECTION_COPY: Record<string, string> = {
  FILE_TOO_LARGE: "The file is larger than the 8 MiB limit.",
  NESTING_TOO_DEEP: "The file nests deeper than the import limit allows.",
  INVALID_JSON: "The file isn't valid JSON.",
  NOT_AN_ARTIFACT: "The file isn't a randomization artifact.",
  MISSING_FIELD: "The file is missing a field every artifact needs.",
  UNSUPPORTED_VERSION:
    "The file uses a contract, artifact or canonical payload version this verifier doesn't support.",
  UNSUPPORTED_ALGORITHM:
    "The file names an engine this verifier can't rerun. Only the MT19937 block and minimization engines are supported.",
  TOO_MANY_ROWS: "The file has more rows than the engine allows.",
  INVALID_REQUEST:
    "The embedded request isn't a complete, valid plan (for example, a site weight is missing).",
};

const FAILURE_COPY: Record<string, string> = {
  FILE_TOO_LARGE: "The file is larger than the 8 MiB limit, so it wasn't read.",
  FALLBACK_BUDGET_EXCEEDED:
    "This browser can't run a background worker, and the file is too large to verify on the page.",
  READ_FAILED: "The file couldn't be read.",
};

const OUTCOME_COPY = {
  verified:
    "Verified. The digest matches, the request regenerates the same rows in the same order, and every invariant and provenance check passes.",
  failed: "Not verified. At least one check failed; see below.",
  "insufficient-evidence":
    "Insufficient evidence. The file is masked or doesn't say it holds real assignments, so the digest and regeneration checks could not run. The checks that could run are listed below.",
  rejected: "Not checked. The file couldn't be read as a supported artifact.",
} as const;

const STATUS_COPY: Record<VerificationCheckStatus, string> = {
  pass: "Pass",
  fail: "Fail",
  "not-run": "Not run",
};

const EVIDENCE_COPY: Record<string, string> = {
  MISSING_DISCLOSURE_METADATA: "The file has no disclosure metadata.",
  MASKED_PRESENTATION: "The file is a masked presentation.",
  NO_AUTHORITATIVE_ASSIGNMENTS: "The file says it holds no real assignments.",
};

/** What the panel is waiting for, or has, for one selected file. */
type Selection = { readonly token: number; readonly name: string };
type Result =
  | { readonly token: number; readonly report: VerificationReport }
  | { readonly token: number; readonly failure: string };

function short(hex: string | null): string {
  if (!hex) return "none";
  return hex.length > 16 ? `${hex.slice(0, 8)}…${hex.slice(-8)}` : hex;
}

function Findings({
  findings,
  total,
}: {
  readonly findings: readonly VerificationFinding[];
  readonly total: number;
}) {
  if (total === 0) return null;
  return (
    <>
      <ul className="ml-4 list-disc space-y-1 text-sm text-slate-300">
        {findings.map((finding, i) => (
          <li key={`${finding.code}-${i}`}>
            <span className={MONO}>{finding.code}</span>: {finding.message}
          </li>
        ))}
      </ul>
      {total > findings.length && (
        <p className="text-sm text-slate-400">
          {total - findings.length} more not listed.
        </p>
      )}
    </>
  );
}

function ReportView({ report }: { readonly report: VerificationReport }) {
  if (report.outcome === "rejected") {
    return (
      <p className="text-sm text-slate-300">
        {REJECTION_COPY[report.rejection ?? ""] ?? "The file was rejected."}
      </p>
    );
  }
  const { digest, regeneration, invariants, provenance } = report;
  return (
    <div className="space-y-3 text-sm">
      <p className={`${MONO} text-xs text-slate-400`}>
        {report.rowCount} rows · {report.method} ({report.algorithmId})
      </p>
      {report.evidence?.status === "insufficient-evidence" && (
        <p className="text-slate-300">{EVIDENCE_COPY[report.evidence.code]}</p>
      )}
      <dl className="grid min-w-0 gap-3">
        <div className="min-w-0">
          <dt className="font-medium">
            Integrity (content digest): {STATUS_COPY[digest.status]}
          </dt>
          <dd className={`${MONO} break-all text-xs text-slate-400`}>
            Recorded {short(digest.recorded)}
            {digest.status !== "not-run" &&
              `, recomputed ${short(digest.computed)}`}
          </dd>
        </div>
        <div className="min-w-0 space-y-2">
          <dt className="font-medium">
            Regeneration (every row and field):{" "}
            {STATUS_COPY[regeneration.status]}
          </dt>
          <dd className="space-y-2">
            {regeneration.status !== "not-run" && (
              <p className="text-slate-300">
                Expected {regeneration.expectedRows ?? "no"} rows, the file has{" "}
                {regeneration.actualRows}.
                {regeneration.diffCount > 0 &&
                  ` ${regeneration.diffCount} ${regeneration.diffCount === 1 ? "difference" : "differences"}.`}
              </p>
            )}
            {regeneration.diffs.length > 0 && (
              <div
                className="max-h-[24rem] overflow-auto rounded border border-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                role="region"
                aria-label="Row differences"
                tabIndex={0}
              >
                <table className="w-full min-w-0 text-left text-sm">
                  <caption className="sr-only">
                    Row differences, {regeneration.diffs.length} of{" "}
                    {regeneration.diffCount} listed
                  </caption>
                  <thead className="bg-[#13151a]">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Row
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Field
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Expected
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        In the file
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {regeneration.diffs.map((diff, i) => (
                      <tr key={i} className="border-t border-white/[0.08]">
                        <td className={`${MONO} px-3 py-1`}>
                          {diff.index + 1}
                        </td>
                        <td className={`${MONO} px-3 py-1`}>
                          {diff.category === "field"
                            ? diff.field
                            : diff.category === "missing-row"
                              ? "missing row"
                              : "extra row"}
                        </td>
                        <td className={`${MONO} break-all px-3 py-1`}>
                          {diff.expected || "—"}
                        </td>
                        <td className={`${MONO} break-all px-3 py-1`}>
                          {diff.actual || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {regeneration.diffCount > regeneration.diffs.length && (
              <p className="text-slate-400">
                {regeneration.diffCount - regeneration.diffs.length} more
                differences not listed.
              </p>
            )}
          </dd>
        </div>
        <div className="min-w-0 space-y-1">
          <dt className="font-medium">
            Invariants: {STATUS_COPY[invariants.status]}
          </dt>
          <dd>
            <Findings
              findings={invariants.findings}
              total={invariants.findingCount}
            />
          </dd>
        </div>
        <div className="min-w-0 space-y-1">
          <dt className="font-medium">
            Provenance: {STATUS_COPY[provenance.status]}
          </dt>
          <dd>
            <Findings
              findings={provenance.findings}
              total={provenance.findingCount}
            />
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** In-memory artifact passed from the governed export bar for one-click verification. */
export interface ExternalVerificationArtifact {
  readonly name: string;
  readonly content: string;
  readonly token: number;
}

/**
 * Verifies a randomization artifact file in this browser (#4009). The file
 * is read locally and never uploaded or logged. Verification runs on its
 * own worker, so it never touches a schedule on screen, and a newer file
 * replaces an older read or run.
 */
export function VerificationPanel({
  createClient,
  externalArtifact,
}: {
  readonly createClient?: () => RandomizationClient;
  readonly externalArtifact?: ExternalVerificationArtifact | null;
}) {
  const { announce } = useAnnouncer();
  const inputId = useId();
  const hintId = useId();
  const [client] = useState<RandomizationClient>(
    () => createClient?.() ?? createRandomizationClient()
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [dragging, setDragging] = useState(false);
  const latest = useRef(0);
  const handledExternalToken = useRef<number | null>(null);

  useEffect(() => () => client.dispose(), [client]);

  const busy = selection !== null && result?.token !== selection.token;

  const finish = (token: number, next: Result, message: string) => {
    if (latest.current !== token) return;
    setResult(next);
    announce(message);
  };

  const runVerificationText = (
    rawName: string,
    byteLength: number,
    readText: () => Promise<string>
  ) => {
    const token = ++latest.current;
    const name = sanitizeDisplayLabel(rawName) || "file";
    setSelection({ token, name });
    if (byteLength > MAX_BYTES) {
      finish(
        token,
        { token, failure: "FILE_TOO_LARGE" },
        "The file is larger than the 8 MiB limit."
      );
      return;
    }
    announce("Verifying the file.");
    void readText().then(
      (text) => {
        if (latest.current !== token) return;
        const encodedBytes = new TextEncoder().encode(text).byteLength;
        if (encodedBytes > MAX_BYTES) {
          finish(
            token,
            { token, failure: "FILE_TOO_LARGE" },
            "The file is larger than the 8 MiB limit."
          );
          return;
        }
        void client.verify(text).then((outcome) => {
          if (outcome.status === "complete") {
            finish(
              token,
              { token, report: outcome.report },
              OUTCOME_COPY[outcome.report.outcome].split(".")[0] + "."
            );
          } else if (outcome.status === "failed") {
            finish(
              token,
              { token, failure: outcome.code },
              "Verification couldn't run."
            );
          }
        });
      },
      () =>
        finish(
          token,
          { token, failure: "READ_FAILED" },
          "The file couldn't be read."
        )
    );
  };

  useEffect(() => {
    if (!externalArtifact) return;
    if (handledExternalToken.current === externalArtifact.token) return;
    handledExternalToken.current = externalArtifact.token;
    const byteLength = new TextEncoder().encode(
      externalArtifact.content
    ).byteLength;
    runVerificationText(externalArtifact.name, byteLength, () =>
      Promise.resolve(externalArtifact.content)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalArtifact]);

  const choose = (file: File | undefined) => {
    if (!file) return;
    runVerificationText(file.name, file.size, () => file.text());
  };

  const shown =
    result && selection && result.token === selection.token ? result : null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">
        Check a randomization JSON artifact in this browser. The file stays on
        your device and isn&apos;t changed. The verifier recomputes its digest,
        reruns its request and compares every row, field by field.
      </p>
      <div
        className={`rounded border border-dashed p-4 ${dragging ? "border-amber-500/70 bg-amber-500/10" : "border-white/[0.16]"}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          choose(event.dataTransfer.files[0]);
        }}
      >
        <label htmlFor={inputId} className="block text-sm font-medium">
          Artifact file (JSON, up to 8 MiB)
        </label>
        <input
          id={inputId}
          type="file"
          accept=".json,application/json"
          aria-describedby={hintId}
          className="mt-2 block min-h-12 w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded file:border file:border-white/[0.08] file:bg-[#0d0e11] file:px-3 file:text-[#f4f4f6]"
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <p id={hintId} className="mt-2 text-xs text-slate-400">
          Or drop the file here. Choosing another file replaces this check.
        </p>
      </div>

      <div role="status" aria-live="polite" className="space-y-2">
        {busy && selection && (
          <p className="text-sm text-slate-300">
            Verifying <span className={MONO}>{selection.name}</span>…
          </p>
        )}
        {shown && selection && (
          <p className="text-sm font-medium">
            <span className={`${MONO} text-slate-400`}>{selection.name}: </span>
            {"report" in shown
              ? OUTCOME_COPY[shown.report.outcome]
              : (FAILURE_COPY[shown.failure] ??
                `Verification couldn't run (${shown.failure}).`)}
          </p>
        )}
      </div>
      {shown && "report" in shown && <ReportView report={shown.report} />}
      {busy && (
        <button
          type="button"
          className={`${BUTTON} min-w-12`}
          onClick={() => {
            latest.current += 1;
            setSelection(null);
            client.dispose();
            announce("Verification canceled.");
          }}
        >
          Cancel verification
        </button>
      )}
    </div>
  );
}
