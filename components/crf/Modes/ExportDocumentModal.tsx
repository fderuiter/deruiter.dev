"use client";

import React, { useState, useEffect, useRef } from "react";
import { StudyProtocol, StudyBranding } from "@/lib/crf/types";
import { getStudyBranding } from "@/lib/crf/branding-defaults";
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
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [docxSuccess, setDocxSuccess] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [exportError, setExportError] = useState<{
    message: string;
    format: "docx" | "pdf";
  } | null>(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClose = () => {
    setExportError(null);
    onClose();
  };

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
    try {
      if (isMounted.current) {
        setIsExportingDocx(true);
        setExportError(null);
      }
      recordEvent("crf", "project_click");
      const options = getEffectiveOptions();
      const { generateStudyDocx } = await import("@/lib/crf/export-docx");
      const blob = await generateStudyDocx(study, options);
      const filename = `${study.protocolNumber}-${exportMode === "annotated" ? "aCRF" : "CRF"}-book.docx`;
      downloadFile(blob, filename);
      if (isMounted.current) {
        setDocxSuccess(true);
        setTimeout(() => {
          if (isMounted.current) setDocxSuccess(false);
        }, 2500);
      }
    } catch (err) {
      logger.error("Failed to generate Word document:", err);
      if (isMounted.current) {
        setExportError({
          message:
            "Failed to generate Word document (.docx). Please check study configuration and retry.",
          format: "docx",
        });
      }
    } finally {
      if (isMounted.current) {
        setIsExportingDocx(false);
      }
    }
  };

  const handleDownloadPdf = async () => {
    try {
      if (isMounted.current) {
        setIsExportingPdf(true);
        setExportError(null);
      }
      recordEvent("crf", "project_click");
      const options = getEffectiveOptions();
      const { generateStudyPdf } = await import("@/lib/crf/export-pdf");
      const blob = await generateStudyPdf(study, options);
      const filename = `${study.protocolNumber}-${exportMode === "annotated" ? "aCRF" : "CRF"}-book.pdf`;
      downloadFile(blob, filename);
      if (isMounted.current) {
        setPdfSuccess(true);
        setTimeout(() => {
          if (isMounted.current) setPdfSuccess(false);
        }, 2500);
      }
    } catch (err) {
      logger.error("Failed to generate PDF document:", err);
      if (isMounted.current) {
        setExportError({
          message:
            "Failed to generate PDF document (.pdf). Please check study configuration and retry.",
          format: "pdf",
        });
      }
    } finally {
      if (isMounted.current) {
        setIsExportingPdf(false);
      }
    }
  };

  const handlePrint = async () => {
    recordEvent("crf", "project_click");
    const { generateAcrfHtml, generateStudyAcrfBookHtml } =
      await import("@/lib/crf/export-acrf");
    const htmlContent =
      scope === "single" && activeForm
        ? generateAcrfHtml(activeForm, study, { mode: exportMode, branding })
        : generateStudyAcrfBookHtml(study, { mode: exportMode, branding });

    if (!htmlContent) return;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(htmlContent);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 400);
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
      className="bg-zinc-900 border-zinc-750"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan">
            <IconFileSpreadsheet className="w-5 h-5" />
          </span>
          <div>
            <h2
              id="export-modal-title"
              className="text-base font-bold text-white font-mono uppercase tracking-wide"
            >
              Clinical Word (.docx) &amp; PDF Exporter
            </h2>
            <p className="text-xs text-zinc-400 font-sans">
              Export clinical worksheets and regulatory submission aCRFs with
              your organization&apos;s custom branding.
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
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
            className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono"
          >
            <div className="flex items-center gap-2.5">
              <IconAlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
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
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-900/60 hover:bg-red-800/80 border border-red-700/60 text-red-100 font-mono text-xs font-bold transition-colors"
              >
                <IconRefresh className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
              <button
                type="button"
                aria-label="Dismiss error"
                onClick={() => setExportError(null)}
                className="p-1 rounded-lg text-red-400 hover:text-red-200 hover:bg-red-900/40 transition-colors"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Active Branding Strip */}
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-3.5 h-3.5 rounded-full ring-2 ring-zinc-700"
              style={{ backgroundColor: branding.primaryColor }}
            />
            <div>
              <div className="text-xs font-bold text-white font-mono">
                {branding.organizationName}
              </div>
              <div className="text-[10px] text-zinc-400">
                Primary:{" "}
                <span className="font-mono text-zinc-300">
                  {branding.primaryColor}
                </span>{" "}
                • Logo:{" "}
                <span className="font-mono text-zinc-300">
                  {branding.logoBase64 ? "Custom Uploaded" : "Default"}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenBranding}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-brand-cyan text-xs font-mono transition-colors"
          >
            <IconPalette className="w-3.5 h-3.5" />
            <span>Customize Branding</span>
          </button>
        </div>

        {/* 1. Document Mode Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-300 font-mono uppercase">
            1. Document Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setExportMode("blank")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                exportMode === "blank"
                  ? "bg-brand-cyan/10 border-brand-cyan text-white shadow-sm"
                  : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white mb-1">
                <IconFileText className="w-4 h-4 text-brand-cyan" />
                <span>Blank Data Collection Forms</span>
              </div>
              <p className="text-[11px] text-zinc-400 font-sans">
                Clean worksheets for clinical site investigators, subject source
                records, and paper-entry backup.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setExportMode("annotated")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                exportMode === "annotated"
                  ? "bg-brand-cyan/10 border-brand-cyan text-white shadow-sm"
                  : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-white mb-1">
                <IconBook className="w-4 h-4 text-purple-400" />
                <span>Annotated Submission aCRF</span>
              </div>
              <p className="text-[11px] text-zinc-400 font-sans">
                CDISC SDTMIG v3.4 / CDASH v2.2 variable tags, origin badges, and
                regulatory submission metadata.
              </p>
            </button>
          </div>
        </div>

        {/* 2. Export Scope Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-300 font-mono uppercase">
            2. Export Scope
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`px-3 py-2 rounded-xl border text-xs font-mono transition-all ${
                scope === "all"
                  ? "bg-zinc-800 border-brand-cyan text-brand-cyan font-bold"
                  : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              Entire Study Book ({study.forms.length} Forms)
            </button>

            <button
              type="button"
              onClick={() => setScope("single")}
              className={`px-3 py-2 rounded-xl border text-xs font-mono transition-all ${
                scope === "single"
                  ? "bg-zinc-800 border-brand-cyan text-brand-cyan font-bold"
                  : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              Active Form Only ([{activeForm?.domain}])
            </button>

            <button
              type="button"
              onClick={() => setScope("selected")}
              className={`px-3 py-2 rounded-xl border text-xs font-mono transition-all ${
                scope === "selected"
                  ? "bg-zinc-800 border-brand-cyan text-brand-cyan font-bold"
                  : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              Custom Multi-Form ({selectedFormIds.length})
            </button>
          </div>

          {/* Custom Multi-Form Checkbox Matrix */}
          {scope === "selected" && (
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto">
              {study.forms.map((f) => (
                <label
                  key={f.id}
                  className="flex items-center gap-2 text-xs font-mono text-zinc-300 cursor-pointer hover:text-white"
                >
                  <input
                    type="checkbox"
                    checked={selectedFormIds.includes(f.id)}
                    onChange={() => handleToggleForm(f.id)}
                    className="rounded border-zinc-700 bg-zinc-900 text-brand-cyan focus:ring-0"
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
          <label className="text-xs font-bold text-zinc-300 font-mono uppercase flex items-center gap-1">
            <IconListCheck className="w-3.5 h-3.5 text-brand-cyan" />
            <span>3. Document Structure &amp; Appendices</span>
          </label>
          <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2.5">
            <label className="flex items-center gap-2.5 text-xs font-mono text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTableOfContents}
                onChange={(e) => setIncludeTableOfContents(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-brand-cyan focus:ring-0"
              />
              <span>Include Table of Contents &amp; SDTM Domain Index</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-mono text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSdtmAppendix}
                onChange={(e) => setIncludeSdtmAppendix(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-brand-cyan focus:ring-0"
              />
              <span>
                Include SDTM Target Variable Mapping Matrix (Appendix)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-200 font-mono text-xs transition-colors"
          >
            <IconPrinter className="w-4 h-4" />
            <span>Print / Preview</span>
          </button>
          <a
            href="/schedule"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordEvent("crf", "project_click")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition-all shadow-sm"
          >
            <IconCalendar className="w-4 h-4" />
            <span>Schedule Consultation</span>
          </a>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Word (.docx) Button */}
          <button
            type="button"
            onClick={handleDownloadDocx}
            disabled={isExportingDocx || isExportingPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold transition-all shadow-md disabled:opacity-50"
          >
            {isExportingDocx ? (
              <IconLoader2 className="w-4 h-4 animate-spin" />
            ) : docxSuccess ? (
              <IconCheck className="w-4 h-4 text-emerald-300" />
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
            disabled={isExportingDocx || isExportingPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-cyan text-black hover:bg-white font-mono text-xs font-bold transition-all shadow-md disabled:opacity-50"
          >
            {isExportingPdf ? (
              <IconLoader2 className="w-4 h-4 animate-spin" />
            ) : pdfSuccess ? (
              <IconCheck className="w-4 h-4 text-emerald-900" />
            ) : (
              <IconDownload className="w-4 h-4" />
            )}
            <span>
              {pdfSuccess
                ? "Downloaded PDF!"
                : `Export PDF (.pdf) [${targetFormCount}]`}
            </span>
          </button>
        </div>
      </div>
    </ModalContainer>
  );
};
