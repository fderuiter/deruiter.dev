import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { IntentLink } from "@/components/ui/IntentLink";
import { StudyDesignGrid } from "@/components/study-workspace/StudyDesignGrid";
import { getBreadcrumbTrailSchema } from "@/lib/navigation";
import { getBreadcrumbSchema, getWebApplicationSchema } from "@/lib/seo";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.studyStudio
);

const ADR_URL =
  "https://github.com/fderuiter/deruiter.dev/blob/main/adr/0074-clinical-study-studio-design-views.md";

/**
 * The studio's work areas, in the order a study is built. Each is a view of
 * one study workspace (ADR 0074); the Randomization area follows ADR 0073.
 */
const WORK_AREAS: readonly {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
}[] = [
  {
    id: "design",
    title: "Design",
    summary: "Arms by epochs, the elements in each cell, and interventions.",
    status: "Grid editor below",
  },
  {
    id: "schedule",
    title: "Schedule",
    summary: "Visits and the activities planned at each one.",
    status: "Not built yet",
  },
  {
    id: "narrative",
    title: "Narrative",
    summary: "Objectives, endpoints and the protocol text around them.",
    status: "Not built yet",
  },
  {
    id: "analysis",
    title: "Analysis intent",
    summary: "Estimands and the planned analysis, read by the study pipeline.",
    status: "Not built yet",
  },
  {
    id: "randomization",
    title: "Randomization",
    summary: "Allocation schemes, checked by simulation before use.",
    status: "Not built yet",
  },
];

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
        <p className="font-[family-name:var(--font-geist-mono)] text-xs uppercase tracking-[0.2em] text-amber-400">
          In development
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
          Clinical Study Studio
        </h1>
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
          read the same facts. The work areas below are being built; each lists
          what it will hold.
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

      <div className="@container mt-12">
        <ol className="grid gap-4 @md:grid-cols-2">
          {WORK_AREAS.map((area, index) => (
            <li key={area.id} className="min-w-0">
              <section
                aria-labelledby={`work-area-${area.id}`}
                className="h-full rounded-lg border border-white/[0.08] bg-[#13151a] p-5"
              >
                <p className="font-[family-name:var(--font-geist-mono)] text-xs text-slate-400">
                  {String(index + 1).padStart(2, "0")} · {area.status}
                </p>
                <h2
                  id={`work-area-${area.id}`}
                  className="mt-2 text-xl font-semibold tracking-[-0.035em]"
                >
                  {area.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {area.summary}
                </p>
              </section>
            </li>
          ))}
        </ol>
      </div>

      <section
        id="design-grid"
        aria-labelledby="design-grid-heading"
        className="mt-16 border-t border-white/[0.08] pt-12"
      >
        <h2
          id="design-grid-heading"
          className="text-2xl font-semibold tracking-[-0.035em]"
        >
          Design grid
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
          Arms are rows and epochs are columns. Select an arm, an epoch or a
          cell to rename, reorder or remove it, or to add and move the elements
          in a cell. Each change is a new revision of the study and can be
          undone. Where the study leaves a cell out, the grid says so instead of
          filling one in.
        </p>
        <div className="mt-8">
          <StudyDesignGrid />
        </div>
      </section>
    </PageLayout>
  );
}
