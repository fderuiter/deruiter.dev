"use client";

import React, { useState, useMemo } from "react";
import { StudyProtocol, StudyVisit } from "@/lib/crf/types";
import {
  formatVisitWindow,
  evaluateVisitWindowConflicts,
  calculateScheduleBounds,
  calculateBaselineDrift,
  calculateMilestoneForecasts,
  CohortForecastParameters,
} from "@/lib/crf/visit-window";
import {
  IconCalendar,
  IconPlus,
  IconTrash,
  IconCheck,
  IconMinus,
  IconTable,
  IconCards,
  IconEdit,
  IconAlertTriangle,
  IconChartBar,
  IconClock,
  IconX,
  IconInfoCircle,
} from "@tabler/icons-react";

type FillState = "full" | "partial" | "none";

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
  const [isIntelligenceOpen, setIsIntelligenceOpen] = useState<boolean>(false);
  const [forecastParams, setForecastParams] =
    useState<CohortForecastParameters>({
      startDate: new Date().toISOString().slice(0, 10),
      cohortSize: 50,
      enrollmentDurationDays: 90,
      expectedAttritionRate: 10,
    });

  const arms = study.arms || [];
  const epochs = study.epochs || [];
  const epochMap = new Map(epochs.map((e) => [e.id, e.name]));

  // Evaluate real-time visit window conflicts
  const conflictSummary = useMemo(() => {
    return evaluateVisitWindowConflicts(study.visits, selectedArmId);
  }, [study.visits, selectedArmId]);

  // Calculate cumulative schedule bounds (target duration, max expansion, max contraction)
  const scheduleBounds = useMemo(() => {
    return calculateScheduleBounds(study.visits);
  }, [study.visits]);

  // Calculate baseline schedule drift (with graceful fallback if no baseline exists)
  const baselineDrift = useMemo(() => {
    return calculateBaselineDrift(study.visits);
  }, [study.visits]);

  // Compute deterministic subject milestone forecasts
  const milestoneForecast = useMemo(() => {
    return calculateMilestoneForecasts(study.visits, forecastParams);
  }, [study.visits, forecastParams]);

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

  const fillStateOf = (assigned: number, total: number): FillState =>
    total === 0 || assigned === 0
      ? "none"
      : assigned === total
        ? "full"
        : "partial";

  // Each cell is read once per render; the toggles below look these up.
  const columnFillStates: Record<string, FillState> = {};
  const rowAssignedCounts: Record<string, number> = {};
  for (const visit of study.visits) {
    let assignedCount = 0;
    for (const form of study.forms) {
      if (getFormAssignment(visit, form.id)) {
        assignedCount++;
        rowAssignedCounts[form.id] = (rowAssignedCounts[form.id] ?? 0) + 1;
      }
    }
    columnFillStates[visit.id] = fillStateOf(assignedCount, study.forms.length);
  }
  const rowFillStates: Record<string, FillState> = {};
  for (const form of study.forms) {
    rowFillStates[form.id] = fillStateOf(
      rowAssignedCounts[form.id] ?? 0,
      study.visits.length
    );
  }
  const globalFillState = fillStateOf(
    Object.values(rowAssignedCounts).reduce((sum, n) => sum + n, 0),
    study.forms.length * study.visits.length
  );

  const handleBulkToggleColumn = (visitId: string) => {
    const fillState = columnFillStates[visitId];
    if (!fillState) return;
    const targetFormIds =
      fillState === "full" ? [] : study.forms.map((f) => f.id);

    const updated = study.visits.map((v) => {
      if (v.id !== visitId) return v;

      if (selectedArmId !== "all") {
        const armAssignments = { ...(v.armFormAssignments || {}) };
        armAssignments[selectedArmId] = targetFormIds;
        return {
          ...v,
          armFormAssignments: armAssignments,
          armIds: Array.from(new Set([...(v.armIds || []), selectedArmId])),
        };
      } else {
        return {
          ...v,
          assignedFormIds: targetFormIds,
        };
      }
    });

    onUpdateVisits(updated);
  };

  const handleBulkToggleRow = (formId: string) => {
    const fillState = rowFillStates[formId];
    const shouldRemove = fillState === "full";

    const updated = study.visits.map((v) => {
      if (selectedArmId !== "all") {
        const currentArmForms = v.armFormAssignments?.[selectedArmId] ?? [
          ...v.assignedFormIds,
        ];
        const nextArmForms = shouldRemove
          ? currentArmForms.filter((id) => id !== formId)
          : Array.from(new Set([...currentArmForms, formId]));

        const armAssignments = { ...(v.armFormAssignments || {}) };
        armAssignments[selectedArmId] = nextArmForms;

        return {
          ...v,
          armFormAssignments: armAssignments,
          armIds: Array.from(new Set([...(v.armIds || []), selectedArmId])),
        };
      } else {
        const nextAssigned = shouldRemove
          ? v.assignedFormIds.filter((id) => id !== formId)
          : Array.from(new Set([...v.assignedFormIds, formId]));

        return {
          ...v,
          assignedFormIds: nextAssigned,
        };
      }
    });

    onUpdateVisits(updated);
  };

  const handleBulkToggleGlobal = () => {
    const targetFormIds =
      globalFillState === "full" ? [] : study.forms.map((f) => f.id);

    const updated = study.visits.map((v) => {
      if (selectedArmId !== "all") {
        const armAssignments = { ...(v.armFormAssignments || {}) };
        armAssignments[selectedArmId] = targetFormIds;
        return {
          ...v,
          armFormAssignments: armAssignments,
          armIds: Array.from(new Set([...(v.armIds || []), selectedArmId])),
        };
      } else {
        return {
          ...v,
          assignedFormIds: targetFormIds,
        };
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

  const currentCardConflicts = currentCardVisit
    ? conflictSummary.conflictsByVisitId[currentCardVisit.id] || []
    : [];

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
            Map clinical forms to protocol visits, analyze real-time window
            conflicts, and review timeline bounds and milestone projections.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Schedule Intelligence Drawer Toggle */}
          <button
            onClick={() => setIsIntelligenceOpen(!isIntelligenceOpen)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
              isIntelligenceOpen
                ? "bg-purple-500/20 border-purple-500 text-purple-300"
                : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
            }`}
            title="Toggle Schedule Intelligence & Forecasting Drawer"
          >
            <IconChartBar className="w-4 h-4 text-purple-400" />
            <span>Schedule Intelligence</span>
            {conflictSummary.hasConflicts && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-extrabold">
                {conflictSummary.totalConflicts}
              </span>
            )}
          </button>

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

      {/* Schedule Intelligence Drawer / Panel */}
      {isIntelligenceOpen && (
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-purple-500/30 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <IconChartBar className="w-5 h-5 text-purple-400" />
              <h3 className="text-sm sm:text-base font-bold text-white font-mono">
                Schedule Intelligence & Milestone Forecasting Engine
              </h3>
            </div>
            <button
              onClick={() => setIsIntelligenceOpen(false)}
              className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
              title="Close Drawer"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>

          {/* Key Metrics Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
              <div className="text-[10px] font-mono uppercase text-zinc-400">
                Target Schedule Span
              </div>
              <div className="text-base sm:text-lg font-bold text-white font-mono mt-1">
                {scheduleBounds.targetDurationDays}{" "}
                <span className="text-xs text-zinc-400">days</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
              <div className="text-[10px] font-mono uppercase text-zinc-400">
                Max Expansion Bounds
              </div>
              <div className="text-base sm:text-lg font-bold text-purple-300 font-mono mt-1">
                {scheduleBounds.maxExpansionDays}{" "}
                <span className="text-xs text-zinc-400">days</span>
              </div>
              <div className="text-[10px] font-mono text-zinc-500">
                +
                {scheduleBounds.maxExpansionDays -
                  scheduleBounds.targetDurationDays}
                d expansion window
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
              <div className="text-[10px] font-mono uppercase text-zinc-400">
                Max Contraction Bounds
              </div>
              <div className="text-base sm:text-lg font-bold text-brand-cyan font-mono mt-1">
                {scheduleBounds.maxContractionDays}{" "}
                <span className="text-xs text-zinc-400">days</span>
              </div>
              <div className="text-[10px] font-mono text-zinc-500">
                -
                {scheduleBounds.targetDurationDays -
                  scheduleBounds.maxContractionDays}
                d contraction window
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
              <div className="text-[10px] font-mono uppercase text-zinc-400">
                Window Overlap Conflicts
              </div>
              <div
                className={`text-base sm:text-lg font-bold font-mono mt-1 ${
                  conflictSummary.hasConflicts
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {conflictSummary.totalConflicts}{" "}
                <span className="text-xs text-zinc-400">
                  {conflictSummary.hasConflicts ? "detected" : "none"}
                </span>
              </div>
            </div>
          </div>

          {/* Window Conflicts List */}
          {conflictSummary.hasConflicts && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-xs">
                <IconAlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Detected Window Overlap Warnings (
                  {conflictSummary.totalConflicts})
                </span>
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                {conflictSummary.conflicts.map((conflict, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-zinc-950/80 border border-amber-500/20 text-amber-200 flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>{conflict.message}</span>
                    <button
                      onClick={() => {
                        setEditingVisitId(conflict.visitIdA);
                        setSelectedCardVisitId(conflict.visitIdA);
                      }}
                      className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-bold"
                    >
                      Configure Visit
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schedule Drift & Baseline Analysis */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white font-mono">
                <IconClock className="w-4 h-4 text-brand-cyan" />
                <span>Baseline Schedule Drift Bounds</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                {baselineDrift.hasBaseline
                  ? baselineDrift.baselineLabel
                  : "Current Protocol Baseline (Active)"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">
                  Target Duration Drift
                </span>
                <span className="text-sm font-bold text-white">
                  {baselineDrift.targetDurationDriftDays > 0 ? "+" : ""}
                  {baselineDrift.targetDurationDriftDays} days
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">
                  Max Expansion Drift
                </span>
                <span className="text-sm font-bold text-purple-300">
                  {baselineDrift.maxExpansionDriftDays > 0 ? "+" : ""}
                  {baselineDrift.maxExpansionDriftDays} days
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 block">
                  Max Contraction Drift
                </span>
                <span className="text-sm font-bold text-brand-cyan">
                  {baselineDrift.maxContractionDriftDays > 0 ? "+" : ""}
                  {baselineDrift.maxContractionDriftDays} days
                </span>
              </div>
            </div>
          </div>

          {/* Deterministic Milestone Forecasting */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white font-mono">
                <IconInfoCircle className="w-4 h-4 text-purple-400" />
                <span>Subject Milestone Forecasting Controls</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">
                  Study / FSI Start Date
                </label>
                <input
                  type="date"
                  value={forecastParams.startDate}
                  onChange={(e) =>
                    setForecastParams({
                      ...forecastParams,
                      startDate:
                        e.target.value || new Date().toISOString().slice(0, 10),
                    })
                  }
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">
                  Planned Cohort Size
                </label>
                <input
                  type="number"
                  min={1}
                  value={forecastParams.cohortSize}
                  onChange={(e) =>
                    setForecastParams({
                      ...forecastParams,
                      cohortSize: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">
                  Enrollment Window (Days)
                </label>
                <input
                  type="number"
                  min={0}
                  value={forecastParams.enrollmentDurationDays}
                  onChange={(e) =>
                    setForecastParams({
                      ...forecastParams,
                      enrollmentDurationDays: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">
                  Expected Attrition (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={forecastParams.expectedAttritionRate}
                  onChange={(e) =>
                    setForecastParams({
                      ...forecastParams,
                      expectedAttritionRate: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white font-mono text-xs"
                />
              </div>
            </div>

            {/* Projected Milestone Dates Table */}
            <div className="pt-2 space-y-2">
              <div className="text-[11px] font-mono font-bold text-purple-300">
                Calculated Protocol Milestone Projections
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">
                    First Subject In (FSI)
                  </span>
                  <span className="font-bold text-white">
                    {milestoneForecast.fsiDate}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">
                    Last Subject In (LSI)
                  </span>
                  <span className="font-bold text-white">
                    {milestoneForecast.lsiDate}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">
                    First Subject Last Visit
                  </span>
                  <span className="font-bold text-white">
                    {milestoneForecast.fslvDate}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">
                    Last Subject Last Visit (LSLV)
                  </span>
                  <span className="font-bold text-brand-cyan">
                    {milestoneForecast.lslvDate}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-wrap items-center justify-between text-xs font-mono text-zinc-300 gap-2">
                <div>
                  <span className="text-zinc-400">
                    Total Study Completion Bounds (LSLV):{" "}
                  </span>
                  <span className="font-bold text-white">
                    {milestoneForecast.earliestStudyCompletionDate} to{" "}
                    {milestoneForecast.latestStudyCompletionDate}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400">
                    Completing Cohort Estimate:{" "}
                  </span>
                  <span className="font-bold text-emerald-400">
                    {milestoneForecast.projectedCompletingSubjects} /{" "}
                    {milestoneForecast.cohortSize} subjects
                  </span>
                </div>
              </div>
            </div>
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
              const visitConflicts =
                conflictSummary.conflictsByVisitId[visit.id] || [];
              const hasWarning = visitConflicts.length > 0;

              return (
                <button
                  key={visit.id}
                  onClick={() => setSelectedCardVisitId(visit.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-brand-cyan/20 border-brand-cyan text-brand-cyan font-bold"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <span>{visit.name}</span>
                  {hasWarning && (
                    <span
                      className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                      title="Window Overlap Conflict"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {currentCardVisit && (
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-white font-mono">
                      {currentCardVisit.name}
                    </h2>
                    {currentCardConflicts.length > 0 && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold font-mono inline-flex items-center gap-1">
                        <IconAlertTriangle className="w-3 h-3" />
                        <span>Conflict</span>
                      </span>
                    )}
                  </div>
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

              {/* Conflict Alert Box for Current Card Visit */}
              {currentCardConflicts.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-mono space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <IconAlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Visit Window Overlap Detected</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-300">
                    {currentCardConflicts.map((c, idx) => (
                      <li key={idx}>{c.message}</li>
                    ))}
                  </ul>
                </div>
              )}

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
                  <div className="flex items-center justify-between gap-2">
                    <span>Forms ({study.forms.length})</span>
                    <BulkToggle
                      state={globalFillState}
                      onToggle={handleBulkToggleGlobal}
                      label="All forms at all visits"
                      testId="bulk-global-toggle"
                    />
                  </div>
                </th>
                {study.visits.map((visit) => {
                  const visitConflicts =
                    conflictSummary.conflictsByVisitId[visit.id] || [];
                  const hasError = visitConflicts.some(
                    (c) => c.severity === "error"
                  );
                  const hasWarning = visitConflicts.length > 0;

                  return (
                    <th
                      key={visit.id}
                      scope="col"
                      role="columnheader"
                      className={`p-3 text-center border-l min-w-[140px] transition-colors ${
                        hasError
                          ? "border-red-500/40 bg-red-950/20"
                          : hasWarning
                            ? "border-amber-500/40 bg-amber-950/20"
                            : "border-zinc-800/80"
                      }`}
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

                        {/* Visual Conflict Warning Badge */}
                        {hasWarning && (
                          <div
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border cursor-help ${
                              hasError
                                ? "bg-red-500/20 border-red-500/50 text-red-300"
                                : "bg-amber-500/20 border-amber-500/50 text-amber-300"
                            }`}
                            title={visitConflicts
                              .map((c) => c.message)
                              .join("\n")}
                            data-testid={`visit-conflict-badge-${visit.id}`}
                          >
                            <IconAlertTriangle className="w-3 h-3 shrink-0" />
                            <span>
                              {hasError ? "Overlap Error" : "Overlap Warning"}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-center gap-1.5 pt-1">
                          <BulkToggle
                            state={columnFillStates[visit.id] ?? "none"}
                            onToggle={() => handleBulkToggleColumn(visit.id)}
                            label={`All forms at ${visit.name}`}
                            testId={`bulk-column-toggle-${visit.id}`}
                          />
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
                  );
                })}
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
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-900 border border-zinc-800 text-brand-cyan shrink-0">
                          {form.domain}
                        </span>
                        <span className="font-sans font-semibold text-zinc-200 text-xs truncate max-w-[140px] sm:max-w-none">
                          {form.name}
                        </span>
                        {form.isLogForm && (
                          <span className="text-[9px] font-mono text-purple-400 bg-purple-500/10 px-1 rounded border border-purple-500/20 shrink-0">
                            LOG
                          </span>
                        )}
                      </div>

                      <BulkToggle
                        state={rowFillStates[form.id] ?? "none"}
                        onToggle={() => handleBulkToggleRow(form.id)}
                        label={`${form.name} at every visit`}
                        testId={`bulk-row-toggle-${form.id}`}
                      />
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

/**
 * Tri-state checkbox that assigns or clears a whole row, column or the
 * matrix. "partial" is announced as aria-checked="mixed".
 */
function BulkToggle({
  state,
  onToggle,
  label,
  testId,
}: {
  state: FillState;
  onToggle: () => void;
  label: string;
  testId: string;
}) {
  const ariaChecked =
    state === "full" ? true : state === "partial" ? "mixed" : false;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={ariaChecked}
      aria-label={label}
      title={state === "full" ? `Clear ${label}` : `Assign ${label}`}
      onClick={onToggle}
      data-testid={testId}
      className={`p-1 rounded-md border transition-colors flex items-center justify-center shrink-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ${
        state === "full"
          ? "bg-brand-cyan border-brand-cyan text-black"
          : state === "partial"
            ? "bg-brand-cyan/20 border-brand-cyan/60 text-brand-cyan"
            : "bg-zinc-900 border-zinc-600 text-zinc-500 hover:text-zinc-300 hover:border-zinc-400"
      }`}
    >
      {state === "full" ? (
        <IconCheck className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
      ) : state === "partial" ? (
        <IconMinus className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
      ) : (
        <IconPlus className="w-3.5 h-3.5" aria-hidden="true" />
      )}
    </button>
  );
}
