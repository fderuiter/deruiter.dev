"use client";

import React, { useId, useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { getFAQPageNode, getUnifiedGraphSchema } from "@/lib/seo";
import type { FAQItem } from "@/lib/seo";

interface FAQAccordionProps {
  /** The questions shown to the visitor and mirrored into the FAQPage JSON-LD. */
  items: readonly FAQItem[];
  /** Canonical path of the page hosting the FAQ, used for the schema id. */
  pageUrl: string;
  /** Visible section heading. */
  heading?: string;
  className?: string;
}

/**
 * Keyboard-navigable FAQ disclosure list with a matching FAQPage JSON-LD
 * script. Because the schema is built from the same `items` the accordion
 * renders, the structured data cannot drift from the visible content.
 *
 * Each trigger is a native button, so Enter and Space toggle it and Tab moves
 * between questions; `aria-expanded` and `aria-controls` expose the state.
 */
export function FAQAccordion({
  items,
  pageUrl,
  heading = "Frequently asked questions",
  className = "",
}: FAQAccordionProps) {
  const baseId = useId();
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());

  const toggle = (index: number) => {
    const next = new Set(open);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setOpen(next);
  };

  return (
    <section
      aria-labelledby={`${baseId}-heading`}
      className={`w-full max-w-3xl mx-auto ${className}`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getUnifiedGraphSchema([getFAQPageNode(items, pageUrl)]),
        }}
      />
      <h2
        id={`${baseId}-heading`}
        className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight mb-4"
      >
        {heading}
      </h2>
      <ul className="space-y-2">
        {items.map((item, index) => {
          const isOpen = open.has(index);
          const buttonId = `${baseId}-q-${index}`;
          const panelId = `${baseId}-a-${index}`;
          return (
            <li
              key={item.question}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40"
            >
              <h3 className="m-0">
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(index)}
                  className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm sm:text-base font-semibold text-zinc-100 break-words hover:bg-zinc-800/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan active:scale-[0.98] transition-colors"
                >
                  <span className="min-w-0">{item.question}</span>
                  <IconChevronDown
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className="px-4 pb-4 text-sm leading-relaxed text-zinc-300 break-words"
              >
                {item.answer}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
