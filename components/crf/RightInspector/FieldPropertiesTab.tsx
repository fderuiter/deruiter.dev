"use client";

import React, { useEffect, useState } from "react";
import {
  CRFField,
  CodelistDefinition,
  CodelistOption,
  ClinicalDataType,
} from "@/lib/crf/types";
import { validateCdashVariableName } from "@/lib/crf/precision-date";
import { generateId } from "@/lib/utils";
import { AstRuleEditor } from "./AstRuleEditor";
import {
  IconPlus,
  IconTrash,
  IconArrowUp,
  IconArrowDown,
  IconDeviceFloppy,
  IconClipboardText,
  IconSparkles,
  IconListDetails,
} from "@tabler/icons-react";
import { useToast } from "@/hooks/useToast";

interface FieldPropertiesTabProps {
  field: CRFField;
  allFieldsInForm: CRFField[];
  codelists: CodelistDefinition[];
  onUpdateField: (updates: Partial<CRFField>) => void;
  onSaveToStudyCodelist?: (codelist: CodelistDefinition) => void;
  onRenameEverywhere?: (newVar: string) => void;
  onCommitReviewTargetChange?: () => void;
}

const DATA_TYPES: { type: ClinicalDataType; label: string }[] = [
  { type: "text", label: "Single-Line Text" },
  { type: "textarea", label: "Multiline Textarea" },
  { type: "number", label: "Decimal Number (Float)" },
  { type: "integer", label: "Integer Count" },
  {
    type: "precision_date",
    label: "Precision Date (Segmented / Partial ISO 8601)",
  },
  { type: "date", label: "Standard Date" },
  { type: "partial_date", label: "Partial Date (UN-UNK-YYYY)" },
  { type: "datetime", label: "Date & Time Stamp" },
  { type: "time", label: "Time" },
  { type: "radio", label: "Radio Button Group" },
  { type: "single_select", label: "Dropdown Select (Single)" },
  { type: "multi_select", label: "Multi-Select Choices" },
  { type: "checkbox", label: "Single Checkbox" },
  { type: "calculated", label: "Calculated Field (AST Formula)" },
  { type: "vas_scale", label: "Visual Analog Scale (VAS 0-100mm)" },
  { type: "signature", label: "21 CFR Part 11 Electronic Signature" },
];

interface QuickTemplate {
  name: string;
  badge: string;
  options: CodelistOption[];
}

