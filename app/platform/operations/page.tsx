import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { OperationsDashboard } from "@/components/platform/operations/OperationsDashboard";
import {
  REGULATORY_WORDING,
  SYNTHETIC_DATA_NOTICE,
} from "@/lib/clinical-platform/presets";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.platformOperations
);

export default function PlatformOperationsPage() {
  return (
    <PageLayout className="overflow-x-hidden bg-[#0d0e11] text-[#f4f4f6]">
      <header className="border-b border-white/[0.08] pb-10">
        <Link
          href="/platform"
          className="text-sm text-amber-300 underline underline-offset-4 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          ← Clinical Data Platform
        </Link>
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
          Dashboards / Operations
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
          Clinical operations dashboards
        </h1>
        <p className="mt-5 max-w-3xl text-slate-300">
          Enrollment, site activation, data management, quality, risk and
          milestones for a synthetic sponsor portfolio. Drill from the portfolio
          to a study, a country and a site; every number comes from the governed
          metric registry, and every chart has its data table. A study&apos;s
          Risk tab shows its key risk indicators, quality tolerance limits and
          central statistical monitoring.
        </p>
        <p className="mt-4 border-l-2 border-amber-500 pl-3 text-sm text-amber-200">
          {SYNTHETIC_DATA_NOTICE} {REGULATORY_WORDING}
        </p>
      </header>
      <div className="pt-10">
        <OperationsDashboard />
      </div>
    </PageLayout>
  );
}
