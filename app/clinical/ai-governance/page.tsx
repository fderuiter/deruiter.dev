import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { AI_GOVERNANCE_PAGE_COPY } from "@/lib/clinical-ai-governance";
import { getBreadcrumbTrailSchema } from "@/lib/navigation";
import { getBreadcrumbSchema } from "@/lib/seo";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import { AiGovernanceWorkspace } from "./AiGovernanceWorkspace";
import { loadAiGovernanceEvidence } from "./evidence";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.clinicalAiGovernance
);

const LINK =
  "underline decoration-zinc-600 underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

/**
 * Interactive AI governance workspace at `/clinical/ai-governance`.
 *
 * Precomputes deterministic CRF linter violations, recorded CDISC CORE views,
 * pinned standard versions and SHA-256 package digests on `DEMO-301` at build
 * time, then mounts client review and evaluation controls.
 */
export default async function ClinicalAiGovernancePage() {
  const copy = AI_GOVERNANCE_PAGE_COPY;
  const evidence = await loadAiGovernanceEvidence();

  return (
    <PageLayout className="overflow-x-hidden bg-[#0d0e11] text-[#f4f4f6]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema(
            getBreadcrumbTrailSchema("/clinical/ai-governance")
          ),
        }}
      />
      <header className="border-b border-white/[0.08] pb-10 sm:pb-14">
        <Breadcrumbs path="/clinical/ai-governance" />
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
          {copy.eyebrow}
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
          {copy.title}
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
          {copy.intro}
        </p>
        <p
          role="note"
          className="mt-6 max-w-3xl border-l-2 border-amber-500 pl-4 text-sm leading-relaxed text-slate-300"
        >
          {copy.banner}
        </p>

        <nav aria-label="On this page" className="mt-8">
          <ul className="flex min-w-0 flex-wrap gap-x-6 gap-y-2 text-sm">
            {copy.sections.map((section) => (
              <li key={section.id} className="min-w-0">
                <a
                  href={`#${section.id}`}
                  className={`${LINK} inline-flex min-h-11 items-center text-amber-300`}
                >
                  {section.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <section aria-labelledby="references-title" className="py-10 sm:py-14">
        <h2
          id="references-title"
          className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl"
        >
          {copy.referencesHeading}
        </h2>
        <p className="mt-3 max-w-3xl text-slate-300">{copy.referencesIntro}</p>
        <ul className="mt-6 grid min-w-0 gap-4 md:grid-cols-3">
          {copy.references.map((ref) => (
            <li
              key={ref.id}
              className="min-w-0 border border-white/[0.08] bg-[#13151a] p-5"
            >
              <h3 className="break-words text-lg font-semibold tracking-[-0.02em]">
                <a href={ref.href} className={LINK}>
                  {ref.title}
                </a>
              </h3>
              <p className="mt-2 break-words font-mono text-xs text-amber-400">
                {ref.status}
              </p>
              <p className="mt-3 break-words text-sm leading-relaxed text-slate-300">
                {ref.summary}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <AiGovernanceWorkspace evidence={evidence} />
    </PageLayout>
  );
}
