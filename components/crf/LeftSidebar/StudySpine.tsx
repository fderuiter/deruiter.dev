"use client";

import React, { useState, useMemo } from "react";
import {
  IconFileSpreadsheet,
  IconPlus,
  IconTrash,
  IconCopy,
  IconSparkles,
  IconChevronDown,
  IconChevronRight,
  IconGripVertical,
  IconTimeline,
  IconBook2,
  IconComponents,
  IconLayersSubtract,
  IconX,
} from "@tabler/icons-react";
import { StudyProtocol, CRFForm } from "@/lib/crf/types";
import { formatVisitWindow } from "@/lib/crf/visit-window";
import {
  CDASH_DOMAIN_CATALOG,
  StudyProtocolEngine,
} from "@/lib/crf/study-engine";
import { scaffoldCdashDomain } from "@/lib/crf/cdash-domain-templates";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { WidgetPalette } from "./WidgetPalette";

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
  onOpenCdashScaffolder: () => void;
  onAddField: (field: import("@/lib/crf/types").CRFField) => void;
  onAssignFormToVisit: (visitId: string, formId: string) => void;
  onUnassignFormFromVisit: (visitId: string, formId: string) => void;
  onInjectCdashForm: (form: CRFForm, targetVisitId?: string) => void;
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
  onOpenCdashScaffolder,
  onAddField,
  onAssignFormToVisit,
  onUnassignFormFromVisit,
  onInjectCdashForm,
}) => {
  const [collapsedEpochs, setCollapsedEpochs] = useState<
    Record<string, boolean>
  >({});
  const [collapsedVisits, setCollapsedVisits] = useState<
    Record<string, boolean>
  >({});
  const [dragOverVisitId, setDragOverVisitId] = useState<string | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<string>("");
  const [formPendingDeletion, setFormPendingDeletion] =
    useState<CRFForm | null>(null);
  const deleteFormDialogRef = useFocusTrap<HTMLDivElement>(
    !!formPendingDeletion,
    {
      onEscape: () => setFormPendingDeletion(null),
    }
  );

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

  const handleDragStartTemplate = (e: React.DragEvent, domainCode: string) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "template", domainCode })
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
      } else if (data.type === "template" && data.domainCode) {
        const scaffolded = scaffoldCdashDomain(
          data.domainCode as Parameters<typeof scaffoldCdashDomain>[0]
        );
        onInjectCdashForm(scaffolded, visitId);
        onAssignFormToVisit(visitId, scaffolded.id);
        onSelectVisit(visitId);
        onSelectForm(scaffolded.id);
      }
    } catch {
      // Fallback gracefully
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-zinc-950/95 select-none"
      data-testid="study-spine-root"
    >
      {/* 3-Way Sub-Navigation Header */}
      <div
        className="flex border-b border-zinc-800/80 bg-zinc-900/60 p-1 gap-1 shrink-0"
        role="tablist"
        aria-label="Study Spine Navigation"
      >
        <button
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
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-mono transition-all ${
            activeTab === "spine"
              ? "bg-brand-cyan/20 text-brand-cyan font-bold border border-brand-cyan/40 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 border border-transparent"
          }`}
          title="Study Spine (Longitudinal Timeline)"
        >
          <IconTimeline className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Spine</span>
        </button>

        <button
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
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-mono transition-all ${
            activeTab === "forms"
              ? "bg-brand-cyan/20 text-brand-cyan font-bold border border-brand-cyan/40 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 border border-transparent"
          }`}
          title="Protocol Forms & Global Library"
        >
          <IconBook2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Forms ({study.forms.length})</span>
        </button>

        <button
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
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-mono transition-all ${
            activeTab === "palette"
              ? "bg-brand-cyan/20 text-brand-cyan font-bold border border-brand-cyan/40 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 border border-transparent"
          }`}
          title="Widget Palette"
        >
          <IconComponents className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Palette</span>
        </button>
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
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
              <IconTimeline className="w-3.5 h-3.5 text-brand-cyan" />
              Study Timeline ({study.visits.length} Visits)
            </span>
            <button
              onClick={onAddVisit}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-mono transition-colors border border-zinc-700"
              title="Add New Protocol Visit"
            >
              <IconPlus className="w-3 h-3" />
              <span>Visit</span>
            </button>
          </div>

          {/* Epochs & Visits Tree */}
          <div className="space-y-2">
            {epochs.map((epoch) => {
              const epochVisits = getVisitsForEpoch(epoch.id);
              const isEpochCollapsed = !!collapsedEpochs[epoch.id];

              return (
                <div
                  key={epoch.id}
                  className="rounded-xl border border-zinc-850 bg-zinc-900/30 overflow-hidden"
                >
                  {/* Epoch Header */}
                  <div
                    onClick={() => toggleEpochCollapse(epoch.id)}
                    className="flex items-center justify-between px-2.5 py-2 bg-zinc-900/60 hover:bg-zinc-850/60 cursor-pointer border-b border-zinc-850/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isEpochCollapsed ? (
                        <IconChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      ) : (
                        <IconChevronDown className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                      )}
                      <span className="text-xs font-bold font-mono text-zinc-200 truncate">
                        {epoch.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-750">
                      {epochVisits.length}{" "}
                      {epochVisits.length === 1 ? "visit" : "visits"}
                    </span>
                  </div>

                  {/* Visits in Epoch */}
                  {!isEpochCollapsed && (
                    <div className="p-1.5 space-y-1.5">
                      {epochVisits.length === 0 ? (
                        <p className="text-[11px] text-zinc-500 font-mono italic px-2 py-1">
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
                                  ? "border-brand-cyan bg-brand-cyan/20 ring-2 ring-brand-cyan/40 scale-[1.01]"
                                  : isVisitActive
                                    ? "border-brand-cyan/40 bg-zinc-900/90 shadow-sm"
                                    : "border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900/40"
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
                                    className="p-0.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300"
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
                                      <IconChevronDown className="w-3 h-3 text-brand-cyan" />
                                    )}
                                  </button>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`text-xs font-bold truncate ${
                                          isVisitActive
                                            ? "text-brand-cyan"
                                            : "text-zinc-200"
                                        }`}
                                      >
                                        {visit.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] text-zinc-400 font-mono">
                                        Day {visit.targetDay} (
                                        {formatVisitWindow(visit)})
                                      </span>
                                      <span className="text-[9px] font-mono px-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
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
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteVisit(visit.id);
                                    }}
                                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all"
                                    title="Delete Visit"
                                  >
                                    <IconTrash className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Assigned Forms Sub-Tree */}
                              {!isVisitCollapsed && (
                                <div className="border-t border-zinc-850/60 p-1.5 bg-zinc-950/80 space-y-1">
                                  {assignedForms.length === 0 ? (
                                    <p className="text-[10px] text-zinc-500 font-mono italic px-2 py-1">
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
                                              ? "bg-brand-cyan/20 border-brand-cyan/60 text-white font-medium shadow-sm"
                                              : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white"
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <IconGripVertical className="w-3 h-3 text-zinc-600 cursor-grab shrink-0" />
                                            <IconFileSpreadsheet className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                                            <span className="text-xs truncate">
                                              {form.name}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                              {form.domain || "CRF"}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onUnassignFormFromVisit(
                                                  visit.id,
                                                  form.id
                                                );
                                              }}
                                              className="p-0.5 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                                              title="Unassign form from this visit"
                                            >
                                              <IconLayersSubtract className="w-3 h-3" />
                                            </button>
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
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Study Forms ({study.forms.length})
              </span>
              <button
                onClick={onAddForm}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-mono transition-colors border border-zinc-700"
                title="Add Blank Form"
              >
                <IconPlus className="w-3 h-3" />
                <span>New</span>
              </button>
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
                    className={`group relative p-2 rounded-xl border cursor-pointer transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ${
                      isActive
                        ? "bg-brand-cyan/10 border-brand-cyan/50 shadow-sm"
                        : "bg-zinc-950/60 border-zinc-850 hover:border-zinc-700 hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <IconGripVertical className="w-3.5 h-3.5 text-zinc-600 cursor-grab shrink-0" />
                        <span
                          className={`p-1.5 rounded-lg border shrink-0 ${
                            isActive
                              ? "bg-brand-cyan text-black border-brand-cyan"
                              : "bg-zinc-900 text-zinc-400 border-zinc-800"
                          }`}
                        >
                          <IconFileSpreadsheet className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div
                            className={`text-xs font-bold truncate ${
                              isActive ? "text-white" : "text-zinc-300"
                            }`}
                          >
                            {form.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-zinc-850 text-zinc-400 border border-zinc-750">
                              {form.domain || "CRF"}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {fieldCount} fields
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateForm(form.id);
                          }}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                          title="Duplicate Form"
                          aria-label={`Duplicate form ${form.name}`}
                        >
                          <IconCopy className="w-3.5 h-3.5" />
                        </button>
                        {study.forms.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFormClick(form);
                            }}
                            className="p-1 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400"
                            title="Delete Form"
                            aria-label={`Delete form ${form.name}`}
                          >
                            <IconTrash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Global CDASH Library Section */}
          <div className="space-y-2 pt-2 border-t border-zinc-850">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-brand-cyan font-semibold flex items-center gap-1">
                <IconSparkles className="w-3.5 h-3.5" />
                Global CDASH Library
              </span>
              <button
                onClick={onOpenCdashScaffolder}
                className="text-[10px] text-zinc-400 hover:text-brand-cyan font-mono transition-colors"
              >
                Modal View
              </button>
            </div>

            {/* Quick Filter */}
            <input
              type="text"
              placeholder="Search templates (e.g. Vitals, RECIST)..."
              value={libraryFilter}
              onChange={(e) => setLibraryFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-brand-cyan"
            />

            {/* Template Items */}
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
              {CDASH_DOMAIN_CATALOG.filter((cat) =>
                libraryFilter
                  ? cat.label
                      .toLowerCase()
                      .includes(libraryFilter.toLowerCase()) ||
                    cat.code.toLowerCase().includes(libraryFilter.toLowerCase())
                  : true
              ).map((cat) => {
                return (
                  <div
                    key={cat.code}
                    draggable
                    onDragStart={(e) => handleDragStartTemplate(e, cat.code)}
                    className="p-2 rounded-xl border border-zinc-850 bg-zinc-900/40 hover:border-brand-cyan/40 hover:bg-zinc-900/80 transition-all cursor-grab active:cursor-grabbing group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <IconGripVertical className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30">
                          {cat.code}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-zinc-200 truncate group-hover:text-white">
                            {cat.label}
                          </h4>
                          <p className="text-[10px] text-zinc-400 truncate">
                            {cat.variableCount} standardized variables
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const scaffolded = scaffoldCdashDomain(
                            cat.code as Parameters<
                              typeof scaffoldCdashDomain
                            >[0]
                          );
                          onInjectCdashForm(scaffolded, activeVisitId);
                        }}
                        className="px-2 py-1 rounded bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 text-[10px] font-mono font-bold transition-colors shrink-0"
                        title="Add this template to the study"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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

      {/* Confirmation Dialog Previewing Affected Visits & Arms */}
      {formPendingDeletion && formDeletionPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-form-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setFormPendingDeletion(null)}
        >
          <div
            ref={deleteFormDialogRef}
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3
                  id="delete-form-dialog-title"
                  className="text-sm font-bold font-mono text-white"
                >
                  Delete Form &amp; Prune Visit Assignments
                </h3>
                <p className="text-xs text-zinc-400 font-sans">
                  Form{" "}
                  <span className="font-mono text-brand-cyan font-bold">
                    {formPendingDeletion.name}
                  </span>{" "}
                  ({formPendingDeletion.domain}) is currently assigned in the
                  Schedule of Activities.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormPendingDeletion(null)}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors"
                aria-label="Cancel"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            {/* Affected Assignments Preview */}
            <div className="bg-zinc-950/80 rounded-xl p-3 border border-zinc-850 space-y-2 max-h-48 overflow-y-auto">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                Affected Visits ({formDeletionPreview.affectedVisits.length})
              </div>
              <ul className="space-y-1">
                {formDeletionPreview.affectedVisits.map((v) => (
                  <li
                    key={v.id}
                    className="text-xs font-mono text-zinc-300 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="truncate">{v.name}</span>
                    </span>
                    <span className="text-zinc-500 text-[10px] shrink-0">
                      Day {v.targetDay}
                    </span>
                  </li>
                ))}
              </ul>

              {formDeletionPreview.affectedArms.length > 0 && (
                <div className="pt-2 border-t border-zinc-850 space-y-1">
                  <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                    Affected Arms ({formDeletionPreview.affectedArms.length})
                  </div>
                  <ul className="space-y-1">
                    {formDeletionPreview.affectedArms.map((a) => (
                      <li
                        key={a.id}
                        className="text-xs font-mono text-zinc-300 flex items-center gap-1.5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                        <span>{a.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <p className="text-[11px] text-zinc-500 font-sans leading-relaxed">
              Confirming deletion will atomically remove this form and cleanly
              prune all visit and arm assignments across the protocol in a
              single commit.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setFormPendingDeletion(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-300 transition-colors"
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
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-mono font-bold text-white transition-colors shadow-sm"
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
