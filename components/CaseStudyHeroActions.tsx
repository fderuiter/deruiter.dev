import React from "react";
import Link from "next/link";
import {
  IconBrandGithub,
  IconPlayerPlay,
  IconExternalLink,
  IconStar,
  IconGitCommit,
} from "@tabler/icons-react";
import type { GitHubStats } from "@/lib/github";
import { parseGitHubUrl } from "@/lib/github";

interface CaseStudyHeroActionsProps {
  slug?: string;
  githubUrl?: string | null;
  externalPlatformUrl?: string | null;
  externalPlatformType?: "github" | "kaggle" | "pypi" | "npm" | null;
  interactiveUrl?: string | null;
  interactiveLabel?: string | null;
  primaryLanguage?: string | null;
  stats?: GitHubStats | null;
}

export function CaseStudyHeroActions({
  slug: _slug,
  githubUrl,
  externalPlatformUrl,
  externalPlatformType,
  interactiveUrl,
  interactiveLabel = "Launch Interactive Studio",
  stats,
}: CaseStudyHeroActionsProps) {
  const parsed = githubUrl ? parseGitHubUrl(githubUrl) : null;
  const repoDisplay = parsed ? `${parsed.owner}/${parsed.repo}` : githubUrl;

  const isKaggle = externalPlatformType === "kaggle" || externalPlatformUrl?.includes("kaggle.com");

  return (
    <div className="flex flex-wrap items-center gap-3 my-6">
      {/* Primary Action: GitHub Repository */}
      {githubUrl && (
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View on GitHub: ${repoDisplay}`}
          className="inline-flex items-center gap-2.5 px-4 py-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800 hover:border-zinc-700 text-zinc-100 text-sm font-medium transition-all shadow-sm group focus:outline-none focus:ring-2 focus:ring-brand-cyan/50 active:scale-[0.98]"
        >
          <IconBrandGithub className="w-4 h-4 text-brand-cyan transition-transform group-hover:scale-110" />
          <span className="font-mono text-xs md:text-sm font-semibold">{repoDisplay}</span>
          {stats && typeof stats.stars === "number" && (
            <span className="inline-flex items-center gap-1 ml-1.5 pl-2 border-l border-zinc-700 text-xs font-mono text-zinc-400">
              <IconStar className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
              <span>{stats.stars}</span>
            </span>
          )}
          {stats && typeof stats.commitsCount === "number" && stats.commitsCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 pl-1 text-xs font-mono text-muted">
              <IconGitCommit className="w-3.5 h-3.5 text-zinc-400" />
              <span>{stats.commitsCount}</span>
            </span>
          )}
        </a>
      )}

      {/* External Platform: Kaggle Notebook or Registry */}
      {externalPlatformUrl && isKaggle && (
        <a
          href={externalPlatformUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Explore on Kaggle Notebook"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/30 hover:border-sky-400/50 text-sky-200 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-400/50 active:scale-[0.98]"
        >
          <span className="font-bold text-sky-400 font-mono text-xs">K</span>
          <span className="text-xs md:text-sm font-semibold">Explore on Kaggle</span>
          <IconExternalLink className="w-3.5 h-3.5 text-sky-400" />
        </a>
      )}

      {/* External Platform: Generic / Other */}
      {externalPlatformUrl && !isKaggle && (
        <a
          href={externalPlatformUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View external project: ${externalPlatformType || "Resource"}`}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-zinc-400/50 active:scale-[0.98]"
        >
          <IconExternalLink className="w-4 h-4 text-zinc-400" />
          <span className="text-xs md:text-sm font-semibold">
            {externalPlatformType ? `View on ${externalPlatformType.toUpperCase()}` : "External Resource"}
          </span>
        </a>
      )}

      {/* Interactive In-App Studio / Simulator Link */}
      {interactiveUrl && (
        <Link
          href={interactiveUrl}
          aria-label={interactiveLabel || "Launch Interactive Studio"}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/40 hover:border-brand-cyan text-brand-cyan text-sm font-semibold transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] focus:outline-none focus:ring-2 focus:ring-brand-cyan/60 active:scale-[0.98]"
        >
          <IconPlayerPlay className="w-4 h-4 text-brand-cyan fill-brand-cyan/20" />
          <span className="text-xs md:text-sm">{interactiveLabel || "Launch Interactive Studio"}</span>
        </Link>
      )}
    </div>
  );
}
