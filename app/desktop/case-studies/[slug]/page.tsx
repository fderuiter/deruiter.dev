import { CaseStudyService } from "@/lib/services/case-study-service";
import { logger } from "@/lib/logger";
import { notFound } from "next/navigation";
import Image from "next/image";
import { SandboxTerminal } from "@/components/SandboxTerminal";
import { IconTerminal } from "@tabler/icons-react";
import { TracingBeam } from "@/components/ui/TracingBeam";
import { RichNarrative } from "@/components/RichNarrative";
import { InlineMarkdown } from "@/components/ui/InlineMarkdown";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  getGitHubStats,
  parseGitHubUrl,
  getSimulatedStats,
} from "@/lib/github";
import {
  getSoftwareSourceCodeSchema,
  getBreadcrumbSchema,
  getVisualArtworkSchema,
} from "@/lib/seo";
import { TelemetryTracker } from "@/components/TelemetryTracker";
import { TerminologyToggle } from "@/components/TerminologyToggle";
import { CaseStudyHeroActions } from "@/components/CaseStudyHeroActions";
import SchemaFlowWorkspaceWrapper from "@/components/SchemaFlowWorkspaceWrapper";
import { VectorComparisonViewer } from "@/components/laser-loon/VectorComparisonViewer";
import { AssetDistributionHub } from "@/components/laser-loon/AssetDistributionHub";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { PageLayout } from "@/components/PageLayout";
import { resolveBaseUrl } from "@/lib/domain";
import { CaseStudyFeedbackSection } from "@/components/CaseStudyFeedbackSection";

import type { Metadata } from "next";

export const revalidate = 3600;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await CaseStudyService.getAllPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const study = await CaseStudyService.getCaseStudyBySlug(slug);

  if (!study) {
    return {
      title: "Case Study Not Found",
      description: "The requested case study was not found.",
    };
  }

  const cleanDescription = (study.editorial_content || "")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\*/g, "")
    .trim()
    .slice(0, 160);

  const ogImageUrl = `${resolveBaseUrl()}/case-studies/${slug}/opengraph-image`;

  return {
    title: `${study.title} | Case Study`,
    description: cleanDescription,
    alternates: {
      canonical: `/case-studies/${slug}`,
    },
    openGraph: {
      title: `${study.title} | Case Study`,
      description: cleanDescription,
      type: "article",
      url: `${resolveBaseUrl()}/case-studies/${slug}`,
      publishedTime: study.created_at.toISOString(),
      modifiedTime: study.updated_at.toISOString(),
      tags: (study.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${study.title} | Case Study`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${study.title} | Case Study`,
      description: cleanDescription,
      creator: "@laser_loon",
      images: [ogImageUrl],
    },
  };
}