const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    name: "Yes / No",
    badge: "Binary",
    options: [
      { code: "Y", label: "Yes", nciCode: "C49488", order: 1 },
      { code: "N", label: "No", nciCode: "C49487", order: 2 },
    ],
  },
  {
    name: "Normal / Abnormal (CS/NCS)",
    badge: "Safety",
    options: [
      { code: "NORMAL", label: "Normal", nciCode: "C14165", order: 1 },
      {
        code: "ABNORMAL_NCS",
        label: "Abnormal (Not Clinically Significant)",
        nciCode: "C112042",
        order: 2,
      },
      {
        code: "ABNORMAL_CS",
        label: "Abnormal (Clinically Significant)",
        nciCode: "C112043",
        order: 3,
      },
    ],
  },
  {
    name: "Likert 5-Point",
    badge: "PRO/eCOA",
    options: [
      { code: "1", label: "Strongly Disagree", order: 1 },
      { code: "2", label: "Disagree", order: 2 },
      { code: "3", label: "Neutral / Neither", order: 3 },
      { code: "4", label: "Agree", order: 4 },
      { code: "5", label: "Strongly Agree", order: 5 },
    ],
  },
  {
    name: "Severity (Mild/Mod/Sev)",
    badge: "Safety",
    options: [
      { code: "MILD", label: "Mild", nciCode: "C48275", order: 1 },
      { code: "MODERATE", label: "Moderate", nciCode: "C48276", order: 2 },
      { code: "SEVERE", label: "Severe", nciCode: "C48277", order: 3 },
    ],
  },
  {
    name: "Pass / Fail",
    badge: "Screening",
    options: [
      {
        code: "PASS",
        label: "Pass / Criteria Met",
        nciCode: "C48288",
        order: 1,
      },
      {
        code: "FAIL",
        label: "Fail / Criteria Not Met",
        nciCode: "C48289",
        order: 2,
      },
    ],
  },
  {
    name: "Device Status",
    badge: "ISO 14155",
    options: [
      {
        code: "ACTIVE",
        label: "Implanted & Active In-Situ",
        nciCode: "C112034",
        order: 1,
      },
      {
        code: "EXPLANTED",
        label: "Explanted / Removed",
        nciCode: "C112029",
        order: 2,
      },
      {
        code: "DEPLOY_FAILED",
        label: "Deployment Failed / Discarded",
        nciCode: "C112035",
        order: 3,
      },
    ],
  },
  {
    name: "CTCAE Grade 1-5",
    badge: "Oncology",
    options: [
      { code: "GRADE 1", label: "Grade 1 - Mild", nciCode: "C48275", order: 1 },
      {
        code: "GRADE 2",
        label: "Grade 2 - Moderate",
        nciCode: "C48276",
        order: 2,
      },
      {
        code: "GRADE 3",
        label: "Grade 3 - Severe",
        nciCode: "C48277",
        order: 3,
      },
      {
        code: "GRADE 4",
        label: "Grade 4 - Life-Threatening",
        nciCode: "C48278",
        order: 4,
      },
      {
        code: "GRADE 5",
        label: "Grade 5 - Death",
        nciCode: "C48279",
        order: 5,
      },
    ],
  },
];

