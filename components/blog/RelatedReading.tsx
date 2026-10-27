import React from "react";
import { IntentLink } from "@/components/ui/IntentLink";
import type { RelatedItem } from "@/lib/blog/related";
import { InlineMarkdown } from "@/components/ui/InlineMarkdown";

interface RelatedReadingProps {
  items: RelatedItem[];
}

export function RelatedReading({ items }: RelatedReadingProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="related-reading-heading"
      className="w-full mt-16 pt-12 border-t border-zinc-900"
    >
      <div className="mb-6">
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-accent">
          Architecture & Systems Depth
        </span>
        <h2
          id="related-reading-heading"
          className="text-2xl font-bold tracking-tight text-white mt-1 mb-2"
        >
          Related Dispatches & Case Studies
        </h2>
        <p className="text-sm text-zinc-400 max-w-xl">
          Contextually matched by architecture domain, content pillar, and
          technical tags.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {items.map((item) => (
          <IntentLink
            key={item.id}
            href={item.href}
            className="group relative flex flex-col justify-between p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-accent/40 hover:bg-zinc-900/70 transition-all duration-200"
          >
            <div>
              {/* Type & Meta Header */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                    item.type === "dispatch"
                      ? "bg-accent/10 text-accent border border-accent/30"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {item.type === "dispatch" ? "Dispatch" : "Case Study"}
                </span>

                {item.readingTimeMinutes && (
                  <span className="text-[11px] font-mono text-zinc-400">
                    {item.readingTimeMinutes} min read
                  </span>
                )}
                {item.primaryLanguage && (
                  <span className="text-[11px] font-mono text-zinc-400">
                    {item.primaryLanguage}
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-base font-semibold text-zinc-100 group-hover:text-accent transition-colors mb-2 line-clamp-2">
                {item.title}
              </h3>

              {/* Summary */}
              <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3 mb-4">
                <InlineMarkdown text={item.summary} />
              </p>
            </div>

            {/* Tags & Action Link */}
            <div className="mt-auto pt-3 border-t border-zinc-900/80">
              <div className="flex flex-wrap gap-1 mb-3">
                {item.matchedTags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-zinc-800 text-zinc-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <span className="inline-flex items-center gap-1 text-xs font-mono font-medium text-accent group-hover:underline">
                {item.type === "dispatch" ? "Read dispatch" : "Explore study"}
                <svg
                  className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </span>
            </div>
          </IntentLink>
        ))}
      </div>
    </section>
  );
}
