"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IconSearch,
  IconX,
  IconForms,
  IconListDetails,
  IconCalendarEvent,
  IconSparkles,
  IconLayoutDashboard,
  IconFileExport,
  IconCornerDownLeft,
  IconInfoCircle,
} from "@tabler/icons-react";
import type { StudyProtocol } from "@/lib/crf/types";
import {
  buildStudyOmnibarIndex,
  groupOmnibarResults,
  isUnsupportedDictionaryQuery,
  resolveOmnibarInsertionTarget,
  searchStudyOmnibar,
  OMNIBAR_CATEGORY_LABELS,
  OMNIBAR_CATEGORY_ORDER,
  type OmnibarAction,
  type OmnibarCategory,
  type OmnibarEntry,
} from "@/lib/crf";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useWorkspaceAction } from "@/hooks/useWorkspaceAction";
import { useAnnouncer } from "@/components/providers/A11yProvider";

interface StudyOmnibarProps {
  isOpen: boolean;
  /** Opens the omnibar; bound to the F shortcut and the site command palette. */
  onOpen: () => void;
  onClose: () => void;
  study: StudyProtocol;
  /** Form insert actions target. Insert actions are hidden without one. */
  activeFormId?: string;
  /** Selected field; insert actions land after it, as in the slash palette. */
  selectedFieldId?: string | null;
  /** Runs the chosen action through the studio's own handlers. */
  onRunAction: (action: OmnibarAction) => void;
}

/**
 * Plain F, as on GitHub's file finder: a printable key is the one shortcut
 * that reads the same on every platform (Option+letter types a symbol on
 * macOS, and Ctrl/Cmd chords collide with browser and site-wide bindings).
 * useHotkeys already ignores it in inputs, textareas, selects and
 * contenteditable regions, and requires Ctrl, Meta and Alt to be released,
 * so Ctrl/Cmd+F still reaches the browser's own find.
 */
const OMNIBAR_HOTKEYS = ["f"] as const;

const EMPTY_QUERY_GROUP_LIMIT = 5;
const QUERY_GROUP_LIMIT = 8;
const FILTERED_GROUP_LIMIT = 50;

/**
 * Whether the F shortcut may open the omnibar for this event target. It
 * stays out of dialogs (the slash palette, export dialog, the omnibar
 * itself) and out of nested keyboard regions such as the terminal and the
 * form test dock, which own their keys; the studio root is itself a
 * keyboard boundary, marked by its theme attribute, and does not count.
 */
function isOmnibarHotkeyTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return true;
  }
  if (target.closest('[role="dialog"], [role="alertdialog"], dialog')) {
    return false;
  }
  const boundary = target.closest("[data-keyboard-boundary]");
  return !boundary || boundary.hasAttribute("data-studio-theme");
}

function categoryIcon(category: OmnibarCategory) {
  const cls = "w-4 h-4 shrink-0";
  switch (category) {
    case "form":
      return <IconForms className={`${cls} studio-fg-cyan`} aria-hidden />;
    case "field":
      return (
        <IconListDetails className={`${cls} studio-fg-secondary`} aria-hidden />
      );
    case "visit":
      return (
        <IconCalendarEvent className={`${cls} studio-fg-emerald`} aria-hidden />
      );
    case "insert":
      return <IconSparkles className={`${cls} studio-fg-amber`} aria-hidden />;
    case "navigate":
      return (
        <IconLayoutDashboard className={`${cls} studio-fg-muted`} aria-hidden />
      );
    case "export":
      return <IconFileExport className={`${cls} studio-fg-sky`} aria-hidden />;
  }
}

/**
 * Study Omnibar (#544): one keyboard-first search over the study's forms,
 * fields and visits and the studio actions that are supported locally
 * (verified starter-block insertion, studio views, export entry points).
 * Every result names the form, section or visits that own it.
 */
