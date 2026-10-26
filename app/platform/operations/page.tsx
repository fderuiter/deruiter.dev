import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { OperationsDashboard } from "@/components/platform/operations/OperationsDashboard";
import {
  REGULATORY_WORDING,
  SYNTHETIC_DATA_NOTICE,
} from "@/lib/clinical-platform/presets";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getBreadcrumbTrailSchema } from "@/lib/navigation";
import { getBreadcrumbSchema } from "@/lib/seo";

const LINK =
  "text-amber-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-400";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.platformOperations
);

export default function PlatformOperationsPage() {
  return (
    <PageLayout className="overflow-x-hidden bg-[#0d0e11] text-[#f4f4f6]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema(
            getBreadcrumbTrailSchema("/platform/operations")
          ),
        }}
      />
      <header className="border-b border-white/[0.08] pb-10">
        <Breadcrumbs path="/platform/operations" />
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
          central statistical monitoring. Every study side by side is on the{" "}
          <Link href="/platform/portfolio" className={LINK}>
            portfolio dashboard
          </Link>
          , a question of your own goes to the{" "}
          <Link href="/platform/explore" className={LINK}>
            metrics explorer
          </Link>
          , and each metric&apos;s definition and owner are in the{" "}
          <Link href="/platform/governance" className={LINK}>
            data catalog
          </Link>
          .
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
