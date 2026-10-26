import type { Metadata } from "next";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { CaseStudyShowcase } from "@/components/CaseStudyShowcase";
import { BaseCaseStudy } from "@/types/domain";
import {
  getGitHubStats,
  parseGitHubUrl,
  GitHubStats,
  getSimulatedStats,
} from "@/lib/github";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ClinicalJourneyHighlight } from "@/components/clinical-journey/ClinicalJourneyHighlight";
import { PageLayout } from "@/components/PageLayout";
import { resolveBaseUrl } from "@/lib/domain";
import { getBreadcrumbSchema } from "@/lib/seo";
import { getBreadcrumbTrailSchema } from "@/lib/navigation";

// Daily: each regeneration bills Vercel active CPU, and content writes
// revalidate these paths on demand, so the timer is only a backstop (#2971).
export const revalidate = 86400;

export const metadata: Metadata = {
  // No site name here: app/layout.tsx templates this as
  // "%s | Frederick de Ruiter". Including it rendered the name twice.
  // The openGraph and twitter titles below are not templated, so they keep it.
  title: "Engineering Case Studies",
  description:
    "Projects by Fred de Ruiter: the problems, the implementation choices, and what happened along the way.",
  alternates: {
    canonical: "/case-studies",
  },
  openGraph: {
    title: "Engineering Case Studies | Frederick de Ruiter",
    description:
      "Projects by Fred de Ruiter: the problems, the implementation choices, and what happened along the way.",
    type: "website",
    url: `${resolveBaseUrl()}/case-studies`,
    images: [
      {
        url: `${resolveBaseUrl()}/case-studies/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Engineering Case Studies | Frederick de Ruiter",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Engineering Case Studies | Frederick de Ruiter",
    description:
      "The problems and decisions behind my clinical data tools, web apps, and side projects.",
    images: [`${resolveBaseUrl()}/case-studies/opengraph-image`],
  },
};

interface HydratedCaseStudy extends BaseCaseStudy {
  githubStats: GitHubStats | null;
}

export default async function CaseStudiesPage() {
  const data = await CaseStudyService.getAllPublishedCaseStudies();

  const caseStudies: HydratedCaseStudy[] = await Promise.all(
    data.map(async (d) => {
      let stats: GitHubStats | null = null;
      if (d.simulated_telemetry) {
        stats = getSimulatedStats(d.primary_language, d.slug);
      } else if (d.github_url) {
        const parsed = parseGitHubUrl(d.github_url);
        if (parsed) {
          stats = await getGitHubStats(
            parsed.owner,
            parsed.repo,
            d.primary_language,
            d.slug
          );
        }
      }
      return {
        ...d,
        created_at: new Date(d.created_at),
        updated_at: new Date(d.updated_at),
        githubStats: stats,
      };
    })
  );

  return (
    <PageLayout
      variant="standard"
      className="relative bg-zinc-950 text-foreground outline-none"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema(
            getBreadcrumbTrailSchema("/case-studies")
          ),
        }}
      />

      <div className="relative z-10 w-full flex flex-col items-center">
        {/* Navigation Breadcrumb */}
        <div className="w-full mb-6 sm:mb-8 flex justify-start">
          <Breadcrumbs path="/case-studies" />
        </div>

        {/* Page Header */}
        <div className="text-center max-w-3xl mb-10 sm:mb-14">
          <h1 className="type-display font-mono text-white mb-3">
            Engineering Case Studies
          </h1>
          <p className="text-xs sm:text-sm font-mono text-zinc-400 tracking-wider uppercase">
            What I built, why I built it, and how the pieces fit together.
          </p>
        </div>

        <div className="w-full max-w-6xl">
          <ClinicalJourneyHighlight headingLevel={2} />
        </div>

        {/* Dynamic Bento Showcase */}
        {caseStudies.length === 0 ? (
          <div className="text-center p-8 sm:p-12 bg-zinc-900/10 border border-zinc-900/40 border-dashed rounded-2xl w-full">
            <p className="text-sm text-zinc-400 italic mb-2">
              The project writeups aren’t loading right now.
            </p>
            <p className="text-xs text-zinc-500 font-mono">
              You can find project details and source code on my GitHub profile.
            </p>
          </div>
        ) : (
          <CaseStudyShowcase caseStudies={caseStudies} />
        )}
      </div>
    </PageLayout>
  );
}
