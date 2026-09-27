"use client";

import React, { useState } from "react";
import { StudyProtocol, StudyVisit } from "@/lib/crf/types";
import { formatVisitWindow } from "@/lib/crf/visit-window";
import {
  IconCalendar,
  IconPlus,
  IconTrash,
  IconCheck,
  IconTable,
  IconCards,
  IconEdit,
} from "@tabler/icons-react";

interface VisitMatrixEditorProps {
  study: StudyProtocol;
  onUpdateVisits: (visits: StudyVisit[]) => void;
}

export const VisitMatrixEditor: React.FC<VisitMatrixEditorProps> = ({
  study,
  onUpdateVisits,
}) => {
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [viewFormat, setViewFormat] = useState<"table" | "cards">("table");
  const [selectedArmId, setSelectedArmId] = useState<string>("all");
  const [selectedCardVisitId, setSelectedCardVisitId] = useState<string>(
    study.visits[0]?.id || ""
  );

  const arms = study.arms || [];
  const epochs = study.epochs || [];
  const epochMap = new Map(epochs.map((e) => [e.id, e.name]));

  const getFormAssignment = (visit: StudyVisit, formId: string) => {
    if (selectedArmId !== "all" && visit.armFormAssignments?.[selectedArmId]) {
      return visit.armFormAssignments[selectedArmId].includes(formId);
    }
    return visit.assignedFormIds.includes(formId);
  };

  const handleToggleFormAtVisit = (visitId: string, formId: string) => {
    const updated = study.visits.map((v) => {
      if (v.id !== visitId) return v;

      if (selectedArmId !== "all") {
        const currentArmForms = v.armFormAssignments?.[selectedArmId] || [
          ...v.assignedFormIds,
        ];
        const nextArmForms = currentArmForms.includes(formId)
          ? currentArmForms.filter((id) => id !== formId)
          : [...currentArmForms, formId];

        const armAssignments = { ...(v.armFormAssignments || {}) };
        armAssignments[selectedArmId] = nextArmForms;

        return {
          ...v,
          armFormAssignments: armAssignments,
          armIds: Array.from(new Set([...(v.armIds || []), selectedArmId])),
        };
      } else {
        const assigned = v.assignedFormIds.includes(formId)
          ? v.assignedFormIds.filter((id) => id !== formId)
          : [...v.assignedFormIds, formId];
        return { ...v, assignedFormIds: assigned };
      }
    });
    onUpdateVisits(updated);
  };

  const handleAddVisit = () => {
    const nextIdx = study.visits.length + 1;
    const newVisit: StudyVisit = {
      id: `v_cycle_${Date.now()}`,
      oid: `SE.VISIT_${nextIdx}`,
      name: `Visit ${nextIdx} (Day ${(nextIdx - 1) * 28})`,
      visitType: "Scheduled",
      targetDay: (nextIdx - 1) * 28,
      windowBefore: 3,
      windowAfter: 3,
      assignedFormIds: study.forms.filter((f) => !f.isLogForm).map((f) => f.id),
    };
    onUpdateVisits([...study.visits, newVisit]);
    setSelectedCardVisitId(newVisit.id);
  };

  const handleDeleteVisit = (visitId: string) => {
    const filtered = study.visits.filter((v) => v.id !== visitId);
    onUpdateVisits(filtered);
    if (selectedCardVisitId === visitId) {
      setSelectedCardVisitId(filtered[0]?.id || "");
    }
  };

  const handleUpdateVisit = (visitId: string, updates: Partial<StudyVisit>) => {
    onUpdateVisits(
      study.visits.map((v) => (v.id === visitId ? { ...v, ...updates } : v))
    );
  };

  const currentCardVisit =
    study.visits.find((v) => v.id === selectedCardVisitId) || study.visits[0];

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 p-3 sm:p-6 overflow-y-auto">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 sm:pb-6 mb-4 sm:mb-6 border-b border-zinc-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan shrink-0">
              <IconCalendar className="w-5 h-5" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white font-mono truncate">
              Protocol Visit Schedule Matrix (Schedule of Assessments)
            </h2>
          </div>
          <p className="text-xs text-zinc-400 font-sans mt-1">
            Map clinical forms to protocol visits and configure allowable window
            tolerances before and after each target day across study arms and
            epochs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile/Tablet Format Switcher */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
            <button
              onClick={() => setViewFormat("table")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                viewFormat === "table"
                  ? "bg-brand-cyan text-black font-bold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Full Matrix Table"
            >
              <IconTable className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => setViewFormat("cards")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                viewFormat === "cards"
                  ? "bg-brand-cyan text-black font-bold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Mobile Visit Cards View"
            >
              <IconCards className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>

          <button
            onClick={handleAddVisit}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-brand-cyan text-black hover:bg-white font-mono text-xs font-bold transition-all shadow-sm"
          >
            <IconPlus className="w-4 h-4" />
            <span>Add Visit</span>
          </button>
        </div>
      </div>

      {/* Arm Selector Filter Bar */}
      {arms.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-300">
            <span className="font-bold text-brand-cyan">
              Active Study Arm Scope:
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedArmId("all")}
              className={`px-3 py-1 rounded-lg transition-all border ${
                selectedArmId === "all"
                  ? "bg-brand-cyan text-black font-bold border-brand-cyan"
                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
              }`}
            >
              All Arms (Combined Schedule)
            </button>
            {arms.map((arm) => (
              <button
                key={arm.id}
                onClick={() => setSelectedArmId(arm.id)}
                className={`px-3 py-1 rounded-lg transition-all border whitespace-nowrap ${
                  selectedArmId === arm.id
                    ? "bg-brand-cyan text-black font-bold border-brand-cyan"
                    : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
                }`}
              >
                [{arm.type}] {arm.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cards View (Optimized for Mobile Phones & Small Tablets) */}
      {viewFormat === "cards" ? (
        <div className="space-y-4 max-w-2xl mx-auto w-full">
          {/* Visit Pill Selection Rail */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {study.visits.map((visit) => {
              const isSelected = visit.id === selectedCardVisitId;
              return (
                <button
                  key={visit.id}
                  onClick={() => setSelectedCardVisitId(visit.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all border ${
                    isSelected
                      ? "bg-brand-cyan/20 border-brand-cyan text-brand-cyan font-bold"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {visit.name}
                </button>
              );
            })}
          </div>

          {currentCardVisit && (
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white font-mono">
                    {currentCardVisit.name}
                  </h2>
                  <div className="text-xs text-brand-cyan font-mono mt-0.5">
                    Target Day {currentCardVisit.targetDay} (
                    {formatVisitWindow(currentCardVisit)} window)
                    {currentCardVisit.epochId &&
                      epochMap.has(currentCardVisit.epochId) && (
                        <span className="ml-2 text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/30">
                          {epochMap.get(currentCardVisit.epochId)}
                        </span>
                      )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      setEditingVisitId(
                        editingVisitId === currentCardVisit.id
                          ? null
                          : currentCardVisit.id
                      )
                    }
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white"
                    title="Edit Visit Timing"
                  >
                    <IconEdit className="w-3.5 h-3.5" />
                  </button>
                  {study.visits.length > 1 && (
                    <button
                      onClick={() => handleDeleteVisit(currentCardVisit.id)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400"
                      title="Delete Visit"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Form Checkboxes for this Visit */}
              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase text-zinc-400 font-semibold">
                  Assigned Protocol Forms (
                  {currentCardVisit.assignedFormIds.length}/{study.forms.length}
                  )
                </div>
                <div className="space-y-1.5">
                  {study.forms.map((form) => {
                    const isAssigned = getFormAssignment(
                      currentCardVisit,
                      form.id
                    );
                    return (
                      <div
                        key={form.id}
                        onClick={() =>
                          handleToggleFormAtVisit(currentCardVisit.id, form.id)
                        }
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isAssigned
                            ? "bg-brand-cyan/10 border-brand-cyan/40 text-white"
                            : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:bg-zinc-900"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-zinc-900 border border-zinc-800 text-brand-cyan">
                            {form.domain}
                          </span>
                          <span className="text-xs font-sans font-medium truncate">
                            {form.name}
                          </span>
                          {form.isLogForm && (
                            <span className="text-[9px] font-mono text-purple-400 bg-purple-500/10 px-1 rounded">
                              LOG
                            </span>
                          )}
                        </div>

                        <div
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                            isAssigned
                              ? "bg-brand-cyan border-brand-cyan text-black font-bold"
                              : "bg-zinc-900 border-zinc-700 text-transparent"
                          }`}
                        >
                          <IconCheck className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Interactive Matrix Table with Sticky Form Column */
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-x-auto shadow-xl">
          <table
            className="w-full text-left border-collapse min-w-[700px]"
            role="grid"
            aria-label="Schedule of Activities Visit Matrix"
          >
            <thead>
              <tr
                className="border-b border-zinc-800 bg-zinc-950/95 sticky top-0 z-20"
                role="row"
              >
                <th
                  scope="col"
                  role="columnheader"
                  className="p-3.5 sm:p-4 text-xs font-mono font-bold text-zinc-400 w-60 sm:w-64 uppercase tracking-wider sticky left-0 bg-zinc-950 z-30 border-r border-zinc-850"
                >
                  Forms ({study.forms.length})
                </th>
                {study.visits.map((visit) => (
                  <th
                    key={visit.id}
                    scope="col"
                    role="columnheader"
                    className="p-3 text-center border-l border-zinc-800/80 min-w-[130px]"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-bold font-mono text-white truncate max-w-[140px] mx-auto">
                        {visit.name}
                      </div>
                      <div className="text-[10px] font-mono text-brand-cyan">
                        Day {visit.targetDay} ({formatVisitWindow(visit)})
                      </div>
                      {visit.epochId && epochMap.has(visit.epochId) && (
                        <div className="text-[9px] font-mono text-purple-400">
                          {epochMap.get(visit.epochId)}
                        </div>
                      )}
                      <div className="flex items-center justify-center gap-1.5 pt-1">
                        <button
                          onClick={() =>
                            setEditingVisitId(
                              editingVisitId === visit.id ? null : visit.id
                            )
                          }
                          className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-300"
                        >
                          {editingVisitId === visit.id ? "Done" : "Edit"}
                        </button>
                        {study.visits.length > 1 && (
                          <button
                            onClick={() => handleDeleteVisit(visit.id)}
                            className="text-[9px] font-mono text-zinc-500 hover:text-red-400 p-0.5"
                            title="Delete Visit"
                          >
                            <IconTrash className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono text-xs">
              {study.forms.map((form) => (
                <tr
                  key={form.id}
                  role="row"
                  className="hover:bg-zinc-850/40 transition-colors"
                >
                  <th
                    scope="row"
                    role="rowheader"
                    className="p-3 sm:p-3.5 pl-3 sm:pl-4 sticky left-0 bg-zinc-950/95 z-10 border-r border-zinc-850 font-normal text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-900 border border-zinc-800 text-brand-cyan">
                        {form.domain}
                      </span>
                      <span className="font-sans font-semibold text-zinc-200 text-xs truncate max-w-[160px] sm:max-w-none">
                        {form.name}
                      </span>
                      {form.isLogForm && (
                        <span className="text-[9px] font-mono text-purple-400 bg-purple-500/10 px-1 rounded border border-purple-500/20">
                          LOG
                        </span>
                      )}
                    </div>
                  </th>

                  {study.visits.map((visit) => {
                    const isAssigned = getFormAssignment(visit, form.id);

                    return (
                      <td
                        key={visit.id}
                        role="gridcell"
                        tabIndex={0}
                        aria-selected={isAssigned}
                        aria-label={`${form.name} at ${visit.name}: ${
                          isAssigned ? "Scheduled" : "Not Scheduled"
                        }`}
                        onClick={() =>
                          handleToggleFormAtVisit(visit.id, form.id)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleToggleFormAtVisit(visit.id, form.id);
                          }
                        }}
                        className="p-3 text-center border-l border-zinc-800/60 cursor-pointer hover:bg-brand-cyan/5 focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none transition-colors"
                      >
                        <div className="flex items-center justify-center">
                          <div
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                              isAssigned
                                ? "bg-brand-cyan border-brand-cyan text-black font-bold shadow-sm"
                                : "bg-zinc-900 border-zinc-800 text-transparent hover:border-zinc-700"
                            }`}
                          >
                            <IconCheck className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Visit Quick Configuration Drawer */}
      {editingVisitId && (
        <div className="mt-4 sm:mt-6 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
          {(() => {
            const v = study.visits.find((item) => item.id === editingVisitId);
            if (!v) return null;

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white font-mono">
                    Configure Visit: {v.name}
                  </div>
                  <button
                    onClick={() => setEditingVisitId(null)}
                    className="text-xs text-brand-cyan font-mono hover:underline"
                  >
                    Done Editing
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                      Visit Name
                    </label>
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) =>
                        handleUpdateVisit(v.id, { name: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                      Target Day Offset
                    </label>
                    <input
                      type="number"
                      value={v.targetDay}
                      onChange={(e) =>
                        handleUpdateVisit(v.id, {
                          targetDay: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                      Window Before (- Days)
                    </label>
                    <input
                      type="number"
                      value={v.windowBefore}
                      onChange={(e) =>
                        handleUpdateVisit(v.id, {
                          windowBefore: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                      Window After (+ Days)
                    </label>
                    <input
                      type="number"
                      value={v.windowAfter}
                      onChange={(e) =>
                        handleUpdateVisit(v.id, {
                          windowAfter: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
