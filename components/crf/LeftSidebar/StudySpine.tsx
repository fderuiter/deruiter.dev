"use client";

import React, { useState, useMemo } from "react";
import {
  IconFileSpreadsheet,
  IconPlus,
  IconTrash,
  IconCopy,
  IconChevronDown,
  IconChevronRight,
  IconGripVertical,
  IconTimeline,
  IconBook2,
  IconComponents,
  IconLayersSubtract,
  IconX,
  IconGitFork,
} from "@tabler/icons-react";
import { StudyProtocol, CRFForm } from "@/lib/crf/types";
import {
  formatVisitWindow,
  StudyProtocolEngine,
  type FormCatalogEntry,
  getFormUses,
} from "@/lib/crf";
import { CATALOG_DRAG_TYPE, FormCatalogList } from "../FormCatalogList";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { WidgetPalette } from "./WidgetPalette";
import { FormVariantModal } from "./FormVariantModal";
import { FormTemplatesPanel } from "./FormTemplatesPanel";
import { TooltipButton } from "@/components/ui/Tooltip";

export type LeftSidebarTab = "spine" | "forms" | "palette";

const SPINE_TABS: LeftSidebarTab[] = ["spine", "forms", "palette"];

interface StudySpineProps {
  study: StudyProtocol;
  activeVisitId?: string;
  activeFormId: string;
  activeTab: LeftSidebarTab;
  onChangeTab: (tab: LeftSidebarTab) => void;
  onSelectVisit: (visitId: string) => void;
  onSelectForm: (formId: string) => void;
  onAddVisit: () => void;
  onDeleteVisit: (visitId: string) => void;
  onAddForm: () => void;
  onDuplicateForm: (formId: string) => void;
  onDeleteForm: (formId: string) => void;
  onOpenFormCatalog: () => void;
  onAddField: (field: import("@/lib/crf/types").CRFField) => void;
  onAssignFormToVisit: (visitId: string, formId: string) => void;
  onUnassignFormFromVisit: (visitId: string, formId: string) => void;
  /** Every ready-made form and block the studio offers (#2927 item 11). */
  catalogEntries: readonly FormCatalogEntry[];
  /** Adds a catalog entry: a form to the given visit, a block to the open form. */
  onAddCatalogEntry: (entryId: string, targetVisitId?: string) => void;
  /** Commits a form variant transaction (#675) as one undoable change. */
  onCommitFormVariant?: (study: StudyProtocol, variantFormId: string) => void;
}

