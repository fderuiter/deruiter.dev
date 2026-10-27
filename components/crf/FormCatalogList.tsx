"use client";

import React, { useId, useMemo, useState } from "react";
import { IconGripVertical, IconPlus } from "@tabler/icons-react";
import {
  FORM_CATALOG_SOURCES,
  searchFormCatalog,
  type FormCatalogEntry,
  type FormCatalogSource,
} from "@/lib/crf";

/** Drag payload type for a catalog form dropped on a visit. */
export const CATALOG_DRAG_TYPE = "catalog";

interface FormCatalogListProps {
  entries: readonly FormCatalogEntry[];
  onAdd: (entry: FormCatalogEntry) => void;
  /** False when no form is open, so blocks have nowhere to go. */
  canInsertBlocks: boolean;
  /** Lets form entries be dragged onto a visit in the study timeline. */
  draggable?: boolean;
  /** Tighter rows for the sidebar. */
  compact?: boolean;
}

const CHIP =
  "inline-flex min-h-[28px] items-center rounded-full border px-2.5 py-1 text-[10px] font-mono transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 active:scale-[0.98]";

/**
 * The one list of ready-made forms and blocks (#2927 item 11): CDASH
 * domains, forms from the example studies, saved templates and smart
 * blocks, with one search box and a filter per source.
 */
export function FormCatalogList({
  entries,
  onAdd,
  canInsertBlocks,
  draggable = false,
  compact = false,
}: FormCatalogListProps) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<FormCatalogSource | undefined>();
  const searchId = useId();

  const counts = useMemo(() => {
    const bySource = new Map<FormCatalogSource, number>();
    for (const entry of entries) {
      bySource.set(entry.source, (bySource.get(entry.source) ?? 0) + 1);
    }
    return bySource;
  }, [entries]);
  const visible = useMemo(
    () => searchFormCatalog(entries, query, source),
    [entries, query, source]
  );
  const originLabel = (entry: FormCatalogEntry) =>
    FORM_CATALOG_SOURCES.find((s) => s.source === entry.source)?.label;

  const handleDragStart = (e: React.DragEvent, entry: FormCatalogEntry) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: CATALOG_DRAG_TYPE, entryId: entry.id })
    );
  };

  return (
    <div className="space-y-2" data-testid="form-catalog">
      <label htmlFor={searchId} className="sr-only">
        Search the form catalog
      </label>
      <input
        id={searchId}
        type="search"
        placeholder="Search forms and blocks (e.g. vitals, QTc, RECIST)..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-mono text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
      />

      <div
        role="group"
        aria-label="Filter the catalog by source"
        className="flex flex-wrap gap-1.5"
      >
        <button
          type="button"
          aria-pressed={source === undefined}
          onClick={() => setSource(undefined)}
          className={`${CHIP} ${
            source === undefined
              ? "border-amber-500/50 bg-amber-950/40 text-amber-200"
              : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
          }`}
        >
          All ({entries.length})
        </button>
        {FORM_CATALOG_SOURCES.filter(
          (item) => (counts.get(item.source) ?? 0) > 0
        ).map((item) => (
          <button
            key={item.source}
            type="button"
            aria-pressed={source === item.source}
            onClick={() =>
              setSource(source === item.source ? undefined : item.source)
            }
            className={`${CHIP} ${
              source === item.source
                ? "border-amber-500/50 bg-amber-950/40 text-amber-200"
                : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
            }`}
          >
            {item.label} ({counts.get(item.source)})
          </button>
        ))}
      </div>

      <p className="sr-only" role="status">
        {visible.length} of {entries.length} catalog entries shown
      </p>

      {visible.length === 0 ? (
        <p className="px-1 text-[11px] font-mono italic text-zinc-400">
          Nothing in the catalog matches “{query}”.
        </p>
      ) : (
        <ul
          className={`space-y-1.5 overflow-y-auto pr-0.5 ${
            compact ? "max-h-80" : ""
          }`}
        >
          {visible.map((entry) => {
            const isBlock = entry.target === "form";
            const disabled = isBlock && !canInsertBlocks;
            const canDrag = draggable && !isBlock;
            return (
              <li
                key={entry.id}
                draggable={canDrag}
                onDragStart={
                  canDrag ? (e) => handleDragStart(e, entry) : undefined
                }
                className={`group rounded-xl border border-zinc-800 bg-zinc-900/40 transition-colors hover:border-zinc-700 hover:bg-zinc-900/80 ${
                  compact ? "p-2" : "p-3"
                } ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    {canDrag && (
                      <IconGripVertical
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600"
                        aria-hidden="true"
                      />
                    )}
                    {entry.domain && (
                      <span className="shrink-0 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-[10px] font-mono font-bold text-zinc-200">
                        {entry.domain}
                      </span>
                    )}
                    <div className="min-w-0">
                      <h4
                        className={`text-xs font-bold text-zinc-200 group-hover:text-white ${
                          compact ? "truncate" : "break-words"
                        }`}
                      >
                        {entry.title}
                      </h4>
                      {!compact && (
                        <p className="break-words text-[11px] text-zinc-400">
                          {entry.description}
                        </p>
                      )}
                      <p className="truncate text-[10px] font-mono text-zinc-400">
                        {originLabel(entry)} · {entry.fieldCount} fields
                        {entry.source === "preset" ? ` · ${entry.origin}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onAdd(entry)}
                    aria-label={
                      isBlock
                        ? `Insert ${entry.title} into the open form`
                        : `Add ${entry.title} to the study`
                    }
                    title={
                      disabled ? "Open a form to insert a block" : undefined
                    }
                    className="inline-flex min-h-[28px] shrink-0 items-center gap-1 rounded border border-amber-500/30 bg-zinc-900 px-2 py-1 text-[10px] font-mono font-bold text-amber-300 transition-colors hover:bg-amber-950/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IconPlus className="h-3 w-3" aria-hidden="true" />
                    {isBlock ? "Insert" : "Add"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
