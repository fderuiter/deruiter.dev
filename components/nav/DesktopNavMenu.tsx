"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { clamp } from "@/lib/game-utils";
import { filterNavItems, type NavGroup, type NavItem } from "@/lib/navigation";
import { NavIcon } from "@/components/nav/NavIcon";

interface DesktopNavMenuProps {
  group: NavGroup;
  isCurrent: boolean;
  isOpen: boolean;
  pathname: string;
  persona: string;
  onToggle: () => void;
  onNavigate: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  onLinkHover: (e: React.MouseEvent<HTMLElement>) => void;
  triggerRef: React.Ref<HTMLButtonElement>;
}

const ITEM_SELECTOR = "[data-nav-menu-item]";

function MenuLink({
  item,
  pathname,
  onNavigate,
  onLinkHover,
}: {
  item: NavItem;
  pathname: string;
  onNavigate: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  onLinkHover: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  const isActive = pathname === item.href;
  const className = cn(
    "group flex min-w-0 items-start gap-3 rounded-xl p-2.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
    isActive
      ? "border border-brand-cyan/30 bg-brand-cyan/10 text-white"
      : "text-zinc-300 hover:bg-zinc-900/80 hover:text-white"
  );
  const body = (
    <>
      <div className="mt-0.5 shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 transition-colors group-hover:border-brand-cyan/30">
        <NavIcon name={item.icon} tone={item.tone} />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-mono text-xs font-bold tracking-tight text-neutral-200 transition-colors group-hover:text-brand-cyan">
          {item.title}
          {item.external ? " ↗" : ""}
        </span>
        <span className="truncate font-sans text-[11px] text-zinc-400">
          {item.subtitle}
        </span>
      </div>
    </>
  );
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        data-nav-menu-item=""
        onClick={(e) => onNavigate(e, item.href)}
        onMouseEnter={onLinkHover}
        className={className}
      >
        {body}
      </a>
    );
  }
  return (
    <Link
      href={item.href}
      data-nav-menu-item=""
      aria-current={isActive ? "page" : undefined}
      onClick={(e) => onNavigate(e, item.href)}
      onMouseEnter={onLinkHover}
      className={className}
    >
      {body}
    </Link>
  );
}

/**
 * One dropdown in the top bar. The trigger discloses a panel of links; the
 * arrow keys move between them, Home and End jump to the ends, and Escape
 * (handled by the bar so it can also return focus) closes the panel.
 */
export const DesktopNavMenu: React.FC<DesktopNavMenuProps> = ({
  group,
  isCurrent,
  isOpen,
  pathname,
  persona,
  onToggle,
  onNavigate,
  onLinkHover,
  triggerRef,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = `${group.id}-navigation`;

  const focusItem = (which: "first" | "last" | number) => {
    const items =
      panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
    if (!items || items.length === 0) return;
    const index =
      which === "first"
        ? 0
        : which === "last"
          ? items.length - 1
          : clamp(which, 0, items.length - 1);
    items[index].focus();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowDown") return;
    e.preventDefault();
    if (isOpen) {
      focusItem("first");
    } else {
      onToggle();
      // The panel mounts on the next render; focus its first link then.
      setTimeout(() => focusItem("first"), 0);
    }
  };

  const onPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []
    );
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(current < 0 ? 0 : (current + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(current <= 0 ? items.length - 1 : current - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem("first");
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem("last");
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        onKeyDown={onTriggerKeyDown}
        onMouseEnter={onLinkHover}
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={cn(
          "flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded py-1 font-mono text-xs font-semibold tracking-wider transition-all duration-200 hover:text-foreground focus-visible:ring-1 focus-visible:ring-brand-cyan",
          isCurrent || isOpen ? "font-bold text-brand-cyan" : "text-muted"
        )}
      >
        <span className="whitespace-nowrap">{group.label}</span>
        <IconChevronDown
          aria-hidden="true"
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200",
            isOpen ? "rotate-180 text-brand-cyan" : "text-zinc-500"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key={panelId}
            ref={panelRef}
            id={panelId}
            role="group"
            aria-label={`${group.label} menu`}
            onKeyDown={onPanelKeyDown}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 z-50 mt-3 flex max-h-[calc(100dvh-6rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-1 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:w-80"
          >
            {group.sections.map((section) => {
              const items = filterNavItems(section.items, persona);
              if (items.length === 0) return null;
              return (
                <div
                  key={section.id}
                  role="group"
                  aria-label={section.label}
                  className="flex min-w-0 flex-col gap-1"
                >
                  {section.label ? (
                    <span className="mb-1 mt-1 truncate border-b border-zinc-800/80 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      {section.label}
                    </span>
                  ) : null}
                  {items.map((item) => (
                    <MenuLink
                      key={item.id}
                      item={item}
                      pathname={pathname}
                      onNavigate={onNavigate}
                      onLinkHover={onLinkHover}
                    />
                  ))}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
