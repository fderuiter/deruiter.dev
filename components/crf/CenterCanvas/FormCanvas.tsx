"use client";

import React, { useState, useEffect } from "react";
import {
  IconFolderPlus,
  IconTrash,
  IconPlus,
  IconEdit,
  IconCheck,
  IconArrowUp,
  IconArrowDown,
  IconSparkles,
  IconCopy,
  IconFileSpreadsheet,
} from "@tabler/icons-react";
import {
  CRFForm,
  CRFField,
  CodelistDefinition,
  DeviceViewport,
  StudioMode,
} from "@/lib/crf/types";
import { FieldRenderer } from "./FieldRenderer";
import { ViewportSwitcher } from "./ViewportSwitcher";
import { generateId } from "@/lib/utils";

interface FormCanvasProps {
  form: CRFForm;
  selectedFieldId: string | null;
  viewport: DeviceViewport;
  codelists: CodelistDefinition[];
  onChangeViewport: (vp: DeviceViewport) => void;
  onSelectField: (fieldId: string | null) => void;
  onUpdateFormMeta: (updates: Partial<CRFForm>) => void;
  onAddSection: () => void;
  onDeleteSection: (sectionId: string) => void;
  onUpdateSectionTitle: (sectionId: string, title: string) => void;
  onDuplicateField: (sectionId: string, fieldId: string) => void;
  onDeleteField: (sectionId: string, fieldId: string) => void;
  onUpdateField?: (fieldId: string, updates: Partial<CRFField>) => void;
  onCommitReviewTargetChange?: (
    fieldId: string,
    updates?: Partial<CRFField>
  ) => void;
  /** Opens the widget palette. Pass a section id so the field the author
   * picks next is inserted into that section rather than a default one. */
  onOpenPalette: (sectionId?: string) => void;
  onDuplicateForm?: (formId: string) => void;
  onOpenSlashPalette?: (targetSectionId?: string, targetIndex?: number) => void;
  onSwitchMode?: (mode: StudioMode) => void;
}

