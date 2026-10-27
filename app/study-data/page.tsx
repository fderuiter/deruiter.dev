import type { Metadata } from "next";
import { IntentLink } from "@/components/ui/IntentLink";
import { PageLayout } from "@/components/PageLayout";
import { ClinicalJourneyNav } from "@/components/clinical-journey/ClinicalJourneyNav";
import { StudyDataWorkbench } from "@/components/study-data/StudyDataWorkbench";
import {
  toDefinitionCounts,
  toScheduleDesign,
} from "@/components/study-data/schedule-design";
import { getBreadcrumbTrailSchema } from "@/lib/navigation";
import { getBreadcrumbSchema, getWebApplicationSchema } from "@/lib/seo";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import {
  CDISC_CORE_URL,
  CONFORMANCE_RULES_VERSION,
  DEFAULT_SEED,
  DEFAULT_SUBJECT_COUNT,
  DEMO_301_STUDY,
  STANDARD_VERSIONS,
  SUBJECT_COUNT_LIMITS,
  SYNTHETIC_DATA_NOTICE,
  type StandardId,
} from "@/lib/study-data";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.studyData
);

const ADR_URL =
  "https://github.com/fderuiter/deruiter.dev/blob/main/adr/0065-study-data-pipeline-architecture.md";

const STANDARD_NAMES: Readonly<Record<StandardId, string>> = {
  USDM: "Unified Study Definitions Model",
  SDTM: "Study Data Tabulation Model",
  SDTMIG: "SDTM Implementation Guide",
  ADaM: "Analysis Data Model",
  ADaMIG: "ADaM Implementation Guide",
  OCCDS: "ADaM Occurrence Data Structure",
  "ADaM-CR": "ADaM Conformance Rules",
  "Define-XML": "Dataset metadata",
  "Dataset-JSON": "Dataset exchange format",
  ARS: "Analysis Results Standard",
  "NCI-EVS-CT": "NCI EVS controlled terminology, package date",
};

export default function StudyDataPage() {
  const config = ROUTE_METADATA_CONFIGS.studyData;
  return (
    <PageLayout className="bg-[#0d0e11] text-[#f4f4f6]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getWebApplicationSchema({
            name: config.title,
            description: config.description,
            url: config.path,
            applicationCategory: "DeveloperApplication",
            genre: "Clinical Data Engineering",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema(getBreadcrumbTrailSchema("/study-data")),
        }}
      />
      <header className="border-b border-white/[0.08] pb-12 sm:pb-16">
        <Breadcrumbs path="/study-data" className="mb-6" />
        <ClinicalJourneyNav path="/study-data" variant="compact" />
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
          Clinical systems / Study data
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
          Study Data Pipeline
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
          One fictional study, defined once in USDM, taken through collected
          data, SDTM, conformance checks, ADaM, Define-XML and the tables and
          figures of a study report. Select any number to see the records it
          came from and the protocol activity that scheduled them. To run a
          study of your own, design it in{" "}
          <IntentLink
            href="/crf"
            className="text-slate-100 underline decoration-zinc-600 underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            CRF Studio
          </IntentLink>{" "}
          and press Run Pipeline.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 font-mono text-xs">
          <span className="border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-amber-300">
            SYNTHETIC DATA
          </span>
          <span className="border border-white/[0.08] bg-[#13151a] px-3 py-2 text-slate-300">
            RUNS IN YOUR BROWSER
          </span>
          <span className="border border-white/[0.08] bg-[#13151a] px-3 py-2 text-slate-300">
            REPRODUCIBLE BY SEED
          </span>
        </div>
        <p className="mt-6 max-w-3xl border-l-2 border-amber-500 pl-4 text-sm leading-relaxed text-amber-100">
          {SYNTHETIC_DATA_NOTICE} {DEMO_301_STUDY.studyId} and its sponsor are
          fictional, and every subject is generated from a seed.
        </p>
      </header>

      <StudyDataWorkbench
        design={toScheduleDesign(DEMO_301_STUDY)}
        definitionCounts={toDefinitionCounts(DEMO_301_STUDY)}
        limits={{
          min: SUBJECT_COUNT_LIMITS.min,
          max: SUBJECT_COUNT_LIMITS.max,
        }}
        defaults={{ seed: DEFAULT_SEED, nSubjects: DEFAULT_SUBJECT_COUNT }}
      />

      <section
        aria-labelledby="versions-title"
        className="border-t border-white/[0.08] py-12 sm:py-16"
      >
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
          Standards / 05
        </p>
        <h2
          id="versions-title"
          className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl"
        >
          Versions and scope
        </h2>
        <div className="mt-8 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0 overflow-x-auto border border-white/[0.08] bg-[#13151a]">
            <table className="w-full border-collapse text-sm">
              <caption className="px-4 pb-2 pt-4 text-left text-sm font-semibold text-white">
                Standards each run applies and declares
              </caption>
              <thead>
                <tr className="border-y border-white/[0.12] text-left text-xs text-slate-300">
                  <th scope="col" className="px-4 py-2 font-normal">
                    Standard
                  </th>
                  <th scope="col" className="px-4 py-2 font-normal">
                    Version
                  </th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(STANDARD_VERSIONS) as StandardId[]).map((id) => (
                  <tr key={id} className="border-b border-white/[0.04]">
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      <span className="block font-mono text-xs text-amber-200">
                        {id}
                      </span>
                      <span className="block text-xs text-slate-300">
                        {STANDARD_NAMES[id]}
                      </span>
                    </th>
                    <td className="px-4 py-2 font-mono text-xs tabular-nums text-slate-100">
                      {STANDARD_VERSIONS[id]}
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-white/[0.04]">
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    <span className="block font-mono text-xs text-amber-200">
                      Rules
                    </span>
                    <span className="block text-xs text-slate-300">
                      The pipeline&apos;s own conformance rule set
                    </span>
                  </th>
                  <td className="px-4 py-2 font-mono text-xs tabular-nums text-slate-100">
                    {CONFORMANCE_RULES_VERSION}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="min-w-0 space-y-4 text-sm leading-relaxed text-slate-300">
            <p>
              Versions are pinned. Changing one is a controlled upgrade with an
              impact report across datasets, metadata and outputs, and every run
              declares them in its trial summary, its Define-XML and its
              manifest.
            </p>
            <p>
              The controlled terminology is a hand-curated subset of the NCI EVS
              CDISC package of the date shown. Every codelist and term it uses
              is checked against that release in the test suite.
            </p>
            <p>
              The conformance stage models a subset of published SDTM and ADaM
              rules, each cited by id. It is a demonstration, not a validator of
              record; the complete published rules run in{" "}
              <a
                href={CDISC_CORE_URL}
                className="text-amber-300 underline underline-offset-4 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                CDISC CORE
              </a>
              .
            </p>
            <p>
              No implementation guide text is copied: variables, codelist terms
              and rules are encoded in the pipeline&apos;s own words and cited
              by id. The design is recorded in{" "}
              <a
                href={ADR_URL}
                className="text-amber-300 underline underline-offset-4 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                ADR 0065
              </a>
              .
            </p>
            <p className="border-l-2 border-amber-500 pl-4 text-amber-100">
              {SYNTHETIC_DATA_NOTICE}
            </p>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
