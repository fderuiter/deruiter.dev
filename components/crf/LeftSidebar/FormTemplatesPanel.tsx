"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import {
  IconBookmark,
  IconDownload,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import type {
  CodelistDefinition,
  CRFForm,
  StudyProtocol,
} from "@/lib/crf/types";
import {
  FORM_TEMPLATES_STORAGE_KEY,
  MAX_TEMPLATE_PACKAGE_CHARS,
  deleteFormTemplate,
  exportFormTemplates,
  importFormTemplates,
  instantiateFormTemplate,
  parseStoredFormTemplates,
  type FormTemplate,
} from "@/lib/crf/form-templates";
import { downloadFile } from "@/lib/download";
import { STORAGE_CHANGE_EVENT, safeGetRawItem } from "@/lib/safe-storage";

function subscribe(onChange: () => void) {
  window.addEventListener(STORAGE_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(STORAGE_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
const getSnapshot = () => safeGetRawItem(FORM_TEMPLATES_STORAGE_KEY);
const getServerSnapshot = () => null;

function countFields(template: FormTemplate): number {
  let total = 0;
  const walk = (fields: { repeatingColumns?: unknown[] }[]) => {
    for (const field of fields) {
      total += 1;
      walk((field.repeatingColumns as typeof fields | undefined) ?? []);
    }
  };
  for (const section of template.form.sections) walk(section.fields);
  return total;
}

const BUTTON =
  "inline-flex min-h-[28px] items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-mono text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 active:scale-[0.98]";

interface FormTemplatesPanelProps {
  study: StudyProtocol;
  activeVisitId?: string;
  /** Adds the copied form (and the codelists it needs) to the study. */
  onInsert: (
    form: CRFForm,
    targetVisitId: string | undefined,
    codelists: CodelistDefinition[]
  ) => void;
}

/** Saved whole-form templates: insert, delete, export and import. */
export function FormTemplatesPanel({
  study,
  activeVisitId,
  onInsert,
}: FormTemplatesPanelProps) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const templates = useMemo(
    () => (raw ? parseStoredFormTemplates(raw) : []),
    [raw]
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const handleInsert = (template: FormTemplate) => {
    const { form, codelists } = instantiateFormTemplate(template, study);
    onInsert(form, activeVisitId, codelists);
    setMessage(`Added ${template.name} to the study.`);
  };

  const handleDelete = (template: FormTemplate) => {
    deleteFormTemplate(template.id);
    setPendingDeleteId(null);
    setMessage(`Deleted ${template.name}.`);
  };

  const handleExport = () => {
    downloadFile(exportFormTemplates(templates), "crf-form-templates.json", {
      mimeType: "application/json",
    });
    setMessage(`Exported ${templates.length} templates.`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_TEMPLATE_PACKAGE_CHARS) {
      setMessage("That template package is too large to import.");
      return;
    }
    file
      .text()
      .then((text) => {
        const { imported, skipped, result } = importFormTemplates(text);
        if (result.status === "limit") {
          setMessage(
            `The template list is full (${result.max}). Delete one first.`
          );
        } else if (result.status !== "saved") {
          setMessage("Templates could not be saved in this browser.");
        } else {
          setMessage(
            `Imported ${imported} template${imported === 1 ? "" : "s"}${
              skipped ? `, skipped ${skipped}` : ""
            }.`
          );
        }
      })
      .catch((err: unknown) =>
        setMessage(
          err instanceof Error ? err.message : "Could not read that file."
        )
      );
  };

  return (
    <div className="space-y-2 pt-2 border-t border-zinc-850">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="flex min-w-0 items-center gap-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-amber-400">
          <IconBookmark className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            My form templates ({templates.length})
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <label className={`${BUTTON} cursor-pointer`}>
            <IconUpload className="h-3 w-3" aria-hidden="true" />
            <span>Import</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="sr-only"
              aria-label="Import form template package"
            />
          </label>
          {templates.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              aria-label="Export all form templates as a package"
              className={BUTTON}
            >
              <IconDownload className="h-3 w-3" aria-hidden="true" />
              <span>Export</span>
            </button>
          )}
        </div>
      </div>

      {templates.length === 0 ? (
        <p className="px-1 text-[11px] font-mono italic text-zinc-400">
          No saved form templates. Use the bookmark button on a form to save it
          here.
        </p>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-0.5">
          {templates.map((template) => (
            <li
              key={template.id}
              className="rounded-xl border border-zinc-850 bg-zinc-900/60 p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="truncate text-xs font-bold text-zinc-200">
                    {template.name}
                  </h4>
                  <p className="truncate text-[10px] text-zinc-400">
                    {template.form.sections.length} sections ·{" "}
                    {countFields(template)} fields
                  </p>
                </div>
                {pendingDeleteId === template.id ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDelete(template)}
                      className={`${BUTTON} border-rose-500/40 text-rose-200`}
                      aria-label={`Confirm delete ${template.name}`}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(null)}
                      className={BUTTON}
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleInsert(template)}
                      className={`${BUTTON} border-amber-500/30 text-amber-300`}
                      aria-label={`Add template ${template.name} to the study`}
                    >
                      + Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(template.id)}
                      className={BUTTON}
                      aria-label={`Delete template ${template.name}`}
                    >
                      <IconTrash className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p role="status" className="px-1 text-[11px] font-mono text-zinc-300">
        {message}
      </p>
    </div>
  );
}
