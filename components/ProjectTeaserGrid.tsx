"use client";

import React from "react";
import Link from "next/link";
import { BaseCaseStudy } from "@/types/domain";
import {
  IconChevronRight,
  IconArrowRight,
  IconLayersIntersect,
} from "@tabler/icons-react";
import { useTerminology } from "@/components/providers/TerminologyProvider";
import {
  InlineMarkdown,
  resolveSnippetTerminology,
} from "@/components/ui/InlineMarkdown";

interface ProjectTeaserGridProps {
  caseStudies: BaseCaseStudy[];
}

interface FeaturedProject extends FeaturedProjectDetails {
  slug: string;
}

interface FeaturedProjectDetails {
  artifact: string[];
  problem: string;
  contribution: string;
  outcome: string;
}

const FEATURED_PROJECTS: FeaturedProject[] = [
  {
    slug: "clinical-data-mapper",
    artifact: ["ODM / XML", "STREAM", "SDTM"],
    problem:
      "Clinical trial data arrives in formats that need careful standardization before review.",
    contribution:
      "Built a streaming TypeScript mapper that assembles runtime schemas from ODM metadata.",
    outcome:
      "Maps clinical records to SDTM domains while processing XML in chunks.",
  },
  {
    slug: "cadence-clinical",
    artifact: ["PROTOCOL", "AUDIT", "EXECUTION"],
    problem:
      "Clinical teams need protocol changes, operations, and audit evidence to remain connected.",
    contribution:
      "Designed a graph-and-relational system with append-only audit trails and digital signatures.",
    outcome:
      "Keeps study records, protocol changes, and audit history connected.",
  },
  {
    slug: "imednet-python-sdk",
    artifact: ["API", "PYDANTIC", "DATAFRAME"],
    problem:
      "Clinical data teams need safer, typed access to EDC records for analysis and reporting.",
    contribution:
      "Developed an asynchronous Python SDK with typed contracts and token-aware transport.",
    outcome:
      "Brings clinical records into Python data workflows and an interactive CLI sandbox.",
  },
];

const FEATURED_PROJECTS_BY_SLUG = new Map(
  FEATURED_PROJECTS.map((project) => [project.slug, project])
);

const LANGUAGE_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  TypeScript: {
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    border: "border-amber-500/20",
  },
  JavaScript: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-300",
    border: "border-yellow-500/20",
  },
  Python: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    border: "border-emerald-500/20",
  },
  Haskell: {
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    border: "border-amber-500/20",
  },
  React: {
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    border: "border-amber-500/20",
  },
};

const DEFAULT_STYLE = {
  bg: "bg-zinc-800/40",
  text: "text-zinc-300",
  border: "border-white/10",
};

/**
 * Re-exported so existing importers keep their path. The implementation moved to
 * `components/ui/InlineMarkdown` when the case-study detail page needed it too.
 */
export { resolveSnippetTerminology };

function selectFeaturedProjects(caseStudies: BaseCaseStudy[]): BaseCaseStudy[] {
  const publishedStudies = caseStudies.filter((study) => study.published);
  const selected: BaseCaseStudy[] = [];
  const selectedSlugs = new Set<string>();

  for (const featuredProject of FEATURED_PROJECTS) {
    const study = publishedStudies.find(
      (candidate) => candidate.slug === featuredProject.slug
    );
    if (study) {
      selected.push(study);
      selectedSlugs.add(study.slug);
    }
  }

  const backfill = publishedStudies
    .filter((study) => !selectedSlugs.has(study.slug))
    .sort((left, right) => left.slug.localeCompare(right.slug));

  return [...selected, ...backfill].slice(0, 3);
}

