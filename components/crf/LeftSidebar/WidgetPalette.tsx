"use client";

import React from "react";
import {
  IconTypography,
  Icon123,
  IconCalendar,
  IconClock,
  IconListDetails,
  IconCheckbox,
  IconAdjustmentsHorizontal,
  IconMathFunction,
  IconWriting,
  IconPlus,
} from "@tabler/icons-react";
import { ClinicalDataType, CRFField } from "@/lib/crf/types";
import { generateId } from "@/lib/utils";

interface WidgetItem {
  type: ClinicalDataType;
  label: string;
  category: "inputs" | "timing" | "codelists" | "clinical";
  icon: React.ReactNode;
  defaultField: Partial<CRFField>;
}

const WIDGETS: WidgetItem[] = [
  {
    type: "text",
    label: "Single-Line Text",
    category: "inputs",
    icon: <IconTypography className="w-4 h-4 text-sky-400" />,
    defaultField: {
      label: "Text Question",
      variableName: "TEXT_Q",
      columnSpan: 6,
      required: false,
      placeholder: "Enter value...",
    },
  },
  {
    type: "textarea",
    label: "Multiline Text",
    category: "inputs",
    icon: <IconTypography className="w-4 h-4 text-sky-400" />,
    defaultField: {
      label: "Clinical Narrative / Description",
      variableName: "NARRATIVE",
      columnSpan: 12,
      required: false,
      placeholder: "Enter detailed clinical notes...",
    },
  },
  {
    type: "number",
    label: "Decimal Number",
    category: "inputs",
    icon: <Icon123 className="w-4 h-4 text-emerald-400" />,
    defaultField: {
      label: "Numeric Finding",
      variableName: "NUM_VAL",
      columnSpan: 4,
      required: false,
      unit: "units",
    },
  },
  {
    type: "integer",
    label: "Integer Count",
    category: "inputs",
    icon: <Icon123 className="w-4 h-4 text-emerald-400" />,
    defaultField: {
      label: "Integer Count",
      variableName: "INT_VAL",
      columnSpan: 4,
      required: false,
      minValue: 0,
    },
  },
  {
    type: "date",
    label: "Standard Date",
    category: "timing",
    icon: <IconCalendar className="w-4 h-4 text-amber-400" />,
    defaultField: {
      label: "Assessment Date",
      variableName: "ASS_DAT",
      columnSpan: 4,
      required: true,
    },
  },
  {
    type: "precision_date",
    label: "Precision Date (Segmented / ISO)",
    category: "timing",
    icon: <IconCalendar className="w-4 h-4 text-brand-cyan" />,
    defaultField: {
      label: "Clinical Event Date (Precision ISO)",
      variableName: "EVNT_DAT",
      columnSpan: 6,
      required: true,
      allowPartial: true,
      preventFutureDate: true,
      allowNullFlavor: true,
      requirementTier: "hard_stop",
    },
  },
  {
    type: "partial_date",
    label: "Partial Date (UN-UNK-YYYY)",
    category: "timing",
    icon: <IconCalendar className="w-4 h-4 text-amber-400" />,
    defaultField: {
      label: "Onset / Historical Date (Partial Allowed)",
      variableName: "ONSET_DAT",
      columnSpan: 6,
      required: false,
      placeholder: "e.g. UNK-JUN-2023 or 2024",
    },
  },
  {
    type: "datetime",
    label: "Date & Time Stamp",
    category: "timing",
    icon: <IconClock className="w-4 h-4 text-amber-400" />,
    defaultField: {
      label: "Sample Collection Timestamp",
      variableName: "COL_DTC",
      columnSpan: 6,
      required: true,
    },
  },
  {
    type: "radio",
    label: "Radio Button Group",
    category: "codelists",
    icon: <IconListDetails className="w-4 h-4 text-purple-400" />,
    defaultField: {
      label: "Custom Multiple Choice (Radio)",
      variableName: "RADIO_Q",
      columnSpan: 6,
      required: true,
      customOptions: [
        { code: "OPT_1", label: "Option 1", order: 1 },
        { code: "OPT_2", label: "Option 2", order: 2 },
      ],
    },
  },
  {
    type: "single_select",
    label: "Dropdown Select",
    category: "codelists",
    icon: <IconListDetails className="w-4 h-4 text-purple-400" />,
    defaultField: {
      label: "Custom Dropdown Question",
      variableName: "SELECT_Q",
      columnSpan: 6,
      required: true,
      customOptions: [
        { code: "CHOICE_A", label: "Choice A", order: 1 },
        { code: "CHOICE_B", label: "Choice B", order: 2 },
        { code: "CHOICE_C", label: "Choice C", order: 3 },
      ],
    },
  },
  {
    type: "multi_select",
    label: "Multi-Select Choices",
    category: "codelists",
    icon: <IconCheckbox className="w-4 h-4 text-purple-400" />,
    defaultField: {
      label: "Multi-Select Options",
      variableName: "MULTI_Q",
      columnSpan: 6,
      required: false,
      customOptions: [
        { code: "ITEM_1", label: "Item 1", order: 1 },
        { code: "ITEM_2", label: "Item 2", order: 2 },
        { code: "ITEM_3", label: "Item 3", order: 3 },
      ],
    },
  },
  {
    type: "checkbox",
    label: "Single Checkbox Flag",
    category: "codelists",
    icon: <IconCheckbox className="w-4 h-4 text-purple-400" />,
    defaultField: {
      label: "Event is Ongoing",
      variableName: "IS_ONGOING",
      columnSpan: 4,
      required: false,
    },
  },
  {
    type: "calculated",
    label: "Calculated Field (AST Formula)",
    category: "clinical",
    icon: <IconMathFunction className="w-4 h-4 text-brand-cyan" />,
    defaultField: {
      label: "Calculated Clinical Metric",
      variableName: "CALC_METRIC",
      columnSpan: 6,
      required: false,
      readOnly: true,
      calculationFormula: "f_weight / ((f_height/100) * (f_height/100))",
      unit: "units",
    },
  },
  {
    type: "vas_scale",
    label: "Visual Analog Scale (VAS 0-100mm)",
    category: "clinical",
    icon: <IconAdjustmentsHorizontal className="w-4 h-4 text-brand-cyan" />,
    defaultField: {
      label: "Patient Reported Pain / Severity VAS (0-100 mm)",
      variableName: "VAS_SCORE",
      columnSpan: 12,
      required: true,
      minValue: 0,
      maxValue: 100,
      scaleMinLabel: "No Pain (0 mm)",
      scaleMaxLabel: "Worst Possible Pain (100 mm)",
    },
  },
  {
    type: "signature",
    label: "21 CFR Part 11 Electronic Signature",
    category: "clinical",
    icon: <IconWriting className="w-4 h-4 text-rose-400" />,
    defaultField: {
      label: "Principal Investigator Approval & Attestation",
      variableName: "INV_SIGN",
      columnSpan: 12,
      required: true,
    },
  },
];

