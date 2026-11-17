"use client";

import React, { useId, useMemo, useState, useEffect } from "react";
import { IconCalendarPlus, IconX } from "@tabler/icons-react";
import type { StudyProtocol, StudyVisit } from "@/lib/crf/types";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface AssignToVisitModalProps {
  study: StudyProtocol;
  formId: string;
  onClose: () => void;
  onCancel?: () => void;
  onAssignFormToVisit: (visitId: string, formId: string) => void;
  onUnassignFormFromVisit: (visitId: string, formId: string) => void;
}

interface EpochGroup {
  id: string;
  name: string;
  visits: StudyVisit[];
}

/**
 * Accessible modal dialog enabling keyboard and single-pointer users to assign
 * or unassign study forms across visits and epochs without mouse dragging.
 *
 * Implements WCAG 2.2 SC 2.5.7 (Dragging Movements - Technique G219) and
 * SC 2.1.1 (Keyboard - Technique G202).
 */
export const AssignToVisitModal: React.FC<AssignToVisitModalProps> = ({
  study,
  formId,
  onClose,
  onCancel,
  onAssignFormToVisit,
  onUnassignFormFromVisit,
}) => {
  const titleId = useId();
  const descId = useId();
  const form = study.forms.find((f) => f.id === formId);

  const handleDismiss = () => {
    onClose?.();
    onCancel?.();
  };

  const dialogRef = useFocusTrap<HTMLDivElement>(true, {
    onEscape: handleDismiss,
  });

  const [announcement, setAnnouncement] = useState<string>("");

  // Keep a local optimistic set of assigned visit IDs so that immediate visual
  // feedback is provided even before the study state propagates or in unit tests.
  const propAssignedVisitIds = useMemo(() => {
    return new Set(
      study.visits
        .filter((v) => v.assignedFormIds?.includes(formId))
        .map((v) => v.id)
    );
  }, [study, formId]);

  const [prevStudy, setPrevStudy] = useState(study);
  const [localAssignedVisitIds, setLocalAssignedVisitIds] =
    useState<Set<string> | null>(null);

  if (prevStudy !== study) {
    setPrevStudy(study);
    setLocalAssignedVisitIds(null);
  }

  const assignedVisitIds = localAssignedVisitIds ?? propAssignedVisitIds;

  // Immediate focus into dialog on mount for environments where timers are not advanced
  useEffect(() => {
    const el = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    el?.focus();
  }, [dialogRef]);

  // Group study visits by epoch
  const epochGroups = useMemo<EpochGroup[]>(() => {
    const baseEpochs =
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

    const groupMap = new Map<string, EpochGroup>();
    for (const epoch of baseEpochs) {
      groupMap.set(epoch.id, {
        id: epoch.id,
        name: epoch.name,
        visits: [],
      });
    }

    const unassignedVisits: StudyVisit[] = [];

    for (const visit of study.visits) {
      if (visit.epochId && groupMap.has(visit.epochId)) {
        groupMap.get(visit.epochId)!.visits.push(visit);
      } else {
        // Fallback epoch inference
        let matchedEpochId: string | null = null;
        for (const epoch of baseEpochs) {
          const isScreening =
            epoch.id.toLowerCase().includes("screen") ||
            epoch.id.toLowerCase().includes("scrn") ||
            (epoch as { type?: string }).type === "Screening";
          const isFollowup =
            epoch.id.toLowerCase().includes("follow") ||
            epoch.id.toLowerCase().includes("fup") ||
            (epoch as { type?: string }).type === "Follow-up";
          const isTreatment =
            epoch.id.toLowerCase().includes("treat") ||
            epoch.id.toLowerCase().includes("trt") ||
            (epoch as { type?: string }).type === "Treatment";

          if (
            isScreening &&
            (visit.id.toLowerCase().includes("screen") || visit.targetDay === 0)
          ) {
            matchedEpochId = epoch.id;
            break;
          } else if (
            isFollowup &&
            (visit.id.toLowerCase().includes("follow") || visit.targetDay > 100)
          ) {
            matchedEpochId = epoch.id;
            break;
          } else if (isTreatment) {
            matchedEpochId = epoch.id;
          }
        }

        if (matchedEpochId && groupMap.has(matchedEpochId)) {
          groupMap.get(matchedEpochId)!.visits.push(visit);
        } else {
          unassignedVisits.push(visit);
        }
      }
    }

    if (unassignedVisits.length > 0) {
      groupMap.set("epoch_other", {
        id: "epoch_other",
        name: "Unscheduled & Other Visits",
        visits: unassignedVisits,
      });
    }

    return Array.from(groupMap.values()).filter(
      (group) => group.visits.length > 0 || study.visits.length === 0
    );
  }, [study]);

  if (!form) return null;

  const handleToggle = (visit: StudyVisit) => {
    const isCurrentlyAssigned = assignedVisitIds.has(visit.id);
    const next = new Set(assignedVisitIds);

    if (isCurrentlyAssigned) {
      next.delete(visit.id);
      setLocalAssignedVisitIds(next);
      onUnassignFormFromVisit(visit.id, formId);
      setAnnouncement(`Unassigned ${form.name} from ${visit.name}`);
    } else {
      next.add(visit.id);
      setLocalAssignedVisitIds(next);
      onAssignFormToVisit(visit.id, formId);
      setAnnouncement(`Assigned ${form.name} to ${visit.name}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleDismiss}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-testid="assign-to-visit-dialog"
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Screen Reader Live Region */}
        <div
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {announcement}
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h3
              id={titleId}
              className="text-sm font-bold font-mono text-white flex items-center gap-1.5"
            >
              <IconCalendarPlus
                className="w-4 h-4 text-brand-cyan shrink-0"
                aria-hidden="true"
              />
              <span className="truncate">Assign {form.name} to Visits</span>
            </h3>
            <p
              id={descId}
              className="text-xs text-zinc-300 leading-relaxed break-words"
            >
              Select visits to assign or unassign this form across study epochs.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
            aria-label="Close dialog"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {study.visits.length === 0 ? (
          <p className="text-xs text-zinc-400">
            No visits available in this study protocol.
          </p>
        ) : (
          <div className="space-y-3">
            {epochGroups.map((group) => (
              <fieldset
                key={group.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-2 min-w-0"
              >
                <legend className="px-1 text-xs font-mono font-bold text-zinc-200">
                  {group.name}
                </legend>
                <div className="space-y-1.5">
                  {group.visits.map((visit) => {
                    const isAssigned = assignedVisitIds.has(visit.id);
                    return (
                      <label
                        key={visit.id}
                        htmlFor={`assign-visit-${visit.id}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleToggle(visit);
                          } else if (
                            e.key === " " &&
                            e.target === e.currentTarget
                          ) {
                            e.preventDefault();
                            handleToggle(visit);
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                          isAssigned
                            ? "bg-brand-cyan/10 border-brand-cyan/40 text-white"
                            : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            id={`assign-visit-${visit.id}`}
                            checked={isAssigned}
                            onChange={() => handleToggle(visit)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleToggle(visit);
                              }
                            }}
                            className="accent-brand-cyan rounded shrink-0 cursor-pointer w-4 h-4"
                            aria-label={`Assign ${form.name} to ${visit.name}`}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">
                              {visit.name}
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono">
                              Day {visit.targetDay}
                              {visit.visitType && ` · ${visit.visitType}`}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                            isAssigned
                              ? "bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700"
                          }`}
                        >
                          {isAssigned ? "Assigned" : "Unassigned"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3.5 py-1.5 rounded-lg bg-brand-cyan hover:bg-brand-cyan/90 text-xs font-mono font-bold text-black transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
