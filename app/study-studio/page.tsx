import type { Metadata } from "next";
import { ClinicalJourneyNav } from "@/components/clinical-journey/ClinicalJourneyNav";
import { JourneyStepLabel } from "@/components/clinical-journey/JourneyStepLabel";
import { PageLayout } from "@/components/PageLayout";
import { StudyStudioWorkspace } from "@/components/study-workspace/StudyStudioWorkspace";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { IntentLink } from "@/components/ui/IntentLink";
import { getBreadcrumbTrailSchema } from "@/lib/navigation";
import { getBreadcrumbSchema, getWebApplicationSchema } from "@/lib/seo";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.studyStudio
);

const ADR_URL =
  "https://github.com/fderuiter/deruiter.dev/blob/main/adr/0074-clinical-study-studio-design-views.md";

export default function StudyStudioPage() {
  const config = ROUTE_METADATA_CONFIGS.studyStudio;
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
          __html: getBreadcrumbSchema(
            getBreadcrumbTrailSchema("/study-studio")
          ),
        }}
      />
      <header className="border-b border-white/[0.08] pb-12 sm:pb-16">
        <Breadcrumbs path="/study-studio" className="mb-6" />
        <JourneyStepLabel
          path="/study-studio"
          fallback="Clinical Study Studio"
        />
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
          Clinical Study Studio
        </h1>
        <ClinicalJourneyNav
          path="/study-studio"
          variant="compact"
          className="mt-6"
        />
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
          Open a study defined in USDM and work on its design, schedule,
          narrative, analysis intent and randomization in one place. Every view
          edits the same study workspace, so the{" "}
          <IntentLink
            href="/crf"
            className="text-amber-300 underline underline-offset-4"
          >
            CRF Studio
          </IntentLink>{" "}
          and the{" "}
          <IntentLink
            href="/study-data"
            className="text-amber-300 underline underline-offset-4"
          >
            Study Data Pipeline
          </IntentLink>{" "}
          read the same facts.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
          Synthetic and reference studies only.{" "}
          <a
            href={ADR_URL}
            className="text-slate-300 underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            Architecture decision (ADR 0074)
          </a>
        </p>
      </header>

      <section
        id="study-workspace"
        aria-label="Study workspace"
        className="mt-12"
      >
        <StudyStudioWorkspace />
      </section>
    </PageLayout>
  );
}
