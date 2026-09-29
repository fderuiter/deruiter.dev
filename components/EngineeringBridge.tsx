"use client";

import React from "react";
import Link from "next/link";
import { IconArrowDown } from "@tabler/icons-react";
import {
  ADR_REPOSITORY_URL,
  ENGINEERING_BRIDGES,
} from "@/lib/engineering-bridges";

/** Id of the bridge heading, referenced by `aria-labelledby` and the jump link. */
const BRIDGE_HEADING_ID = "systems-architecture";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Small pinned control that scrolls to the engineering notes without asking
 * visitors to leave the canvas they are using. It is a real anchor, so it
 * still works before hydration and without JavaScript.
 */
export function EngineeringBridgeJump({
  className = "",
}: {
  className?: string;
}) {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(BRIDGE_HEADING_ID);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
    target.focus({ preventScroll: true });
  };

  return (
    <a
      href={`#${BRIDGE_HEADING_ID}`}
      onClick={handleClick}
      className={`fixed right-3 top-20 z-40 inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/90 px-3 py-1.5 font-mono text-xs text-zinc-300 hover:border-brand-cyan/40 hover:text-brand-cyan focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan active:scale-[0.98] transition-colors ${className}`}
    >
      Architecture &amp; Engine Notes
      <IconArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
    </a>
  );
}

/**
 * Engineering notes rendered below a tool or game: the technical narrative,
 * design constraints, and links to related case studies and ADRs. Everything
 * is plain server-renderable markup so crawlers index it in the initial HTML.
 */
export function EngineeringBridge({ route }: { route: string }) {
  const entry = ENGINEERING_BRIDGES[route];
  if (!entry) return null;

  return (
    <section
      aria-labelledby={BRIDGE_HEADING_ID}
      className="mx-auto mt-12 w-full max-w-4xl px-4 sm:px-6"
    >
      <h2
        id={BRIDGE_HEADING_ID}
        tabIndex={-1}
        className="scroll-mt-28 font-mono text-xl font-bold tracking-tight text-white sm:text-2xl"
      >
        {`Architecture & Engine Notes: ${entry.name}`}
      </h2>

      <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300 sm:text-base">
        {entry.narrative.map((paragraph) => (
          <p key={paragraph} className="break-words">
            {paragraph}
          </p>
        ))}
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entry.constraints.map((constraint) => (
          <div
            key={constraint.label}
            className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
          >
            <dt className="font-mono text-xs font-semibold uppercase tracking-wide text-brand-cyan">
              {constraint.label}
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-zinc-300 break-words">
              {constraint.detail}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {entry.caseStudies.length > 0 && (
          <nav aria-label="Related case studies" className="min-w-0">
            <h3 className="font-mono text-sm font-semibold text-white">
              Related case studies
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {entry.caseStudies.map((study) => (
                <li key={study.slug} className="break-words">
                  <Link
                    href={`/case-studies/${study.slug}`}
                    className="text-brand-cyan underline underline-offset-2 hover:text-white"
                  >
                    {study.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {entry.adrs.length > 0 && (
          <nav
            aria-label="Related architecture decision records"
            className="min-w-0"
          >
            <h3 className="font-mono text-sm font-semibold text-white">
              Architecture decision records
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {entry.adrs.map((adr) => (
                <li key={adr.id} className="break-words">
                  <a
                    href={`${ADR_REPOSITORY_URL}/${adr.file}`}
                    className="text-brand-cyan underline underline-offset-2 hover:text-white"
                  >
                    {`ADR ${adr.id}: ${adr.title}`}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </section>
  );
}
