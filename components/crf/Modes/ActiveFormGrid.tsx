"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  CRFForm,
  CRFField,
  StudyProtocol,
  StudioMode,
  ClinicalDataType,
  StudyProtocolEngine,
  StudyReviewActor,
  validateCdashVariableName,
} from "@/lib/crf";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  IconLayoutGrid,
  IconPlus,
  IconClipboard,
  IconCheck,
  IconAlertTriangle,
  IconX,
  IconSparkles,
  IconTable,
} from "@tabler/icons-react";

interface ActiveFormGridProps {
  form: CRFForm;
  study: StudyProtocol;
  selectedFieldId: string | null;
  onSelectField: (fieldId: string | null) => void;
  onUpdateField: (fieldId: string, updates: Partial<CRFField>) => void;
  onCommitReviewTargetChange?: (
    fieldId: string,
    updates?: Partial<CRFField>
  ) => void;
  onRenameEverywhere?: (fieldId: string, newVarName: string) => void;
  onUpdateStudy: (updatedStudy: StudyProtocol) => void;
  onSwitchMode?: (mode: StudioMode) => void;
  onAddField?: (sectionId?: string) => void;
  reviewAuthor?: StudyReviewActor;
}

type GridColumnKey =
  | "id"
  | "variableName"
  | "label"
  | "dataType"
  | "sectionId"
  | "required"
  | "unit"
  | "columnSpan"
  | "codelistId"
  | "acrfAnnotation";

interface GridColumnDef {
  key: GridColumnKey;
  label: string;
  width: string;
  editable: boolean;
  type: "text" | "select" | "boolean" | "number" | "readonly";
  options?: { value: string; label: string }[];
}

interface GridRowData {
  field: CRFField;
  sectionId: string;
  sectionTitle: string;
}

interface CellUpdate {
  rowIndex: number;
  colIndex: number;
  fieldId: string;
  fieldVar: string;
  colKey: GridColumnKey;
  colLabel: string;
  oldValue: string;
  newValue: string;
  isValid: boolean;
  error?: string;
}

const DATA_TYPE_OPTIONS: { value: ClinicalDataType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Text Area" },
  { value: "number", label: "Number (Decimal)" },
  { value: "integer", label: "Integer" },
  { value: "date", label: "Date (ISO)" },
  { value: "partial_date", label: "Partial Date" },
  { value: "precision_date", label: "Precision Date" },
  { value: "time", label: "Time" },
  { value: "datetime", label: "Date & Time" },
  { value: "single_select", label: "Single Select" },
  { value: "multi_select", label: "Multi Select" },
  { value: "radio", label: "Radio Group" },
  { value: "checkbox", label: "Checkbox Group" },
  { value: "calculated", label: "Calculated Formula" },
  { value: "repeating_table", label: "Repeating Table" },
  { value: "signature", label: "e-Signature" },
];

