import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import {
  REGULATORY_WORDING,
  SYNTHETIC_DATA_NOTICE,
} from "@/lib/clinical-platform/presets";
import StrategyStudio from "./StrategyStudio";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.platformStrategy
);

export default function PlatformStrategyPage() {
  return (
    <PageLayout className="overflow-x-hidden bg-[#0d0e11] text-[#f4f4f6]">
      <header className="border-b border-white/[0.08] pb-10">
        <Link
          href="/platform"
          className="text-sm text-amber-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          ← Clinical Data Platform
        </Link>
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
          Decision systems / Strategy
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
          Platform strategy toolkit
        </h1>
        <p className="mt-5 max-w-3xl text-slate-300">
          Compare fictional platform options, examine the assumptions that move
          a decision, and export a reviewable memo. Every input lives in this
          page’s URL hash.
        </p>
        <p className="mt-4 border-l-2 border-amber-500 pl-3 text-sm text-amber-200">
          {SYNTHETIC_DATA_NOTICE} Illustrative decisions are not procurement
          advice or evidence of validated systems. {REGULATORY_WORDING}
        </p>
      </header>
      <StrategyStudio />
    </PageLayout>
  );
}
