"use client";

import React, { useMemo, useState } from "react";
import { EDCQuery, StudyProtocol } from "@/lib/crf/types";
import { getEdcRoleActorLabel } from "@/lib/crf";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { IconX } from "@tabler/icons-react";

type EdcUserRole =
  | "Site Coordinator"
  | "Principal Investigator"
  | "CRA Monitor"
  | "Data Manager";

interface ManualQueryDraftSubmission {
  subjectId: string;
  visitId: string;
  formId: string;
  fieldId: string;
  fieldName: string;
  severity: EDCQuery["severity"];
  message: string;
}

interface EdcManualQueryModalProps {
  study: StudyProtocol;
  availableSubjects: string[];
  defaultSubjectId: string;
  defaultVisitId: string;
  defaultFormId: string;
  currentRole: EdcUserRole;
  onClose: () => void;
  onSubmit: (submission: ManualQueryDraftSubmission) => void;
}

export const EdcManualQueryModal: React.FC<EdcManualQueryModalProps> = ({
  study,
  availableSubjects,
  defaultSubjectId,
  defaultVisitId,
  defaultFormId,
  currentRole,
  onClose,
  onSubmit,
}) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(true, {
    onEscape: onClose,
  });

  const initialForm =
    study.forms.find((f) => f.id === defaultFormId) || study.forms[0];
  const initialFields = initialForm
    ? initialForm.sections.flatMap((s) => s.fields)
    : [];

  const [manualQuerySubjectId, setManualQuerySubjectId] = useState(
    defaultSubjectId || availableSubjects[0] || "001-101"
  );
  const [manualQueryVisitId, setManualQueryVisitId] = useState(
    defaultVisitId || study.visits[0]?.id || ""
  );
  const [manualQueryFormId, setManualQueryFormId] = useState(
    initialForm?.id || ""
  );
  const [manualQueryFieldId, setManualQueryFieldId] = useState(
    initialFields[0]?.id || ""
  );
  const [manualQuerySeverity, setManualQuerySeverity] =
    useState<EDCQuery["severity"]>("warning");
  const [manualQueryMessage, setManualQueryMessage] = useState("");

  const manualQueryForm = useMemo(
    () => study.forms.find((f) => f.id === manualQueryFormId) || study.forms[0],
    [study.forms, manualQueryFormId]
  );

  const manualQueryFields = useMemo(
    () =>
      manualQueryForm ? manualQueryForm.sections.flatMap((s) => s.fields) : [],
    [manualQueryForm]
  );

  const handleSubmit = () => {
    if (!manualQueryMessage.trim()) return;
    const resolvedFormId = manualQueryForm?.id || defaultFormId;
    const resolvedField =
      manualQueryFields.find((f) => f.id === manualQueryFieldId) ||
      manualQueryFields[0];
    if (!resolvedField) return;

    onSubmit({
      subjectId: manualQuerySubjectId || defaultSubjectId,
      visitId: manualQueryVisitId || defaultVisitId,
      formId: resolvedFormId,
      fieldId: resolvedField.id,
      fieldName: resolvedField.variableName || resolvedField.label,
      severity: manualQuerySeverity,
      message: manualQueryMessage,
    });
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-query-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 studio-surface-scrim backdrop-blur-sm"
    >
      <div className="studio-surface-elevated border studio-border-strong rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <h3
            id="manual-query-dialog-title"
            className="text-sm font-bold studio-fg-primary font-mono"
          >
            Raise Manual Discrepancy Query
          </h3>
          <button
            type="button"
            aria-label="Close manual query dialog"
            onClick={onClose}
            className="p-1 rounded-lg studio-fg-muted studio-hover-fg-primary"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs studio-fg-muted font-sans">
          Raising manual query as{" "}
          <span className="font-semibold studio-fg-primary">{currentRole}</span>{" "}
          · {getEdcRoleActorLabel(currentRole)}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div>
            <label
              htmlFor="manual-query-subject"
              className="block text-[10px] studio-fg-muted mb-1"
            >
              Subject ID
            </label>
            <select
              id="manual-query-subject"
              value={manualQuerySubjectId}
              onChange={(e) => setManualQuerySubjectId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg studio-surface-subtle border studio-border-strong studio-fg-primary text-xs"
            >
              {availableSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="manual-query-visit"
              className="block text-[10px] studio-fg-muted mb-1"
            >
              Visit
            </label>
            <select
              id="manual-query-visit"
              value={manualQueryVisitId}
              onChange={(e) => setManualQueryVisitId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg studio-surface-subtle border studio-border-strong studio-fg-primary text-xs"
            >
              {study.visits.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="manual-query-form"
              className="block text-[10px] studio-fg-muted mb-1"
            >
              CRF Form
            </label>
            <select
              id="manual-query-form"
              value={manualQueryFormId}
              onChange={(e) => {
                const nextFormId = e.target.value;
                setManualQueryFormId(nextFormId);
                const nextForm = study.forms.find((f) => f.id === nextFormId);
                const firstField = nextForm?.sections.flatMap(
                  (s) => s.fields
                )[0];
                setManualQueryFieldId(firstField?.id || "");
              }}
              className="w-full px-2.5 py-1.5 rounded-lg studio-surface-subtle border studio-border-strong studio-fg-primary text-xs"
            >
              {study.forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.domain})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="manual-query-field"
              className="block text-[10px] studio-fg-muted mb-1"
            >
              Target Variable
            </label>
            <select
              id="manual-query-field"
              value={manualQueryFieldId}
              onChange={(e) => setManualQueryFieldId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg studio-surface-subtle border studio-border-strong studio-fg-primary text-xs"
            >
              {manualQueryFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.variableName} — {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="manual-query-severity"
            className="block text-[10px] font-mono studio-fg-muted mb-1"
          >
            Severity
          </label>
          <select
            id="manual-query-severity"
            value={manualQuerySeverity}
            onChange={(e) =>
              setManualQuerySeverity(e.target.value as EDCQuery["severity"])
            }
            className="w-full px-2.5 py-1.5 rounded-lg studio-surface-subtle border studio-border-strong studio-fg-primary text-xs font-mono"
          >
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="info">Info</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="manual-query-message"
            className="block text-[10px] font-mono studio-fg-muted mb-1"
          >
            Discrepancy Query Message
          </label>
          <textarea
            id="manual-query-message"
            rows={3}
            value={manualQueryMessage}
            onChange={(e) => setManualQueryMessage(e.target.value)}
            placeholder="Describe source discrepancy or missing clarification needed from site..."
            className="w-full px-3 py-2 text-xs studio-surface-subtle border studio-border-strong rounded-lg studio-fg-primary font-sans studio-focus-input focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg studio-surface-muted studio-fg-secondary text-xs font-mono"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!manualQueryMessage.trim()}
            onClick={handleSubmit}
            className="px-3 py-1.5 rounded-lg studio-btn-cyan font-bold text-xs font-mono disabled:opacity-40"
          >
            Submit Manual Query
          </button>
        </div>
      </div>
    </div>
  );
};
