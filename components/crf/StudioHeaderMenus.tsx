"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  IconCheck,
  IconChevronDown,
  IconDotsVertical,
  IconX,
} from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  STUDIO_HEADER_MENUS,
  type StudioMenuId,
  type StudioMenuItemId,
  type StudioMenuItemSpec,
} from "./studio-stages";

/** What the header supplies for one menu item. */
interface StudioMenuAction {
  icon: React.ReactNode;
  /** Omitted when the action is unavailable here; the item is then disabled. */
  run?: () => void;
  /** Replaces the spec label when the label depends on state (the theme). */
  label?: string;
  /** Present on toggles: the item reports this on/off state. */
  checked?: boolean;
  /** Short status at the end of the item, such as the issue count. */
  badge?: string;
}

/** One action per menu item id, so a new item cannot ship without a handler. */
export type StudioMenuActions = Record<StudioMenuItemId, StudioMenuAction>;

const ITEM_SELECTOR = '[role^="menuitem"]:not(:disabled)';

function menuItems(panel: HTMLElement | null | undefined): HTMLElement[] {
  return Array.from(panel?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
}

/** The item's accessible name: its visible label and any status badge. */
function itemName(item: StudioMenuItemSpec, action: StudioMenuAction): string {
  const label = action.label ?? item.label;
  return action.badge ? `${label} ${action.badge}` : label;
}

function ItemContent({
  item,
  action,
  idPrefix,
}: {
  item: StudioMenuItemSpec;
  action: StudioMenuAction;
  idPrefix: string;
}) {
  return (
    <>
      <span className="shrink-0" aria-hidden="true">
        {action.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold break-words">
          {action.label ?? item.label}
        </span>
        {/* The tooltip shows the description; this copy is what
            aria-describedby reads, so the visible text stays the name. */}
        <span id={`${idPrefix}-description`} className="sr-only">
          {item.description}
        </span>
      </span>
      {/* A space, so the label and badge read as two words. */}
      {action.badge !== undefined && " "}
      {action.badge !== undefined && (
        <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-300">
          {action.badge}
        </span>
      )}
      {action.checked !== undefined && (
        <IconCheck
          aria-hidden="true"
          className={`w-3.5 h-3.5 shrink-0 text-brand-cyan ${
            action.checked ? "" : "invisible"
          }`}
        />
      )}
      {item.shortcut && (
        // Drawn from the attribute, so the hint stays out of the visible text
        // that the name must contain; aria-keyshortcuts carries it instead.
        <kbd
          aria-hidden="true"
          data-shortcut={item.shortcut}
          className="shrink-0 text-[10px] font-mono text-zinc-400 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800 after:content-[attr(data-shortcut)]"
        />
      )}
    </>
  );
}

interface StudioHeaderMenusProps {
  actions: StudioMenuActions;
  /** Shown inside the Check trigger: the live issue count (#3394). */
  checkBadge: React.ReactNode;
  /** Whether the study has issues, which colours the Check trigger. */
  hasIssues: boolean;
}

/**
 * The Edit, View, Check and Share menus (#3394), from `lg` up. Each trigger
 * is a menu button: Enter, Space or the arrow keys open its menu and focus
 * an item, the arrow keys move through the items and across to the next
 * menu, and Escape or Tab closes it with focus back on the trigger.
 */
export function StudioHeaderMenus({
  actions,
  checkBadge,
  hasIssues,
}: StudioHeaderMenusProps) {
  const [openMenu, setOpenMenu] = useState<StudioMenuId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<
    Partial<Record<StudioMenuId, HTMLButtonElement | null>>
  >({});
  const panelRefs = useRef<
    Partial<Record<StudioMenuId, HTMLDivElement | null>>
  >({});
  // The item to focus once a menu that is opening has rendered visible.
  const pendingFocus = useRef<"first" | "last" | null>(null);

  const focusItem = (menuId: StudioMenuId, which: "first" | "last") => {
    const items = menuItems(panelRefs.current[menuId]);
    (which === "first" ? items[0] : items[items.length - 1])?.focus();
  };

  const open = (menuId: StudioMenuId, focus: "first" | "last" | null) => {
    if (openMenu === menuId) {
      if (focus) focusItem(menuId, focus);
      return;
    }
    pendingFocus.current = focus;
    setOpenMenu(menuId);
  };

  const close = (returnFocusTo?: StudioMenuId) => {
    setOpenMenu(null);
    if (returnFocusTo) triggerRefs.current[returnFocusTo]?.focus();
  };

  useEffect(() => {
    if (!openMenu) return;
    if (pendingFocus.current) {
      const items = menuItems(panelRefs.current[openMenu]);
      (pendingFocus.current === "first"
        ? items[0]
        : items[items.length - 1]
      )?.focus();
      pendingFocus.current = null;
    }
    // A pointer press anywhere outside the menus closes the open one.
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openMenu]);

  const menuIds = STUDIO_HEADER_MENUS.map((menu) => menu.id);
  const sibling = (menuId: StudioMenuId, key: string): StudioMenuId | null => {
    const index = menuIds.indexOf(menuId);
    if (key === "ArrowRight") return menuIds[(index + 1) % menuIds.length];
    if (key === "ArrowLeft")
      return menuIds[(index - 1 + menuIds.length) % menuIds.length];
    if (key === "Home") return menuIds[0];
    if (key === "End") return menuIds[menuIds.length - 1];
    return null;
  };

  const onTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    menuId: StudioMenuId
  ) => {
    switch (event.key) {
      case "ArrowDown":
      case "Enter":
      case " ":
        event.preventDefault();
        open(menuId, "first");
        return;
      case "ArrowUp":
        event.preventDefault();
        open(menuId, "last");
        return;
      case "Escape":
        if (openMenu) {
          event.preventDefault();
          close(menuId);
        }
        return;
      case "Tab":
        if (openMenu) setOpenMenu(null);
        return;
    }
    const next = sibling(menuId, event.key);
    if (!next) return;
    event.preventDefault();
    triggerRefs.current[next]?.focus();
    if (openMenu) open(next, "first");
  };

  const onItemKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    menuId: StudioMenuId
  ) => {
    const items = menuItems(panelRefs.current[menuId]);
    const index = items.indexOf(event.currentTarget);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
        return;
      case "ArrowUp":
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
        return;
      case "Home":
        event.preventDefault();
        items[0]?.focus();
        return;
      case "End":
        event.preventDefault();
        items[items.length - 1]?.focus();
        return;
      case "Escape":
        event.preventDefault();
        close(menuId);
        return;
      case "Tab":
        // Tab continues from the trigger, not from an item that is hiding.
        close(menuId);
        return;
      case "ArrowRight":
      case "ArrowLeft": {
        event.preventDefault();
        const next = sibling(menuId, event.key);
        if (next) {
          triggerRefs.current[next]?.focus();
          open(next, "first");
        }
        return;
      }
    }
  };

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Studio menus"
      className="hidden lg:flex items-center gap-0.5 shrink-0 ml-1"
    >
      {STUDIO_HEADER_MENUS.map((menu) => {
        const isOpen = openMenu === menu.id;
        const triggerId = `studio-menu-trigger-${menu.id}`;
        const panelId = `studio-menu-${menu.id}`;
        const isCheck = menu.id === "check";
        return (
          <div key={menu.id} className="relative">
            <button
              ref={(node) => {
                triggerRefs.current[menu.id] = node;
              }}
              id={triggerId}
              type="button"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              aria-controls={isOpen ? panelId : undefined}
              data-tour={isCheck ? "conformance" : undefined}
              title={
                isCheck
                  ? "Open CDISC Conformance Diagnostics and checks"
                  : undefined
              }
              onClick={() => (isOpen ? close() : open(menu.id, null))}
              onKeyDown={(event) => onTriggerKeyDown(event, menu.id)}
              className={`min-h-8 pointer-coarse:min-h-11 px-2.5 py-1 text-xs font-mono font-medium rounded-lg border transition-colors inline-flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ${
                isOpen
                  ? "bg-zinc-800 text-white border-zinc-700"
                  : isCheck && hasIssues
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                    : "border-transparent text-zinc-300 hover:text-white hover:bg-zinc-900"
              }`}
            >
              <span>{menu.label}</span>
              {isCheck && checkBadge}
              <IconChevronDown
                aria-hidden="true"
                className={`w-3 h-3 text-zinc-400 transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <div
              ref={(node) => {
                panelRefs.current[menu.id] = node;
              }}
              id={panelId}
              role="menu"
              aria-labelledby={triggerId}
              hidden={!isOpen}
              className="absolute left-0 top-full mt-1.5 w-72 max-w-[calc(100vw-2rem)] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1.5 z-50"
            >
              {menu.items.map((item) => {
                const action = actions[item.id];
                const idPrefix = `${panelId}-${item.id}`;
                return (
                  <React.Fragment key={item.id}>
                    {item.dividerBefore && (
                      <div
                        role="separator"
                        className="my-1 border-t border-zinc-800"
                      />
                    )}
                    <button
                      type="button"
                      role={
                        action.checked === undefined
                          ? "menuitem"
                          : "menuitemcheckbox"
                      }
                      aria-checked={action.checked}
                      aria-label={itemName(item, action)}
                      aria-keyshortcuts={item.keyshortcuts}
                      aria-describedby={`${idPrefix}-description`}
                      tabIndex={-1}
                      title={item.description}
                      disabled={!action.run}
                      onClick={() => {
                        close(menu.id);
                        action.run?.();
                      }}
                      onKeyDown={(event) => onItemKeyDown(event, menu.id)}
                      className="w-full min-h-9 pointer-coarse:min-h-11 flex items-center gap-2 px-2.5 py-1.5 text-xs font-mono rounded-lg text-left text-zinc-200 transition-colors outline-none hover:text-white hover:bg-zinc-800 focus:bg-zinc-800 focus-visible:ring-1 focus-visible:ring-brand-cyan disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <ItemContent
                        item={item}
                        action={action}
                        idPrefix={idPrefix}
                      />
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface StudioActionsDrawerProps {
  actions: StudioMenuActions;
  hasIssues: boolean;
}

/**
 * Below `lg`, the same four groups in one dialog behind the More trigger,
 * with focus trapped inside it and returned to the trigger on close.
 */
export function StudioActionsDrawer({
  actions,
  hasIssues,
}: StudioActionsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useFocusTrap<HTMLDivElement>(isOpen, {
    onEscape: () => setIsOpen(false),
    returnFocusTo: triggerRef,
  });

  return (
    <div className="relative lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="min-h-8 pointer-coarse:min-h-11 min-w-8 pointer-coarse:min-w-11 justify-center p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors inline-flex items-center gap-1 shrink-0"
        title="More Actions & Tools"
        aria-label="More Studio Actions"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <IconDotsVertical aria-hidden="true" className="w-4 h-4" />
        {hasIssues && (
          <span
            aria-hidden="true"
            className="w-2 h-2 rounded-full bg-amber-400"
          />
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Studio Actions"
            tabIndex={-1}
            className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] max-h-[75dvh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-3 z-50 space-y-3 outline-none"
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 px-1">
              <span className="text-xs font-bold font-mono text-zinc-300 uppercase">
                Studio Actions
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-8 min-w-8 pointer-coarse:min-h-11 pointer-coarse:min-w-11 inline-flex items-center justify-center text-zinc-400 hover:text-white rounded"
                aria-label="Close Studio Actions"
              >
                <IconX aria-hidden="true" className="w-3.5 h-3.5" />
              </button>
            </div>

            {STUDIO_HEADER_MENUS.map((menu) => (
              <section
                key={menu.id}
                aria-labelledby={`studio-drawer-${menu.id}`}
                className="space-y-1"
              >
                <h2
                  id={`studio-drawer-${menu.id}`}
                  className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 px-1"
                >
                  {menu.label}
                </h2>
                {menu.items.map((item) => {
                  const action = actions[item.id];
                  const idPrefix = `studio-drawer-${item.id}`;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={action.checked}
                      aria-label={itemName(item, action)}
                      aria-keyshortcuts={item.keyshortcuts}
                      aria-describedby={`${idPrefix}-description`}
                      title={item.description}
                      disabled={!action.run}
                      onClick={() => {
                        setIsOpen(false);
                        action.run?.();
                      }}
                      className="w-full min-h-9 pointer-coarse:min-h-11 flex items-center gap-2 px-2.5 py-1.5 text-xs font-mono rounded-lg text-left text-zinc-200 transition-colors hover:text-white hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ItemContent
                        item={item}
                        action={action}
                        idPrefix={idPrefix}
                      />
                    </button>
                  );
                })}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
