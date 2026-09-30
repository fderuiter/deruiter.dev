"use client";

import React, { useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DISCOVERY_SOURCE_LABELS,
  HAND_NAMES,
  RUN_HISTORY_LIMIT,
  deriveCodexView,
  originLabel,
  sponsorById,
  type Codex as CodexDocument,
  type CodexEntryView,
  type CodexSectionView,
  type RunHistoryEntry,
  type RunPlan,
} from "@/lib/trial-and-error";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface CodexProps {
  /** The plan whose entries the Codex lists. */
  plan: RunPlan;
  /** The stored Codex: discoveries and run history. */
  codex: CodexDocument;
  onClose: () => void;
}

const HISTORY_TAB = "HISTORY";

const TAB =
  "min-h-[44px] border px-3 py-2 text-[10px] font-bold uppercase tracking-wider touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]";

/** The first-seen line of a discovered entry. */
function firstSeenLine(entry: CodexEntryView): string {
  const discovery = entry.discovery;
  if (!discovery) return "";
  const origin = discovery.firstSeen.origin;
  const marker =
    origin && origin.kind !== "RANDOM" ? ` (${originLabel(origin)})` : "";
  return `First seen on seed ${discovery.firstSeen.seed}${marker}. ${DISCOVERY_SOURCE_LABELS[discovery.via]}.`;
}

function EntryCard({ entry }: { entry: CodexEntryView }) {
  if (!entry.discovery) {
    return (
      <li
        className="flex min-w-0 flex-col gap-1 border border-dashed border-zinc-800 bg-[color:var(--te-surface-0)] p-3 text-xs"
        data-testid="codex-entry"
        data-discovered="false"
      >
        <span
          aria-hidden="true"
          className="block h-3 w-24 max-w-full bg-zinc-800"
        />
        <p className="font-bold uppercase tracking-wider text-zinc-400">
          Undiscovered
        </p>
        <p className="text-zinc-400 break-words">{entry.teaser}</p>
      </li>
    );
  }
  return (
    <li
      className="flex min-w-0 flex-col gap-1 border border-zinc-700 bg-[color:var(--te-surface-1)] p-3 text-xs"
      data-testid="codex-entry"
      data-discovered="true"
    >
      <p className="font-bold text-zinc-100 break-words">{entry.name}</p>
      <p className="text-zinc-300 break-words">{entry.description}</p>
      {entry.flavor && (
        <p className="italic text-zinc-400 break-words">{entry.flavor}</p>
      )}
      <p className="mt-1 text-[11px] text-zinc-400 tabular-nums break-words">
        {firstSeenLine(entry)}
      </p>
    </li>
  );
}

function reachedLine(entry: RunHistoryEntry): string {
  const { reached } = entry;
  const where =
    reached.round !== null
      ? `Post-marketing round ${reached.round}`
      : reached.actTitle;
  return `${where} · ${reached.blindTitle}`;
}

function resultLabel(entry: RunHistoryEntry): string {
  if (entry.result === "WON") return "Won";
  return entry.campaignWon ? "Won, then failed post-marketing" : "Failed";
}

function HistoryItem({ entry }: { entry: RunHistoryEntry }) {
  const won = entry.result === "WON" || entry.campaignWon;
  const sponsor =
    entry.sponsorId && entry.sponsorId !== "VIRTUAL_BIOTECH"
      ? sponsorById(entry.sponsorId).name
      : null;
  const marker =
    entry.origin && entry.origin.kind !== "RANDOM"
      ? originLabel(entry.origin)
      : null;
  return (
    <li
      className="flex min-w-0 flex-col gap-1 border border-zinc-700 bg-[color:var(--te-surface-1)] p-3 text-xs"
      data-testid="codex-history-entry"
    >
      <p className="flex min-w-0 flex-wrap items-center gap-2">
        <span
          className={`border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            won
              ? "border-emerald-500/60 text-emerald-300"
              : "border-rose-400/60 text-rose-200"
          }`}
        >
          {resultLabel(entry)}
        </span>
        {marker && (
          <span
            className="border border-amber-500/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300"
            data-testid="codex-history-marker"
          >
            {marker}
          </span>
        )}
        {entry.endedOn && (
          <span className="text-[11px] text-zinc-400 tabular-nums">
            {entry.endedOn}
          </span>
        )}
      </p>
      <p className="text-zinc-200 break-words">{reachedLine(entry)}</p>
      <p className="text-zinc-300 tabular-nums break-words">
        Seed {entry.seed}
        {sponsor ? ` · ${sponsor}` : ""}
        {entry.stake && entry.stake > 1 ? ` · Stake ${entry.stake}` : ""}
      </p>
      <p className="text-zinc-300 tabular-nums break-words">
        {entry.bestHand
          ? `Best hand: ${HAND_NAMES[entry.bestHand.handType]}, ${entry.bestHand.score.toLocaleString("en-US")}`
          : "No hand played"}
      </p>
    </li>
  );
}