export const StudySpine: React.FC<StudySpineProps> = ({
  study,
  activeVisitId,
  activeFormId,
  activeTab,
  onChangeTab,
  onSelectVisit,
  onSelectForm,
  onAddVisit,
  onDeleteVisit,
  onAddForm,
  onDuplicateForm,
  onDeleteForm,
  onOpenFormCatalog,
  onAddField,
  onAssignFormToVisit,
  onUnassignFormFromVisit,
  catalogEntries,
  onAddCatalogEntry,
  onCommitFormVariant,
}) => {
  const [collapsedEpochs, setCollapsedEpochs] = useState<
    Record<string, boolean>
  >({});
  const [collapsedVisits, setCollapsedVisits] = useState<
    Record<string, boolean>
  >({});
  const [dragOverVisitId, setDragOverVisitId] = useState<string | null>(null);
  const [formPendingDeletion, setFormPendingDeletion] =
    useState<CRFForm | null>(null);
  const deleteFormDialogRef = useFocusTrap<HTMLDivElement>(
    !!formPendingDeletion,
    {
      onEscape: () => setFormPendingDeletion(null),
    }
  );

  const [variantFormId, setVariantFormId] = useState<string | null>(null);
  const formUseCounts = useMemo(
    () =>
      new Map(study.forms.map((f) => [f.id, getFormUses(study, f.id).length])),
    [study]
  );
  const activeFormUseCount = formUseCounts.get(activeFormId) ?? 0;
  const activeFormName = study.forms.find((f) => f.id === activeFormId)?.name;

  const tabRefs = React.useRef<
    Record<LeftSidebarTab, HTMLButtonElement | null>
  >({
    spine: null,
    forms: null,
    palette: null,
  });

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: LeftSidebarTab
  ) => {
    const currentIndex = SPINE_TABS.indexOf(currentTab);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % SPINE_TABS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + SPINE_TABS.length) % SPINE_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = SPINE_TABS.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = SPINE_TABS[nextIndex];
    onChangeTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  const formDeletionPreview = useMemo(() => {
    if (!formPendingDeletion) return null;
    return StudyProtocolEngine.previewFormRemoval(
      study,
      formPendingDeletion.id
    );
  }, [study, formPendingDeletion]);

  const handleDeleteFormClick = (form: CRFForm) => {
    const preview = StudyProtocolEngine.previewFormRemoval(study, form.id);
    const isInUse =
      preview.affectedVisits.length > 0 || preview.affectedArms.length > 0;
    if (isInUse) {
      setFormPendingDeletion(form);
    } else {
      onDeleteForm(form.id);
    }
  };

  const epochs =
    study.epochs && study.epochs.length > 0
      ? study.epochs
      : [
          {
            id: "epoch_screening",
            name: "Screening & Baseline",
            sequenceNumber: 1,
            type: "Screening",
          },
          {
            id: "epoch_treatment",
            name: "Active Treatment",
            sequenceNumber: 2,
            type: "Treatment",
          },
          {
            id: "epoch_followup",
            name: "Follow-Up & Safety",
            sequenceNumber: 3,
            type: "Follow-up",
          },
        ];

  const toggleEpochCollapse = (epochId: string) => {
    setCollapsedEpochs((prev) => ({ ...prev, [epochId]: !prev[epochId] }));
  };

  const toggleVisitCollapse = (visitId: string) => {
    setCollapsedVisits((prev) => ({ ...prev, [visitId]: !prev[visitId] }));
  };

  // Group visits by epoch
  const getVisitsForEpoch = (epochId: string) => {
    return study.visits.filter((v) => {
      if (v.epochId) return v.epochId === epochId;
      // Fallback inference if visits lack epochId
      if (
        epochId.includes("screen") ||
        v.id.includes("screen") ||
        v.targetDay === 0
      ) {
        return epochId.includes("screen");
      }
      if (
        epochId.includes("follow") ||
        v.id.includes("follow") ||
        v.targetDay > 100
      ) {
        return epochId.includes("follow");
      }
      return epochId.includes("treatment");
    });
  };

  // Handle Drag & Drop form assignment onto visit
  const handleDragStartForm = (e: React.DragEvent, formId: string) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "form", formId })
    );
  };

  const handleDragOverVisit = (e: React.DragEvent, visitId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverVisitId !== visitId) {
      setDragOverVisitId(visitId);
    }
  };

  const handleDragLeaveVisit = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverVisitId(null);
  };

  const handleDropOnVisit = (e: React.DragEvent, visitId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverVisitId(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data.type === "form" && data.formId) {
        onAssignFormToVisit(visitId, data.formId);
        onSelectVisit(visitId);
        onSelectForm(data.formId);
      } else if (data.type === CATALOG_DRAG_TYPE && data.entryId) {
        onAddCatalogEntry(data.entryId, visitId);
        onSelectVisit(visitId);
      }
    } catch {
      // Fallback gracefully
    }
  };

  return (
    <div
      className="flex flex-col h-full studio-surface-sidebar select-none"
      data-testid="study-spine-root"
    >
      {/* 3-Way Sub-Navigation Header */}
      <div
        className="flex border-b studio-border-default studio-surface-subtle p-1 gap-1 shrink-0"
        role="tablist"
        aria-label="Study Spine Navigation"
      >
        <TooltipButton
          ref={(node) => {
            tabRefs.current.spine = node;
          }}
          type="button"
          id="study-spine-tab-spine"
          role="tab"
          aria-selected={activeTab === "spine"}
          aria-controls="study-spine-panel-spine"
          tabIndex={activeTab === "spine" ? 0 : -1}
          onClick={() => onChangeTab("spine")}
          onKeyDown={(e) => handleTabKeyDown(e, "spine")}
          className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all ${
            activeTab === "spine"
              ? "studio-accent-cyan-strong font-bold border shadow-sm"
              : "studio-fg-muted studio-hover-fg-primary studio-hover-surface border border-transparent"
          }`}
          tooltip="Study Spine (Longitudinal Timeline)"
        >
          <IconTimeline className="w-3.5 h-3.5 shrink-0 hidden 2xl:inline" />
          <span className="truncate">Spine</span>
        </TooltipButton>

        <TooltipButton
          ref={(node) => {
            tabRefs.current.forms = node;
          }}
          type="button"
          id="study-spine-tab-forms"
          role="tab"
          aria-selected={activeTab === "forms"}
          aria-controls="study-spine-panel-forms"
          tabIndex={activeTab === "forms" ? 0 : -1}
          onClick={() => onChangeTab("forms")}
          onKeyDown={(e) => handleTabKeyDown(e, "forms")}
          className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all ${
            activeTab === "forms"
              ? "studio-accent-cyan-strong font-bold border shadow-sm"
              : "studio-fg-muted studio-hover-fg-primary studio-hover-surface border border-transparent"
          }`}
          tooltip="Protocol Forms & Global Library"
        >
          <IconBook2 className="w-3.5 h-3.5 shrink-0 hidden 2xl:inline" />
          <span className="truncate">Forms ({study.forms.length})</span>
        </TooltipButton>

        <TooltipButton
          ref={(node) => {
            tabRefs.current.palette = node;
          }}
          type="button"
          id="study-spine-tab-palette"
          role="tab"
          aria-selected={activeTab === "palette"}
          aria-controls="study-spine-panel-palette"
          tabIndex={activeTab === "palette" ? 0 : -1}
          onClick={() => onChangeTab("palette")}
          onKeyDown={(e) => handleTabKeyDown(e, "palette")}
          className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all ${
            activeTab === "palette"
              ? "studio-accent-cyan-strong font-bold border shadow-sm"
              : "studio-fg-muted studio-hover-fg-primary studio-hover-surface border border-transparent"
          }`}
          tooltip="Widget Palette"
        >
          <IconComponents className="w-3.5 h-3.5 shrink-0 hidden 2xl:inline" />
          <span className="truncate">Palette</span>
        </TooltipButton>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
        {/* TAB 1: STUDY SPINE (Timeline & Epochs) */}
        <div
          id="study-spine-panel-spine"
          role="tabpanel"
          aria-labelledby="study-spine-tab-spine"
          tabIndex={0}
          hidden={activeTab !== "spine"}
          className={activeTab === "spine" ? "space-y-3" : "hidden"}
        >
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-mono uppercase tracking-wider studio-fg-muted font-semibold flex items-center gap-1.5">
              <IconTimeline className="w-3.5 h-3.5 studio-fg-cyan" />
              Study Timeline ({study.visits.length} Visits)
            </span>
            <TooltipButton
              onClick={onAddVisit}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded studio-surface-muted studio-hover-active studio-fg-primary text-[11px] font-mono transition-colors border studio-border-strong"
              tooltip="Add New Protocol Visit"
            >
              <IconPlus className="w-3 h-3" />
              <span>Visit</span>
            </TooltipButton>
          </div>

          {/* Epochs & Visits Tree */}
          <div className="space-y-2">
            {epochs.map((epoch) => {
              const epochVisits = getVisitsForEpoch(epoch.id);
              const isEpochCollapsed = !!collapsedEpochs[epoch.id];

              return (
                <div
                  key={epoch.id}
                  className="rounded-xl border studio-border-default studio-surface-subtle overflow-hidden"
                >
                  {/* Epoch Header */}
                  <div
                    onClick={() => toggleEpochCollapse(epoch.id)}
                    className="flex items-center justify-between px-2.5 py-2 studio-surface-subtle studio-hover-surface cursor-pointer border-b studio-border-subtle transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isEpochCollapsed ? (
                        <IconChevronRight className="w-3.5 h-3.5 studio-fg-muted shrink-0" />
                      ) : (
                        <IconChevronDown className="w-3.5 h-3.5 studio-fg-cyan shrink-0" />
                      )}
                      <span className="text-xs font-bold font-mono studio-fg-primary truncate">
                        {epoch.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded studio-surface-muted studio-fg-muted border studio-border-default">
                      {epochVisits.length}{" "}
                      {epochVisits.length === 1 ? "visit" : "visits"}
                    </span>
                  </div>

                  {/* Visits in Epoch */}
                  {!isEpochCollapsed && (
                    <div className="p-1.5 space-y-1.5">
                      {epochVisits.length === 0 ? (
                        <p className="text-[11px] studio-fg-muted font-mono italic px-2 py-1">
                          No visits scheduled in this epoch.
                        </p>
                      ) : (
                        epochVisits.map((visit) => {
                          const isVisitActive = activeVisitId === visit.id;
                          const isVisitCollapsed = !!collapsedVisits[visit.id];
                          const isDropTarget = dragOverVisitId === visit.id;
                          const assignedForms = study.forms.filter((f) =>
                            visit.assignedFormIds.includes(f.id)
                          );

                          return (
                            <div
                              key={visit.id}
                              onDragOver={(e) =>
                                handleDragOverVisit(e, visit.id)
                              }
                              onDragLeave={handleDragLeaveVisit}
                              onDrop={(e) => handleDropOnVisit(e, visit.id)}
                              className={`rounded-lg border transition-all ${
                                isDropTarget
                                  ? "studio-border-cyan studio-bg-cyan-strong ring-2 studio-ring-cyan scale-[1.01]"
                                  : isVisitActive
                                    ? "studio-border-cyan studio-surface-card shadow-sm"
                                    : "studio-border-default studio-surface-subtle studio-hover-border-strong studio-hover-subtle"
                              }`}
                            >
                              {/* Visit Row */}
                              <div
                                onClick={() => {
                                  onSelectVisit(visit.id);
                                  if (assignedForms[0]) {
                                    onSelectForm(assignedForms[0].id);
                                  }
                                }}
                                className="p-2 flex items-center justify-between gap-2 cursor-pointer group"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleVisitCollapse(visit.id);
                                    }}
                                    className="p-0.5 studio-hover-surface rounded studio-fg-muted studio-hover-fg-secondary"
                                    aria-label={
                                      isVisitCollapsed
                                        ? `Expand ${visit.name}`
                                        : `Collapse ${visit.name}`
                                    }
                                    aria-expanded={!isVisitCollapsed}
                                  >
                                    {isVisitCollapsed ? (
                                      <IconChevronRight className="w-3 h-3" />
                                    ) : (
                                      <IconChevronDown className="w-3 h-3 studio-fg-cyan" />
                                    )}
                                  </button>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`text-xs font-bold truncate ${
                                          isVisitActive
                                            ? "studio-fg-cyan"
                                            : "studio-fg-primary"
                                        }`}
                                      >
                                        {visit.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] studio-fg-muted font-mono">
                                        Day {visit.targetDay} (
                                        {formatVisitWindow(visit)})
                                      </span>
                                      <span className="text-[9px] font-mono px-1 rounded studio-surface-muted studio-fg-muted border studio-border-strong">
                                        {assignedForms.length}{" "}
                                        {assignedForms.length === 1
                                          ? "form"
                                          : "forms"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Delete Visit Action */}
                                {study.visits.length > 1 && (
                                  <TooltipButton
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteVisit(visit.id);
                                    }}
                                    className="p-1 rounded opacity-0 group-hover:opacity-100 studio-hover-bg-red studio-fg-muted studio-hover-fg-red transition-all"
                                    tooltip="Delete Visit"
                                    aria-label="Delete Visit"
                                  >
                                    <IconTrash className="w-3.5 h-3.5" />
                                  </TooltipButton>
                                )}
                              </div>

                              {/* Assigned Forms Sub-Tree */}
                              {!isVisitCollapsed && (
                                <div className="border-t studio-border-subtle p-1.5 studio-surface-subtle space-y-1">
                                  {assignedForms.length === 0 ? (
                                    <p className="text-[10px] studio-fg-muted font-mono italic px-2 py-1">
                                      Drop a form template here to assign.
                                    </p>
                                  ) : (
                                    assignedForms.map((form) => {
                                      const isFormActive =
                                        form.id === activeFormId;
                                      return (
                                        <div
                                          key={form.id}
                                          draggable
                                          onDragStart={(e) =>
                                            handleDragStartForm(e, form.id)
                                          }
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectVisit(visit.id);
                                            onSelectForm(form.id);
                                          }}
                                          className={`flex items-center justify-between p-1.5 rounded-md border cursor-pointer transition-all ${
                                            isFormActive
                                              ? "studio-bg-cyan-strong studio-border-cyan studio-fg-primary font-medium shadow-sm"
                                              : "studio-surface-subtle studio-border-default studio-hover-border-strong studio-fg-secondary studio-hover-fg-primary"
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <IconGripVertical className="w-3 h-3 studio-fg-muted cursor-grab shrink-0" />
                                            <IconFileSpreadsheet className="w-3.5 h-3.5 studio-fg-cyan shrink-0" />
                                            <span className="text-xs truncate">
                                              {form.name}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span className="text-[9px] font-mono px-1 py-0.2 rounded studio-surface-muted studio-fg-muted border studio-border-strong">
                                              {form.domain || "CRF"}
                                            </span>
                                            <TooltipButton
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onUnassignFormFromVisit(
                                                  visit.id,
                                                  form.id
                                                );
                                              }}
                                              className="p-0.5 rounded studio-fg-muted studio-hover-fg-red studio-hover-surface transition-colors"
                                              tooltip={`Unassign ${form.name} from ${visit.name}`}
                                              aria-label={`Unassign ${form.name} from ${visit.name}`}
                                            >
                                              <IconLayersSubtract className="w-3 h-3" />
                                            </TooltipButton>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* TAB 2: PROTOCOL FORMS & GLOBAL LIBRARY */}
        <div
          id="study-spine-panel-forms"
          role="tabpanel"
          aria-labelledby="study-spine-tab-forms"
          tabIndex={0}
          hidden={activeTab !== "forms"}
          className={activeTab === "forms" ? "space-y-4" : "hidden"}
        >
          {/* Active Protocol Forms Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-mono uppercase tracking-wider studio-fg-muted font-semibold">
                Study Forms ({study.forms.length})
              </span>
              <TooltipButton
                onClick={onAddForm}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded studio-surface-muted studio-hover-active studio-fg-primary text-[11px] font-mono transition-colors border studio-border-strong"
                tooltip="Add Blank Form"
              >
                <IconPlus className="w-3 h-3" />
                <span>New</span>
              </TooltipButton>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
              {study.forms.map((form) => {
                const isActive = form.id === activeFormId;
                const fieldCount = form.sections.reduce(
                  (acc, s) => acc + s.fields.length,
                  0
                );

                return (
                  <div
                    key={form.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    aria-label={`Select form ${form.name}`}
                    draggable
                    onDragStart={(e) => handleDragStartForm(e, form.id)}
                    onClick={() => onSelectForm(form.id)}
                    onKeyDown={(e) => {
                      // Only Enter/Space on the row itself selects the form; the
                      // duplicate/delete buttons nested inside handle their own
                      // activation and must not also bubble into this handler.
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectForm(form.id);
                      }
                    }}
                    className={`group relative p-2 rounded-xl border cursor-pointer transition-all outline-none focus-visible:ring-2 studio-focus-ring ${
                      isActive
                        ? "studio-bg-cyan studio-border-cyan shadow-sm"
                        : "studio-surface-subtle studio-border-default studio-hover-border-strong studio-hover-subtle"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <IconGripVertical className="w-3.5 h-3.5 studio-fg-muted cursor-grab shrink-0" />
                        <span
                          className={`p-1.5 rounded-lg border shrink-0 ${
                            isActive
                              ? "studio-btn-cyan"
                              : "studio-surface-card studio-fg-muted studio-border-default"
                          }`}
                        >
                          <IconFileSpreadsheet className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div
                            className={`text-xs font-bold truncate ${
                              isActive
                                ? "studio-fg-primary"
                                : "studio-fg-secondary"
                            }`}
                          >
                            {form.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded studio-surface-muted studio-fg-muted border studio-border-default">
                              {form.domain || "CRF"}
                            </span>
                            <span className="text-[10px] studio-fg-muted font-mono">
                              {fieldCount} fields
                            </span>
                            {(formUseCounts.get(form.id) ?? 0) > 1 && (
                              <span
                                className="text-[10px] studio-fg-amber font-mono"
                                data-testid={`form-use-count-${form.id}`}
                              >
                                shared · {formUseCounts.get(form.id)} uses
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        {onCommitFormVariant && (
                          <TooltipButton
                            onClick={(e) => {
                              e.stopPropagation();
                              setVariantFormId(form.id);
                            }}
                            className="p-1 rounded studio-hover-surface studio-fg-muted studio-hover-fg-primary"
                            tooltip="Visit uses & variants"
                            aria-label={`Inspect visit uses of form ${form.name}`}
                          >
                            <IconGitFork className="w-3.5 h-3.5" />
                          </TooltipButton>
                        )}
                        <TooltipButton
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateForm(form.id);
                          }}
                          className="p-1 rounded studio-hover-surface studio-fg-muted studio-hover-fg-primary"
                          tooltip="Duplicate Form"
                          aria-label={`Duplicate form ${form.name}`}
                        >
                          <IconCopy className="w-3.5 h-3.5" />
                        </TooltipButton>
                        {study.forms.length > 1 && (
                          <TooltipButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFormClick(form);
                            }}
                            className="p-1 rounded studio-hover-bg-red studio-fg-muted studio-hover-fg-red"
                            tooltip="Delete Form"
                            aria-label={`Delete form ${form.name}`}
                          >
                            <IconTrash className="w-3.5 h-3.5" />
                          </TooltipButton>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {activeFormUseCount > 1 && (
              <p
                className="px-1 text-[11px] studio-fg-muted leading-relaxed break-words"
                data-testid="shared-form-notice"
              >
                Edits to{" "}
                <span className="font-mono studio-fg-primary">
                  {activeFormName}
                </span>{" "}
                change all {activeFormUseCount} of its visit uses.
                {onCommitFormVariant && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => setVariantFormId(activeFormId)}
                      className="font-mono studio-fg-amber studio-hover-fg-amber underline underline-offset-2"
                    >
                      Inspect uses
                    </button>
                  </>
                )}
              </p>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t studio-border-default">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-mono uppercase tracking-wider studio-fg-amber font-semibold">
                Form catalog
              </span>
              <button
                type="button"
                onClick={onOpenFormCatalog}
                className="text-[10px] studio-fg-muted studio-hover-fg-amber font-mono transition-colors"
              >
                Open larger view
              </button>
            </div>
            <p className="px-1 text-[10px] studio-fg-muted">
              Forms go to the selected visit. Blocks go into the open form.
            </p>
            <FormCatalogList
              entries={catalogEntries}
              canInsertBlocks={!!activeFormId}
              draggable
              compact
              onAdd={(entry) => onAddCatalogEntry(entry.id, activeVisitId)}
            />
          </div>

          <FormTemplatesPanel />
        </div>

        {/* TAB 3: WIDGET PALETTE */}
        <div
          id="study-spine-panel-palette"
          role="tabpanel"
          aria-labelledby="study-spine-tab-palette"
          tabIndex={0}
          hidden={activeTab !== "palette"}
          className={activeTab === "palette" ? "" : "hidden"}
        >
          <WidgetPalette onAddField={onAddField} />
        </div>
      </div>

      {variantFormId && onCommitFormVariant && (
        <FormVariantModal
          study={study}
          formId={variantFormId}
          onCancel={() => setVariantFormId(null)}
          onCommit={(nextStudy, newFormId) => {
            setVariantFormId(null);
            onCommitFormVariant(nextStudy, newFormId);
          }}
        />
      )}

      {/* Confirmation Dialog Previewing Affected Visits & Arms */}
      {formPendingDeletion && formDeletionPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-form-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 studio-surface-scrim backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setFormPendingDeletion(null)}
        >
          <div
            ref={deleteFormDialogRef}
            className="w-full max-w-md studio-surface-elevated border studio-border-default rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3
                  id="delete-form-dialog-title"
                  className="text-sm font-bold font-mono studio-fg-primary"
                >
                  Delete Form &amp; Prune Visit Assignments
                </h3>
                <p className="text-xs studio-fg-muted font-sans">
                  Form{" "}
                  <span className="font-mono studio-fg-cyan font-bold">
                    {formPendingDeletion.name}
                  </span>{" "}
                  ({formPendingDeletion.domain}) is currently assigned in the
                  Schedule of Activities.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormPendingDeletion(null)}
                className="p-1 rounded studio-fg-muted studio-hover-fg-primary studio-hover-surface transition-colors"
                aria-label="Cancel"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            {/* Affected Assignments Preview */}
            <div className="studio-surface-subtle rounded-xl p-3 border studio-border-default space-y-2 max-h-48 overflow-y-auto">
              <div className="text-[11px] font-mono studio-fg-muted uppercase tracking-wider font-semibold">
                Affected Visits ({formDeletionPreview.affectedVisits.length})
              </div>
              <ul className="space-y-1">
                {formDeletionPreview.affectedVisits.map((v) => (
                  <li
                    key={v.id}
                    className="text-xs font-mono studio-fg-secondary flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full studio-dot-amber shrink-0" />
                      <span className="truncate">{v.name}</span>
                    </span>
                    <span className="studio-fg-muted text-[10px] shrink-0">
                      Day {v.targetDay}
                    </span>
                  </li>
                ))}
              </ul>

              {formDeletionPreview.affectedArms.length > 0 && (
                <div className="pt-2 border-t studio-border-default space-y-1">
                  <div className="text-[11px] font-mono studio-fg-muted uppercase tracking-wider font-semibold">
                    Affected Arms ({formDeletionPreview.affectedArms.length})
                  </div>
                  <ul className="space-y-1">
                    {formDeletionPreview.affectedArms.map((a) => (
                      <li
                        key={a.id}
                        className="text-xs font-mono studio-fg-secondary flex items-center gap-1.5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full studio-dot-purple shrink-0" />
                        <span>{a.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <p className="text-[11px] studio-fg-muted font-sans leading-relaxed">
              Confirming deletion will atomically remove this form and cleanly
              prune all visit and arm assignments across the protocol in a
              single commit.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setFormPendingDeletion(null)}
                className="px-3 py-1.5 rounded-lg studio-surface-muted studio-hover-active text-xs font-mono studio-fg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const idToDelete = formPendingDeletion.id;
                  setFormPendingDeletion(null);
                  onDeleteForm(idToDelete);
                }}
                className="px-3.5 py-1.5 rounded-lg studio-btn-red text-xs font-mono font-bold transition-colors shadow-sm"
              >
                Delete Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
