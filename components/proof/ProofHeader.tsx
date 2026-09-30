"use client";

import React, { useRef, useState } from "react";
import {
  IconCpu,
  IconLink,
  IconPlus,
  IconDownload,
  IconShieldCheck,
  IconTable,
  IconAlertTriangle,
  IconTerminal,
} from "@tabler/icons-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { FieldManualButton } from "@/components/FieldManualButton";
import {
  THEOREMS,
  TheoremId,
  Edge,
  evaluateProofStatus,
} from "@/lib/proof-utils";

interface ProofHeaderProps {
  activeTheoremId: TheoremId;
  handleSwitchTheorem: (id: TheoremId) => void;
  isE_Proven: boolean;
  edges: Edge[];
  handleCopyShareLink: () => void;
  setIsCustomStudioOpen: (open: boolean) => void;
  setIsExportModalOpen: (open: boolean) => void;
  mobileActiveView: "canvas" | "ledger" | "systems" | "fallacy" | "terminal";
  setMobileActiveView: (
    view: "canvas" | "ledger" | "systems" | "fallacy" | "terminal"
  ) => void;
  setActiveTab: (tab: "ledger" | "systems" | "fallacy") => void;
}

export const ProofHeader: React.FC<ProofHeaderProps> = ({
  activeTheoremId,
  handleSwitchTheorem,
  isE_Proven,
  edges,
  handleCopyShareLink,
  setIsCustomStudioOpen,
  setIsExportModalOpen,
  mobileActiveView,
  setMobileActiveView,
  setActiveTab,
}) => {
  // Below md the 12-card catalog collapses behind a disclosure so the canvas
  // stays in reach (#1236); md and up always show the full grid.
  const [catalogOpen, setCatalogOpen] = useState(false);
  const catalogToggleRef = useRef<HTMLButtonElement>(null);
  const activeTheorem = THEOREMS[activeTheoremId];

  const selectTheorem = (id: TheoremId) => {
    handleSwitchTheorem(id);
    setCatalogOpen(false);
    catalogToggleRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <Breadcrumbs
            items={[{ label: "Logical Proof Workspace", href: "/proof" }]}
          />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2 mt-1">
            <IconCpu className="w-8 h-8 text-brand-cyan animate-pulse" />
            Logical Proof Canvas
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Connect premises, apply rules, and see whether the conclusion
            follows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyShareLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 text-xs font-semibold transition cursor-pointer active:scale-[0.98]"
            title="Copy Shareable Proof Link with Active Theorem & Tab"
          >
            <IconLink className="w-4 h-4 text-brand-cyan" />
            Share
          </button>
          <button
            onClick={(event) => {
              // Safari pointer clicks do not focus buttons automatically.
              event.currentTarget.focus();
              setIsCustomStudioOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-purple/40 bg-brand-purple/10 text-brand-purple hover:bg-brand-purple/20 text-xs font-semibold transition cursor-pointer active:scale-[0.98]"
          >
            <IconPlus className="w-4 h-4" />
            Custom Studio
          </button>
          <button
            onClick={(event) => {
              // Safari pointer clicks do not focus buttons automatically.
              event.currentTarget.focus();
              setIsExportModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 text-xs font-semibold transition cursor-pointer active:scale-[0.98]"
          >
            <IconDownload className="w-4 h-4" />
            Export
          </button>
          <FieldManualButton manualId="proof" />
        </div>
      </div>

      {/* Curriculum Domain Carousel */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Choose a Proof
          </span>
          <span className="text-xs font-mono text-brand-cyan">
            Status:{" "}
            {isE_Proven ? "✔ GRAPH COMPLETE · SIMULATED" : "⏳ IN PROGRESS"}
          </span>
        </div>
        <button
          ref={catalogToggleRef}
          type="button"
          aria-expanded={catalogOpen}
          aria-controls="proof-catalog"
          data-testid="proof-catalog-toggle"
          onClick={() => setCatalogOpen((prev) => !prev)}
          className="md:hidden min-h-[44px] w-full flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-left text-xs font-bold text-slate-200 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none cursor-pointer active:scale-[0.98]"
        >
          <span className="min-w-0 truncate">
            {catalogOpen ? "Hide proofs" : "Browse proofs"} ·{" "}
            {activeTheorem?.title ?? "Custom"}
          </span>
          <span aria-hidden="true">{catalogOpen ? "−" : "+"}</span>
        </button>
        <div
          id="proof-catalog"
          data-testid="proof-catalog"
          className={`${catalogOpen ? "grid" : "hidden md:grid"} grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2`}
        >
          {(Object.keys(THEOREMS) as TheoremId[]).map((thKey) => {
            const th = THEOREMS[thKey];
            const isActive = thKey === activeTheoremId;
            const { isE_Proven: isThProven } = evaluateProofStatus(
              isActive ? edges : th.initialEdges,
              thKey
            );
            return (
              <button
                key={thKey}
                onClick={() => selectTheorem(thKey)}
                className={`flex flex-col text-left p-2.5 rounded-xl border transition-all relative overflow-hidden cursor-pointer active:scale-[0.98] ${
                  isActive
                    ? "bg-slate-800 border-brand-cyan shadow-lg shadow-brand-cyan/10"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-950 text-slate-400">
                    {th.category}
                  </span>
                  {isThProven ? (
                    <IconShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-500/80" />
                  )}
                </div>
                <span className="text-xs font-bold text-slate-200 line-clamp-1">
                  {th.title}
                </span>
                <span className="text-[11px] text-slate-400 line-clamp-1">
                  {th.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile View Switcher Tabs (Visible on < lg screens) */}
      <div className="lg:hidden flex items-center bg-slate-900 border border-slate-800 rounded-2xl p-1 gap-1 text-xs font-mono select-none">
        <button
          onClick={() => setMobileActiveView("canvas")}
          className={`flex-1 py-2.5 px-2 rounded-xl text-center font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            mobileActiveView === "canvas"
              ? "bg-brand-cyan text-slate-950 shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <IconCpu className="w-4 h-4" />
          <span>Canvas</span>
        </button>
        <button
          onClick={() => {
            setMobileActiveView("ledger");
            setActiveTab("ledger");
          }}
          className={`flex-1 py-2.5 px-2 rounded-xl text-center font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            mobileActiveView === "ledger"
              ? "bg-brand-cyan text-slate-950 shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <IconTable className="w-4 h-4" />
          <span>Ledger</span>
        </button>
        <button
          onClick={() => {
            setMobileActiveView("fallacy");
            setActiveTab("fallacy");
          }}
          className={`flex-1 py-2.5 px-2 rounded-xl text-center font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            mobileActiveView === "fallacy"
              ? "bg-brand-cyan text-slate-950 shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <IconAlertTriangle className="w-4 h-4" />
          <span>Fallacy</span>
        </button>
        <button
          onClick={() => setMobileActiveView("terminal")}
          className={`flex-1 py-2.5 px-2 rounded-xl text-center font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            mobileActiveView === "terminal"
              ? "bg-brand-cyan text-slate-950 shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <IconTerminal className="w-4 h-4" />
          <span>Terminal</span>
        </button>
      </div>
    </div>
  );
};