export const StudyOmnibar: React.FC<StudyOmnibarProps> = ({
  isOpen,
  onOpen,
  onClose,
  study,
  activeFormId,
  selectedFieldId,
  onRunAction,
}) => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<OmnibarCategory | "all">("all");
  const [activeIndex, setActiveIndex] = useState(0);

  // Reset selection while rendering (not in an effect) when inputs change.
  const [prevQuery, setPrevQuery] = useState(query);
  const [prevCategory, setPrevCategory] = useState(category);
  if (query !== prevQuery || category !== prevCategory) {
    setPrevQuery(query);
    setPrevCategory(category);
    setActiveIndex(0);
  }
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setQuery("");
      setCategory("all");
      setActiveIndex(0);
    }
  }

  const { announce } = useAnnouncer();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, {
    initialFocusRef: inputRef,
  });

  useHotkeys(
    OMNIBAR_HOTKEYS,
    (event) => {
      if (!isOmnibarHotkeyTarget(event.target)) return;
      event.preventDefault();
      onOpen();
    },
    {
      enabled: !isOpen,
      allowInKeyboardBoundary: true,
      ignoreWhenModalOpen: true,
    }
  );

  useWorkspaceAction({
    id: "crf-studio:omnibar",
    title: "CRF Studio: Find Forms, Fields, Visits & Actions",
    description:
      "Search the open study and run supported insert, navigation and export actions",
    subToolId: "crf-studio",
    subToolName: "CRF Studio",
    badge: "Find",
    tags: ["find", "search", "omnibar", "forms", "fields", "visits", "crf"],
    shortcut: "F",
    handler: onOpen,
  });

  const insertion = useMemo(
    () => resolveOmnibarInsertionTarget(study, activeFormId, selectedFieldId),
    [study, activeFormId, selectedFieldId]
  );

  // Built only while open: insert entries dry-run the engine per command.
  const index = useMemo(
    () =>
      isOpen
        ? buildStudyOmnibarIndex(study, { insertionTarget: insertion })
        : [],
    [isOpen, study, insertion]
  );

  const groups = useMemo(() => {
    const scoped = category === "all" ? undefined : category;
    const limit = scoped
      ? FILTERED_GROUP_LIMIT
      : query.trim()
        ? QUERY_GROUP_LIMIT
        : EMPTY_QUERY_GROUP_LIMIT;
    return groupOmnibarResults(searchStudyOmnibar(index, query, scoped), limit);
  }, [index, query, category]);

  const flat = useMemo(
    () => groups.flatMap((g) => g.results.map((r) => r.entry)),
    [groups]
  );
  const availableCategories = useMemo(
    () =>
      OMNIBAR_CATEGORY_ORDER.filter((c) => index.some((e) => e.category === c)),
    [index]
  );

  const showDictionaryNotice = isUnsupportedDictionaryQuery(query);
  const activeEntry = flat[activeIndex];
  const optionId = (entry: OmnibarEntry) =>
    `study-omnibar-opt-${entry.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!activeEntry || !listRef.current) return;
    listRef.current
      .querySelector(`#${optionId(activeEntry)}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeEntry]);

  const run = (entry: OmnibarEntry) => {
    onClose();
    onRunAction(entry.action);
    announce(`${entry.title}: ${entry.context}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      // Handled here and stopped, so the studio's global Escape binding
      // does not also clear the author's field selection behind the dialog.
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.target !== inputRef.current) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (flat.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (i + step + flat.length) % flat.length);
    } else if (e.key === "Home" && e.ctrlKey) {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End" && e.ctrlKey) {
      e.preventDefault();
      setActiveIndex(Math.max(0, flat.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeEntry) run(activeEntry);
    }
  };

  if (!isOpen) return null;

  let flatCursor = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-4 studio-surface-scrim"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-omnibar-title"
        aria-describedby="study-omnibar-hint"
        data-testid="study-omnibar"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl min-w-0 studio-surface-elevated border studio-border-default rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[82dvh]"
      >
        <div className="p-3 sm:p-4 border-b studio-border-default studio-surface-subtle space-y-2.5">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <h2
              id="study-omnibar-title"
              className="text-xs font-mono font-bold studio-fg-primary uppercase tracking-wider truncate"
            >
              Find in Study
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 studio-fg-muted studio-hover-fg-primary rounded-lg studio-hover-surface transition-colors shrink-0"
              aria-label="Close study search"
            >
              <IconX className="w-4 h-4" aria-hidden />
            </button>
          </div>

          <div className="relative">
            <IconSearch
              className="w-4 h-4 studio-fg-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden
            />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="study-omnibar-listbox"
              aria-autocomplete="list"
              aria-activedescendant={
                activeEntry ? optionId(activeEntry) : undefined
              }
              aria-label="Search forms, fields, visits and actions"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search forms, fields, visits, or actions (e.g. weight, screening, /vitals, export)"
              className="w-full pl-9 pr-3 py-2 studio-surface-card border studio-border-strong rounded-xl text-sm studio-fg-primary studio-placeholder font-mono focus:outline-none studio-focus-input focus:ring-1"
            />
          </div>

          <div
            role="group"
            aria-label="Filter results by category"
            className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
          >
            {(["all", ...availableCategories] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => {
                  setCategory(c);
                  inputRef.current?.focus();
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono shrink-0 transition-colors ${
                  category === c
                    ? "studio-btn-cyan font-semibold"
                    : "studio-surface-card studio-fg-muted studio-hover-fg-primary studio-hover-surface"
                }`}
              >
                {c === "all" ? "All" : OMNIBAR_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        {showDictionaryNotice && (
          <p
            role="note"
            data-testid="study-omnibar-dictionary-notice"
            className="mx-3 sm:mx-4 mt-3 flex items-start gap-2 rounded-xl border studio-accent-amber px-3 py-2 text-[11px] break-words"
          >
            <IconInfoCircle className="w-4 h-4 shrink-0 mt-px" aria-hidden />
            <span className="min-w-0">
              MedDRA and WHODrug coding lookups are not available in CRF Studio:
              licensed dictionaries are not bundled. Fields can still be found
              by name or variable.
            </span>
          </p>
        )}

        <div
          ref={listRef}
          id="study-omnibar-listbox"
          role="listbox"
          aria-label="Study search results"
          className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-3 space-y-3 crf-custom-scrollbar"
        >
          {groups.length === 0 ? (
            <p className="py-10 text-center studio-fg-muted font-mono text-xs break-words">
              No forms, fields, visits or actions match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            groups.map((group) => (
              <div
                key={group.category}
                role="group"
                aria-labelledby={`study-omnibar-group-${group.category}`}
              >
                <div
                  id={`study-omnibar-group-${group.category}`}
                  role="presentation"
                  className="px-1.5 pb-1 text-[10px] font-mono uppercase tracking-wider studio-fg-muted"
                >
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.results.map(({ entry }) => {
                    flatCursor += 1;
                    const position = flatCursor;
                    const selected = position === activeIndex;
                    return (
                      <div
                        key={entry.id}
                        id={optionId(entry)}
                        role="option"
                        aria-selected={selected}
                        data-category={entry.category}
                        onClick={() => run(entry)}
                        onMouseMove={() => {
                          if (!selected) setActiveIndex(position);
                        }}
                        className={`px-2.5 py-2 rounded-xl border cursor-pointer flex items-center gap-3 min-w-0 active:scale-[0.98] transition-colors ${
                          selected
                            ? "studio-surface-card studio-border-cyan studio-fg-primary"
                            : "studio-surface-subtle studio-border-default studio-fg-secondary studio-hover-subtle"
                        }`}
                      >
                        {categoryIcon(entry.category)}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-mono font-semibold truncate">
                              {entry.title}
                            </span>
                            {entry.detail && (
                              <code className="text-[10px] font-mono px-1.5 py-0.5 rounded studio-surface-subtle border studio-border-default studio-fg-muted shrink-0 max-w-[40%] truncate">
                                {entry.detail}
                              </code>
                            )}
                          </div>
                          <p className="text-[11px] studio-fg-muted truncate">
                            {entry.context}
                          </p>
                        </div>
                        {selected && (
                          <IconCornerDownLeft
                            className="w-3.5 h-3.5 studio-fg-muted shrink-0 hidden sm:block"
                            aria-hidden
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                {group.hiddenCount > 0 && (
                  <p className="px-1.5 pt-1 text-[10px] font-mono studio-fg-muted">
                    +{group.hiddenCount} more {group.label.toLowerCase()}: keep
                    typing or filter by category.
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        <div
          id="study-omnibar-hint"
          className="px-4 py-2 border-t studio-border-default studio-surface-subtle text-[10px] font-mono studio-fg-muted flex items-center justify-between gap-3"
        >
          <span className="truncate">↑↓ move · ↵ open or run · Esc close</span>
          <span className="shrink-0" aria-live="polite">
            {flat.length} shown
          </span>
        </div>
      </div>
    </div>
  );
};
