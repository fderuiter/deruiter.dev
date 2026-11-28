"use client";

import { standardCitation } from "@/lib/clinical-standards";
import React, { useState, useEffect, useRef, useReducer } from "react";
import { StudyProtocol, StudyBranding } from "@/lib/crf/types";
import { getStudyBranding } from "@/lib/crf";
import { ModalContainer } from "@/components/ui/ModalContainer";
import { useTelemetry } from "@/hooks/useTelemetry";
import { logger } from "@/lib/logger";
import { downloadFile } from "@/lib/download";
import {
  IconFileSpreadsheet,
  IconDownload,
  IconPrinter,
  IconX,
  IconCheck,
  IconFileText,
  IconPalette,
  IconBook,
  IconListCheck,
  IconLoader2,
  IconCalendar,
  IconAlertTriangle,
  IconRefresh,
} from "@tabler/icons-react";

type ExportFormat = "docx" | "pdf";

type ExportModalState =
  | { status: "idle" }
  | { status: "exporting"; format: ExportFormat }
  | { status: "success"; format: ExportFormat }
  | { status: "error"; format: ExportFormat; message: string };

type ExportAction =
  | { type: "START_EXPORT"; format: ExportFormat }
  | { type: "EXPORT_SUCCESS"; format: ExportFormat }
  | { type: "EXPORT_ERROR"; format: ExportFormat; message: string }
  | { type: "CLEAR_ERROR" }
  | { type: "RESET" };

const initialExportState: ExportModalState = { status: "idle" };

function exportModalReducer(
  state: ExportModalState,
  action: ExportAction
): ExportModalState {
  switch (action.type) {
    case "START_EXPORT":
      if (state.status === "exporting") {
        return state;
      }
      return { status: "exporting", format: action.format };
    case "EXPORT_SUCCESS":
      if (state.status !== "exporting" || state.format !== action.format) {
        return state;
      }
      return { status: "success", format: action.format };
    case "EXPORT_ERROR":
      if (state.status !== "exporting" || state.format !== action.format) {
        return state;
      }
      return {
        status: "error",
        format: action.format,
        message: action.message,
      };
    case "CLEAR_ERROR":
      if (state.status !== "error") {
        return state;
      }
      return { status: "idle" };
    case "RESET":
      return { status: "idle" };
    default:
      return state;
  }
}

interface ExportDocumentModalProps {
  study: StudyProtocol;
  activeFormId: string;
  onClose: () => void;
  onOpenBranding: () => void;
}

