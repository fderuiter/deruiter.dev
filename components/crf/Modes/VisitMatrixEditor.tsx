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
} from "@/lib/crf";
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
import { TooltipButton } from "@/components/ui/Tooltip";

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
    <div className="flex-1 flex flex-col h-full studio-surface-subtle p-3 sm:p-6 overflow-y-auto">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 sm:pb-6 mb-4 sm:mb-6 border-b studio-border-default">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg studio-accent-cyan border shrink-0">
              <IconCalendar className="w-5 h-5" />
            </span>
            <h2 className="text-base sm:text-lg font-bold studio-fg-primary font-mono truncate">
              Protocol Visit Schedule Matrix (Schedule of Assessments)
            </h2>
          </div>
          <p className="text-xs studio-fg-muted font-sans mt-1">
            Map clinical forms to protocol visits, analyze real-time window
            conflicts, and review timeline bounds and milestone projections.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Schedule Intelligence Drawer Toggle */}
          <TooltipButton
            onClick={() => setIsIntelligenceOpen(!isIntelligenceOpen)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
              isIntelligenceOpen
                ? "studio-accent-purple-strong"
                : "studio-surface-card studio-border-default studio-fg-secondary studio-hover-border-strong"
            }`}
            tooltip="Toggle Schedule Intelligence & Forecasting Drawer"
          >
            <IconChartBar className="w-4 h-4 studio-fg-purple" />
            <span>Schedule Intelligence</span>
            {conflictSummary.hasConflicts && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full studio-btn-amber text-[10px] font-extrabold">
                {conflictSummary.totalConflicts}
              </span>
            )}
          </TooltipButton>

          {/* Mobile/Tablet Format Switcher */}
          <div className="flex items-center studio-surface-card border studio-border-default rounded-xl p-0.5">
            <TooltipButton
              onClick={() => setViewFormat("table")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                viewFormat === "table"
                  ? "studio-btn-cyan font-bold"
                  : "studio-fg-muted studio-hover-fg-primary"
              }`}
              tooltip="Full Matrix Table"
              aria-label="Full Matrix Table"
            >
              <IconTable className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </TooltipButton>
            <TooltipButton
              onClick={() => setViewFormat("cards")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                viewFormat === "cards"
                  ? "studio-btn-cyan font-bold"
                  : "studio-fg-muted studio-hover-fg-primary"
              }`}
              tooltip="Mobile Visit Cards View"
              aria-label="Mobile Visit Cards View"
            >
              <IconCards className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </TooltipButton>
          </div>

          <button
            onClick={handleAddVisit}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl studio-btn-cyan font-mono text-xs font-bold transition-all shadow-sm"
          >
            <IconPlus className="w-4 h-4" />
            <span>Add Visit</span>
          </button>
        </div>
      </div>

      {/* Arm Selector Filter Bar */}
      {arms.length > 0 && (
        <div className="mb-4 p-3 rounded-xl studio-surface-subtle border studio-border-default flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 studio-fg-secondary">
            <span className="font-bold studio-fg-cyan">
              Active Study Arm Scope:
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedArmId("all")}
              className={`px-3 py-1 rounded-lg transition-all border ${
                selectedArmId === "all"
                  ? "studio-btn-cyan font-bold"
                  : "studio-surface-subtle studio-fg-muted studio-border-default studio-hover-fg-primary"
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
                    ? "studio-btn-cyan font-bold"
                    : "studio-surface-subtle studio-fg-muted studio-border-default studio-hover-fg-primary"
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
        <div className="mb-6 p-4 sm:p-5 rounded-2xl studio-surface-card border studio-border-purple space-y-5 shadow-2xl">
          <div className="flex items-center justify-between border-b studio-border-default pb-3">
            <div className="flex items-center gap-2">
              <IconChartBar className="w-5 h-5 studio-fg-purple" />
              <h3 className="text-sm sm:text-base font-bold studio-fg-primary font-mono">
                Schedule Intelligence & Milestone Forecasting Engine
              </h3>
            </div>
            <TooltipButton
              onClick={() => setIsIntelligenceOpen(false)}
              className="p-1.5 rounded-lg studio-surface-muted studio-fg-muted studio-hover-fg-primary"
              tooltip="Close Drawer"
              aria-label="Close Drawer"
            >
              <IconX className="w-4 h-4" />
            </TooltipButton>
          </div>

          {/* Key Metrics Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl studio-surface-subtle border studio-border-default">
              <div className="text-[10px] font-mono uppercase studio-fg-muted">
                Target Schedule Span
              </div>
              <div className="text-base sm:text-lg font-bold studio-fg-primary font-mono mt-1">
                {scheduleBounds.targetDurationDays}{" "}
                <span className="text-xs studio-fg-muted">days</span>
              </div>
            </div>

            <div className="p-3 rounded-xl studio-surface-subtle border studio-border-default">
              <div className="text-[10px] font-mono uppercase studio-fg-muted">
                Max Expansion Bounds
              </div>
              <div className="text-base sm:text-lg font-bold studio-fg-purple font-mono mt-1">
                {scheduleBounds.maxExpansionDays}{" "}
                <span className="text-xs studio-fg-muted">days</span>
              </div>
              <div className="text-[10px] font-mono studio-fg-muted">
                +
                {scheduleBounds.maxExpansionDays -
                  scheduleBounds.targetDurationDays}
                d expansion window
              </div>
            </div>

            <div className="p-3 rounded-xl studio-surface-subtle border studio-border-default">
              <div className="text-[10px] font-mono uppercase studio-fg-muted">
                Max Contraction Bounds
              </div>
              <div className="text-base sm:text-lg font-bold studio-fg-cyan font-mono mt-1">
                {scheduleBounds.maxContractionDays}{" "}
                <span className="text-xs studio-fg-muted">days</span>
              </div>
              <div className="text-[10px] font-mono studio-fg-muted">
                -
                {scheduleBounds.targetDurationDays -
                  scheduleBounds.maxContractionDays}
                d contraction window
              </div>
            </div>

            <div className="p-3 rounded-xl studio-surface-subtle border studio-border-default">
              <div className="text-[10px] font-mono uppercase studio-fg-muted">
                Window Overlap Conflicts
              </div>
              <div
                className={`text-base sm:text-lg font-bold font-mono mt-1 ${
                  conflictSummary.hasConflicts
                    ? "studio-fg-amber"
                    : "studio-fg-emerald"
                }`}
              >
                {conflictSummary.totalConflicts}{" "}
                <span className="text-xs studio-fg-muted">
                  {conflictSummary.hasConflicts ? "detected" : "none"}
                </span>
              </div>
            </div>
          </div>

          {/* Window Conflicts List */}
          {conflictSummary.hasConflicts && (
            <div className="p-3.5 rounded-xl studio-bg-amber border studio-border-amber space-y-2">
              <div className="flex items-center gap-2 studio-fg-amber font-mono font-bold text-xs">
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
                    className="p-2 rounded-lg studio-surface-subtle border studio-border-amber studio-fg-amber flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>{conflict.message}</span>
                    <button
                      onClick={() => {
                        setEditingVisitId(conflict.visitIdA);
                        setSelectedCardVisitId(conflict.visitIdA);
                      }}
                      className="px-2 py-0.5 rounded studio-bg-amber-strong studio-fg-amber studio-hover-amber text-[10px] font-bold"
                    >
                      Configure Visit
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schedule Drift & Baseline Analysis */}
          <div className="p-4 rounded-xl studio-surface-subtle border studio-border-default space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold studio-fg-primary font-mono">
                <IconClock className="w-4 h-4 studio-fg-cyan" />
                <span>Baseline Schedule Drift Bounds</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded studio-surface-card border studio-border-default studio-fg-muted">
                {baselineDrift.hasBaseline
                  ? baselineDrift.baselineLabel
                  : "Current Protocol Baseline (Active)"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg studio-surface-card border studio-border-default">
                <span className="text-[10px] studio-fg-muted block">
                  Target Duration Drift
                </span>
                <span className="text-sm font-bold studio-fg-primary">
                  {baselineDrift.targetDurationDriftDays > 0 ? "+" : ""}
                  {baselineDrift.targetDurationDriftDays} days
                </span>
              </div>
              <div className="p-2.5 rounded-lg studio-surface-card border studio-border-default">
                <span className="text-[10px] studio-fg-muted block">
                  Max Expansion Drift
                </span>
                <span className="text-sm font-bold studio-fg-purple">
                  {baselineDrift.maxExpansionDriftDays > 0 ? "+" : ""}
                  {baselineDrift.maxExpansionDriftDays} days
                </span>
              </div>
              <div className="p-2.5 rounded-lg studio-surface-card border studio-border-default">
                <span className="text-[10px] studio-fg-muted block">
                  Max Contraction Drift
                </span>
                <span className="text-sm font-bold studio-fg-cyan">
                  {baselineDrift.maxContractionDriftDays > 0 ? "+" : ""}
                  {baselineDrift.maxContractionDriftDays} days
                </span>
              </div>
            </div>
          </div>

          {/* Deterministic Milestone Forecasting */}
          <div className="p-4 rounded-xl studio-surface-subtle border studio-border-default space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold studio-fg-primary font-mono">
                <IconInfoCircle className="w-4 h-4 studio-fg-purple" />
                <span>Subject Milestone Forecasting Controls</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div>
                <label className="block text-[10px] studio-fg-muted mb-1">
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
                  className="w-full px-2.5 py-1.5 studio-surface-card border studio-border-strong rounded-lg studio-fg-primary font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] studio-fg-muted mb-1">
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
                  className="w-full px-2.5 py-1.5 studio-surface-card border studio-border-strong rounded-lg studio-fg-primary font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] studio-fg-muted mb-1">
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
                  className="w-full px-2.5 py-1.5 studio-surface-card border studio-border-strong rounded-lg studio-fg-primary font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] studio-fg-muted mb-1">
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
                  className="w-full px-2.5 py-1.5 studio-surface-card border studio-border-strong rounded-lg studio-fg-primary font-mono text-xs"
                />
              </div>
            </div>

            {/* Projected Milestone Dates Table */}
            <div className="pt-2 space-y-2">
              <div className="text-[11px] font-mono font-bold studio-fg-purple">
                Calculated Protocol Milestone Projections
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg studio-surface-card border studio-border-default">
                  <span className="text-[10px] studio-fg-muted block">
                    First Subject In (FSI)
                  </span>
                  <span className="font-bold studio-fg-primary">
                    {milestoneForecast.fsiDate}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg studio-surface-card border studio-border-default">
                  <span className="text-[10px] studio-fg-muted block">
                    Last Subject In (LSI)
                  </span>
                  <span className="font-bold studio-fg-primary">
                    {milestoneForecast.lsiDate}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg studio-surface-card border studio-border-default">
                  <span className="text-[10px] studio-fg-muted block">
                    First Subject Last Visit
                  </span>
                  <span className="font-bold studio-fg-primary">
                    {milestoneForecast.fslvDate}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg studio-surface-card border studio-border-default">
                  <span className="text-[10px] studio-fg-muted block">
                    Last Subject Last Visit (LSLV)
                  </span>
                  <span className="font-bold studio-fg-cyan">
                    {milestoneForecast.lslvDate}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg studio-surface-card border studio-border-default flex flex-wrap items-center justify-between text-xs font-mono studio-fg-secondary gap-2">
                <div>
                  <span className="studio-fg-muted">
                    Total Study Completion Bounds (LSLV):{" "}
                  </span>
                  <span className="font-bold studio-fg-primary">
                    {milestoneForecast.earliestStudyCompletionDate} to{" "}
                    {milestoneForecast.latestStudyCompletionDate}
                  </span>
                </div>
                <div>
                  <span className="studio-fg-muted">
                    Completing Cohort Estimate:{" "}
                  </span>
                  <span className="font-bold studio-fg-emerald">
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
                      ? "studio-accent-cyan-strong font-bold"
                      : "studio-surface-card studio-border-default studio-fg-muted studio-hover-fg-primary"
                  }`}
                >
                  <span>{visit.name}</span>
                  {hasWarning && (
                    <span
                      className="w-2 h-2 rounded-full studio-dot-amber shrink-0"
                      title="Window Overlap Conflict"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {currentCardVisit && (
            <div className="p-4 sm:p-5 rounded-2xl studio-surface-subtle border studio-border-default space-y-4">
              <div className="flex items-start justify-between gap-3 border-b studio-border-default pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold studio-fg-primary font-mono">
                      {currentCardVisit.name}
                    </h2>
                    {currentCardConflicts.length > 0 && (
                      <span className="px-2 py-0.5 rounded studio-accent-amber-strong border text-[10px] font-bold font-mono inline-flex items-center gap-1">
                        <IconAlertTriangle className="w-3 h-3" />
                        <span>Conflict</span>
                      </span>
                    )}
                  </div>
                  <div className="text-xs studio-fg-cyan font-mono mt-0.5">
                    Target Day {currentCardVisit.targetDay} (
                    {formatVisitWindow(currentCardVisit)} window)
                    {currentCardVisit.epochId &&
                      epochMap.has(currentCardVisit.epochId) && (
                        <span className="ml-2 studio-accent-purple px-1.5 py-0.5 rounded border">
                          {epochMap.get(currentCardVisit.epochId)}
                        </span>
                      )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <TooltipButton
                    onClick={() =>
                      setEditingVisitId(
                        editingVisitId === currentCardVisit.id
                          ? null
                          : currentCardVisit.id
                      )
                    }
                    className="p-1.5 rounded-lg studio-surface-muted studio-fg-secondary studio-hover-fg-primary"
                    tooltip="Edit Visit Timing"
                    aria-label="Edit Visit Timing"
                  >
                    <IconEdit className="w-3.5 h-3.5" />
                  </TooltipButton>
                  {study.visits.length > 1 && (
                    <TooltipButton
                      onClick={() => handleDeleteVisit(currentCardVisit.id)}
                      className="p-1.5 rounded-lg studio-surface-muted studio-hover-bg-red studio-fg-muted studio-hover-fg-red"
                      tooltip="Delete Visit"
                      aria-label="Delete Visit"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                    </TooltipButton>
                  )}
                </div>
              </div>

              {/* Conflict Alert Box for Current Card Visit */}
              {currentCardConflicts.length > 0 && (
                <div className="p-3 rounded-xl studio-accent-amber border text-xs font-mono space-y-1">
                  <div className="flex items-center gap-1.5 font-bold studio-fg-amber">
                    <IconAlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Visit Window Overlap Detected</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] studio-fg-amber">
                    {currentCardConflicts.map((c, idx) => (
                      <li key={idx}>{c.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Form Checkboxes for this Visit */}
              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase studio-fg-muted font-semibold">
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
                            ? "studio-bg-cyan studio-border-cyan studio-fg-primary"
                            : "studio-surface-subtle studio-border-default studio-fg-muted studio-hover-subtle"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono studio-surface-card border studio-border-default studio-fg-cyan">
                            {form.domain}
                          </span>
                          <span className="text-xs font-sans font-medium truncate">
                            {form.name}
                          </span>
                          {form.isLogForm && (
                            <span className="text-[9px] font-mono studio-fg-purple studio-bg-purple px-1 rounded">
                              LOG
                            </span>
                          )}
                        </div>

                        <div
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                            isAssigned
                              ? "studio-btn-cyan font-bold"
                              : "studio-surface-card studio-border-strong text-transparent"
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
        <div className="rounded-2xl border studio-border-default studio-surface-subtle overflow-x-auto shadow-xl">
          <table
            className="w-full text-left border-collapse min-w-[700px]"
            role="grid"
            aria-label="Schedule of Activities Visit Matrix"
          >
            <thead>
              <tr
                className="border-b studio-border-default studio-surface-subtle sticky top-0 z-20"
                role="row"
              >
                <th
                  scope="col"
                  role="columnheader"
                  className="p-3.5 sm:p-4 text-xs font-mono font-bold studio-fg-muted w-60 sm:w-64 uppercase tracking-wider sticky left-0 studio-surface-subtle z-30 border-r studio-border-default"
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
                          ? "studio-border-red studio-bg-red"
                          : hasWarning
                            ? "studio-border-amber studio-bg-amber"
                            : "studio-border-default"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-bold font-mono studio-fg-primary truncate max-w-[140px] mx-auto">
                          {visit.name}
                        </div>
                        <div className="text-[10px] font-mono studio-fg-cyan">
                          Day {visit.targetDay} ({formatVisitWindow(visit)})
                        </div>
                        {visit.epochId && epochMap.has(visit.epochId) && (
                          <div className="text-[9px] font-mono studio-fg-purple">
                            {epochMap.get(visit.epochId)}
                          </div>
                        )}

                        {/* Visual Conflict Warning Badge */}
                        {hasWarning && (
                          <div
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border cursor-help ${
                              hasError
                                ? "studio-accent-red-strong"
                                : "studio-accent-amber-strong"
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
                            className="text-[9px] font-mono px-1.5 py-0.2 rounded studio-surface-muted studio-hover-active studio-fg-secondary"
                          >
                            {editingVisitId === visit.id ? "Done" : "Edit"}
                          </button>
                          {study.visits.length > 1 && (
                            <TooltipButton
                              onClick={() => handleDeleteVisit(visit.id)}
                              className="text-[9px] font-mono studio-fg-muted studio-hover-fg-red p-0.5"
                              tooltip="Delete Visit"
                              aria-label="Delete Visit"
                            >
                              <IconTrash className="w-3 h-3" />
                            </TooltipButton>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y studio-divide-subtle font-mono text-xs">
              {study.forms.map((form) => (
                <tr
                  key={form.id}
                  role="row"
                  className="studio-hover-surface transition-colors"
                >
                  <th
                    scope="row"
                    role="rowheader"
                    className="p-3 sm:p-3.5 pl-3 sm:pl-4 sticky left-0 studio-surface-subtle z-10 border-r studio-border-default font-normal text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold studio-surface-card border studio-border-default studio-fg-cyan shrink-0">
                          {form.domain}
                        </span>
                        <span className="font-sans font-semibold studio-fg-primary text-xs truncate max-w-[140px] sm:max-w-none">
                          {form.name}
                        </span>
                        {form.isLogForm && (
                          <span className="text-[9px] font-mono studio-accent-purple px-1 rounded border shrink-0">
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
                        className="p-3 text-center border-l studio-border-subtle cursor-pointer studio-hover-bg-cyan focus-visible:ring-2 studio-focus-ring focus-visible:outline-none transition-colors"
                      >
                        <div className="flex items-center justify-center">
                          <div
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                              isAssigned
                                ? "studio-btn-cyan font-bold shadow-sm"
                                : "studio-surface-card studio-border-default text-transparent studio-hover-border-strong"
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
        <div className="mt-4 sm:mt-6 p-4 rounded-2xl studio-surface-card border studio-border-default space-y-3">
          {(() => {
            const v = study.visits.find((item) => item.id === editingVisitId);
            if (!v) return null;

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold studio-fg-primary font-mono">
                    Configure Visit: {v.name}
                  </div>
                  <button
                    onClick={() => setEditingVisitId(null)}
                    className="text-xs studio-fg-cyan font-mono hover:underline"
                  >
                    Done Editing
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-mono studio-fg-muted mb-1">
                      Visit Name
                    </label>
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) =>
                        handleUpdateVisit(v.id, { name: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 studio-surface-subtle border studio-border-strong rounded-lg studio-fg-primary font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono studio-fg-muted mb-1">
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
                      className="w-full px-2.5 py-1.5 studio-surface-subtle border studio-border-strong rounded-lg studio-fg-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono studio-fg-muted mb-1">
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
                      className="w-full px-2.5 py-1.5 studio-surface-subtle border studio-border-strong rounded-lg studio-fg-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono studio-fg-muted mb-1">
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
                      className="w-full px-2.5 py-1.5 studio-surface-subtle border studio-border-strong rounded-lg studio-fg-primary font-mono"
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
    <TooltipButton
      type="button"
      role="checkbox"
      aria-checked={ariaChecked}
      aria-label={label}
      tooltip={state === "full" ? `Clear ${label}` : `Assign ${label}`}
      onClick={onToggle}
      data-testid={testId}
      className={`p-1 rounded-md border transition-colors flex items-center justify-center shrink-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 studio-focus-ring ${
        state === "full"
          ? "studio-btn-cyan"
          : state === "partial"
            ? "studio-accent-cyan-strong"
            : "studio-surface-card studio-border-strong studio-fg-muted studio-hover-fg-secondary studio-hover-border"
      }`}
    >
      {state === "full" ? (
        <IconCheck className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
      ) : state === "partial" ? (
        <IconMinus className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
      ) : (
        <IconPlus className="w-3.5 h-3.5" aria-hidden="true" />
      )}
    </TooltipButton>
  );
}