export const FormCanvas: React.FC<FormCanvasProps> = ({
  form,
  selectedFieldId,
  viewport,
  codelists,
  onChangeViewport,
  onSelectField,
  onUpdateFormMeta,
  onAddSection,
  onDeleteSection,
  onUpdateSectionTitle,
  onDuplicateField,
  onDeleteField,
  onUpdateField,
  onCommitReviewTargetChange,
  onOpenPalette,
  onDuplicateForm,
  onOpenSlashPalette,
  onSwitchMode,
}) => {
  // Bring the selected field into view, so a field added from the Palette
  // doesn't land below the fold unnoticed (#1205). Only the visible canvas
  // (desktop or mobile) scrolls, and "nearest" leaves on-screen fields alone.
  useEffect(() => {
    if (!selectedFieldId) return;
    const frame = requestAnimationFrame(() => {
      const target = Array.from(
        document.querySelectorAll<HTMLElement>(
          `[data-field-id="${selectedFieldId}"]`
        )
      ).find((el) => el.offsetParent !== null);
      const reduceMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      )?.matches;
      target?.scrollIntoView?.({
        block: "nearest",
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedFieldId]);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(form.name);
  const [descInput, setDescInput] = useState(form.description);
  const [domainInput, setDomainInput] = useState(form.domain);

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionTitleInput, setSectionTitleInput] = useState("");

  // Drag and drop tracking state
  const [draggedFieldInfo, setDraggedFieldInfo] = useState<{
    sectionId: string;
    fieldId: string;
  } | null>(null);
  const [dropTargetInfo, setDropTargetInfo] = useState<{
    sectionId: string;
    targetIndex: number;
  } | null>(null);

  const handleSaveTitle = () => {
    onUpdateFormMeta({
      name: titleInput,
      description: descInput,
      domain: domainInput.toUpperCase(),
    });
    setIsEditingTitle(false);
  };

  // Section reordering
  const handleMoveSection = (
    sectionIndex: number,
    direction: "up" | "down"
  ) => {
    const targetIndex =
      direction === "up" ? sectionIndex - 1 : sectionIndex + 1;
    if (targetIndex < 0 || targetIndex >= form.sections.length) return;

    const newSections = [...form.sections];
    const [moved] = newSections.splice(sectionIndex, 1);
    newSections.splice(targetIndex, 0, moved);
    onUpdateFormMeta({ sections: newSections });
  };

  // Field move up / down (touch & accessible navigation)
  const handleMoveField = (
    sectionId: string,
    fieldIndex: number,
    direction: "up" | "down"
  ) => {
    const targetIndex = direction === "up" ? fieldIndex - 1 : fieldIndex + 1;
    const targetSec = form.sections.find((s) => s.id === sectionId);
    if (!targetSec || targetIndex < 0 || targetIndex >= targetSec.fields.length)
      return;

    const updatedSections = form.sections.map((sec) => {
      if (sec.id !== sectionId) return sec;
      const fields = [...sec.fields];
      const [moved] = fields.splice(fieldIndex, 1);
      fields.splice(targetIndex, 0, moved);
      return { ...sec, fields };
    });

    onUpdateFormMeta({ sections: updatedSections });
  };

  // Drag & drop field reordering
  const handleFieldDragStart = (
    e: React.DragEvent,
    sectionId: string,
    fieldId: string
  ) => {
    e.stopPropagation();
    setDraggedFieldInfo({ sectionId, fieldId });
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ sectionId, fieldId })
    );
  };

  const handleFieldDragOver = (
    e: React.DragEvent,
    sectionId: string,
    targetIndex: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetInfo({ sectionId, targetIndex });
  };

  const handleFieldDrop = (
    e: React.DragEvent,
    targetSectionId: string,
    targetIndex: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Check for widget drop payload from WidgetPalette
    let payload: {
      type?: string;
      widgetType?: string;
      defaultField?: Partial<CRFField>;
    } | null = null;
    let jsonStr = "";
    try {
      const dt =
        e.dataTransfer ||
        (e.nativeEvent as unknown as { dataTransfer?: DataTransfer })
          .dataTransfer;
      jsonStr =
        dt?.getData("application/json") || dt?.getData("text/plain") || "";
      if (jsonStr) {
        payload = JSON.parse(jsonStr);
      }
    } catch {
      // Ignore JSON parse errors
    }

    if (payload?.type === "widget" && payload.widgetType) {
      try {
        const widgetType = payload.widgetType;
        const defaultField = payload.defaultField || {};
        const newField: CRFField = {
          id: generateId(`f_${widgetType}`),
          variableName: defaultField.variableName || "FIELD",
          label: defaultField.label || "New Question",
          dataType: widgetType as CRFField["dataType"],
          columnSpan: defaultField.columnSpan || 6,
          required: !!defaultField.required,
          readOnly: defaultField.readOnly,
          placeholder: defaultField.placeholder,
          unit: defaultField.unit,
          minValue: defaultField.minValue,
          maxValue: defaultField.maxValue,
          codelistId: defaultField.codelistId,
          customOptions: defaultField.customOptions
            ? defaultField.customOptions.map((o) => ({ ...o }))
            : undefined,
          calculationFormula: defaultField.calculationFormula,
          scaleMinLabel: defaultField.scaleMinLabel,
          scaleMaxLabel: defaultField.scaleMaxLabel,
        };

        const updatedSections = form.sections.map((section) => {
          if (section.id !== targetSectionId) return section;
          const fields = [...section.fields];
          fields.splice(targetIndex, 0, newField);
          return { ...section, fields };
        });

        onUpdateFormMeta({ sections: updatedSections });
        setDraggedFieldInfo(null);
        setDropTargetInfo(null);
      } catch {
        // Ignore drop errors
      }
      return;
    }

    if (!draggedFieldInfo) {
      setDropTargetInfo(null);
      return;
    }

    const { sectionId: sourceSectionId, fieldId: sourceFieldId } =
      draggedFieldInfo;

    // Find source field
    const sourceSec = form.sections.find((s) => s.id === sourceSectionId);
    const draggedField = sourceSec?.fields.find((f) => f.id === sourceFieldId);

    if (!draggedField) {
      setDraggedFieldInfo(null);
      setDropTargetInfo(null);
      return;
    }

    const updatedSections = form.sections.map((section) => {
      let fields = [...section.fields];

      // Remove from source
      if (section.id === sourceSectionId) {
        fields = fields.filter((f) => f.id !== sourceFieldId);
      }

      // Insert into target
      if (section.id === targetSectionId) {
        const adjustedIndex =
          section.id === sourceSectionId &&
          sourceSec &&
          sourceSec.fields.findIndex((f) => f.id === sourceFieldId) <
            targetIndex
            ? Math.max(0, targetIndex - 1)
            : targetIndex;

        fields.splice(adjustedIndex, 0, draggedField);
      }

      return { ...section, fields };
    });

    onUpdateFormMeta({ sections: updatedSections });
    setDraggedFieldInfo(null);
    setDropTargetInfo(null);
  };

  // Viewport container width constraints
  const viewportWidthClass = {
    desktop: "w-full max-w-5xl",
    tablet: "w-full max-w-2xl",
    mobile: "w-full max-w-sm",
  }[viewport];

  return (
    <div
      onClick={() => onSelectField(null)}
      className="@container flex-1 flex flex-col min-w-0 h-auto md:h-full bg-zinc-950/80 crf-canvas-area overflow-visible md:overflow-y-auto p-3 sm:p-6 transition-all relative"
    >
      {/* Top Canvas Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="font-mono text-xs font-bold text-zinc-300">
            Layout Canvas
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-brand-cyan border border-zinc-800 hidden @4xl:inline-block whitespace-nowrap">
            12-Column Responsive Grid
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 min-w-0">
          <ViewportSwitcher
            viewport={viewport}
            onChangeViewport={onChangeViewport}
            gridCols={12}
          />
          {onSwitchMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSwitchMode("grid");
              }}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 text-xs font-mono transition-all shadow-sm whitespace-nowrap"
              title="Edit this form's fields as a table (Form Grid)"
              aria-label="Grid View"
            >
              <IconFileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-cyan" />
              <span className="hidden @2xl:inline">Grid View</span>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenSlashPalette) {
                onOpenSlashPalette();
              } else {
                onOpenPalette();
              }
            }}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan text-xs font-mono transition-all shadow-sm whitespace-nowrap"
            title="Open Slash Command Palette (/)"
            aria-label="Slash Commands"
          >
            <IconSparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden @2xl:inline">Slash Commands</span>
            <kbd className="hidden md:inline-block text-[9px] px-1 py-0.2 rounded bg-zinc-900 border border-zinc-700 text-zinc-400">
              /
            </kbd>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddSection();
            }}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-xs font-mono transition-all shadow-sm"
          >
            <IconFolderPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-cyan" />
            <span className="hidden sm:inline">Add Section</span>
            <span className="sm:hidden">+ Section</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Scroll Area with Centered Viewport */}
      <div className="flex-1 flex justify-center pb-28">
        <div
          className={`${viewportWidthClass} transition-all duration-300 space-y-4 sm:space-y-6`}
        >
          {/* Form Header Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/70 crf-paper-sheet border border-zinc-800/80 shadow-lg relative group">
            {isEditingTitle ? (
              <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                      Form Display Name
                    </label>
                    <input
                      type="text"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-white font-sans focus:border-brand-cyan focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                      CDASH Domain
                    </label>
                    <input
                      type="text"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-white font-mono uppercase focus:border-brand-cyan focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Form Description &amp; Scope
                  </label>
                  <textarea
                    rows={2}
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-zinc-300 font-sans resize-none focus:border-brand-cyan focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsEditingTitle(false)}
                    className="px-3 py-1 text-xs font-mono rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTitle}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-mono font-bold rounded bg-brand-cyan text-black hover:bg-white transition-all"
                  >
                    <IconCheck className="w-3.5 h-3.5" />
                    <span>Save Form Details</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30">
                      {form.domain || "CRF"}
                    </span>
                    <h2 className="text-base sm:text-xl font-extrabold text-white font-mono truncate">
                      {form.name}
                    </h2>
                    {form.isLogForm && (
                      <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                        Log Form
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed max-w-2xl">
                    {form.description || "No description provided."}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {onDuplicateForm && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateForm(form.id);
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700/60 transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
                      title="Duplicate Form"
                      aria-label={`Duplicate form ${form.name}`}
                    >
                      <IconCopy className="w-4 h-4 text-brand-cyan" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTitleInput(form.name);
                      setDescInput(form.description);
                      setDomainInput(form.domain);
                      setIsEditingTitle(true);
                    }}
                    className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700/60 transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
                    title="Edit Form Properties"
                    aria-label="Edit Form Properties"
                  >
                    <IconEdit className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Form Sections */}
          {form.sections.map((section, sIdx) => {
            const isEditingSec = editingSectionId === section.id;

            return (
              <div
                key={section.id}
                data-section-id={section.id}
                onDragOver={(e) =>
                  handleFieldDragOver(e, section.id, section.fields.length)
                }
                onDrop={(e) =>
                  handleFieldDrop(e, section.id, section.fields.length)
                }
                className="p-3.5 sm:p-5 rounded-2xl bg-zinc-900/40 crf-paper-sheet border border-zinc-800/80 space-y-3 sm:space-y-4"
              >
                {/* Section Header */}
                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                  {isEditingSec ? (
                    <div
                      className="flex items-center gap-2 flex-1 max-w-md"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={sectionTitleInput}
                        onChange={(e) => setSectionTitleInput(e.target.value)}
                        className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-700 rounded-md text-xs text-white focus:border-brand-cyan focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          onUpdateSectionTitle(section.id, sectionTitleInput);
                          setEditingSectionId(null);
                        }}
                        className="p-1 rounded bg-brand-cyan text-black"
                      >
                        <IconCheck className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono font-bold text-zinc-400">
                        §{sIdx + 1}.
                      </span>
                      <h2 className="text-xs sm:text-sm font-bold text-zinc-100 font-mono truncate">
                        {section.title}
                      </h2>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSectionId(section.id);
                          setSectionTitleInput(section.title);
                        }}
                        className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                        title="Rename Section"
                        aria-label="Rename Section"
                      >
                        <IconEdit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    {/* Section Move Up / Down Buttons */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveSection(sIdx, "up");
                      }}
                      disabled={sIdx === 0}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white disabled:opacity-25"
                      title="Move Section Up"
                      aria-label="Move Section Up"
                    >
                      <IconArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveSection(sIdx, "down");
                      }}
                      disabled={sIdx === form.sections.length - 1}
                      className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white disabled:opacity-25"
                      title="Move Section Down"
                      aria-label="Move Section Down"
                    >
                      <IconArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <span className="text-[10px] font-mono text-zinc-500 ml-1 hidden xs:inline">
                      {section.fields.length}{" "}
                      {section.fields.length === 1 ? "field" : "fields"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenSlashPalette) {
                          onOpenSlashPalette(section.id, section.fields.length);
                        } else {
                          onOpenPalette(section.id);
                        }
                      }}
                      className="p-1 rounded hover:bg-zinc-800 text-brand-cyan hover:text-white transition-colors ml-1"
                      title="Insert Field or Smart Block into Section (/)"
                      aria-label={`Add field to ${section.title}`}
                    >
                      <IconPlus className="w-3.5 h-3.5" />
                    </button>
                    {form.sections.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSection(section.id);
                        }}
                        className="p-1 text-zinc-500 hover:text-red-400 transition-colors ml-1"
                        title="Delete Section"
                        aria-label="Delete Section"
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 12-Column Responsive Grid */}
                {section.fields.length === 0 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenSlashPalette) {
                        onOpenSlashPalette(section.id, 0);
                      } else {
                        onOpenPalette(section.id);
                      }
                    }}
                    aria-label={`Add field to ${section.title}`}
                    className="w-full p-6 sm:p-8 border-2 border-dashed border-zinc-800 hover:border-brand-cyan/40 rounded-xl text-center cursor-pointer transition-all bg-zinc-950/30 group"
                  >
                    <IconPlus className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-600 group-hover:text-brand-cyan mx-auto mb-2 transition-colors" />
                    <p className="text-xs text-zinc-400 font-mono">
                      No fields in this section yet.
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Tap or click to pick a widget or press / for Smart Blocks.
                    </p>
                  </button>
                ) : (
                  <div className="grid grid-cols-12 gap-2.5 sm:gap-4">
                    {section.fields.map((field, fIdx) => (
                      <React.Fragment key={field.id}>
                        {/* Drop indicator line if dragging over this position */}
                        {dropTargetInfo?.sectionId === section.id &&
                          dropTargetInfo?.targetIndex === fIdx &&
                          draggedFieldInfo?.fieldId !== field.id && (
                            <div className="col-span-12 h-1 bg-brand-cyan rounded-full animate-pulse my-1" />
                          )}

                        <FieldRenderer
                          field={field}
                          isSelected={field.id === selectedFieldId}
                          codelists={codelists}
                          onSelect={() => onSelectField(field.id)}
                          onDuplicate={() =>
                            onDuplicateField(section.id, field.id)
                          }
                          onDelete={() => onDeleteField(section.id, field.id)}
                          canMoveUp={fIdx > 0}
                          canMoveDown={fIdx < section.fields.length - 1}
                          onMoveUp={() =>
                            handleMoveField(section.id, fIdx, "up")
                          }
                          onMoveDown={() =>
                            handleMoveField(section.id, fIdx, "down")
                          }
                          onUpdateField={(updates) => {
                            if (
                              onCommitReviewTargetChange &&
                              (updates.label !== undefined ||
                                updates.variableName !== undefined)
                            ) {
                              onCommitReviewTargetChange(field.id, updates);
                            } else if (onUpdateField) {
                              onUpdateField(field.id, updates);
                            }
                          }}
                          onDragStart={(e) =>
                            handleFieldDragStart(e, section.id, field.id)
                          }
                          onDragOver={(e) =>
                            handleFieldDragOver(e, section.id, fIdx)
                          }
                          onDrop={(e) => handleFieldDrop(e, section.id, fIdx)}
                        />
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Bottom Add Section Button */}
          <div className="pt-2 text-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddSection();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-mono transition-all"
            >
              <IconPlus className="w-4 h-4 text-brand-cyan" />
              <span>Add New Section to Form</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Action Button (FAB) for Mobile Quick Widget Addition */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenPalette();
        }}
        className="sm:hidden self-end mt-5 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-brand-cyan text-black font-mono text-xs font-extrabold shadow-lg hover:bg-white transition-all active:scale-[0.98]"
        title="Add Field / Open Widget Palette"
        aria-label="Add Field Widget"
      >
        <IconSparkles className="w-4 h-4" />
        <span>+ Widget</span>
      </button>
    </div>
  );
};
