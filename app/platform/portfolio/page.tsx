import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { PortfolioDashboard } from "@/components/platform/portfolio/PortfolioDashboard";
import {
  REGULATORY_WORDING,
  SYNTHETIC_DATA_NOTICE,
} from "@/lib/clinical-platform/presets";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getBreadcrumbTrailSchema } from "@/lib/navigation";
import { getBreadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.platformPortfolio
);

export default function PlatformPortfolioPage() {
  return (
    <PageLayout className="overflow-x-hidden bg-[#0d0e11] text-[#f4f4f6]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema(
            getBreadcrumbTrailSchema("/platform/portfolio")
          ),
        }}
      />
      <header className="border-b border-white/[0.08] pb-10">
        <Breadcrumbs path="/platform/portfolio" />
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
          Dashboards / Portfolio
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
          Portfolio dashboard
        </h1>
        <p className="mt-5 max-w-3xl text-slate-300">
          Eight synthetic studies side by side against their plans: each rated
          on schedule, budget and quality by stated rules, every study&apos;s
          milestones on one timeline, with the slips highlighted, how long each
          took to start up, recruit and lock its database against the rest of
          the portfolio, what each is now forecast to cost against its budget,
          and when each study still enrolling is likely to enroll its last
          subject, with a what-if that adds sites. Every measure comes from the
          governed metric registry, the enrollment forecast from a seeded Monte
          Carlo model, and every chart has its data table. To drill into one
          study, open the{" "}
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