export const ActiveFormGrid: React.FC<ActiveFormGridProps> = ({
  form,
  study,
  selectedFieldId,
  onSelectField,
  onUpdateField,
  onCommitReviewTargetChange,
  onRenameEverywhere,
  onUpdateStudy,
  onSwitchMode,
  onAddField,
  reviewAuthor,
}) => {
  // Flatten form sections into rows
  const rows: GridRowData[] = React.useMemo(() => {
    if (!form || !form.sections) return [];
    const list: GridRowData[] = [];
    form.sections.forEach((sec) => {
      sec.fields.forEach((fld) => {
        list.push({
          field: fld,
          sectionId: sec.id,
          sectionTitle: sec.title,
        });
      });
    });
    return list;
  }, [form]);

  // Dynamic Column Definitions
  const columns: GridColumnDef[] = React.useMemo(() => {
    const codelistOpts = [
      { value: "", label: "None (Raw Input)" },
      ...study.codelists.map((cl) => ({
        value: cl.id,
        label: `${cl.name} (${cl.options.length} items)`,
      })),
    ];

    const sectionOpts = form.sections.map((sec) => ({
      value: sec.id,
      label: sec.title,
    }));

    return [
      {
        key: "id",
        label: "Stable ID",
        width: "w-28",
        editable: false,
        type: "readonly",
      },
      {
        key: "variableName",
        label: "CDASH Variable",
        width: "w-36",
        editable: true,
        type: "text",
      },
      {
        key: "label",
        label: "Question Label",
        width: "w-64",
        editable: true,
        type: "text",
      },
      {
        key: "dataType",
        label: "Data Type",
        width: "w-40",
        editable: true,
        type: "select",
        options: DATA_TYPE_OPTIONS,
      },
      {
        key: "sectionId",
        label: "Section",
        width: "w-44",
        editable: true,
        type: "select",
        options: sectionOpts,
      },
      {
        key: "required",
        label: "Required",
        width: "w-24",
        editable: true,
        type: "boolean",
      },
      {
        key: "unit",
        label: "Unit",
        width: "w-28",
        editable: true,
        type: "text",
      },
      {
        key: "columnSpan",
        label: "Grid Span",
        width: "w-24",
        editable: true,
        type: "number",
      },
      {
        key: "codelistId",
        label: "Codelist",
        width: "w-48",
        editable: true,
        type: "select",
        options: codelistOpts,
      },
      {
        key: "acrfAnnotation",
        label: "External OID / aCRF",
        width: "w-44",
        editable: true,
        type: "text",
      },
    ];
  }, [study.codelists, form.sections]);

  // Focus & Editing State
  const [activeCell, setActiveCell] = useState<{
    rowIndex: number;
    colIndex: number;
  } | null>(null);

  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colIndex: number;
    value: string;
  } | null>(null);

  // Paste / Batch Modal state
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [rawPasteText, setRawPasteText] = useState("");
  const [pendingBatchUpdates, setPendingBatchUpdates] = useState<CellUpdate[]>(
    []
  );

  const pasteModalRef = useFocusTrap<HTMLDivElement>(pasteModalOpen, {
    onEscape: () => setPasteModalOpen(false),
  });

  const gridRef = useRef<HTMLDivElement>(null);

  // Sync activeCell row from selectedFieldId if external selection changes
  useEffect(() => {
    if (selectedFieldId && rows.length > 0) {
      const idx = rows.findIndex((r) => r.field.id === selectedFieldId);
      if (idx !== -1) {
        const handle = requestAnimationFrame(() => {
          setActiveCell((prev) => {
            if (prev && prev.rowIndex === idx) return prev;
            return {
              rowIndex: idx,
              colIndex: prev ? prev.colIndex : 1, // Default to variableName column
            };
          });
        });
        return () => cancelAnimationFrame(handle);
      }
    }
  }, [selectedFieldId, rows]);

  // Read cell value from row
  const getCellValue = useCallback(
    (row: GridRowData, colKey: GridColumnKey): string => {
      switch (colKey) {
        case "id":
          return row.field.id;
        case "variableName":
          return row.field.variableName || "";
        case "label":
          return row.field.label || "";
        case "dataType":
          return row.field.dataType || "text";
        case "sectionId":
          return row.sectionId || "";
        case "required":
          return row.field.required ? "true" : "false";
        case "unit":
          return row.field.unit || "";
        case "columnSpan":
          return String(row.field.columnSpan || 6);
        case "codelistId":
          return row.field.codelistId || "";
        case "acrfAnnotation":
          return row.field.cdashMetadata?.acrfAnnotation || "";
        default:
          return "";
      }
    },
    []
  );

  // Select cell handler
  const handleCellClick = (rIdx: number, cIdx: number) => {
    setActiveCell({ rowIndex: rIdx, colIndex: cIdx });
    const row = rows[rIdx];
    if (row) {
      onSelectField(row.field.id);
    }
  };

  const handleCellDoubleClick = (rIdx: number, cIdx: number) => {
    const col = columns[cIdx];
    if (!col || !col.editable) return;
    const row = rows[rIdx];
    if (!row) return;
    const val = getCellValue(row, col.key);
    setEditingCell({ rowIndex: rIdx, colIndex: cIdx, value: val });
  };

  // Commit single cell edit
  const commitCellEdit = (rIdx: number, cIdx: number, val: string) => {
    const row = rows[rIdx];
    const col = columns[cIdx];
    if (!row || !col || !col.editable) {
      setEditingCell(null);
      return;
    }

    const trimmed = val.trim();
    const reviewActor = reviewAuthor || {
      name: "Study author",
      role: "Data Manager",
    };

    if (col.key === "variableName") {
      const upperVar = trimmed.toUpperCase();
      if (upperVar !== row.field.variableName) {
        if (onRenameEverywhere) {
          onRenameEverywhere(row.field.id, upperVar);
        } else {
          const res = StudyProtocolEngine.renameFieldEverywhere(
            study,
            form.id,
            row.field.id,
            upperVar,
            undefined,
            reviewActor
          );
          if (!res.error && res.study) {
            onUpdateStudy(res.study);
          }
        }
      }
    } else if (col.key === "label") {
      if (trimmed !== row.field.label) {
        if (onCommitReviewTargetChange) {
          onCommitReviewTargetChange(row.field.id, { label: trimmed });
        } else {
          const editRes = StudyProtocolEngine.updateField(
            study,
            form.id,
            row.field.id,
            { label: trimmed }
          );
          if (!editRes.error && editRes.study) {
            const auditStudy = StudyProtocolEngine.recordReviewTargetChange(
              editRes.study,
              row.field.id,
              reviewActor
            );
            onUpdateStudy(auditStudy);
          }
        }
      }
    } else if (col.key === "dataType") {
      const editRes = StudyProtocolEngine.updateField(
        study,
        form.id,
        row.field.id,
        { dataType: trimmed as ClinicalDataType }
      );
      if (!editRes.error && editRes.study) {
        onUpdateStudy(editRes.study);
      } else {
        onUpdateField(row.field.id, { dataType: trimmed as ClinicalDataType });
      }
    } else if (col.key === "sectionId") {
      if (trimmed && trimmed !== row.sectionId) {
        const moveRes = StudyProtocolEngine.moveFieldToSection(
          study,
          form.id,
          row.field.id,
          trimmed
        );
        if (!moveRes.error && moveRes.study) {
          onUpdateStudy(moveRes.study);
        }
      }
    } else if (col.key === "required") {
      const isReq = trimmed === "true" || trimmed === "1" || trimmed === "yes";
      const editRes = StudyProtocolEngine.updateField(
        study,
        form.id,
        row.field.id,
        { required: isReq }
      );
      if (!editRes.error && editRes.study) {
        onUpdateStudy(editRes.study);
      } else {
        onUpdateField(row.field.id, { required: isReq });
      }
    } else if (col.key === "unit") {
      const editRes = StudyProtocolEngine.updateField(
        study,
        form.id,
        row.field.id,
        { unit: trimmed }
      );
      if (!editRes.error && editRes.study) {
        onUpdateStudy(editRes.study);
      } else {
        onUpdateField(row.field.id, { unit: trimmed });
      }
    } else if (col.key === "columnSpan") {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= 12) {
        const editRes = StudyProtocolEngine.updateField(
          study,
          form.id,
          row.field.id,
          { columnSpan: num }
        );
        if (!editRes.error && editRes.study) {
          onUpdateStudy(editRes.study);
        } else {
          onUpdateField(row.field.id, { columnSpan: num });
        }
      }
    } else if (col.key === "codelistId") {
      const editRes = StudyProtocolEngine.updateField(
        study,
        form.id,
        row.field.id,
        { codelistId: trimmed || undefined }
      );
      if (!editRes.error && editRes.study) {
        onUpdateStudy(editRes.study);
      } else {
        onUpdateField(row.field.id, { codelistId: trimmed || undefined });
      }
    } else if (col.key === "acrfAnnotation") {
      const meta = row.field.cdashMetadata || {
        domain: form.domain,
        sdtmVariable: row.field.variableName,
        cdashLabel: row.field.label,
        core: "O",
        acrfAnnotation: trimmed,
      };
      const editRes = StudyProtocolEngine.updateField(
        study,
        form.id,
        row.field.id,
        { cdashMetadata: { ...meta, acrfAnnotation: trimmed } }
      );
      if (!editRes.error && editRes.study) {
        onUpdateStudy(editRes.study);
      } else {
        onUpdateField(row.field.id, {
          cdashMetadata: { ...meta, acrfAnnotation: trimmed },
        });
      }
    }

    setEditingCell(null);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingCell) {
      if (e.key === "Enter") {
        e.preventDefault();
        commitCellEdit(
          editingCell.rowIndex,
          editingCell.colIndex,
          editingCell.value
        );
        // Move focus down
        if (editingCell.rowIndex < rows.length - 1) {
          const nextR = editingCell.rowIndex + 1;
          setActiveCell({ rowIndex: nextR, colIndex: editingCell.colIndex });
          if (rows[nextR]) onSelectField(rows[nextR].field.id);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditingCell(null);
      }
      return;
    }

    if (!activeCell) {
      if (
        ["ArrowDown", "ArrowUp", "Tab", "Enter"].includes(e.key) &&
        rows.length > 0
      ) {
        e.preventDefault();
        setActiveCell({ rowIndex: 0, colIndex: 1 });
        if (rows[0]) onSelectField(rows[0].field.id);
      }
      return;
    }
    const { rowIndex, colIndex } = activeCell;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) {
        const nextR = rowIndex - 1;
        setActiveCell({ rowIndex: nextR, colIndex });
        if (rows[nextR]) onSelectField(rows[nextR].field.id);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < rows.length - 1) {
        const nextR = rowIndex + 1;
        setActiveCell({ rowIndex: nextR, colIndex });
        if (rows[nextR]) onSelectField(rows[nextR].field.id);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (colIndex > 0) {
        setActiveCell({ rowIndex, colIndex: colIndex - 1 });
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (colIndex < columns.length - 1) {
        setActiveCell({ rowIndex, colIndex: colIndex + 1 });
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const col = columns[colIndex];
      if (col && col.editable && rows[rowIndex]) {
        const val = getCellValue(rows[rowIndex], col.key);
        setEditingCell({ rowIndex, colIndex, value: val });
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        if (colIndex > 0) {
          setActiveCell({ rowIndex, colIndex: colIndex - 1 });
        } else if (rowIndex > 0) {
          const nextR = rowIndex - 1;
          const nextC = columns.length - 1;
          setActiveCell({ rowIndex: nextR, colIndex: nextC });
          if (rows[nextR]) onSelectField(rows[nextR].field.id);
        }
      } else {
        if (colIndex < columns.length - 1) {
          setActiveCell({ rowIndex, colIndex: colIndex + 1 });
        } else if (rowIndex < rows.length - 1) {
          const nextR = rowIndex + 1;
          setActiveCell({ rowIndex: nextR, colIndex: 0 });
          if (rows[nextR]) onSelectField(rows[nextR].field.id);
        }
      }
    } else if (e.key === "Escape") {
      setActiveCell(null);
    }
  };

  // Validate paste payload cell by cell
  const parseAndValidatePaste = useCallback(
    (pastedText: string, startRow: number, startCol: number): CellUpdate[] => {
      const lines = pastedText
        .split(/\r?\n/)
        .map((l) => l.trimEnd())
        .filter((l) => l.length > 0);

      const updates: CellUpdate[] = [];
      const batchAssignedVars = new Set<string>();

      lines.forEach((line, rOffset) => {
        const targetRowIdx = startRow + rOffset;
        if (targetRowIdx >= rows.length) return; // ignore overflow rows beyond form length

        const cells = line.split("\t");
        cells.forEach((cellVal, cOffset) => {
          const targetColIdx = startCol + cOffset;
          if (targetColIdx >= columns.length) return;

          const col = columns[targetColIdx];
          if (!col || !col.editable) return;

          const row = rows[targetRowIdx];
          const oldVal = getCellValue(row, col.key);
          const newVal = cellVal.trim();

          let isValid = true;
          let error: string | undefined;

          // Exact-cell validation
          if (col.key === "variableName") {
            const upperVar = newVal.toUpperCase();
            const valRes = validateCdashVariableName(upperVar);
            if (!valRes.isValid) {
              isValid = false;
              error = valRes.error || "Invalid CDASH variable format";
            } else if (batchAssignedVars.has(upperVar)) {
              isValid = false;
              error = `Duplicate variable name '${upperVar}' in paste batch`;
            } else {
              // Check collision within form rows
              const exists = rows.some(
                (r, idx) =>
                  idx !== targetRowIdx &&
                  r.field.variableName.toUpperCase() === upperVar
              );
              if (exists) {
                isValid = false;
                error = `Variable name '${upperVar}' already exists in form`;
              } else {
                // Test Sentinel rename via StudyProtocolEngine
                const testRename = StudyProtocolEngine.renameFieldEverywhere(
                  study,
                  form.id,
                  row.field.id,
                  upperVar
                );
                if (testRename.error) {
                  isValid = false;
                  error = testRename.error;
                }
              }
            }
            if (isValid) {
              batchAssignedVars.add(upperVar);
            }
          } else if (col.key === "sectionId") {
            const matchedSec = form.sections.find(
              (s) =>
                s.id === newVal ||
                s.title.trim().toLowerCase() === newVal.trim().toLowerCase()
            );
            if (!matchedSec) {
              isValid = false;
              error = `Section '${newVal}' does not exist in form '${form.name}'`;
            }
          } else if (col.key === "dataType") {
            const validTypes = DATA_TYPE_OPTIONS.map((o) => o.value);
            if (!validTypes.includes(newVal as ClinicalDataType)) {
              isValid = false;
              error = `Invalid data type '${newVal}'. Must be one of: ${validTypes.slice(0, 4).join(", ")}...`;
            }
          } else if (col.key === "columnSpan") {
            const num = parseInt(newVal, 10);
            if (isNaN(num) || num < 1 || num > 12) {
              isValid = false;
              error = `Grid span must be an integer between 1 and 12 (got '${newVal}')`;
            }
          } else if (col.key === "required") {
            const lower = newVal.toLowerCase();
            if (!["true", "false", "yes", "no", "1", "0"].includes(lower)) {
              isValid = false;
              error = `Required must be true/false or yes/no (got '${newVal}')`;
            }
          } else if (col.key === "codelistId") {
            if (newVal && newVal !== "none" && newVal !== "") {
              const clExists = study.codelists.some((c) => c.id === newVal);
              if (!clExists) {
                isValid = false;
                error = `Codelist ID '${newVal}' does not exist in study codelists`;
              }
            }
          }

          updates.push({
            rowIndex: targetRowIdx,
            colIndex: targetColIdx,
            fieldId: row.field.id,
            fieldVar: row.field.variableName,
            colKey: col.key,
            colLabel: col.label,
            oldValue: oldVal,
            newValue: newVal,
            isValid,
            error,
          });
        });
      });

      return updates;
    },
    [rows, columns, getCellValue, study, form]
  );

  // Handle clipboard paste event
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (editingCell) return; // let native text input handle inline edit paste
      const pasted = e.clipboardData.getData("text");
      if (!pasted) return;

      e.preventDefault();
      const startR = activeCell ? activeCell.rowIndex : 0;
      const startC = activeCell ? activeCell.colIndex : 1;

      const batch = parseAndValidatePaste(pasted, startR, startC);
      if (batch.length > 0) {
        setPendingBatchUpdates(batch);
        setRawPasteText(pasted);
        setPasteModalOpen(true);
      }
    },
    [editingCell, activeCell, parseAndValidatePaste]
  );

  // Apply batch updates atomically (1 undo entry)
  const commitBatchUpdates = () => {
    if (
      pendingBatchUpdates.length === 0 ||
      pendingBatchUpdates.some((u) => !u.isValid)
    ) {
      return; // Cannot commit invalid or empty batch
    }

    let currentStudy = study;
    const reviewActor = reviewAuthor || {
      name: "Study author",
      role: "Data Manager",
    };

    // Group updates by fieldId
    const updatesByFieldId = new Map<string, CellUpdate[]>();
    for (const upd of pendingBatchUpdates) {
      const list = updatesByFieldId.get(upd.fieldId) || [];
      list.push(upd);
      updatesByFieldId.set(upd.fieldId, list);
    }

    for (const [fieldId, updates] of updatesByFieldId.entries()) {
      const varUpdate = updates.find((u) => u.colKey === "variableName");
      const labelUpdate = updates.find((u) => u.colKey === "label");
      const secUpdate = updates.find((u) => u.colKey === "sectionId");

      // 1. If variableName is updated, call renameFieldEverywhere
      if (varUpdate) {
        const renameRes = StudyProtocolEngine.renameFieldEverywhere(
          currentStudy,
          form.id,
          fieldId,
          varUpdate.newValue,
          labelUpdate ? labelUpdate.newValue : undefined,
          reviewActor
        );
        if (renameRes.error) return; // abort batch
        currentStudy = renameRes.study;
      }

      // 2. If sectionId is updated, call moveFieldToSection
      if (secUpdate) {
        const moveRes = StudyProtocolEngine.moveFieldToSection(
          currentStudy,
          form.id,
          fieldId,
          secUpdate.newValue
        );
        if (moveRes.error) return; // abort batch
        currentStudy = moveRes.study;
      }

      // 3. Process remaining property updates via updateField
      const otherUpdates = updates.filter(
        (u) =>
          u.colKey !== "variableName" &&
          u.colKey !== "sectionId" &&
          !(u.colKey === "label" && varUpdate)
      );

      if (otherUpdates.length > 0) {
        const currentField = StudyProtocolEngine.getField(
          currentStudy,
          form.id,
          fieldId
        )?.field;

        const fieldPartial: Partial<CRFField> = {};
        for (const upd of otherUpdates) {
          if (upd.colKey === "label") {
            fieldPartial.label = upd.newValue;
          } else if (upd.colKey === "dataType") {
            fieldPartial.dataType = upd.newValue as ClinicalDataType;
          } else if (upd.colKey === "required") {
            const lower = upd.newValue.toLowerCase();
            fieldPartial.required =
              lower === "true" || lower === "1" || lower === "yes";
          } else if (upd.colKey === "unit") {
            fieldPartial.unit = upd.newValue;
          } else if (upd.colKey === "columnSpan") {
            fieldPartial.columnSpan = parseInt(upd.newValue, 10);
          } else if (upd.colKey === "codelistId") {
            fieldPartial.codelistId = upd.newValue || undefined;
          } else if (upd.colKey === "acrfAnnotation") {
            const meta = currentField?.cdashMetadata || {
              domain: form.domain,
              sdtmVariable: currentField?.variableName || upd.fieldVar,
              cdashLabel: currentField?.label || upd.newValue,
              core: "O",
              acrfAnnotation: upd.newValue,
            };
            fieldPartial.cdashMetadata = {
              ...meta,
              acrfAnnotation: upd.newValue,
            };
          }
        }

        const editRes = StudyProtocolEngine.updateField(
          currentStudy,
          form.id,
          fieldId,
          fieldPartial
        );
        if (editRes.error) return; // abort batch
        currentStudy = editRes.study;

        if (fieldPartial.label !== undefined) {
          currentStudy = StudyProtocolEngine.recordReviewTargetChange(
            currentStudy,
            fieldId,
            reviewActor
          );
        }
      }
    }

    // Commit whole study state transition atomically
    onUpdateStudy(currentStudy);
    setPasteModalOpen(false);
    setPendingBatchUpdates([]);
    setRawPasteText("");
  };

  const invalidCount = pendingBatchUpdates.filter((u) => !u.isValid).length;
  const validCount = pendingBatchUpdates.filter((u) => u.isValid).length;

  return (
    <div
      ref={gridRef}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      tabIndex={0}
      aria-label="Active Form Grid"
      className="flex-1 flex flex-col h-full bg-zinc-950/90 crf-canvas-area overflow-hidden p-3 sm:p-6 transition-all relative focus:outline-none"
    >
      {/* Grid Controls Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <IconTable className="w-4 h-4 text-brand-cyan" />
            <span className="font-mono text-xs font-bold text-zinc-200">
              Active Form Grid
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
            Form: <span className="text-zinc-200 font-bold">{form.name}</span> (
            {rows.length} fields)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onSwitchMode && (
            <button
              onClick={() => onSwitchMode("designer")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-mono transition-all"
            >
              <IconLayoutGrid className="w-3.5 h-3.5 text-brand-cyan" />
              <span>Canvas View</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const startR = activeCell ? activeCell.rowIndex : 0;
              const startC = activeCell ? activeCell.colIndex : 1;
              const batch = parseAndValidatePaste(rawPasteText, startR, startC);
              setPendingBatchUpdates(batch);
              setPasteModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan text-xs font-mono transition-all"
          >
            <IconClipboard className="w-3.5 h-3.5" />
            <span>Paste / Fill</span>
          </button>

          {onAddField && (
            <button
              type="button"
              onClick={() => onAddField()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-cyan text-zinc-950 hover:bg-brand-cyan/90 text-xs font-mono font-bold transition-all"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Add Field</span>
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet Table Container */}
      <div className="flex-1 overflow-auto rounded-xl border border-zinc-800/80 bg-zinc-950 shadow-inner">
        <table className="w-full text-left border-collapse font-mono text-xs text-zinc-300">
          <caption className="sr-only">Form Fields Spreadsheet Grid</caption>
          <thead>
            <tr className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800 text-[11px] uppercase tracking-wider sticky top-0 z-10">
              <th
                scope="col"
                className="py-2.5 px-3 font-semibold text-zinc-500 border-r border-zinc-800 w-10 text-center"
              >
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`py-2.5 px-3 font-semibold border-r border-zinc-800/80 ${col.width}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-850/60">
            {rows.map((row, rIdx) => {
              const isRowSelected = row.field.id === selectedFieldId;

              return (
                <tr
                  key={row.field.id}
                  className={`transition-colors hover:bg-zinc-900/50 ${
                    isRowSelected ? "bg-brand-cyan/5" : ""
                  }`}
                >
                  {/* Row index */}
                  <td className="py-2 px-3 text-center text-zinc-600 border-r border-zinc-850 text-[10px] font-mono">
                    {rIdx + 1}
                  </td>

                  {/* Columns */}
                  {columns.map((col, cIdx) => {
                    const isCellActive =
                      activeCell?.rowIndex === rIdx &&
                      activeCell?.colIndex === cIdx;
                    const isCellEditing =
                      editingCell?.rowIndex === rIdx &&
                      editingCell?.colIndex === cIdx;
                    const cellVal = getCellValue(row, col.key);

                    return (
                      <td
                        key={col.key}
                        onClick={() => handleCellClick(rIdx, cIdx)}
                        onDoubleClick={() => handleCellDoubleClick(rIdx, cIdx)}
                        className={`py-1.5 px-3 border-r border-zinc-850/80 relative cursor-pointer select-none transition-all ${
                          isCellActive
                            ? "ring-2 ring-brand-cyan ring-inset bg-zinc-900/80 z-1"
                            : ""
                        }`}
                      >
                        {isCellEditing ? (
                          col.type === "select" && col.options ? (
                            <select
                              autoFocus
                              value={editingCell.value}
                              onChange={(e) =>
                                setEditingCell({
                                  ...editingCell,
                                  value: e.target.value,
                                })
                              }
                              onBlur={() =>
                                commitCellEdit(rIdx, cIdx, editingCell.value)
                              }
                              className="w-full bg-zinc-900 text-brand-cyan border border-brand-cyan/60 rounded px-1.5 py-0.5 text-xs font-mono focus:outline-none"
                            >
                              {col.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : col.type === "boolean" ? (
                            <select
                              autoFocus
                              value={editingCell.value}
                              onChange={(e) =>
                                setEditingCell({
                                  ...editingCell,
                                  value: e.target.value,
                                })
                              }
                              onBlur={() =>
                                commitCellEdit(rIdx, cIdx, editingCell.value)
                              }
                              className="w-full bg-zinc-900 text-brand-cyan border border-brand-cyan/60 rounded px-1.5 py-0.5 text-xs font-mono focus:outline-none"
                            >
                              <option value="true">true (Required)</option>
                              <option value="false">false (Optional)</option>
                            </select>
                          ) : (
                            <input
                              autoFocus
                              type={col.type === "number" ? "number" : "text"}
                              value={editingCell.value}
                              onChange={(e) =>
                                setEditingCell({
                                  ...editingCell,
                                  value: e.target.value,
                                })
                              }
                              onBlur={() =>
                                commitCellEdit(rIdx, cIdx, editingCell.value)
                              }
                              className="w-full bg-zinc-900 text-brand-cyan border border-brand-cyan/60 rounded px-1.5 py-0.5 text-xs font-mono focus:outline-none"
                            />
                          )
                        ) : col.key === "id" ? (
                          <span className="font-mono text-[10px] text-zinc-500 bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800">
                            {cellVal}
                          </span>
                        ) : col.key === "variableName" ? (
                          <span className="font-mono font-bold text-brand-cyan">
                            {cellVal}
                          </span>
                        ) : col.key === "required" ? (
                          <span
                            className={`inline-block text-[10px] px-1.5 py-0.2 rounded ${
                              cellVal === "true"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : "bg-zinc-850 text-zinc-500 border border-zinc-800"
                            }`}
                          >
                            {cellVal === "true" ? "Required" : "Optional"}
                          </span>
                        ) : col.key === "codelistId" ? (
                          <span className="text-zinc-400 italic text-[11px]">
                            {col.options?.find((o) => o.value === cellVal)
                              ?.label ||
                              cellVal ||
                              "—"}
                          </span>
                        ) : col.key === "dataType" ? (
                          <span className="text-zinc-300 text-[11px] px-1.5 py-0.5 bg-zinc-900 rounded border border-zinc-800">
                            {cellVal}
                          </span>
                        ) : (
                          <span className="truncate block max-w-full">
                            {cellVal || "—"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Batch Paste Preview Modal */}
      {pasteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          role="presentation"
        >
          <div
            ref={pasteModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="paste-modal-title"
            className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
          >
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <IconSparkles className="w-5 h-5 text-brand-cyan" />
                <h3
                  id="paste-modal-title"
                  className="font-mono text-sm font-bold text-zinc-100"
                >
                  Batch Metadata Paste Validation &amp; Preview
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                aria-label="Close dialog"
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-800"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {/* Paste Raw Textarea Input */}
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Raw Clipboard Data (Tab or Comma Separated):
                </label>
                <textarea
                  value={rawPasteText}
                  onChange={(e) => {
                    setRawPasteText(e.target.value);
                    const startR = activeCell ? activeCell.rowIndex : 0;
                    const startC = activeCell ? activeCell.colIndex : 1;
                    const batch = parseAndValidatePaste(
                      e.target.value,
                      startR,
                      startC
                    );
                    setPendingBatchUpdates(batch);
                  }}
                  placeholder="Paste TSV/CSV text here (e.g., SYSBP&#9;Systolic BP&#9;integer&#9;true&#9;mmHg&#9;6)"
                  className="w-full h-24 bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-xl p-3 font-mono text-xs focus:outline-none focus:border-brand-cyan"
                />
              </div>

              {/* Status Banner */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
                  invalidCount > 0
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {invalidCount > 0 ? (
                    <IconAlertTriangle className="w-4 h-4 text-rose-400" />
                  ) : (
                    <IconCheck className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>
                    Batch Summary: {pendingBatchUpdates.length} cells to update
                    ({validCount} Valid, {invalidCount} Invalid)
                  </span>
                </div>
                {invalidCount > 0 && (
                  <span className="text-[11px] font-semibold text-rose-400">
                    Fix invalid cell data before committing batch
                  </span>
                )}
              </div>

              {/* Updates Table Preview */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left font-mono text-xs text-zinc-300">
                  <caption className="sr-only">
                    Batch Paste Preview Updates
                  </caption>
                  <thead className="bg-zinc-900 text-zinc-400 text-[10px] uppercase">
                    <tr>
                      <th scope="col" className="p-2 border-r border-zinc-800">
                        Target Field
                      </th>
                      <th scope="col" className="p-2 border-r border-zinc-800">
                        Column
                      </th>
                      <th scope="col" className="p-2 border-r border-zinc-800">
                        Current Value
                      </th>
                      <th scope="col" className="p-2 border-r border-zinc-800">
                        Pasted Value
                      </th>
                      <th scope="col" className="p-2">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {pendingBatchUpdates.map((upd, idx) => (
                      <tr
                        key={idx}
                        className={
                          upd.isValid ? "hover:bg-zinc-900/40" : "bg-rose-500/5"
                        }
                      >
                        <td className="p-2 border-r border-zinc-850 font-bold text-brand-cyan">
                          {upd.fieldVar}
                        </td>
                        <td className="p-2 border-r border-zinc-850 text-zinc-400">
                          {upd.colLabel}
                        </td>
                        <td className="p-2 border-r border-zinc-850 text-zinc-500">
                          {upd.oldValue || "—"}
                        </td>
                        <td className="p-2 border-r border-zinc-850 font-semibold text-zinc-200">
                          {upd.newValue}
                        </td>
                        <td className="p-2">
                          {upd.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                              <IconCheck className="w-3 h-3" /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 font-bold">
                              <IconAlertTriangle className="w-3 h-3" />{" "}
                              {upd.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs font-mono transition-all"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={invalidCount > 0 || pendingBatchUpdates.length === 0}
                onClick={commitBatchUpdates}
                className="px-5 py-2 rounded-xl bg-brand-cyan text-zinc-950 font-bold text-xs font-mono hover:bg-brand-cyan/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
              >
                Commit Batch ({pendingBatchUpdates.length} Updates)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
