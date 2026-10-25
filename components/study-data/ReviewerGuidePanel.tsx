"use client";

import { useState } from "react";
import { ADRG_PATH, CSDRG_PATH } from "@/lib/study-data";
import { BUTTON_SECONDARY } from "./ui";

interface ReviewerGuidePanelProps {
  readonly guides: {
    readonly csdrg: string;
    readonly adrg: string;
  };
}

const GUIDES = [
  { id: "csdrg", label: "cSDRG (SDTM)", path: CSDRG_PATH },
  { id: "adrg", label: "ADRG (ADaM)", path: ADRG_PATH },
] as const;

/**
 * Element styles for the guide article. The article is plain semantic HTML
 * so the package can ship it unstyled; the page styles it from outside.
 */
const ARTICLE =
  "min-w-0 space-y-4 text-sm leading-relaxed text-slate-300 [&_a]:text-amber-300 [&_a]:underline [&_caption]:pb-2 [&_caption]:text-left [&_caption]:font-semibold [&_caption]:text-white [&_dd]:mb-4 [&_dd]:space-y-1 [&_dd]:border-l [&_dd]:border-white/[0.08] [&_dd]:pl-3 [&_dt]:font-mono [&_dt]:text-xs [&_dt]:text-amber-200 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.035em] [&_h2]:text-white [&_h3]:mt-8 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_section]:space-y-3 [&_strong]:text-slate-100 [&_table]:border-collapse [&_td]:border-t [&_td]:border-white/[0.08] [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:font-mono [&_td]:text-xs [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-mono [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-[0.12em] [&_th]:text-slate-400";

/**
 * The run's reviewer guides, the cSDRG-lite and ADRG-lite the package
 * ships, rendered from the same HTML so the page and the download cannot
 * disagree.
 */
export function ReviewerGuidePanel({ guides }: ReviewerGuidePanelProps) {
  const [current, setCurrent] = useState<"csdrg" | "adrg">("csdrg");
  const guide = GUIDES.find((item) => item.id === current)!;
  return (
    <div className="min-w-0 space-y-6">
      <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
        Reviewer guides written from this run: data flow, standards, datasets,
        conformance findings with the reason each expected one occurs,
        derivations and, for ADaM, the analysis output index. The package
        carries this one as{" "}
        <code className="break-all font-mono text-xs">{guide.path}</code>.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Guide">
        {GUIDES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={current === option.id}
            onClick={() => setCurrent(option.id)}
            className={`${BUTTON_SECONDARY} min-h-12 ${current === option.id ? "border-amber-500/60 bg-amber-500/10 text-amber-100" : ""}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {/* Wide tables scroll inside the region, not the page. */}
      <div
        role="region"
        aria-label={`${guide.label} reviewer guide`}
        tabIndex={0}
        className="min-w-0 max-w-full overflow-x-auto border border-white/[0.08] bg-[#0d0e11] p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-400 sm:p-6"
      >
        <div
          className={ARTICLE}
          // The article comes from renderReviewerGuideHtml, which escapes
          // every value it interpolates.
          dangerouslySetInnerHTML={{ __html: guides[current] }}
        />
      </div>
    </div>
  );
}