export default async function CaseStudyPage({ params }: PageProps) {
  const { slug } = await params;

  const [allStudies, study] = await Promise.all([
    CaseStudyService.getAllPublishedCaseStudies(),
    CaseStudyService.getCaseStudyBySlug(slug),
  ]);

  if (!study) {
    notFound();
  }

  const currentIndex = allStudies.findIndex((s) => s.slug === slug);
  const prevStudy =
    currentIndex > 0
      ? allStudies[currentIndex - 1]
      : allStudies[allStudies.length - 1];
  const nextStudy =
    currentIndex < allStudies.length - 1
      ? allStudies[currentIndex + 1]
      : allStudies[0];

  let stats = null;
  if (study.simulated_telemetry) {
    stats = getSimulatedStats(study.primary_language, study.slug);
  } else if (study.github_url) {
    const parsed = parseGitHubUrl(study.github_url);
    if (parsed) {
      stats = await getGitHubStats(
        parsed.owner,
        parsed.repo,
        study.primary_language,
        study.slug
      );
    }
  }

  const tagsList = study.tags ? study.tags.split(",").map((t) => t.trim()) : [];

  let commands = undefined;
  let playback = undefined;
  try {
    if (study.commands_json) {
      commands = JSON.parse(study.commands_json);
    }
  } catch (err) {
    logger.error("Failed to parse commands_json:", err);
  }
  try {
    if (study.playback_json) {
      playback = JSON.parse(study.playback_json);
    }
  } catch (err) {
    logger.error("Failed to parse playback_json:", err);
  }

  return (
    <PageLayout
      variant="standard"
      className="py-24 md:py-32 px-6 md:px-12 lg:px-24 bg-zinc-950 text-foreground flex flex-col items-center relative overflow-hidden outline-none"
    >
      <TelemetryTracker slug={slug} />
      {/* Dynamic JSON-LD Schema: VisualArtwork for Laser Loon, SoftwareSourceCode for systems engineering */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html:
            study.slug === "laser-loon"
              ? getVisualArtworkSchema({
                  name: study.title,
                  description: study.editorial_content
                    .replace(/\*\*/g, "")
                    .replace(/`/g, "")
                    .slice(0, 200),
                  url: `/case-studies/${study.slug}`,
                  imageUrl: `${resolveBaseUrl()}/images/laser-loon-preview.png`,
                  formats: [
                    "image/svg+xml",
                    "application/illustrator",
                    "application/pdf",
                    "image/png",
                  ],
                  license: "https://creativecommons.org/licenses/by/4.0/",
                })
              : getSoftwareSourceCodeSchema(study, stats),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getBreadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Case Studies", url: "/case-studies" },
            { name: study.title, url: `/case-studies/${study.slug}` },
          ]),
        }}
      />
      {/* Background Blurs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-brand-cyan/5 blur-[120px] pointer-events-none hidden sm:block" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 w-80 h-80 rounded-full bg-brand-blue/5 blur-[120px] pointer-events-none hidden sm:block" />

      <div className="relative z-10 w-full max-w-3xl">
        <TracingBeam>
          {/* Breadcrumbs Navigation */}
          <div className="mb-8">
            <Breadcrumbs
              items={[
                { label: "Case Studies", href: "/case-studies" },
                { label: study.title },
              ]}
            />
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-neutral-100 mb-4 leading-tight">
            {study.title}
          </h1>

          {/* Project Hero Image Banner */}
          {study.hero_image_url && (
            <div className="relative w-full h-64 md:h-80 rounded-xl border border-zinc-800 overflow-hidden mb-6 bg-zinc-900 shadow-lg">
              <Image
                src={study.hero_image_url}
                alt={`Validated hero media for ${study.title}`}
                fill
                className="object-cover"
                unoptimized
                priority
              />
            </div>
          )}

          {/* CRF.xl FluentUI Easter Egg Banner */}
          {slug === "crf-xl" && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-mono mb-6 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold">
                Microsoft Office / Fluent Design Accent Active (Easter Egg)
              </span>
            </div>
          )}

          {/* Metadata badges row */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-zinc-900 pb-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 text-xs font-mono font-bold bg-brand-cyan/5 border border-brand-cyan/20 text-brand-cyan rounded-md">
                {study.primary_language}
              </span>
              <span className="text-xs font-mono text-muted">
                Node ID: {study.id}
              </span>
            </div>
            <TerminologyToggle />
          </div>

          {/* Multi-Action Hero Bar: Source Code, Kaggle Notebook & Live Studio Links */}
          <CaseStudyHeroActions
            slug={slug}
            githubUrl={study.github_url}
            externalPlatformUrl={study.external_platform_url}
            externalPlatformType={study.external_platform_type}
            interactiveUrl={study.interactive_url}
            interactiveLabel={study.interactive_label}
            primaryLanguage={study.primary_language}
            stats={stats}
          />

          {/* Long-form Article Narrative */}
          <article className="prose prose-invert max-w-none text-neutral-300 leading-relaxed space-y-8">
            {/* Editorial Content Highlight block.
                `editorial_content` is Markdown, not HTML -- rendering it through
                RichNarrative printed the asterisks and backticks literally on
                every case study. */}
            <div className="text-lg text-muted-strong font-medium border-l-2 border-brand-cyan/60 pl-6 py-2 italic bg-zinc-900/10 rounded-r-xl">
              <InlineMarkdown
                text={study.editorial_content}
                codeClassName="px-1.5 py-0.5 mx-0.5 text-sm font-mono not-italic bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded"
              />
            </div>

            {/* Tags list row */}
            <div className="flex flex-wrap gap-2 pt-4">
              {tagsList.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-0.5 text-xs font-mono font-medium bg-zinc-900/60 border border-zinc-800/80 text-muted-strong rounded"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Interactive Sandbox Terminal Shell */}
            {(Boolean(commands || study.commands_json) ||
              slug === "imednet-python-sdk") && (
              <div className="mt-12 border-t border-zinc-900/50 pt-10">
                <h2 className="text-xl font-bold font-sans text-neutral-100 mb-3 flex items-center gap-2">
                  <IconTerminal className="w-5 h-5 text-brand-cyan" />
                  Try the Sample Commands
                </h2>
                <p className="text-xs font-mono text-zinc-500 mb-6 leading-relaxed">
                  Explore recorded sample responses in this browser demo. Choose
                  a command or type &apos;help&apos; to see what’s available.
                </p>
                <SandboxTerminal
                  commands={commands}
                  playback={playback}
                  slug={slug}
                />
              </div>
            )}

            {/* Interactive Proof Tactic Canvas & Telemetry Gauge */}
            {slug === "schemaflow" && (
              <div className="mt-12 border-t border-zinc-900/50 pt-10">
                <h2 className="text-xl font-bold font-sans text-neutral-100 mb-3 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-brand-cyan"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                  Try a Proof Tree
                </h2>
                <p className="text-xs font-mono text-zinc-500 mb-6 leading-relaxed">
                  Apply logical tactics to branch and navigate the mathematical
                  proof tree. Click nodes to connect/disconnect, track real-time
                  telemetry, and run/rollback proof states.
                </p>
                <SchemaFlowWorkspaceWrapper />
              </div>
            )}

            {/* Interactive Vector Comparison Viewer & Asset Distribution Hub */}
            {slug === "laser-loon" && (
              <div className="mt-12 border-t border-zinc-900/50 pt-10 space-y-12">
                <VectorComparisonViewer />
                <AssetDistributionHub />
              </div>
            )}

            {/* Technical Deep Dive Narrative */}
            <div className="mt-12 border-t border-zinc-900/50 pt-10">
              <h2 className="text-xl font-bold font-sans text-neutral-100 mb-3">
                <Tooltip text="The human story behind the code: why this was built and who it helps.">
                  How It Works
                </Tooltip>
              </h2>
              <RichNarrative
                html={study.architectural_narrative}
                className="space-y-6 text-sm md:text-base leading-relaxed text-muted-strong"
              />
            </div>
          </article>

          {/* Structured Learning Feedback & Reaction Engine */}
          <CaseStudyFeedbackSection slug={slug} />

          {/* Sequential Next / Previous Case Study Navigation */}
          {prevStudy && nextStudy && (
            <NextPrevNav
              prev={
                prevStudy.slug !== slug
                  ? {
                      title: prevStudy.title,
                      href: `/case-studies/${prevStudy.slug}`,
                      label: "Previous Case Study",
                      tag: prevStudy.primary_language,
                    }
                  : null
              }
              next={
                nextStudy.slug !== slug
                  ? {
                      title: nextStudy.title,
                      href: `/case-studies/${nextStudy.slug}`,
                      label: "Next Case Study",
                      tag: nextStudy.primary_language,
                    }
                  : null
              }
              backToHub={{
                title: "View All Case Studies",
                href: "/case-studies",
              }}
            />
          )}
        </TracingBeam>
      </div>
    </PageLayout>
  );
}
