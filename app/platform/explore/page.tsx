import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { Explorer } from "@/components/platform/explore/Explorer";
import {
  REGULATORY_WORDING,
  SYNTHETIC_DATA_NOTICE,
} from "@/lib/clinical-platform/presets";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getBreadcrumbTrailSchema } from "@/lib/navigation";
import { getBreadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.platformExplore
);

export default function PlatformExplorePage() {
  return (
    <PageLayout className="overflow-x-hidden bg-[#0d0e11] text-[#f4f4f6]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema(
            getBreadcrumbTrailSchema("/platform/explore")
          ),
        }}
      />
      <header className="border-b border-white/[0.08] pb-10">
        <Breadcrumbs path="/platform/explore" />
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
          Self-service / Explore
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
          Explore the metrics
        </h1>
        <p className="mt-5 max-w-3xl text-slate-300">
          Pick a governed metric, group it, filter it and choose how to draw it.
          The explorer offers only what the semantic layer allows: the
          dimensions each metric may be grouped and filtered by, and the visuals
          that fit, so no exploration joins the wrong tables. Every result shows
          the metric&apos;s definition, version and SQL, and comes from the same
          registry as the{" "}
          <Link
            href="/platform/operations"
            className="text-amber-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            operations
          </Link>{" "}
          and{" "}
          <Link
            href="/platform/portfolio"
            className="text-amber-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            portfolio
          </Link>{" "}
          dashboards. An exploration is saved in the link, never on a server.
        </p>
        <p className="mt-4 border-l-2 border-amber-500 pl-3 text-sm text-amber-200">
          {SYNTHETIC_DATA_NOTICE} {REGULATORY_WORDING}
        </p>
      </header>
      <div className="pt-10">
        <Explorer />
      </div>
    </PageLayout>
  );
}
