"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStudioHashParams } from "@/hooks/useStudioHashParams";
import type {
  OperationsDashboard as Dashboard,
  OperationsScope,
  OperationsSectionId,
} from "@/lib/clinical-platform";
import { createOperationsClient } from "./operations-client";
import { OperationsView } from "./OperationsView";

const SECTION_IDS: readonly OperationsSectionId[] = [
  "enrollment",
  "activation",
  "data-management",
  "quality",
  "milestones",
];

function scopeOf(params: Record<string, string>): OperationsScope {
  const scope: { -readonly [K in keyof OperationsScope]: string } = {};
  if (params.study) scope.study = params.study;
  if (params.country) scope.country = params.country;
  if (params.site) scope.site = params.site;
  if (params.runby) scope.runBy = params.runby;
  return scope;
}

function viewOf(params: Record<string, string>): OperationsSectionId | null {
  const view = params.view as OperationsSectionId | undefined;
  return view !== undefined && SECTION_IDS.includes(view) ? view : null;
}

/**
 * The /platform/operations dashboard. The scope and the section live in the
 * URL hash (`#study=DEMO-302&country=DE&view=quality`), so every view has
 * an address and Back walks the drill-down. The dashboard is computed in a
 * Web Worker from the synthetic portfolio; nothing is fetched and no
 * database is woken (ADR 0066).
 */
export function OperationsDashboard() {
  const { params, setParams } = useStudioHashParams();
  const scope = useMemo(() => scopeOf(params), [params]);
  const view = viewOf(params);
  const scopeKey = JSON.stringify(scope);
  const [client] = useState(createOperationsClient);
  const [result, setResult] = useState<{
    key: string;
    dashboard: Dashboard | null;
    error: string | null;
  } | null>(null);

  useEffect(() => () => client.dispose(), [client]);

  useEffect(() => {
    let live = true;
    client.dashboard(JSON.parse(scopeKey) as OperationsScope).then(
      (dashboard) => {
        if (live) setResult({ key: scopeKey, dashboard, error: null });
      },
      (error: unknown) => {
        if (live) {
          setResult((previous) => ({
            key: scopeKey,
            dashboard: previous?.dashboard ?? null,
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      }
    );
    return () => {
      live = false;
    };
  }, [client, scopeKey]);

  const onView = useCallback(
    (next: OperationsSectionId) => setParams({ view: next }, { replace: true }),
    [setParams]
  );
  const onRunBy = useCallback(
    (runBy: string) => setParams({ runby: runBy || null }),
    [setParams]
  );

  const dashboard = result?.dashboard ?? null;
  const busy = result === null || result.key !== scopeKey;

  return (
    <div className="min-w-0">
      <p role="status" className="sr-only">
        {busy
          ? "Computing the dashboard from the synthetic portfolio."
          : dashboard === null
            ? ""
            : `Showing the ${dashboard.crumbs.at(-1)?.label ?? "portfolio"} dashboard.`}
      </p>
      {result?.error && (
        <p
          role="alert"
          className="mb-6 border-l-2 border-red-500 pl-3 text-sm text-red-200"
        >
          The dashboard could not be computed: {result.error}
        </p>
      )}
      {dashboard === null ? (
        !result?.error && (
          <div
            aria-hidden="true"
            className="space-y-4"
            data-testid="operations-loading"
          >
            <div className="min-h-6 w-1/3 animate-pulse bg-white/[0.06]" />
            <div className="min-h-24 animate-pulse bg-white/[0.04]" />
            <div className="min-h-64 animate-pulse bg-white/[0.04]" />
          </div>
        )
      ) : (
        <OperationsView
          dashboard={dashboard}
          view={view}
          onView={onView}
          onRunBy={onRunBy}
          busy={busy}
        />
      )}
    </div>
  );
}
