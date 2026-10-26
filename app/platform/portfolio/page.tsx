import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { PortfolioDashboard } from "@/components/platform/portfolio/PortfolioDashboard";
import {
  REGULATORY_WORDING,
  SYNTHETIC_DATA_NOTICE,
} from "@/lib/clinical-platform/presets";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.platformPortfolio
);

export default function PlatformPortfolioPage() {
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
          Dashboards / Portfolio
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
          Portfolio dashboard
        </h1>
        <p className="mt-5 max-w-3xl text-slate-300">
          Eight synthetic studies side by side against their plans: every
          study&apos;s milestones on one timeline, with the slips highlighted,
          how long each took to start up, recruit and lock its database against
          the rest of the portfolio, and what each is now forecast to cost
          against its budget. Every number comes from the governed metric
          registry, and every chart has its data table. To drill into one study,
          open the{" "}
          <Link
            href="/platform/operations"
            className="text-amber-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            operations dashboards
          </Link>
          .
        </p>
        <p className="mt-4 border-l-2 border-amber-500 pl-3 text-sm text-amber-200">
          {SYNTHETIC_DATA_NOTICE} {REGULATORY_WORDING}
        </p>
      </header>
      <div className="pt-10">
        <PortfolioDashboard />
      </div>
    </PageLayout>
  );
}