function SectionPanel({ section }: { section: CodexSectionView }) {
  return (
    <>
      <p className="text-[11px] text-zinc-400 tabular-nums">
        {section.discovered} of {section.entries.length} discovered
      </p>
      <div className="@container mt-2">
        <ul className="grid gap-2 @lg:grid-cols-2">
          {section.entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </ul>
      </div>
    </>
  );
}

/**
 * The Codex (#1529): every relic, Guidance card, Footnote Seal, Boss, crisis,
 * hand type and sponsor the plan holds, and the last runs. Undiscovered
 * entries are graphite silhouettes with a teaser line; discovered ones show
 * the card, its flavor text and the run it was first seen in. A
 * focus-trapped dialog with arrow-key tabs; Escape or Close dismisses it and
 * focus returns to the trigger.
 */
export function Codex({ plan, codex, onClose }: CodexProps) {
  const ref = useFocusTrap<HTMLDivElement>(true, { onEscape: onClose });
  const sections = useMemo(() => deriveCodexView(plan, codex), [plan, codex]);
  const tabIds = [...sections.map((s) => s.category), HISTORY_TAB];
  const [active, setActive] = useState<string>(tabIds[0]);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const id = useId();
  const tabId = (key: string) => `${id}-tab-${key}`;
  const panelId = `${id}-panel`;
  const total = sections.reduce((n, s) => n + s.entries.length, 0);
  const found = sections.reduce((n, s) => n + s.discovered, 0);
  const section = sections.find((s) => s.category === active);

  const select = (key: string) => {
    setActive(key);
    tabRefs.current.get(key)?.focus();
  };
  const onTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = tabIds.length - 1;
    const target =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    select(tabIds[target]);
  };

  return createPortal(
    <div
      data-te-cabinet=""
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-heading`}
        className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto border border-zinc-700 bg-[color:var(--te-surface-0)] p-4 font-mono text-[color:var(--te-text)]"
        data-testid="codex"
      >
        <h2
          id={`${id}-heading`}
          className="text-sm font-bold uppercase tracking-wider"
        >
          Codex
        </h2>
        <p className="mt-1 text-[11px] text-zinc-400 tabular-nums break-words">
          {found} of {total} entries discovered in this browser. Entries appear
          the first time a run shows them to you.
        </p>
        <div
          role="tablist"
          aria-label="Codex sections"
          className="mt-3 flex flex-wrap gap-1"
        >
          {tabIds.map((key, index) => {
            const s = sections.find((x) => x.category === key);
            const selected = key === active;
            return (
              <button
                key={key}
                ref={(node) => {
                  if (node) tabRefs.current.set(key, node);
                  else tabRefs.current.delete(key);
                }}
                type="button"
                role="tab"
                id={tabId(key)}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(key)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                className={`${TAB} ${
                  selected
                    ? "border-amber-400 bg-amber-500/10 text-amber-300"
                    : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                }`}
                data-testid={`codex-tab-${key}`}
              >
                {s
                  ? `${s.title} ${s.discovered}/${s.entries.length}`
                  : "Run history"}
              </button>
            );
          })}
        </div>
        <div
          role="tabpanel"
          id={panelId}
          aria-labelledby={tabId(active)}
          tabIndex={0}
          className="mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          data-testid="codex-panel"
        >
          {section ? (
            <SectionPanel section={section} />
          ) : codex.history.length === 0 ? (
            <p className="text-xs text-zinc-300 break-words">
              No finished runs yet. Your last {RUN_HISTORY_LIMIT} runs appear
              here, win or lose.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-zinc-400">
                The last {RUN_HISTORY_LIMIT} runs, newest first.
              </p>
              <ol className="mt-2 grid gap-2" data-testid="codex-history">
                {codex.history.map((entry, index) => (
                  <HistoryItem
                    key={`${entry.seed}-${entry.moves}-${index}`}
                    entry={entry}
                  />
                ))}
              </ol>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-[48px] w-full border border-zinc-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-200 touch-manipulation hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
        >
          Close [Esc]
        </button>
      </div>
    </div>,
    document.fullscreenElement ?? document.body
  );
}