export const ExportDocumentModal: React.FC<ExportDocumentModalProps> = ({
  study,
  activeFormId,
  onClose,
  onOpenBranding,
}) => {
  const { recordEvent } = useTelemetry();

  const [exportMode, setExportMode] = useState<"blank" | "annotated">("blank");
  const [scope, setScope] = useState<"all" | "single" | "selected">("all");
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([
    activeFormId || study.forms[0]?.id || "",
  ]);
  const [includeTableOfContents, setIncludeTableOfContents] = useState(true);
  const [includeSdtmAppendix, setIncludeSdtmAppendix] = useState(true);

  const [state, dispatch] = useReducer(exportModalReducer, initialExportState);
  const [isPrinting, setIsPrinting] = useState(false);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  const clearSuccessTimer = () => {
    if (successTimerRef.current !== null) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  };

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      clearSuccessTimer();
    };
  }, []);

  const handleClose = () => {
    clearSuccessTimer();
    dispatch({ type: "RESET" });
    onClose();
  };

  const isExporting = state.status === "exporting";
  const isBusy = isExporting || isPrinting;
  const isExportingDocx =
    state.status === "exporting" && state.format === "docx";
  const isExportingPdf = state.status === "exporting" && state.format === "pdf";
  const docxSuccess = state.status === "success" && state.format === "docx";
  const pdfSuccess = state.status === "success" && state.format === "pdf";
  const exportError =
    state.status === "error"
      ? { message: state.message, format: state.format }
      : null;

  const branding: StudyBranding = getStudyBranding(study);
  const activeForm =
    study.forms.find((f) => f.id === activeFormId) || study.forms[0];

  const handleToggleForm = (formId: string) => {
    if (selectedFormIds.includes(formId)) {
      if (selectedFormIds.length > 1) {
        setSelectedFormIds(selectedFormIds.filter((id) => id !== formId));
      }
    } else {
      setSelectedFormIds([...selectedFormIds, formId]);
    }
  };

  const getEffectiveOptions = () => ({
    mode: exportMode,
    scope,
    selectedFormIds:
      scope === "single"
        ? [activeForm?.id || study.forms[0]?.id || ""]
        : selectedFormIds,
    includeTableOfContents,
    includeSdtmAppendix,
    branding,
  });

  const handleDownloadDocx = async () => {
    if (isBusy) return;
    try {
      clearSuccessTimer();
      if (isMounted.current) {
        dispatch({ type: "START_EXPORT", format: "docx" });
      }
      recordEvent("crf", "project_click");
      const options = getEffectiveOptions();
      const { generateStudyDocx } = await import("@/lib/crf/export-docx");
      const blob = await generateStudyDocx(study, options);
      if (!isMounted.current) return;
      const filename = `${study.protocolNumber}-${exportMode === "annotated" ? "aCRF" : "CRF"}-book.docx`;
      downloadFile(blob, filename);
      if (isMounted.current) {
        clearSuccessTimer();
        dispatch({ type: "EXPORT_SUCCESS", format: "docx" });
        successTimerRef.current = setTimeout(() => {
          if (isMounted.current) {
            dispatch({ type: "RESET" });
          }
          successTimerRef.current = null;
        }, 2500);
      }
    } catch (err) {
      logger.error("Failed to generate Word document:", err);
      if (isMounted.current) {
        dispatch({
          type: "EXPORT_ERROR",
          format: "docx",
          message:
            "Failed to generate Word document (.docx). Please check study configuration and retry.",
        });
      }
    }
  };

  const handleDownloadPdf = async () => {
    if (isBusy) return;
    try {
      clearSuccessTimer();
      if (isMounted.current) {
        dispatch({ type: "START_EXPORT", format: "pdf" });
      }
      recordEvent("crf", "project_click");
      const options = getEffectiveOptions();
      const { generateStudyPdf } = await import("@/lib/crf/export-pdf");
      const blob = await generateStudyPdf(study, options);
      if (!isMounted.current) return;
      const filename = `${study.protocolNumber}-${exportMode === "annotated" ? "aCRF" : "CRF"}-book.pdf`;
      downloadFile(blob, filename);
      if (isMounted.current) {
        clearSuccessTimer();
        dispatch({ type: "EXPORT_SUCCESS", format: "pdf" });
        successTimerRef.current = setTimeout(() => {
          if (isMounted.current) {
            dispatch({ type: "RESET" });
          }
          successTimerRef.current = null;
        }, 2500);
      }
    } catch (err) {
      logger.error("Failed to generate PDF document:", err);
      if (isMounted.current) {
        dispatch({
          type: "EXPORT_ERROR",
          format: "pdf",
          message:
            "Failed to generate PDF document (.pdf). Please check study configuration and retry.",
        });
      }
    }
  };

  const handlePrint = async () => {
    if (isBusy) return;
    setIsPrinting(true);
    try {
      recordEvent("crf", "project_click");
      const { generateAcrfHtml, generateStudyAcrfBookHtml } =
        await import("@/lib/crf");
      if (!isMounted.current) return;
      const htmlContent =
        scope === "single" && activeForm
          ? generateAcrfHtml(activeForm, study, { mode: exportMode, branding })
          : generateStudyAcrfBookHtml(study, { mode: exportMode, branding });

      if (!htmlContent || !isMounted.current) return;
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(htmlContent);
        win.document.close();
        win.focus();
        setTimeout(() => {
          win.print();
        }, 400);
      }
    } finally {
      if (isMounted.current) {
        setIsPrinting(false);
      }
    }
  };

  const targetFormCount =
    scope === "all"
      ? study.forms.length
      : scope === "single"
        ? 1
        : selectedFormIds.length;

  return (
    <ModalContainer
      isOpen={true}
      onClose={handleClose}
      titleId="export-modal-title"
      maxWidth="max-w-3xl"
      className="studio-surface-elevated studio-border-default studio-fg-primary"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b studio-border-default studio-surface-subtle">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl studio-accent-cyan border">
            <IconFileSpreadsheet className="w-5 h-5" />
          </span>
          <div>
            <h2
              id="export-modal-title"
              className="text-base font-bold studio-fg-primary font-mono uppercase tracking-wide"
            >
              Clinical Word (.docx) &amp; PDF Exporter
            </h2>
            <p className="text-xs studio-fg-muted font-sans">
              Export clinical worksheets and regulatory submission aCRFs with
              your organization&apos;s custom branding.
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          aria-label="Close export modal"
          className="p-1.5 rounded-lg studio-fg-muted studio-hover-fg-primary studio-hover-surface transition-colors"
        >
          <IconX className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Error Banner */}
        {exportError && (
          <div
            role="alert"
            className="p-3.5 rounded-xl studio-accent-red-strong border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono"
          >
            <div className="flex items-center gap-2.5">
              <IconAlertTriangle className="w-4 h-4 studio-fg-red shrink-0" />
              <span>{exportError.message}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  if (exportError.format === "docx") {
                    handleDownloadDocx();
                  } else {
                    handleDownloadPdf();
                  }
                }}
                disabled={isBusy}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg studio-accent-red-strong studio-hover-bg-red border font-mono text-xs font-bold transition-colors disabled:opacity-50"
              >
                <IconRefresh className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
              <button
                type="button"
                aria-label="Dismiss error"
                onClick={() => {
                  clearSuccessTimer();
                  dispatch({ type: "CLEAR_ERROR" });
                }}
                className="p-1 rounded-lg studio-fg-red studio-hover-fg-red studio-hover-bg-red transition-colors"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Active Branding Strip */}
        <div className="p-3.5 rounded-xl studio-surface-subtle border studio-border-default flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-3.5 h-3.5 rounded-full ring-2 studio-ring-default"
              style={{ backgroundColor: branding.primaryColor }}
            />
            <div>
              <div className="text-xs font-bold studio-fg-primary font-mono">
                {branding.organizationName}
              </div>
              <div className="text-[10px] studio-fg-muted">
                Primary:{" "}
                <span className="font-mono studio-fg-secondary">
                  {branding.primaryColor}
                </span>{" "}
                • Logo:{" "}
                <span className="font-mono studio-fg-secondary">
                  {branding.logoBase64 ? "Custom Uploaded" : "Default"}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenBranding}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg studio-surface-muted studio-hover-active border studio-border-strong studio-fg-cyan text-xs font-mono transition-colors"
          >
            <IconPalette className="w-3.5 h-3.5" />
            <span>Customize Branding</span>
          </button>
        </div>

        {/* 1. Document Mode Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold studio-fg-secondary font-mono uppercase">
            1. Document Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setExportMode("blank")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                exportMode === "blank"
                  ? "studio-bg-cyan studio-border-cyan studio-fg-primary shadow-sm"
                  : "studio-surface-subtle studio-border-default studio-fg-muted studio-hover-fg-primary"
              }`}
            >
              <div className="flex items-center gap-2 font-mono text-xs font-bold studio-fg-primary mb-1">
                <IconFileText className="w-4 h-4 studio-fg-cyan" />
                <span>Blank Data Collection Forms</span>
              </div>
              <p className="text-[11px] studio-fg-muted font-sans">
                Clean worksheets for clinical site investigators, subject source
                records, and paper-entry backup.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setExportMode("annotated")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                exportMode === "annotated"
                  ? "studio-bg-cyan studio-border-cyan studio-fg-primary shadow-sm"
                  : "studio-surface-subtle studio-border-default studio-fg-muted studio-hover-fg-primary"
              }`}
            >
              <div className="flex items-center gap-2 font-mono text-xs font-bold studio-fg-primary mb-1">
                <IconBook className="w-4 h-4 studio-fg-purple" />
                <span>Annotated Submission aCRF</span>
              </div>
              <p className="text-[11px] studio-fg-muted font-sans">
                CDISC {standardCitation("SDTMIG")} /{" "}
                {standardCitation("CDASHIG")} variable tags, origin badges, and
                regulatory submission metadata.
              </p>
            </button>
          </div>
        </div>

        {/* 2. Export Scope Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold studio-fg-secondary font-mono uppercase">
            2. Export Scope
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`px-3 py-2 rounded-xl border text-xs font-mono transition-all ${
                scope === "all"
                  ? "studio-surface-muted studio-border-cyan studio-fg-cyan font-bold"
                  : "studio-surface-subtle studio-border-default studio-fg-muted studio-hover-fg-primary"
              }`}
            >
              Entire Study Book ({study.forms.length} Forms)
            </button>

            <button
              type="button"
              onClick={() => setScope("single")}
              className={`px-3 py-2 rounded-xl border text-xs font-mono transition-all ${
                scope === "single"
                  ? "studio-surface-muted studio-border-cyan studio-fg-cyan font-bold"
                  : "studio-surface-subtle studio-border-default studio-fg-muted studio-hover-fg-primary"
              }`}
            >
              Active Form Only ([{activeForm?.domain}])
            </button>

            <button
              type="button"
              onClick={() => setScope("selected")}
              className={`px-3 py-2 rounded-xl border text-xs font-mono transition-all ${
                scope === "selected"
                  ? "studio-surface-muted studio-border-cyan studio-fg-cyan font-bold"
                  : "studio-surface-subtle studio-border-default studio-fg-muted studio-hover-fg-primary"
              }`}
            >
              Custom Multi-Form ({selectedFormIds.length})
            </button>
          </div>

          {/* Custom Multi-Form Checkbox Matrix */}
          {scope === "selected" && (
            <div className="p-3 studio-surface-subtle border studio-border-default rounded-xl grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto">
              {study.forms.map((f) => (
                <label
                  key={f.id}
                  className="flex items-center gap-2 text-xs font-mono studio-fg-secondary cursor-pointer studio-hover-fg-primary"
                >
                  <input
                    type="checkbox"
                    checked={selectedFormIds.includes(f.id)}
                    onChange={() => handleToggleForm(f.id)}
                    className="rounded studio-border-strong studio-surface-card studio-fg-cyan focus:ring-0"
                  />
                  <span className="truncate">
                    [{f.domain}] {f.name}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 3. Document Sections & Options */}
        <div className="space-y-2">
          <label className="text-xs font-bold studio-fg-secondary font-mono uppercase flex items-center gap-1">
            <IconListCheck className="w-3.5 h-3.5 studio-fg-cyan" />
            <span>3. Document Structure &amp; Appendices</span>
          </label>
          <div className="p-3.5 studio-surface-subtle border studio-border-default rounded-xl space-y-2.5">
            <label className="flex items-center gap-2.5 text-xs font-mono studio-fg-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={includeTableOfContents}
                onChange={(e) => setIncludeTableOfContents(e.target.checked)}
                className="rounded studio-border-strong studio-surface-card studio-fg-cyan focus:ring-0"
              />
              <span>Include Table of Contents &amp; SDTM Domain Index</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-mono studio-fg-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={includeSdtmAppendix}
                onChange={(e) => setIncludeSdtmAppendix(e.target.checked)}
                className="rounded studio-border-strong studio-surface-card studio-fg-cyan focus:ring-0"
              />
              <span>
                Include SDTM Target Variable Mapping Matrix (Appendix)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t studio-border-default studio-surface-subtle">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl studio-surface-muted studio-hover-active border studio-border-strong studio-fg-primary font-mono text-xs transition-colors disabled:opacity-50"
          >
            <IconPrinter className="w-4 h-4" />
            <span>Print / Preview</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Word (.docx) Button */}
          <button
            type="button"
            onClick={handleDownloadDocx}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl studio-btn-sky font-mono text-xs font-bold transition-all shadow-md disabled:opacity-50"
          >
            {isExportingDocx ? (
              <IconLoader2 className="w-4 h-4 animate-spin" />
            ) : docxSuccess ? (
              <IconCheck className="w-4 h-4" />
            ) : (
              <IconDownload className="w-4 h-4" />
            )}
            <span>
              {docxSuccess
                ? "Downloaded Word!"
                : `Export Word (.docx) [${targetFormCount}]`}
            </span>
          </button>

          {/* PDF (.pdf) Button */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl studio-btn-cyan font-mono text-xs font-bold transition-all shadow-md disabled:opacity-50"
          >
            {isExportingPdf ? (
              <IconLoader2 className="w-4 h-4 animate-spin" />
            ) : pdfSuccess ? (
              <IconCheck className="w-4 h-4" />
            ) : (
              <IconDownload className="w-4 h-4" />
            )}
            <span>
              {pdfSuccess
                ? "Downloaded PDF!"
                : `Export PDF (.pdf) [${targetFormCount}]`}
            </span>
          </button>
          <a
            href="/schedule"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordEvent("crf", "project_click")}
            className="inline-flex items-center gap-1.5 px-2 py-2 studio-fg-muted studio-hover-fg-primary font-mono text-xs underline decoration-current underline-offset-4 transition-colors"
          >
            <IconCalendar className="w-4 h-4" />
            <span>Schedule Consultation</span>
          </a>
        </div>
      </div>
    </ModalContainer>
  );
};
