"use client";

import { useEffect, useState } from "react";
import type { PortfolioDashboard as Dashboard } from "@/lib/clinical-platform";
import { createPortfolioClient } from "./portfolio-client";
import { PortfolioView } from "./PortfolioView";

/**
 * The /platform/portfolio dashboard. It is computed in a Web Worker from
 * the synthetic portfolio; nothing is fetched and no database is woken
 * (ADR 0066).
 */
export function PortfolioDashboard() {
  const [client] = useState(createPortfolioClient);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    client.dashboard().then(
      (result) => {
        if (live) setDashboard(result);
      },
      (failure: unknown) => {
        if (live) {
          setError(
            failure instanceof Error ? failure.message : String(failure)
          );
        }
      }
    );
    return () => {
      live = false;
      client.dispose();
    };
  }, [client]);

  return (
    <div className="min-w-0">
      <p role="status" className="sr-only">
        {dashboard === null
          ? error === null
            ? "Computing the portfolio dashboard from the synthetic portfolio."
            : ""
          : "Showing the portfolio dashboard."}
      </p>
      {error !== null && (
        <p
          role="alert"
          className="mb-6 border-l-2 border-red-500 pl-3 text-sm text-red-200"
        >
          The dashboard could not be computed: {error}
        </p>
      )}
      {dashboard === null ? (
        error === null && (
          <div
            aria-hidden="true"
            className="space-y-4"
            data-testid="portfolio-loading"
          >
            <div className="min-h-6 w-1/3 animate-pulse bg-white/[0.06]" />
            <div className="min-h-80 animate-pulse bg-white/[0.04]" />
            <div className="min-h-64 animate-pulse bg-white/[0.04]" />
          </div>
        )
      ) : (
        <PortfolioView dashboard={dashboard} />
      )}
    </div>
  );
}
