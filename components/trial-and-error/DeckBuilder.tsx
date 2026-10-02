"use client";

import React, { useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type CardType,
  type CustomScenarioSpec,
  CustomScenarioSpecSchema,
  type PopulationType,
  POPULATION_LABELS,
  type RoundingMode,
  challengeHash,
  createCustomScenario,
  exportScenarioJson,
  getAllCodexCards,
  importScenarioJson,
} from "@/lib/trial-and-error";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { copyToClipboard, getActiveHostUrl } from "@/lib/clipboard";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import { CHALLENGE_PATH } from "@/components/trial-and-error/useChallenge";

const BUTTON =
  "min-h-[44px] border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-200 touch-manipulation hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

const PRIMARY_BUTTON =
  "min-h-[44px] border border-amber-500 bg-amber-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-300 touch-manipulation hover:bg-amber-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

const INPUT =
  "w-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-100 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400";

const SELECT =
  "w-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-100 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400";

interface DeckBuilderProps {
  /** Callback when user starts a run with the custom scenario spec. */
  onStartCustomRun: (spec: CustomScenarioSpec) => void;
  /** Initial spec to edit if imported or shared. */
  initialSpec?: CustomScenarioSpec | null;
  /** Close modal callback. */
  onClose: () => void;
}

const CARD_TYPES: CardType[] = ["TABLE", "LISTING", "FIGURE", "SUBJECT_TOKEN"];
const POPULATIONS: PopulationType[] = [
  "ITT",
  "SAFETY",
  "FAS",
  "PER_PROTOCOL",
  "SCREENED",
];
const ROUNDING_MODES: RoundingMode[] = [
  "HALF_EVEN",
  "HALF_AWAY_FROM_ZERO",
  "TRUNCATE",
];

