"use client";

import React from "react";
import Link from "next/link";
import { IconChevronRight, IconHome } from "@tabler/icons-react";
import { useAudio } from "@/components/providers/AudioProvider";

interface BreadcrumbCrumb {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbCrumb[];
  className?: string;
}

/* jscpd:ignore-start */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  className = "",
}) => {
  const { playHover } = useAudio();

  const isRootCrumb = (crumb: BreadcrumbCrumb) => {
    const labelLower = (crumb.label || "").trim().toLowerCase();
    const hrefTrim = (crumb.href || "").trim();
    return (
      labelLower === "home" ||
      (crumb.href !== undefined &&
        (hrefTrim === "/" ||
          hrefTrim === "https://deruiter.dev" ||
          hrefTrim === "http://localhost:3000"))
    );
  };

  const filteredItems = (items || []).filter((crumb) => !isRootCrumb(crumb));
  const allCrumbs: BreadcrumbCrumb[] = [
    { label: "Home", href: "/" },
    ...filteredItems,
  ];

  const handleHover = (e: React.MouseEvent<HTMLElement>) => {
    if (typeof window === "undefined") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pan = ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1;
    playHover(pan);
  };

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center text-xs font-mono text-zinc-400 select-none ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {allCrumbs.map((crumb, idx) => {
          const isLast = idx === allCrumbs.length - 1;
          const isFirst = idx === 0;

          return (
            <li
              key={`${crumb.label}-${idx}`}
              className="inline-flex items-center gap-1.5 sm:gap-2"
            >
              {idx > 0 && (
                <IconChevronRight
                  className="w-3 h-3 text-zinc-600 flex-shrink-0"
                  aria-hidden="true"
                />
              )}
              {isLast || !crumb.href ? (
                <span
                  className="font-bold text-neutral-200 truncate max-w-[200px] sm:max-w-xs"
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  onMouseEnter={handleHover}
                  className="hover:text-brand-cyan transition-colors duration-150 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-cyan rounded px-0.5"
                >
                  {isFirst && <IconHome className="w-3.5 h-3.5" />}
                  <span>{crumb.label}</span>
                </Link>
              )}
            </li>
          );
/* jscpd:ignore-end */
        })}
      </ol>
    </nav>
  );
};