function getProjectDetails(
  study: BaseCaseStudy,
  simplified: boolean
): FeaturedProjectDetails {
  const featuredProject = FEATURED_PROJECTS_BY_SLUG.get(study.slug);
  if (featuredProject) {
    return featuredProject;
  }

  const summary = resolveSnippetTerminology(study.editorial_content, simplified)
    .replace(/(\*\*|`)/g, "")
    .trim();

  return {
    artifact: ["CASE STUDY", study.primary_language, "DOSSIER"],
    problem:
      "See what prompted this project and the constraints it needed to work within.",
    contribution:
      summary || "The writeup walks through the implementation choices.",
    outcome: "Read the writeup for the results and lessons.",
  };
}

function getProjectTags(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export const ProjectTeaserGrid: React.FC<ProjectTeaserGridProps> = ({
  caseStudies,
}) => {
  const { simplified } = useTerminology();
  const topProjects = selectFeaturedProjects(caseStudies);

  return (
    <div className="w-full flex flex-col items-center">
      {/* 3-Column Systems Dossier Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 w-full mb-8 sm:mb-10">
        {topProjects.map((study, idx) => {
          const style =
            LANGUAGE_STYLES[study.primary_language] || DEFAULT_STYLE;
          const sysId = `SYS-0${idx + 1}`;
          const details = getProjectDetails(study, simplified);
          const tags = getProjectTags(study.tags);

          return (
            <article
              key={study.id}
              data-testid="featured-project-card"
              className="group relative isolate @container min-w-0 break-words flex flex-col p-5 @sm:p-6 rounded-2xl bg-surface-1 border border-white/10 hover:border-amber-500/40 hover:bg-surface-2 transition-all duration-300 motion-reduce:transition-none overflow-hidden shadow-xl"
            >
              <div className="relative z-10 min-w-0 flex flex-1 flex-col">
                {/* Header: System Number, Language Badge & Slug */}
                <div className="flex min-w-0 items-start justify-between gap-2 mb-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded">
                      {sysId}
                    </span>
                    <span
                      className={`min-w-0 break-words px-2.5 py-0.5 text-[10px] font-mono font-bold border rounded-md ${style.bg} ${style.text} ${style.border}`}
                    >
                      {study.primary_language}
                    </span>
                  </div>
                  <span className="min-w-0 max-w-[45%] break-all text-right text-[10px] font-mono text-zinc-400">
                    {study.slug}
                  </span>
                </div>

                <div
                  data-testid="featured-project-artifact"
                  aria-label={`${study.title} architecture artifact`}
                  className="mb-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1.5 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-center font-mono text-[9px] font-bold tracking-wide text-zinc-300"
                >
                  {details.artifact.map((label, artifactIndex) => (
                    <React.Fragment key={label}>
                      {artifactIndex > 0 && (
                        <span aria-hidden="true" className="text-amber-400">
                          →
                        </span>
                      )}
                      <span className="min-w-0 break-words rounded bg-white/[0.04] px-1.5 py-1.5">
                        {label}
                      </span>
                    </React.Fragment>
                  ))}
                </div>

                {/* Title */}
                <h3 className="min-w-0 break-words text-base @sm:text-lg font-bold text-white tracking-tight leading-snug mb-3 group-hover:text-amber-300 transition-colors">
                  {study.title}
                </h3>

                {/* Lightweight Description */}
                <p className="min-w-0 break-words text-xs @sm:text-sm text-zinc-400 leading-relaxed font-sans mb-4 line-clamp-4">
                  <InlineMarkdown
                    text={study.editorial_content}
                    maxLength={240}
                  />
                </p>

                <dl className="mb-4 grid gap-2 border-l border-amber-500/30 pl-3 text-xs leading-relaxed">
                  <div>
                    <dt className="font-mono text-[10px] font-bold uppercase tracking-wide text-amber-300">
                      Problem
                    </dt>
                    <dd className="min-w-0 break-words text-zinc-400">
                      {details.problem}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] font-bold uppercase tracking-wide text-amber-300">
                      Contribution
                    </dt>
                    <dd className="min-w-0 break-words text-zinc-400">
                      {details.contribution}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] font-bold uppercase tracking-wide text-amber-300">
                      Outcome
                    </dt>
                    <dd className="min-w-0 break-words text-zinc-400">
                      {details.outcome}
                    </dd>
                  </div>
                </dl>

                {tags.length > 0 && (
                  <ul
                    aria-label={`${study.title} technologies`}
                    className="mb-4 flex min-w-0 flex-wrap gap-1.5"
                  >
                    {tags.map((tag) => (
                      <li
                        key={tag}
                        className="min-w-0 break-all rounded border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-zinc-400"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Card Footer Link */}
                <div className="mt-auto flex min-w-0 items-center justify-between gap-2 border-t border-white/10 pt-3">
                  <Link
                    href={`/case-studies/${study.slug}`}
                    className="inline-flex min-w-0 items-center gap-1 text-left min-h-[44px] text-xs font-mono font-bold text-amber-400 hover:text-amber-200 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#13151a]"
                    aria-label={`Read the ${study.title} case study`}
                  >
                    <span className="min-w-0 break-words">
                      Read the {study.title} case study
                    </span>
                    <IconChevronRight className="w-3.5 h-3.5 shrink-0 transform group-hover:translate-x-1 transition-transform duration-200" />
                  </Link>

                  <span className="shrink-0 text-[10px] font-mono text-zinc-400 uppercase">
                    PROJECT WRITEUPS
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Primary CTA leading to full /case-studies showcase */}
      <div className="w-full flex justify-center">
        <Link
          href="/case-studies"
          className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#14161d] hover:bg-amber-400 border border-white/10 hover:border-amber-400 text-zinc-200 hover:text-black font-mono text-xs font-bold rounded-xl transition-all duration-200 shadow-md active:scale-[0.98] group"
        >
          <IconLayersIntersect className="w-4 h-4 text-amber-400 group-hover:text-black transition-colors" />
          <span>View All Case Studies ({caseStudies.length})</span>
          <IconArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-200" />
        </Link>
      </div>
    </div>
  );
};
