"use client";

import React, { useId, useMemo, useState } from "react";
import { IconGitFork, IconX } from "@tabler/icons-react";
import type { StudyProtocol } from "@/lib/crf/types";
import {
  createFormVariant,
  getFormUses,
  previewFormVariant,
  type FormUse,
} from "@/lib/crf/form-variants";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface FormVariantModalProps {
  study: StudyProtocol;
  formId: string;
  onCancel: () => void;
  /** Receives the committed study; the caller records it as one undoable step. */
  onCommit: (study: StudyProtocol, variantFormId: string) => void;
}

interface VisitGroup {
  visitId: string;
  visitName: string;
  targetDay: number;
  uses: FormUse[];
}

function describeUse(use: FormUse): string {
  if (use.kind === "visit_default")
    return "Visit default (all arms that follow it)";
  if (use.kind === "arm_override")
    return `${use.armName}: arm-specific assignment`;
  return `${use.armName}: follows visit default`;
}

function formatUseLabel(use: FormUse): string {
  return use.armName
    ? `${use.visitName} · ${use.armName}`
    : `${use.visitName} · default`;
}

/**
 * Inspect a form's visit uses and create an explicit variant for a selected
 * subset of them (#675). Nothing changes until "Create variant" commits the
 * engine transaction; Cancel and Escape leave the study untouched.
 */
export const FormVariantModal: React.FC<FormVariantModalProps> = ({
  study,
  formId,
  onCancel,
  onCommit,
}) => {
  const titleId = useId();
  const descId = useId();
  const nameId = useId();
  const form = study.forms.find((f) => f.id === formId);
  const [selected, setSelected] = useState<string[]>([]);
  const [variantName, setVariantName] = useState(
    `${form?.name ?? "Form"} (Variant)`
  );
  const dialogRef = useFocusTrap<HTMLDivElement>(true, { onEscape: onCancel });

  const uses = useMemo(() => getFormUses(study, formId), [study, formId]);
  const groups = useMemo(() => {
    const byVisit = new Map<string, VisitGroup>();
    for (const use of uses) {
      const group = byVisit.get(use.visitId) ?? {
        visitId: use.visitId,
        visitName: use.visitName,
        targetDay: use.targetDay,
        uses: [],
      };
      group.uses.push(use);
      byVisit.set(use.visitId, group);
    }
    return Array.from(byVisit.values());
  }, [uses]);
  const preview = useMemo(
    () =>
      previewFormVariant(study, formId, {
        selectedUseKeys: selected,
        variantName,
      }),
    [study, formId, selected, variantName]
  );

  if (!form) return null;

  const toggle = (use: FormUse, checked: boolean) => {
    const next = new Set(selected);
    const apply = (key: string) => (checked ? next.add(key) : next.delete(key));
    apply(use.key);
    // Checking a visit default carries the arms that follow it, which the
    // author can then uncheck to keep them on the shared form.
    if (use.kind === "visit_default") {
      uses
        .filter((u) => u.visitId === use.visitId && u.kind === "arm_inherited")
        .forEach((u) => apply(u.key));
    }
    setSelected(Array.from(next));
  };

  const handleCreate = () => {
    const result = createFormVariant(study, formId, {
      selectedUseKeys: selected,
      variantName,
    });
    if (result.error || !result.variant) return;
    onCommit(result.study, result.variant.id);
  };

  const visibleChanges = preview.changes.filter(
    (c) => c.outcome === "moves_to_variant" || c.createsArmAssignment
  );
  const showError = selected.length > 0 || variantName.trim() === "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-testid="form-variant-dialog"
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h3
              id={titleId}
              className="text-sm font-bold font-mono text-white flex items-center gap-1.5"
            >
              <IconGitFork
                className="w-4 h-4 text-amber-400 shrink-0"
                aria-hidden="true"
              />
              <span className="truncate">Visit uses of {form.name}</span>
            </h3>
            <p
              id={descId}
              className="text-xs text-zinc-300 leading-relaxed break-words"
            >
              {form.name} is one shared definition used in {uses.length}{" "}
              {uses.length === 1 ? "place" : "places"}. Ordinary edits to this
              form change every use listed here. To change only some of them,
              create a variant: a separate copy with its own field and rule
              identities. Later edits to either form do not carry over to the
              other.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
            aria-label="Close without changes"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {uses.length === 0 ? (
          <p className="text-xs text-zinc-400">
            This form is not assigned to any visit, so there is nothing to
            split. Assign it in the Study Spine or the Visit Matrix first.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Choose the uses that move to the variant
              </p>
              {groups.map((group) => (
                <fieldset
                  key={group.visitId}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 space-y-1.5 min-w-0"
                >
                  <legend className="px-1 text-xs font-mono font-bold text-zinc-200">
                    {group.visitName}{" "}
                    <span className="text-zinc-500 font-normal">
                      Day {group.targetDay}
                    </span>
                  </legend>
                  {group.uses.map((use) => (
                    <label
                      key={use.key}
                      className={`flex items-center gap-2 text-xs text-zinc-300 min-w-0 cursor-pointer ${
                        use.kind === "visit_default" ? "" : "pl-4"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(use.key)}
                        onChange={(e) => toggle(use, e.target.checked)}
                        className="accent-amber-500 shrink-0"
                      />
                      <span className="min-w-0 break-words">
                        {describeUse(use)}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>

            <div className="space-y-1">
              <label
                htmlFor={nameId}
                className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold"
              >
                Variant name
              </label>
              <input
                id={nameId}
                type="text"
                value={variantName}
                onChange={(e) => setVariantName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <section
              aria-labelledby={`${titleId}-preview`}
              className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-2"
            >
              <h4
                id={`${titleId}-preview`}
                className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold"
              >
                Preview
              </h4>
              <p
                className="text-xs text-zinc-300"
                aria-live="polite"
                data-testid="form-variant-summary"
              >
                {preview.movedCount} of {uses.length} uses move to{" "}
                <span className="font-mono text-amber-400">
                  {preview.variantName || "the variant"}
                </span>
                ; {preview.remainingCount} stay on {form.name}.
              </p>
              {visibleChanges.length > 0 && (
                <ul className="space-y-1" data-testid="form-variant-changes">
                  {visibleChanges.map((change) => (
                    <li
                      key={change.use.key}
                      className="text-xs font-mono text-zinc-300 flex flex-wrap items-center gap-x-1.5 min-w-0"
                    >
                      <span
                        aria-hidden="true"
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          change.outcome === "moves_to_variant"
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                        }`}
                      />
                      <span className="min-w-0 break-words">
                        {formatUseLabel(change.use)}:{" "}
                        {change.outcome === "moves_to_variant"
                          ? `moves to ${preview.variantName || "the variant"}`
                          : `stays on ${form.name}`}
                        {change.createsArmAssignment && (
                          <span className="text-zinc-500">
                            {" "}
                            (new arm-specific assignment)
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {preview.error && showError && (
                <p
                  className="text-xs text-amber-400"
                  data-testid="form-variant-error"
                >
                  {preview.error}
                </p>
              )}
            </section>
          </>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-300 transition-colors active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={Boolean(preview.error)}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-mono font-bold text-black transition-colors active:scale-[0.98]"
          >
            Create variant
          </button>
        </div>
      </div>
    </div>
  );
};