export function DeckBuilder({
  onStartCustomRun,
  initialSpec,
  onClose,
}: DeckBuilderProps) {
  const { announce } = useAnnouncer();
  const allCards = useMemo(() => getAllCodexCards(), []);

  const defaultCardIds = useMemo(
    () => initialSpec?.cardIds ?? allCards.slice(0, 10).map((c) => c.id),
    [initialSpec, allCards]
  );

  const [title, setTitle] = useState(initialSpec?.title ?? "Custom Challenge");
  const [summary, setSummary] = useState(
    initialSpec?.summary ??
      "A custom clinical scenario constructed with the Deck Builder."
  );
  const [quota, setQuota] = useState(initialSpec?.quota ?? 500);
  const [startingCpu, setStartingCpu] = useState(
    initialSpec?.startingCpu ?? 10
  );
  const [percentPrecision, setPercentPrecision] = useState(
    initialSpec?.rulebook.percentPrecision ?? 1
  );
  const [meanPrecision, setMeanPrecision] = useState(
    initialSpec?.rulebook.meanPrecision ?? 2
  );
  const [roundingMode, setRoundingMode] = useState<RoundingMode>(
    initialSpec?.rulebook.roundingMode ?? "HALF_EVEN"
  );
  const [populationSuit, setPopulationSuit] = useState<PopulationType | "">(
    initialSpec?.rulebook.populationSuit ?? "ITT"
  );

  const [selectedCardIds, setSelectedCardIds] =
    useState<string[]>(defaultCardIds);
  const [typeFilter, setTypeFilter] = useState<CardType | "ALL">("ALL");
  const [suitFilter, setSuitFilter] = useState<PopulationType | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useFocusTrap<HTMLDivElement>(true, {
    onEscape: onClose,
    initialFocusRef: closeButtonRef,
  });

  const id = useId();

  const currentSpec: CustomScenarioSpec = {
    title: title.trim() || "Custom Challenge",
    summary: summary.trim() || undefined,
    quota: Math.max(50, Number(quota) || 500),
    startingCpu: Math.max(1, Number(startingCpu) || 10),
    rulebook: {
      percentPrecision: Number(percentPrecision),
      meanPrecision: Number(meanPrecision),
      roundingMode,
      ...(populationSuit
        ? { populationSuit: populationSuit as PopulationType }
        : {}),
    },
    cardIds: selectedCardIds,
  };

  const filteredCards = allCards.filter((card) => {
    if (typeFilter !== "ALL" && card.cardType !== typeFilter) return false;
    if (suitFilter !== "ALL" && card.population !== suitFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = card.title.toLowerCase().includes(q);
      const matchNumber = card.number.toLowerCase().includes(q);
      const matchTopic = card.topic.toLowerCase().includes(q);
      if (!matchTitle && !matchNumber && !matchTopic) return false;
    }
    return true;
  });

  const toggleCard = (cardId: string) => {
    setSelectedCardIds((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      return [...prev, cardId];
    });
    setValidationError(null);
  };

  const validateSpec = (): CustomScenarioSpec | null => {
    const parse = CustomScenarioSpecSchema.safeParse(currentSpec);
    if (!parse.success) {
      const issue = parse.error.issues[0];
      const msg = issue
        ? `${issue.path.join(".")}: ${issue.message}`
        : "Invalid custom scenario configuration.";
      setValidationError(msg);
      announce(`Validation error: ${msg}`);
      return null;
    }
    setValidationError(null);
    return parse.data;
  };

  const handleStartRun = () => {
    const valid = validateSpec();
    if (!valid) return;
    try {
      // Test creating scenario to verify full ScenarioSchema validity
      createCustomScenario(valid, allCards);
      onStartCustomRun(valid);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setValidationError(`Scenario build error: ${msg}`);
    }
  };

  const handleCopyLink = async () => {
    const valid = validateSpec();
    if (!valid) return;
    const hash = challengeHash("7K3M-Q9PX", { kind: "SEEDED" }, {}, valid);
    const link = `${getActiveHostUrl()}${CHALLENGE_PATH}${hash}`;
    try {
      await copyToClipboard(link);
      setStatusNotice("Challenge link copied!");
      announce("Challenge link copied to clipboard.");
      window.setTimeout(() => setStatusNotice(null), 2500);
    } catch {
      setStatusNotice("Failed to copy link.");
    }
  };

  const handleExportJson = () => {
    const valid = validateSpec();
    if (!valid) return;
    const jsonStr = exportScenarioJson(valid);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `custom-scenario-${valid.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusNotice("Scenario JSON exported!");
    announce("Scenario JSON exported.");
    window.setTimeout(() => setStatusNotice(null), 2500);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = importScenarioJson(text);
        setTitle(imported.title);
        if (imported.summary) setSummary(imported.summary);
        setQuota(imported.quota);
        setStartingCpu(imported.startingCpu);
        setPercentPrecision(imported.rulebook.percentPrecision);
        setMeanPrecision(imported.rulebook.meanPrecision);
        setRoundingMode(imported.rulebook.roundingMode);
        setPopulationSuit(imported.rulebook.populationSuit ?? "ITT");
        setSelectedCardIds(imported.cardIds);
        setValidationError(null);
        setStatusNotice("Scenario JSON imported successfully!");
        announce("Scenario JSON imported successfully.");
        window.setTimeout(() => setStatusNotice(null), 2500);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Invalid scenario JSON";
        setValidationError(`Import failed: ${msg}`);
        announce("Import failed: Invalid scenario JSON format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return createPortal(
    <div
      data-te-cabinet=""
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col border border-zinc-800 bg-[#13151a] p-4 text-zinc-100 shadow-2xl sm:p-6 overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <h2
              id={`${id}-title`}
              className="font-mono text-lg font-extrabold text-amber-400 sm:text-xl"
            >
              Arcade Deck Builder &amp; Scenario Specification Editor
            </h2>
            <p id={`${id}-desc`} className="font-mono text-xs text-zinc-400">
              Build a custom TLF starting deck, tune study quotas and SAP
              rulebook parameters, and share via compressed challenge URLs or
              exported JSON payloads.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="border border-zinc-700 px-3 py-1.5 font-mono text-xs font-bold uppercase text-zinc-300 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Close ✕
          </button>
        </div>

        {/* Modal Scroll Body */}
        <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-6">
          {/* General Scenario Parameters */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`${id}-scenario-title`}
                className="block font-mono text-xs font-bold text-zinc-300"
              >
                Scenario Title
              </label>
              <input
                id={`${id}-scenario-title`}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={INPUT}
                placeholder="e.g. Precision Cardiology Run"
              />
            </div>
            <div>
              <label
                htmlFor={`${id}-scenario-summary`}
                className="block font-mono text-xs font-bold text-zinc-300"
              >
                Summary / Description
              </label>
              <input
                id={`${id}-scenario-summary`}
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className={INPUT}
                placeholder="Short description of the challenge"
              />
            </div>

            <div>
              <label
                htmlFor={`${id}-quota`}
                className="block font-mono text-xs font-bold text-zinc-300"
              >
                Study Quota ({quota} Chips)
              </label>
              <input
                id={`${id}-quota`}
                type="number"
                min={50}
                max={10000}
                step={25}
                value={quota}
                onChange={(e) => setQuota(Number(e.target.value))}
                className={INPUT}
              />
            </div>

            <div>
              <label
                htmlFor={`${id}-starting-cpu`}
                className="block font-mono text-xs font-bold text-zinc-300"
              >
                Starting CPU ({startingCpu} CPU)
              </label>
              <input
                id={`${id}-starting-cpu`}
                type="number"
                min={1}
                max={100}
                value={startingCpu}
                onChange={(e) => setStartingCpu(Number(e.target.value))}
                className={INPUT}
              />
            </div>
          </div>

          {/* SAP Rulebook Parameters */}
          <div className="border border-zinc-800 bg-zinc-900/50 p-3 sm:p-4 rounded-none">
            <h3 className="font-mono text-xs font-bold uppercase text-amber-400">
              Statistical Analysis Plan (SAP) Rulebook Parameters
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label
                  htmlFor={`${id}-percent-precision`}
                  className="block font-mono text-[10px] text-zinc-400"
                >
                  Percent Precision ({percentPrecision} dec)
                </label>
                <input
                  id={`${id}-percent-precision`}
                  type="number"
                  min={0}
                  max={6}
                  value={percentPrecision}
                  onChange={(e) => setPercentPrecision(Number(e.target.value))}
                  className={INPUT}
                />
              </div>

              <div>
                <label
                  htmlFor={`${id}-mean-precision`}
                  className="block font-mono text-[10px] text-zinc-400"
                >
                  Mean Precision ({meanPrecision} dec)
                </label>
                <input
                  id={`${id}-mean-precision`}
                  type="number"
                  min={0}
                  max={6}
                  value={meanPrecision}
                  onChange={(e) => setMeanPrecision(Number(e.target.value))}
                  className={INPUT}
                />
              </div>

              <div>
                <label
                  htmlFor={`${id}-rounding-mode`}
                  className="block font-mono text-[10px] text-zinc-400"
                >
                  Rounding Mode
                </label>
                <select
                  id={`${id}-rounding-mode`}
                  value={roundingMode}
                  onChange={(e) =>
                    setRoundingMode(e.target.value as RoundingMode)
                  }
                  className={SELECT}
                >
                  {ROUNDING_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor={`${id}-pop-suit`}
                  className="block font-mono text-[10px] text-zinc-400"
                >
                  Population Suit
                </label>
                <select
                  id={`${id}-pop-suit`}
                  value={populationSuit}
                  onChange={(e) =>
                    setPopulationSuit(e.target.value as PopulationType)
                  }
                  className={SELECT}
                >
                  {POPULATIONS.map((pop) => (
                    <option key={pop} value={pop}>
                      {POPULATION_LABELS[pop]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Codex Card Selector */}
          <div className="border border-zinc-800 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-mono text-xs font-bold uppercase text-amber-400">
                Card Codex Deck Builder ({selectedCardIds.length} Selected · Min
                5 Cards)
              </h3>
              <p className="font-mono text-[10px] text-zinc-400">
                Click cards to add or remove them from your starting deck pool.
              </p>
            </div>

            {/* Codex Filters */}
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cards by title or number..."
                className={INPUT}
              />
              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as CardType | "ALL")
                }
                className={SELECT}
              >
                <option value="ALL">All Card Types</option>
                {CARD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={suitFilter}
                onChange={(e) =>
                  setSuitFilter(e.target.value as PopulationType | "ALL")
                }
                className={SELECT}
              >
                <option value="ALL">All Population Suits</option>
                {POPULATIONS.map((p) => (
                  <option key={p} value={p}>
                    {POPULATION_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            {/* Available Cards Grid */}
            <div className="mt-4 max-h-56 overflow-y-auto border border-zinc-800 bg-black/40 p-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCards.map((card) => {
                  const selected = selectedCardIds.includes(card.id);
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => toggleCard(card.id)}
                      className={`flex min-h-[48px] items-start justify-between border p-2 text-left transition-colors ${
                        selected
                          ? "border-amber-400 bg-amber-400/10 text-amber-300"
                          : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="block font-mono text-[10px] font-bold tracking-tight text-amber-400">
                          {card.number} · {POPULATION_LABELS[card.population]}
                        </span>
                        <span className="block truncate font-mono text-xs font-bold text-zinc-100">
                          {card.title}
                        </span>
                        <span className="block font-mono text-[10px] text-zinc-400">
                          {card.cardType} · {card.chips} Chips / +{card.mult}{" "}
                          Mult
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-xs font-bold text-amber-400">
                        {selected ? "✓ IN" : "+ ADD"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Notices and Errors */}
        {validationError && (
          <div className="mt-2 border border-red-500/50 bg-red-950/40 p-2 font-mono text-xs text-red-300">
            {validationError}
          </div>
        )}
        {statusNotice && (
          <div className="mt-2 border border-emerald-500/50 bg-emerald-950/40 p-2 font-mono text-xs text-emerald-300">
            {statusNotice}
          </div>
        )}

        {/* Action Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleExportJson} className={BUTTON}>
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={BUTTON}
            >
              Import JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportJson}
            />
            <button type="button" onClick={handleCopyLink} className={BUTTON}>
              Copy Challenge Link
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStartRun}
              className={PRIMARY_BUTTON}
            >
              Start Custom Run
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
