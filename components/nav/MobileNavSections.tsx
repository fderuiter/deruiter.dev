"use client";

import React, { useState } from "react";
import Link from "next/link";
import { IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  filterNavItems,
  getNavHref,
  isNavGroupActive,
  isNavMenu,
  PRIMARY_NAV,
  type NavGroup,
  type NavItem,
} from "@/lib/navigation";
import { ARCADE_GAME_COUNT } from "@/lib/arcade";
import { NavIcon, navToneClass } from "@/components/nav/NavIcon";

interface MobileNavSectionsProps {
  pathname: string;
  persona: string;
  onNavigate: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}

const ROW =
  "min-h-[48px] w-full px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-base font-bold text-neutral-200 hover:text-brand-cyan hover:border-brand-cyan/30 flex items-center justify-between gap-2 active:scale-[0.98] transition-all min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan";

function ItemRow({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate: MobileNavSectionsProps["onNavigate"];
}) {
  const href = getNavHref(item, "mobile");
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <NavIcon name={item.icon} tone={item.tone} />
        <span className="truncate">
          {item.title}
          {item.external ? " ↗" : ""}
        </span>
      </span>
      {item.badge ? (
        <span
          className={cn(
            "shrink-0 rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px]",
            navToneClass(item.tone)
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </>
  );
  const className =
    "min-h-[48px] px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-sm font-semibold text-neutral-200 hover:text-brand-cyan flex items-center justify-between gap-2 active:scale-[0.98] transition-all min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan";
  if (item.external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  }
  return (
    <Link
      href={href}
      onClick={(e) => onNavigate(e, href)}
      className={className}
    >
      {content}
    </Link>
  );
}

function ExpandableGroup({
  group,
  pathname,
  persona,
  onNavigate,
}: { group: NavGroup } & MobileNavSectionsProps) {
  // The section holding the current page starts open; the others start
  // folded so the drawer fits a small screen without a long scroll.
  const [open, setOpen] = useState(isNavGroupActive(group, pathname));
  const panelId = `mobile-nav-${group.id}`;
  const count = group.sections.reduce(
    (n, s) => n + filterNavItems(s.items, persona).length,
    0
  );
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={ROW}
      >
        <span>{group.label}</span>
        <span className="flex shrink-0 items-center gap-2 font-mono text-xs text-zinc-400">
          {group.id === "arcade" ? `${ARCADE_GAME_COUNT} Games` : count}
          <IconChevronDown
            aria-hidden="true"
            className={cn(
              "h-4 w-4 transition-transform",
              open && "rotate-180 text-brand-cyan"
            )}
          />
        </span>
      </button>
      {/* Folded sections stay in the document, hidden, so the links remain
          findable by anything that reads the markup. */}
      <div id={panelId} hidden={!open} className="flex flex-col gap-2 pl-2">
        {group.sections.map((section) => {
          const items = filterNavItems(section.items, persona);
          if (items.length === 0) return null;
          return (
            <div
              key={section.id}
              role="group"
              aria-label={section.label ?? group.label}
              className="flex flex-col gap-2"
            >
              {section.label ? (
                <span className="px-1 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  {section.label}
                </span>
              ) : null}
              {items.map((item) => (
                <ItemRow key={item.id} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The drawer's navigation: plain links for Work, Blog and Contact, and a
 * folding section for each menu, in the order the top bar shows them.
 */
export const MobileNavSections: React.FC<MobileNavSectionsProps> = (props) => {
  const { pathname, onNavigate } = props;
  return (
    <nav aria-label="Site sections" className="flex flex-col gap-2">
      {PRIMARY_NAV.map((group) =>
        isNavMenu(group) ? (
          <ExpandableGroup key={group.id} group={group} {...props} />
        ) : (
          <Link
            key={group.id}
            href={group.href}
            aria-current={
              isNavGroupActive(group, pathname) ? "page" : undefined
            }
            onClick={(e) => onNavigate(e, group.href)}
            className={ROW}
          >
            <span>{group.label}</span>
            <span className="font-mono text-xs text-zinc-500">→</span>
          </Link>
        )
      )}
    </nav>
  );
};
