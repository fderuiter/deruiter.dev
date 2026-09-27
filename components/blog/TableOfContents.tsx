"use client";

import React, { useState, useEffect } from "react";
import type { HeadingItem } from "@/lib/blog/headings";

interface TableOfContentsProps {
  headings: HeadingItem[];
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || headings.length === 0) return;

    // Headings are looked up by id on every pass rather than observed once:
    // RichNarrative replaces its server-rendered nodes after idle rehydration,
    // which would leave an IntersectionObserver watching detached elements.
    let frame = 0;
    const updateActive = () => {
      frame = 0;
      const threshold = window.innerHeight * 0.3;
      let current = "";
      for (const heading of headings) {
        const el = document.getElementById(heading.id);
        if (el && el.getBoundingClientRect().top <= threshold) {
          current = heading.id;
        }
      }
      if (current) {
        setActiveId(current);
      }
    };
    const onScroll = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(updateActive);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [headings]);

  if (!headings || headings.length < 2) {
    return null;
  }

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    e.preventDefault();
    setActiveId(id);
    setIsOpen(false);
    window.history.pushState(null, "", `#${id}`);
    // The mobile list collapses on selection. Scroll after that layout change
    // so the heading remains below the fixed navbar at every width.
    window.requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (!target) return;
      const reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  return (
    <nav
      aria-label="Table of contents"
      className="my-8 p-4 md:p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800/80 backdrop-blur-sm"
    >
      {/* Header bar / Mobile Accordion Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs sm:text-sm font-mono font-bold tracking-wider text-zinc-300 uppercase flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full bg-brand-cyan"
            aria-hidden="true"
          />
          Table of Contents
        </h2>

        {/* Mobile toggle button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-controls="blog-toc-links"
          aria-label="Toggle table of contents"
          className="lg:hidden text-xs font-mono text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded bg-zinc-800/60"
        >
          {isOpen ? "Hide" : "Show"}
        </button>
      </div>

      {/* Heading links list (always visible on desktop, toggleable on mobile/tablet) */}
      <div
        id="blog-toc-links"
        className={`mt-4 ${isOpen ? "block" : "hidden lg:block"}`}
      >
        <ul className="space-y-1.5 border-l border-zinc-800 text-sm">
          {headings.map((heading) => {
            const isActive = activeId === heading.id;
            return (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  onClick={(e) => handleLinkClick(e, heading.id)}
                  aria-current={isActive ? "location" : undefined}
                  className={`block py-1 transition-colors border-l -ml-[1px] ${
                    heading.level === 3
                      ? "pl-4 text-xs"
                      : "pl-3 text-sm font-medium"
                  } ${
                    isActive
                      ? "border-brand-cyan text-brand-cyan font-semibold"
                      : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
                  }`}
                >
                  {heading.text}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