export const FieldPropertiesTab: React.FC<FieldPropertiesTabProps> = ({
  field,
  allFieldsInForm,
  codelists,
  onUpdateField,
  onSaveToStudyCodelist,
  onRenameEverywhere,
  onCommitReviewTargetChange,
}) => {
  const isCodelistField =
    field.dataType === "single_select" ||
    field.dataType === "radio" ||
    field.dataType === "multi_select";

  const hasCustomOptions = !!(
    field.customOptions && field.customOptions.length > 0
  );
  const [optionMode, setOptionMode] = useState<"standard" | "custom">(
    hasCustomOptions ? "custom" : "standard"
  );
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const toast = useToast();
  const [renameSuccess, setRenameSuccess] = useState<string | null>(null);
  const [variableNameDraft, setVariableNameDraft] = useState(
    field.variableName
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVariableNameDraft(field.variableName);
  }, [field.id, field.variableName]);

  // Active options list (custom or resolved from codelist)
  const currentCodelist = codelists.find((cl) => cl.id === field.codelistId);
  const currentOptions: CodelistOption[] =
    field.customOptions || currentCodelist?.options || [];

  const handleSetOptionMode = (mode: "standard" | "custom") => {
    setOptionMode(mode);
    if (mode === "custom") {
      // If switching to custom and no custom options exist yet, clone existing codelist options or create defaults
      if (!field.customOptions || field.customOptions.length === 0) {
        if (currentCodelist && currentCodelist.options.length > 0) {
          onUpdateField({
            customOptions: currentCodelist.options.map((opt) => ({ ...opt })),
            codelistId: undefined,
          });
        } else {
          onUpdateField({
            customOptions: [
              { code: "OPT_1", label: "Option 1", order: 1 },
              { code: "OPT_2", label: "Option 2", order: 2 },
            ],
            codelistId: undefined,
          });
        }
      }
    } else {
      // Switching to standard
      if (!field.codelistId && codelists.length > 0) {
        onUpdateField({
          codelistId: codelists[0].id,
          customOptions: undefined,
        });
      }
    }
  };

  const handleAddOption = () => {
    const nextOrder = (field.customOptions?.length || 0) + 1;
    const newOption: CodelistOption = {
      code: `OPT_${nextOrder}`,
      label: `Option ${nextOrder}`,
      order: nextOrder,
    };
    const updated = [...(field.customOptions || []), newOption];
    onUpdateField({ customOptions: updated });
  };

  const handleUpdateOptionItem = (
    index: number,
    updates: Partial<CodelistOption>
  ) => {
    if (!field.customOptions) return;
    const updated = field.customOptions.map((opt, i) =>
      i === index ? { ...opt, ...updates } : opt
    );
    onUpdateField({ customOptions: updated });
  };

  const handleDeleteOptionItem = (index: number) => {
    if (!field.customOptions) return;
    const updated = field.customOptions
      .filter((_, i) => i !== index)
      .map((opt, i) => ({ ...opt, order: i + 1 }));
    onUpdateField({ customOptions: updated });
  };

  const handleMoveOption = (index: number, direction: -1 | 1) => {
    if (!field.customOptions) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= field.customOptions.length) return;

    const list = [...field.customOptions];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const reordered = list.map((opt, i) => ({ ...opt, order: i + 1 }));
    onUpdateField({ customOptions: reordered });
  };

  const handleApplyTemplate = (tpl: QuickTemplate) => {
    onUpdateField({
      customOptions: tpl.options.map((opt) => ({ ...opt })),
      codelistId: undefined,
    });
    setOptionMode("custom");
  };

  const handleApplyBulkText = () => {
    if (!bulkInput.trim()) return;

    // Split by newlines or commas
    const lines = bulkInput
      .split(/[\n,]/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    const generated: CodelistOption[] = lines.map((line, idx) => {
      // Create a clean submission code (alphanumeric uppercase with underscores)
      const sanitizedCode =
        line
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "")
          .slice(0, 16) || `OPT_${idx + 1}`;

      return {
        code: sanitizedCode,
        label: line,
        order: idx + 1,
      };
    });

    onUpdateField({
      customOptions: generated,
      codelistId: undefined,
    });
    setOptionMode("custom");
    setBulkInput("");
    setIsBulkOpen(false);
  };

  const handleSaveAsStudyCodelist = () => {
    if (
      !field.customOptions ||
      field.customOptions.length === 0 ||
      !onSaveToStudyCodelist
    )
      return;

    const codelistId = generateId(
      `CL_${field.variableName || "CUSTOM"}_`
    ).toUpperCase();
    const newCodelist: CodelistDefinition = {
      id: codelistId,
      name: `${field.label || field.variableName} (${field.customOptions.length} Options)`,
      options: field.customOptions.map((opt) => ({ ...opt })),
      isStandard: false,
    };

    onSaveToStudyCodelist(newCodelist);
    onUpdateField({
      codelistId: newCodelist.id,
      customOptions: undefined,
    });
    setOptionMode("standard");
    toast.success(`Saved as study codelist "${newCodelist.name}"!`);
  };

  const varValidation = validateCdashVariableName(variableNameDraft);

  return (
    <div className="space-y-4 p-4 text-xs font-sans">
      {/* Variable Name & Display Label */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[11px] font-mono text-zinc-400">
            CDASH / SDTM Variable Name{" "}
            <span className="text-brand-cyan">*</span>
          </label>
          <span className="text-[10px] font-mono text-zinc-500">
            {variableNameDraft.length}/8 chars
          </span>
        </div>
        <input
          type="text"
          maxLength={8}
          value={variableNameDraft}
          onChange={(e) => setVariableNameDraft(e.target.value.toUpperCase())}
          className={`w-full px-2.5 py-1.5 bg-zinc-950 border rounded-lg text-white font-mono uppercase focus:outline-none ${
            !varValidation.isValid && variableNameDraft
              ? "border-red-500/70 focus:border-red-400 ring-1 ring-red-500/20"
              : "border-zinc-800 focus:border-brand-cyan"
          }`}
          placeholder="e.g. BRTHYR, SYSBP, AETERM, DITERM"
        />
        {!varValidation.isValid && variableNameDraft && (
          <p className="text-[10px] text-red-400 font-mono mt-1">
            ⚠ {varValidation.error}
          </p>
        )}
        {onRenameEverywhere && varValidation.isValid && variableNameDraft && (
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onRenameEverywhere(variableNameDraft);
                setRenameSuccess("Renamed everywhere");
                setTimeout(() => setRenameSuccess(null), 3000);
              }}
              className="px-2 py-0.5 rounded bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 text-[10px] font-mono text-brand-cyan flex items-center gap-1 transition-colors"
              title="Atomically updates variable name and all AST rules, conditions, and formulas"
            >
              <span>Rename Everywhere (Atomic)</span>
            </button>
            {renameSuccess && (
              <span className="text-[10px] font-mono text-emerald-400 animate-in fade-in">
                ✓ {renameSuccess}
              </span>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-[11px] font-mono text-zinc-400 mb-1">
          Question Text / Form Label <span className="text-brand-cyan">*</span>
        </label>
        <input
          type="text"
          value={field.label}
          onChange={(e) => onUpdateField({ label: e.target.value })}
          onBlur={onCommitReviewTargetChange}
          className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-sans focus:border-brand-cyan focus:outline-none"
          placeholder="e.g. Primary Device Deficiency Classification"
        />
      </div>

      <div>
        <label className="block text-[11px] font-mono text-zinc-400 mb-1">
          Instruction / Clinical Description
        </label>
        <textarea
          rows={2}
          value={field.description || ""}
          onChange={(e) => onUpdateField({ description: e.target.value })}
          className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 font-sans focus:border-brand-cyan focus:outline-none resize-none"
          placeholder="e.g. Select the primary reason observed during procedure."
        />
      </div>

      {/* Data Type & Grid Width */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-mono text-zinc-400 mb-1">
            Data Type
          </label>
          <select
            value={field.dataType}
            onChange={(e) =>
              onUpdateField({ dataType: e.target.value as ClinicalDataType })
            }
            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-sans focus:border-brand-cyan focus:outline-none"
          >
            {DATA_TYPES.map((dt) => (
              <option key={dt.type} value={dt.type}>
                {dt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono text-zinc-400 mb-1">
            Grid Width ({field.columnSpan}/12)
          </label>
          <select
            value={field.columnSpan}
            onChange={(e) =>
              onUpdateField({ columnSpan: parseInt(e.target.value, 10) })
            }
            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono focus:border-brand-cyan focus:outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((col) => (
              <option key={col} value={col}>
                {col}{" "}
                {col === 12
                  ? "(Full Width)"
                  : col === 6
                    ? "(Half Width)"
                    : col === 4
                      ? "(1/3 Width)"
                      : "cols"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3-Tier Missing Data Engine */}
      <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-mono text-zinc-300 font-bold uppercase">
            3-Tier Missing Data Engine
          </label>
          <span className="text-[10px] font-mono text-brand-cyan">
            {field.requirementTier ||
              (field.required ? "hard_stop" : "optional")}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() =>
              onUpdateField({ requirementTier: "optional", required: false })
            }
            className={`px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all border ${
              field.requirementTier === "optional" ||
              (!field.requirementTier && !field.required)
                ? "bg-zinc-800 text-white border-zinc-600 shadow-sm"
                : "bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200"
            }`}
          >
            Optional
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateField({ requirementTier: "hard_stop", required: true })
            }
            className={`px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all border ${
              field.requirementTier === "hard_stop" ||
              (!field.requirementTier && field.required)
                ? "bg-red-500/20 text-red-300 border-red-500/40 shadow-sm"
                : "bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-red-300"
            }`}
          >
            Hard Stop
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateField({ requirementTier: "auto_query", required: true })
            }
            className={`px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all border ${
              field.requirementTier === "auto_query"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm"
                : "bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-amber-300"
            }`}
          >
            Auto-Query
          </button>
        </div>

        <p className="text-[10px] text-zinc-400 leading-normal">
          {field.requirementTier === "auto_query"
            ? "Allows form save when empty, but registers an open EDC discrepancy query ticket."
            : field.requirementTier === "hard_stop" ||
                (!field.requirementTier && field.required)
              ? "Mandatory variable. Physically blocks saving form with red error border if empty."
              : "Optional variable. May be left blank without errors or queries."}
        </p>

        <div className="pt-1 flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={field.readOnly || false}
              onChange={(e) => onUpdateField({ readOnly: e.target.checked })}
              className="rounded border-zinc-700 bg-zinc-900 text-brand-cyan focus:ring-0"
            />
            <span className="text-xs text-zinc-300">Read-Only</span>
          </label>
        </div>
      </div>

      {/* Precision Date Controls */}
      {(field.dataType === "precision_date" ||
        field.dataType === "date" ||
        field.dataType === "partial_date") && (
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-2.5">
          <div className="text-[11px] font-mono text-zinc-300 font-bold uppercase flex items-center justify-between">
            <span>Precision Date Controls</span>
            <span className="text-[10px] text-brand-cyan">ISO 8601</span>
          </div>
          <div className="space-y-2">
            <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700">
              <div>
                <span className="text-xs text-zinc-200 block font-medium">
                  Allow Partial Dates
                </span>
                <span className="text-[10px] text-zinc-400">
                  Permit missing/unknown day or month (e.g. 2026-08-UNK,
                  2026-UNK-UNK)
                </span>
              </div>
              <input
                type="checkbox"
                checked={
                  field.allowPartial ??
                  (field.dataType === "partial_date" ||
                    field.dataType === "precision_date")
                }
                onChange={(e) =>
                  onUpdateField({ allowPartial: e.target.checked })
                }
                className="rounded border-zinc-700 bg-zinc-900 text-brand-cyan focus:ring-0 ml-2"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700">
              <div>
                <span className="text-xs text-zinc-200 block font-medium">
                  Prevent Future Dates
                </span>
                <span className="text-[10px] text-zinc-400">
                  Enforce boundary check against current UTC timestamp
                </span>
              </div>
              <input
                type="checkbox"
                checked={field.preventFutureDate ?? false}
                onChange={(e) =>
                  onUpdateField({ preventFutureDate: e.target.checked })
                }
                className="rounded border-zinc-700 bg-zinc-900 text-brand-cyan focus:ring-0 ml-2"
              />
            </label>
          </div>
        </div>
      )}

      {/* Clinical Governance & Null Flavors */}
      <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-2.5">
        <div className="text-[11px] font-mono text-zinc-300 font-bold uppercase">
          Clinical Governance &amp; Null Flavors
        </div>
        <div className="space-y-2">
          <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700">
            <div>
              <span className="text-xs text-zinc-200 block font-medium">
                Allow CDISC Null Flavors
              </span>
              <span className="text-[10px] text-zinc-400">
                Attach compact ND (Not Done), NA (Not Applicable), UNK (Unknown)
                badges
              </span>
            </div>
            <input
              type="checkbox"
              checked={field.allowNullFlavor ?? false}
              onChange={(e) =>
                onUpdateField({ allowNullFlavor: e.target.checked })
              }
              className="rounded border-zinc-700 bg-zinc-900 text-brand-cyan focus:ring-0 ml-2"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700">
            <div>
              <span className="text-xs text-zinc-200 block font-medium">
                Requires SDV (CRA Monitor)
              </span>
              <span className="text-[10px] text-zinc-400">
                Flag variable for mandatory Source Document Verification audit
              </span>
            </div>
            <input
              type="checkbox"
              checked={field.requiresSdv ?? false}
              onChange={(e) => onUpdateField({ requiresSdv: e.target.checked })}
              className="rounded border-zinc-700 bg-zinc-900 text-brand-cyan focus:ring-0 ml-2"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700">
            <div>
              <span className="text-xs text-zinc-200 block font-medium">
                Blinded Variable
              </span>
              <span className="text-[10px] text-zinc-400">
                Mask observation from sponsor roles until database lock
              </span>
            </div>
            <input
              type="checkbox"
              checked={field.isBlinded ?? false}
              onChange={(e) => onUpdateField({ isBlinded: e.target.checked })}
              className="rounded border-zinc-700 bg-zinc-900 text-brand-cyan focus:ring-0 ml-2"
            />
          </label>
        </div>
      </div>

      {/* Specific Properties for Numeric Fields */}
      {(field.dataType === "number" ||
        field.dataType === "integer" ||
        field.dataType === "calculated") && (
        <div className="space-y-3 pt-2 border-t border-zinc-850">
          <div className="text-[11px] font-mono text-zinc-400 font-semibold uppercase">
            Numeric Boundaries &amp; Units
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-mono text-zinc-500 mb-1">
                Unit
              </label>
              <input
                type="text"
                value={field.unit || ""}
                onChange={(e) => onUpdateField({ unit: e.target.value })}
                className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-white font-mono"
                placeholder="mmHg, kg, °C"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-zinc-500 mb-1">
                Min Value
              </label>
              <input
                type="number"
                value={field.minValue !== undefined ? field.minValue : ""}
                onChange={(e) =>
                  onUpdateField({
                    minValue:
                      e.target.value === ""
                        ? undefined
                        : parseFloat(e.target.value),
                  })
                }
                className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-white font-mono"
                placeholder="None"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-zinc-500 mb-1">
                Max Value
              </label>
              <input
                type="number"
                value={field.maxValue !== undefined ? field.maxValue : ""}
                onChange={(e) =>
                  onUpdateField({
                    maxValue:
                      e.target.value === ""
                        ? undefined
                        : parseFloat(e.target.value),
                  })
                }
                className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-white font-mono"
                placeholder="None"
              />
            </div>
          </div>
        </div>
      )}

      {/* RICH QUESTION OPTIONS BUILDER (Radio, Single Select, Multi Select) */}
      {isCodelistField && (
        <div className="space-y-3 pt-3 border-t border-zinc-850">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-white font-bold uppercase flex items-center gap-1.5">
              <IconListDetails className="w-3.5 h-3.5 text-brand-cyan" />
              <span>Options &amp; Terminology</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              {currentOptions.length} choice
              {currentOptions.length === 1 ? "" : "s"}
            </span>
          </div>

          {/* Source Switcher: Standard vs Custom */}
          <div className="flex rounded-lg p-0.5 bg-zinc-900 border border-zinc-800">
            <button
              onClick={() => handleSetOptionMode("standard")}
              className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-mono font-medium transition-all ${
                optionMode === "standard"
                  ? "bg-zinc-800 text-brand-cyan shadow-sm font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Standard Codelist
            </button>
            <button
              onClick={() => handleSetOptionMode("custom")}
              className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-mono font-medium transition-all ${
                optionMode === "custom"
                  ? "bg-zinc-800 text-brand-cyan shadow-sm font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Custom Options ({field.customOptions?.length || 0})
            </button>
          </div>

          {/* STANDARD CODELIST SELECTOR */}
          {optionMode === "standard" && (
            <div className="space-y-2 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-850">
              <label className="block text-[10px] font-mono text-zinc-400">
                Select Controlled Codelist Library
              </label>
              <select
                value={field.codelistId || ""}
                onChange={(e) => {
                  onUpdateField({
                    codelistId: e.target.value || undefined,
                    customOptions: undefined,
                  });
                }}
                className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-750 rounded-lg text-white font-sans text-xs focus:border-brand-cyan focus:outline-none"
              >
                <option value="">-- Choose Standard / Study Codelist --</option>
                {codelists.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name} ({cl.options.length} options){" "}
                    {cl.isStandard ? "[CDISC]" : "[Custom]"}
                  </option>
                ))}
              </select>

              {currentCodelist && (
                <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>Preview Choices:</span>
                    <button
                      onClick={() => handleSetOptionMode("custom")}
                      className="text-brand-cyan hover:underline"
                    >
                      Clone &amp; Customize
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {currentCodelist.options.map((opt) => (
                      <span
                        key={opt.code}
                        className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 font-sans"
                      >
                        {opt.label}{" "}
                        <code className="text-zinc-500">({opt.code})</code>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CUSTOM OPTIONS BUILDER */}
          {optionMode === "custom" && (
            <div className="space-y-3">
              {/* Quick Template Buttons */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <IconSparkles className="w-3 h-3 text-brand-cyan" />
                  <span>Quick-Insert Templates</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      onClick={() => handleApplyTemplate(tpl)}
                      className="px-2 py-1 rounded-md bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-brand-cyan/40 text-[10px] font-sans text-zinc-300 hover:text-white transition-all flex items-center gap-1"
                      title={`Load ${tpl.options.length} options for ${tpl.name}`}
                    >
                      <span>{tpl.name}</span>
                      <span className="text-[9px] font-mono text-brand-cyan/80 bg-brand-cyan/10 px-1 rounded">
                        {tpl.options.length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bulk Text Import Drawer */}
              <div className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-850 space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setIsBulkOpen(!isBulkOpen)}
                    className="text-[10px] font-mono text-zinc-400 hover:text-brand-cyan flex items-center gap-1 transition-colors"
                  >
                    <IconClipboardText className="w-3 h-3 text-brand-cyan" />
                    <span>
                      {isBulkOpen
                        ? "Hide Bulk Paste Tool"
                        : "Bulk Paste Options (Line/Comma List)"}
                    </span>
                  </button>
                </div>

                {isBulkOpen && (
                  <div className="space-y-1.5 pt-1 animate-in fade-in">
                    <textarea
                      rows={3}
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      placeholder="Paste options here, e.g.:&#10;Mild&#10;Moderate&#10;Severe&#10;or: Option A, Option B, Option C"
                      className="w-full px-2 py-1.5 text-xs bg-zinc-900 border border-zinc-750 rounded text-white font-sans focus:border-brand-cyan focus:outline-none resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsBulkOpen(false)}
                        className="px-2 py-1 text-[10px] font-mono text-zinc-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleApplyBulkText}
                        disabled={!bulkInput.trim()}
                        className="px-2.5 py-1 rounded bg-brand-cyan/20 hover:bg-brand-cyan text-brand-cyan hover:text-black font-mono text-[10px] font-bold border border-brand-cyan/40 transition-all disabled:opacity-40"
                      >
                        Apply Bulk Options
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Interactive Rows Editor */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-12 gap-1 text-[9px] font-mono text-zinc-400 uppercase px-1">
                  <span className="col-span-1 text-center">#</span>
                  <span className="col-span-5">Display Label</span>
                  <span className="col-span-3">SDTM Code</span>
                  <span className="col-span-2">NCI Code</span>
                  <span className="col-span-1 text-right">Act</span>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                  {(field.customOptions || []).map((opt, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-1 items-center p-1 rounded-md bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition-colors"
                    >
                      <span className="col-span-1 text-center font-mono text-[10px] text-zinc-500 font-bold">
                        {opt.order || idx + 1}
                      </span>
                      <input
                        type="text"
                        value={opt.label}
                        onChange={(e) =>
                          handleUpdateOptionItem(idx, { label: e.target.value })
                        }
                        className="col-span-5 px-1.5 py-1 text-[11px] bg-zinc-950 border border-zinc-800 rounded text-white font-sans focus:border-brand-cyan focus:outline-none"
                        placeholder="Choice Label"
                      />
                      <input
                        type="text"
                        value={opt.code}
                        onChange={(e) =>
                          handleUpdateOptionItem(idx, {
                            code: e.target.value.toUpperCase(),
                          })
                        }
                        className="col-span-3 px-1.5 py-1 text-[10px] bg-zinc-950 border border-zinc-800 rounded text-brand-cyan font-mono uppercase focus:border-brand-cyan focus:outline-none"
                        placeholder="CODE"
                      />
                      <input
                        type="text"
                        value={opt.nciCode || ""}
                        onChange={(e) =>
                          handleUpdateOptionItem(idx, {
                            nciCode: e.target.value.toUpperCase(),
                          })
                        }
                        className="col-span-2 px-1 py-1 text-[9px] bg-zinc-950 border border-zinc-800 rounded text-zinc-400 font-mono uppercase focus:border-brand-cyan focus:outline-none"
                        placeholder="C-Code"
                      />
                      <div className="col-span-1 flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => handleMoveOption(idx, -1)}
                          disabled={idx === 0}
                          className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-20"
                          title="Move Up"
                        >
                          <IconArrowUp className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => handleMoveOption(idx, 1)}
                          disabled={
                            idx === (field.customOptions?.length || 0) - 1
                          }
                          className="p-0.5 text-zinc-500 hover:text-white disabled:opacity-20"
                          title="Move Down"
                        >
                          <IconArrowDown className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteOptionItem(idx)}
                          className="p-0.5 text-zinc-500 hover:text-red-400 transition-colors"
                          title="Delete Choice"
                        >
                          <IconTrash className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {(!field.customOptions ||
                    field.customOptions.length === 0) && (
                    <div className="text-center p-3 rounded-lg border border-dashed border-zinc-800 text-zinc-500 text-[11px]">
                      No custom choices defined yet. Click &quot;Add
                      Option&quot; or select a template above.
                    </div>
                  )}
                </div>

                {/* Option Builder Controls */}
                <div className="flex items-center justify-between pt-1 gap-2">
                  <button
                    onClick={handleAddOption}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-brand-cyan border border-zinc-750 text-[11px] font-mono font-medium transition-colors"
                  >
                    <IconPlus className="w-3 h-3" />
                    <span>Add Option</span>
                  </button>

                  {onSaveToStudyCodelist &&
                    (field.customOptions?.length || 0) > 0 && (
                      <button
                        onClick={handleSaveAsStudyCodelist}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-brand-cyan/15 hover:bg-brand-cyan/25 text-brand-cyan border border-brand-cyan/40 text-[10px] font-mono font-bold transition-all"
                        title="Promote these choices into a reusable study-level controlled codelist"
                      >
                        <IconDeviceFloppy className="w-3 h-3" />
                        <span>Save to Study Codelists</span>
                      </button>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dynamic AST Formula Builder for Calculated Fields */}
      {field.dataType === "calculated" && (
        <div className="pt-2 border-t border-zinc-850">
          <AstRuleEditor
            formula={field.calculationFormula || ""}
            onChange={(newFormula) =>
              onUpdateField({ calculationFormula: newFormula })
            }
            fields={allFieldsInForm}
            currentFieldId={field.id}
          />
        </div>
      )}

      {/* VAS scale labels */}
      {field.dataType === "vas_scale" && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-850">
          <div>
            <label className="block text-[10px] font-mono text-zinc-500 mb-1">
              Min Label (0mm)
            </label>
            <input
              type="text"
              value={field.scaleMinLabel || ""}
              onChange={(e) => onUpdateField({ scaleMinLabel: e.target.value })}
              className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-white"
              placeholder="e.g. No Pain"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono text-zinc-500 mb-1">
              Max Label (100mm)
            </label>
            <input
              type="text"
              value={field.scaleMaxLabel || ""}
              onChange={(e) => onUpdateField({ scaleMaxLabel: e.target.value })}
              className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-white"
              placeholder="e.g. Worst Pain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