function generateFieldId(type: string): string {
  return generateId(`f_${type}`);
}

interface WidgetPaletteProps {
  onAddField: (field: CRFField) => void;
}

export const WidgetPalette: React.FC<WidgetPaletteProps> = ({ onAddField }) => {
  const categories = [
    { key: "clinical", label: "Specialized Clinical" },
    { key: "codelists", label: "Codelists & Selectors" },
    { key: "inputs", label: "Standard Inputs" },
    { key: "timing", label: "Timing & Dates" },
  ] as const;

  const handleAdd = (widget: WidgetItem) => {
    const newField: CRFField = {
      id: generateFieldId(widget.type),
      variableName: widget.defaultField.variableName || "FIELD",
      label: widget.defaultField.label || "New Question",
      dataType: widget.type,
      columnSpan: widget.defaultField.columnSpan || 6,
      required: !!widget.defaultField.required,
      readOnly: widget.defaultField.readOnly,
      placeholder: widget.defaultField.placeholder,
      unit: widget.defaultField.unit,
      minValue: widget.defaultField.minValue,
      maxValue: widget.defaultField.maxValue,
      codelistId: widget.defaultField.codelistId,
      customOptions: widget.defaultField.customOptions
        ? widget.defaultField.customOptions.map((o) => ({ ...o }))
        : undefined,
      calculationFormula: widget.defaultField.calculationFormula,
      scaleMinLabel: widget.defaultField.scaleMinLabel,
      scaleMaxLabel: widget.defaultField.scaleMaxLabel,
    };
    onAddField(newField);
  };

  return (
    <div className="space-y-4">
      <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold px-1">
        Clinical Field Palette
      </div>

      {categories.map((cat) => {
        const items = WIDGETS.filter((w) => w.category === cat.key);
        return (
          <div key={cat.key} className="space-y-1.5">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest px-1">
              {cat.label}
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {items.map((widget) => (
                <button
                  key={widget.type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/json",
                      JSON.stringify({
                        type: "widget",
                        widgetType: widget.type,
                        defaultField: widget.defaultField,
                      })
                    );
                    e.dataTransfer.setData(
                      "text/plain",
                      JSON.stringify({
                        type: "widget",
                        widgetType: widget.type,
                        defaultField: widget.defaultField,
                      })
                    );
                  }}
                  onClick={() => handleAdd(widget)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80 hover:border-brand-cyan/40 hover:bg-zinc-900 text-left transition-all group cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="p-1 rounded bg-zinc-900 border border-zinc-800 group-hover:border-zinc-700 transition-colors">
                      {widget.icon}
                    </span>
                    <span className="text-xs font-medium text-zinc-300 group-hover:text-white truncate">
                      {widget.label}
                    </span>
                  </div>
                  <IconPlus className="w-3.5 h-3.5 text-zinc-600 group-hover:text-brand-cyan transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
