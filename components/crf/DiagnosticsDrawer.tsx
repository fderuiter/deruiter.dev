"use client";

import { standardCitation } from "@/lib/clinical-standards";
import React, { useState, useMemo, startTransition } from "react";
import {
  StudyProtocol,
  ComplianceViolation,
  ComplianceSeverity,
} from "@/lib/crf/types";
import {
  validateStudyCompliance,
  autoFixViolation,
  autoFixAllViolations,
} from "@/lib/crf";
import {
  IconCheck,
  IconX,
  IconShieldCheck,
  IconWand,
} from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useCrfService } from "@/hooks/useCrfService";
import { TooltipButton } from "@/components/ui/Tooltip";

interface DiagnosticsDrawerProps {
  isOpen: boolean;
  study: StudyProtocol;
  onClose: () => void;
  onSelectForm: (formId: string) => void;
  onUpdateStudy?: (updated: StudyProtocol) => void;
}

export const DiagnosticsDrawer: React.FC<DiagnosticsDrawerProps> = ({
  isOpen,
  study,
  onClose,
  onSelectForm,
  onUpdateStudy,
}) => {
  const { lintForm } = useCrfService();
  const [filterSeverity, setFilterSeverity] = useState<
    "all" | ComplianceSeverity
  >("all");
  const [fixedNotice, setFixedNotice] = useState<string | null>(null);

  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, {
    onEscape: onClose,
    returnFocus: true,
  });

  // Requirement 3: Memoize diagnostic drawer evaluation results so compliance scans run only when study protocol state changes
  const { astDiagnostics, complianceViolations, totalErrors, totalWarnings } =
    useMemo(() => {
      if (!isOpen) {
        return {
          astDiagnostics: [],
          complianceViolations: [],
          totalErrors: 0,
          totalWarnings: 0,
        };
      }
      const astDiags: {
        id: string;
        formName: string;
        formId: string;
        message: string;
        location: string;
        severity: string;
      }[] = [];
      study.forms.forEach((form) => {
        const res = lintForm({ form });
        const items = res.success ? res.data : [];
        items.forEach((item) => {
          astDiags.push({
            id: `${form.id}_${item.id}`,
            formName: form.name,
            formId: form.id,
            message: item.message,
            location: item.location,
            severity: item.severity,
          });
        });
      });

      const compViolations = validateStudyCompliance(study);

      const errs =
        compViolations.filter((v) => v.severity === "error").length +
        astDiags.filter((d) => d.severity === "error").length;

      const warns =
        compViolations.filter((v) => v.severity === "warning").length +
        astDiags.filter((d) => d.severity === "warning").length;

      return {
        astDiagnostics: astDiags,
        complianceViolations: compViolations,
        totalErrors: errs,
        totalWarnings: warns,
      };
    }, [isOpen, study, lintForm]);

  if (!isOpen) return null;

  const filteredViolations = complianceViolations.filter((v) =>
    filterSeverity === "all" ? true : v.severity === filterSeverity
  );

  // AST/rule-reference diagnostics (broken trigger/target field references,
  // dead rules, duplicate variables) only ever fed the header counts above;
  // they were never rendered as findings, so "rule-reference error" had no
  // way to be inspected or navigated to at all. Map their severity onto the
  // same error/warning tabs ("info" only surfaces under "All Issues", since
  // there is no dedicated tab for it) so they share one findings list.
  const filteredAstDiagnostics = astDiagnostics.filter((d) =>
    filterSeverity === "all" ? true : d.severity === filterSeverity
  );

  const handleFixSingle = (violation: ComplianceViolation) => {
    if (!onUpdateStudy) return;
    const fixed = autoFixViolation(study, violation);
    startTransition(() => {
      onUpdateStudy(fixed);
    });
    setFixedNotice(`Remediated ${violation.ruleId}: ${violation.suggestedFix}`);
    setTimeout(() => setFixedNotice(null), 3000);
  };

  const handleFixAll = () => {
    if (!onUpdateStudy) return;
    const { updatedStudy, fixedCount } = autoFixAllViolations(study);
    startTransition(() => {
      onUpdateStudy(updatedStudy);
    });
    setFixedNotice(
      `Successfully auto-fixed ${fixedCount} compliance issues across the study!`
    );
    setTimeout(() => setFixedNotice(null), 4000);
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 studio-surface-scrim backdrop-blur-sm"
    >
      <div className="studio-surface-elevated border studio-border-strong rounded-2xl w-full max-w-3xl max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b studio-border-default studio-surface-subtle">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-1.5 sm:p-2 rounded-lg studio-accent-cyan border shrink-0">
              <IconShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-base font-bold studio-fg-primary font-mono flex items-center gap-2 flex-wrap">
                <span className="truncate">
                  CDISC Conformance &amp; Regulatory Validation Studio
                </span>
                <span className="text-[9px] sm:text-[10px] studio-accent-cyan-strong px-1.5 sm:px-2 py-0.5 rounded border">
                  {standardCitation("CDASHIG")} / {standardCitation("SDTMIG")}
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs studio-fg-muted font-sans truncate sm:whitespace-normal">
                Real-time validation for missing core variables and SDTM limits
                with 1-Click Auto-Fix.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close diagnostics drawer"
            className="p-1.5 rounded-lg studio-fg-muted studio-hover-fg-primary studio-hover-surface transition-colors shrink-0"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Severity Filter Tabs & Auto-Fix All Action */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b studio-border-default studio-surface-subtle flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterSeverity("all")}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                filterSeverity === "all"
                  ? "studio-surface-muted studio-fg-primary font-bold"
                  : "studio-fg-muted studio-hover-fg-primary"
              }`}
            >
              All Issues ({complianceViolations.length + astDiagnostics.length})
            </button>
            <button
              onClick={() => setFilterSeverity("error")}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
                filterSeverity === "error"
                  ? "studio-accent-red-strong border font-bold"
                  : "studio-fg-muted studio-hover-fg-primary"
              }`}
            >
              <span>Errors</span>
              <span className="text-[10px] studio-bg-red-strong px-1.5 py-0.2 rounded">
                {totalErrors}
              </span>
            </button>
            <button
              onClick={() => setFilterSeverity("warning")}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
                filterSeverity === "warning"
                  ? "studio-accent-amber-strong border font-bold"
                  : "studio-fg-muted studio-hover-fg-primary"
              }`}
            >
              <span>Warnings</span>
              <span className="text-[10px] studio-bg-amber-strong px-1.5 py-0.2 rounded">
                {totalWarnings}
              </span>
            </button>
          </div>

          {complianceViolations.some((v) => v.autoFixAvailable) &&
            onUpdateStudy && (
              <button
                onClick={handleFixAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl studio-btn-cyan font-mono text-xs font-bold transition-all shadow-sm"
              >
                <IconWand className="w-3.5 h-3.5" />
                <span>1-Click Auto-Fix All</span>
              </button>
            )}
        </div>

        {/* Action Notice Alert */}
        {fixedNotice && (
          <div className="mx-6 mt-4 p-3 rounded-xl studio-accent-emerald border text-xs font-mono flex items-center gap-2 animate-in fade-in">
            <IconCheck className="w-4 h-4 studio-fg-emerald shrink-0" />
            <span>{fixedNotice}</span>
          </div>
        )}

        {/* Diagnostics Results Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {complianceViolations.length === 0 && astDiagnostics.length === 0 ? (
            <div className="p-8 rounded-2xl studio-surface-subtle border studio-border-default text-center space-y-2">
              <div className="w-10 h-10 rounded-full studio-accent-emerald border flex items-center justify-center mx-auto">
                <IconCheck className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold studio-fg-primary font-mono">
                No findings from the implemented checks
              </div>
              <p className="text-xs studio-fg-muted">
                Forms, variable identifiers, formulas, codelists and Schedule of
                Activities visits pass the design checks this studio implements,
                a subset of {standardCitation("CDASHIG")} and{" "}
                {standardCitation("SDTMIG")} rules. This is not a full
                conformance validation.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredViolations.map((v) => (
                <div
                  key={v.id}
                  className={`p-4 rounded-xl border font-mono text-xs space-y-2 transition-all ${
                    v.severity === "error"
                      ? "studio-bg-red studio-border-red"
                      : "studio-bg-amber studio-border-amber"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            v.severity === "error"
                              ? "studio-accent-red-strong border"
                              : "studio-accent-amber-strong border"
                          }`}
                        >
                          {v.ruleId}
                        </span>
                        <span className="font-bold studio-fg-primary">
                          Form: {v.formName}
                        </span>
                        {v.variableName && (
                          <span className="studio-fg-cyan">
                            ({v.variableName})
                          </span>
                        )}
                      </div>
                      <p className="text-xs studio-fg-secondary font-sans">
                        {v.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {v.autoFixAvailable && onUpdateStudy && (
                        <TooltipButton
                          onClick={() => handleFixSingle(v)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg studio-accent-cyan-strong studio-hover-bg-cyan-strong border text-[11px] font-mono transition-colors"
                          tooltip="Apply instant schema fix"
                        >
                          <IconWand className="w-3 h-3" />
                          <span>Fix Rule</span>
                        </TooltipButton>
                      )}

                      <button
                        onClick={() => {
                          onSelectForm(v.formId);
                          onClose();
                        }}
                        className="text-[11px] font-mono studio-fg-muted studio-hover-fg-primary underline ml-1"
                      >
                        Inspect Form →
                      </button>
                    </div>
                  </div>

                  {v.suggestedFix && (
                    <div className="text-[10px] studio-fg-muted font-sans pt-1 border-t studio-border-default">
                      Suggested Remedy:{" "}
                      <span className="studio-fg-secondary font-mono">
                        {v.suggestedFix}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {filteredAstDiagnostics.map((d) => (
                <div
                  key={d.id}
                  className={`p-4 rounded-xl border font-mono text-xs space-y-2 transition-all ${
                    d.severity === "error"
                      ? "studio-bg-red studio-border-red"
                      : d.severity === "warning"
                        ? "studio-bg-amber studio-border-amber"
                        : "studio-surface-muted studio-border-strong"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            d.severity === "error"
                              ? "studio-accent-red-strong border"
                              : d.severity === "warning"
                                ? "studio-accent-amber-strong border"
                                : "studio-surface-active studio-fg-secondary border studio-border-strong"
                          }`}
                        >
                          Rule Ref
                        </span>
                        <span className="font-bold studio-fg-primary">
                          Form: {d.formName}
                        </span>
                      </div>
                      <p className="text-xs studio-fg-secondary font-sans">
                        {d.message}
                      </p>
                      <p className="text-[10px] studio-fg-muted font-sans">
                        {d.location}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        onSelectForm(d.formId);
                        onClose();
                      }}
                      className="text-[11px] font-mono studio-fg-muted studio-hover-fg-primary underline ml-1 shrink-0"
                    >
                      Inspect Form →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t studio-border-default studio-surface-subtle flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 studio-surface-muted studio-hover-active studio-fg-primary rounded-lg text-xs font-mono transition-colors"
          >
            Close Conformance Studio
          </button>
        </div>
      </div>
    </div>
  );
};
