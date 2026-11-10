"use client";

import React, { useId, useState } from "react";
import {
  getClinicalGlossaryEntry,
  type ClinicalGlossaryId,
} from "@/lib/clinical-glossary";

interface GlossaryTermProps {
  /** The glossary key of the term. */
  term: ClinicalGlossaryId;
  /** Text shown in place of the term's own name, e.g. a plural. */
  children?: React.ReactNode;
}

/**
 * A clinical term that opens its plain definition (#3385).
 *
 * The term is a native button, so Enter and Space toggle it and screen
 * readers announce it as expanded or collapsed. The definition is placed in
 * the text flow rather than in a floating tooltip, so it wraps at 320 px and
 * never depends on hover. Escape closes it and keeps focus on the term.
 */
export function GlossaryTerm({ term, children }: GlossaryTermProps) {
  const entry = getClinicalGlossaryEntry(term);
  const [open, setOpen] = useState(false);
  const definitionId = useId();

  return (
    <span className="inline">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={definitionId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpen(false);
          }
        }}
        className="inline-flex min-h-6 items-center rounded-sm border-b border-dashed border-zinc-500 bg-transparent p-0 align-baseline font-[inherit] text-inherit hover:border-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 active:scale-[0.98]"
      >
        {children ?? entry.term}
      </button>
      <span
        id={definitionId}
        role="note"
        hidden={!open}
        className="mt-1 mb-2 block max-w-prose rounded-md border border-zinc-800 bg-[#13151a] px-3 py-2 text-sm leading-relaxed text-zinc-200 break-words"
      >
        <span className="font-semibold text-zinc-100">{entry.term}:</span>{" "}
        {entry.definition}
        {entry.standard ? (
          <>
            {" "}
            <a
              href={entry.standard.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
            >
              {entry.standard.name}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </>
        ) : null}
      </span>
    </span>
  );
}
