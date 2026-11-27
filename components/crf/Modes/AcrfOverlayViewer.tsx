"use client";

import {
  CLINICAL_STANDARDS_PROFILE,
  standardCitation,
} from "@/lib/clinical-standards";
import React, { useState, useEffect, useMemo } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { StudyProtocol } from "@/lib/crf/types";
import { type SdtmMappingRow, getStudyBranding } from "@/lib/crf";
import {
  IconFileCode,
  IconPrinter,
  IconBook,
  IconTable,
  IconPalette,
  IconFileSpreadsheet,
} from "@tabler/icons-react";

interface AcrfOverlayViewerProps {
  study: StudyProtocol;
  activeFormId: string;
  onOpenExportModal?: () => void;
  onOpenBranding?: () => void;
}

type AcrfViewMode = "single_form" | "study_book" | "sdtm_matrix";

export const AcrfOverlayViewer: React.FC<AcrfOverlayViewerProps> = ({
  study,
  activeFormId,
  onOpenExportModal,
  onOpenBranding,
}) => {
  // getStudyBranding builds a new object per call; memoizing keeps the
  // regeneration effect below from re-running on every render (#1199).
  const branding = useMemo(() => getStudyBranding(study), [study]);
  const [viewMode, setViewMode] = useState<AcrfViewMode>("single_form");
  const [selectedFormId, setSelectedFormId] = useState(
    activeFormId || study.forms[0]?.id || ""
  );

  const activeForm =
    study.forms.find((f) => f.id === selectedFormId) || study.forms[0];
  const [sdtmMatrix, setSdtmMatrix] = useState<SdtmMappingRow[]>([]);
  const [acrfHtml, setAcrfHtml] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    import("@/lib/crf").then(
      ({
        generateSdtmMappingMatrix,
        generateStudyAcrfBookHtml,
        generateAcrfHtml,
      }) => {
        if (!isMounted) return;
        setSdtmMatrix(generateSdtmMappingMatrix(study));
        const html =
          viewMode === "study_book"
            ? generateStudyAcrfBookHtml(study, { mode: "annotated", branding })
            : activeForm
              ? generateAcrfHtml(activeForm, study, {
                  mode: "annotated",
                  branding,
                })
              : "";
        setAcrfHtml(html);
      }
    );
    return () => {
      isMounted = false;
    };
  }, [study, viewMode, activeForm, branding]);

  const handlePrint = async () => {
    let htmlContent = acrfHtml;
    if (!htmlContent) {
      const { generateStudyAcrfBookHtml, generateAcrfHtml } =
        await import("@/lib/crf");
      htmlContent =
        viewMode === "study_book"
          ? generateStudyAcrfBookHtml(study, { mode: "annotated", branding })
          : activeForm
            ? generateAcrfHtml(activeForm, study, {
                mode: "annotated",
                branding,
              })
            : "";
    }

    if (!htmlContent) return;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(htmlContent);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 500);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full studio-surface-canvas p-4 sm:p-6 overflow-y-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b studio-border-default">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg studio-accent-sky border">
              <IconFileCode className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold studio-fg-primary font-mono">
              Visual Annotated CRF (aCRF) Submission Studio
            </h2>
          </div>
          <p className="text-xs studio-fg-muted font-sans mt-1">
            Publication-ready blank case report form with{" "}
            {standardCitation("SDTMIG")} / CDASH variable annotation overlays
            for FDA, EMA, and PMDA filings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onOpenBranding && (
            <button
              onClick={onOpenBranding}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl studio-surface-card studio-hover-surface border studio-border-default studio-fg-secondary studio-hover-fg-primary text-xs font-mono transition-all"
            >
              <IconPalette className="w-4 h-4 studio-fg-cyan" />
              <span>Branding</span>
            </button>
          )}

          {onOpenExportModal && (
            <button
              onClick={onOpenExportModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl studio-btn-sky font-mono text-xs font-bold transition-all shadow-sm"
            >
              <IconFileSpreadsheet className="w-4 h-4" />
              <span>Export Docx / PDF</span>
            </button>
          )}

          <CopyButton
            text={acrfHtml}
            label="Copy aCRF HTML"
            copiedLabel="Copied HTML!"
            successMessage="aCRF HTML content copied to clipboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl studio-surface-muted studio-hover-active border studio-border-strong studio-fg-primary text-xs font-mono transition-all cursor-pointer"
          />
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl studio-btn-cyan font-mono text-xs font-bold transition-all shadow-sm"
          >
            <IconPrinter className="w-4 h-4" />
            <span>
              {viewMode === "study_book"
                ? "Print aCRF Book"
                : "Print Form aCRF"}
            </span>
          </button>
        </div>
      </div>

      {/* View Mode Switcher */}
      <div className="flex items-center gap-2 border-b studio-border-default pb-2">
        <button
          onClick={() => setViewMode("single_form")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
            viewMode === "single_form"
              ? "studio-btn-cyan font-bold"
              : "studio-surface-card border studio-border-default studio-fg-muted studio-hover-fg-primary studio-hover-surface"
          }`}
        >
          <IconFileCode className="w-4 h-4" />
          <span>Single Form aCRF</span>
        </button>
        <button
          onClick={() => setViewMode("study_book")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
            viewMode === "study_book"
              ? "studio-btn-cyan font-bold"
              : "studio-surface-card border studio-border-default studio-fg-muted studio-hover-fg-primary studio-hover-surface"
          }`}
        >
          <IconBook className="w-4 h-4" />
          <span>Unified Study aCRF Book ({study.forms.length} Forms)</span>
        </button>
        <button
          onClick={() => setViewMode("sdtm_matrix")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
            viewMode === "sdtm_matrix"
              ? "studio-btn-cyan font-bold"
              : "studio-surface-card border studio-border-default studio-fg-muted studio-hover-fg-primary studio-hover-surface"
          }`}
        >
          <IconTable className="w-4 h-4" />
          <span>SDTM Mapping Matrix ({sdtmMatrix.length} Variables)</span>
        </button>
      </div>

      {/* VIEW 1: SINGLE FORM aCRF PREVIEW */}
      {viewMode === "single_form" && activeForm && (
        <div className="space-y-4">
          {/* Form Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {study.forms.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFormId(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all whitespace-nowrap flex items-center gap-2 border ${
                  f.id === selectedFormId
                    ? "studio-accent-cyan-strong font-bold"
                    : "studio-surface-card studio-border-default studio-fg-muted studio-hover-fg-primary studio-hover-surface"
                }`}
              >
                <span>[{f.domain}]</span>
                <span>{f.name}</span>
              </button>
            ))}
          </div>

          {/* Form Paper Document Card */}
          <div className="studio-paper p-8 sm:p-10 rounded-2xl shadow-2xl border max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="border-b-2 studio-paper-border-strong pb-4 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold uppercase studio-paper-fg tracking-tight">
                  {study.studyName}
                </h2>
                <div className="font-mono text-xs studio-paper-fg-muted mt-1">
                  Protocol: {study.protocolNumber} | Phase: {study.phase} |
                  Sponsor: {study.sponsor}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-block whitespace-nowrap studio-paper-badge-ink font-mono font-bold text-xs px-2.5 py-1 rounded">
                  SUBMISSION aCRF
                </span>
                <div className="font-mono text-xs studio-paper-fg-muted mt-1 whitespace-nowrap">
                  Domain: {activeForm.domain} | v{activeForm.version}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-base font-bold text-sky-700 font-mono">
                {activeForm.name}
              </h3>
              <p className="text-xs studio-paper-fg-muted mt-0.5">
                {activeForm.description}
              </p>
            </div>

            {/* Sections & Fields with SDTM Overlays */}
            {activeForm.sections.map((sec) => (
              <div
                key={sec.id}
                className="border studio-paper-border rounded-lg overflow-hidden space-y-0"
              >
                <div className="studio-paper-muted px-4 py-2 font-bold font-mono text-xs studio-paper-fg border-b studio-paper-border">
                  {sec.title}
                </div>
                <div className="grid grid-cols-12 gap-3 p-4 studio-paper-subtle">
                  {sec.fields.map((field) => {
                    const sdtmTag =
                      field.cdashMetadata?.acrfAnnotation ||
                      `${activeForm.domain}.${field.variableName}`;
                    const isDerived = field.dataType === "calculated";

                    return (
                      <div
                        key={field.id}
                        className="relative border studio-paper-border-subtle studio-paper rounded-lg p-3 shadow-xs"
                        style={{ gridColumn: `span ${field.columnSpan || 12}` }}
                      >
                        {/* SDTM Annotation Badge */}
                        <div
                          className={`absolute -top-2.5 right-2 font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded shadow-sm flex items-center gap-1 ${
                            isDerived ? "bg-purple-700" : "bg-sky-700"
                          }`}
                        >
                          <span>{sdtmTag}</span>
                          <span className="text-[8px]">
                            {isDerived ? "[Derived]" : "[CRF]"}
                          </span>
                        </div>

                        <div className="text-xs font-semibold studio-paper-fg mb-1">
                          {field.label}
                          {field.required && (
                            <span className="text-red-700 ml-0.5">*</span>
                          )}
                        </div>

                        {field.description && (
                          <p className="text-[10px] studio-paper-fg-muted mb-2">
                            {field.description}
                          </p>
                        )}

                        <div className="h-6 border-b border-dashed studio-paper-border flex items-end pb-0.5 text-[11px] studio-paper-fg-muted font-mono">
                          {field.placeholder || "_________________________"}
                          {field.unit && ` (${field.unit})`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: UNIFIED STUDY aCRF BOOK */}
      {viewMode === "study_book" && (
        <div className="studio-paper p-8 sm:p-12 rounded-2xl shadow-2xl border max-w-4xl mx-auto space-y-8">
          <div className="text-center py-8 border-b-2 studio-paper-border-strong space-y-3">
            <span className="text-xs font-mono font-bold tracking-widest text-sky-700 uppercase">
              Regulatory Submission Annotated CRF Book (aCRF)
            </span>
            <h2 className="text-2xl font-extrabold studio-paper-fg">
              {study.studyName}
            </h2>
            <p className="text-xs font-mono studio-paper-fg-muted">
              Protocol: {study.protocolNumber} | Phase: {study.phase} | Version:{" "}
              {study.version}
            </p>
          </div>

          {/* Table of Contents */}
          <div className="space-y-3">
            <h3 className="font-mono font-bold text-sm studio-paper-fg uppercase border-b studio-paper-border pb-1">
              Table of Contents
            </h3>
            <table className="w-full text-left font-mono text-xs">
              <caption className="sr-only">aCRF Book Table of Contents</caption>
              <thead>
                <tr className="border-b studio-paper-border studio-paper-muted">
                  <th scope="col" className="p-2">
                    Section #
                  </th>
                  <th scope="col" className="p-2">
                    Domain
                  </th>
                  <th scope="col" className="p-2">
                    Form Title
                  </th>
                  <th scope="col" className="p-2 text-right">
                    Fields
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y studio-paper-divide">
                {study.forms.map((f, idx) => (
                  <tr key={f.id}>
                    <td className="p-2">{idx + 1}</td>
                    <td className="p-2 font-bold text-sky-700">{f.domain}</td>
                    <td className="p-2">{f.name}</td>
                    <td className="p-2 text-right">
                      {f.sections.flatMap((s) => s.fields).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: SDTM MAPPING MATRIX */}
      {viewMode === "sdtm_matrix" && (
        <div className="p-5 rounded-2xl studio-surface-card border studio-border-default space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold studio-fg-primary font-mono">
              CDISC SDTMIG v{CLINICAL_STANDARDS_PROFILE.SDTMIG} Target Variable
              Mapping Matrix
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded studio-accent-sky border">
                [CRF] Direct Collected
              </span>
              <span className="px-2 py-0.5 rounded studio-accent-purple border">
                [Derived] Algorithm
              </span>
              <span className="px-2 py-0.5 rounded studio-accent-cyan border">
                [Assigned] System
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <caption className="sr-only">
                CDISC SDTMIG v{CLINICAL_STANDARDS_PROFILE.SDTMIG} Target
                Variable Mapping Matrix
              </caption>
              <thead>
                <tr className="border-b studio-border-default studio-surface-subtle studio-fg-muted">
                  <th scope="col" className="p-2.5">
                    Domain
                  </th>
                  <th scope="col" className="p-2.5">
                    Variable
                  </th>
                  <th scope="col" className="p-2.5">
                    CDASH Label / Question Prompt
                  </th>
                  <th scope="col" className="p-2.5">
                    Data Type
                  </th>
                  <th scope="col" className="p-2.5">
                    SDTM Target
                  </th>
                  <th scope="col" className="p-2.5">
                    Origin
                  </th>
                  <th scope="col" className="p-2.5">
                    Core
                  </th>
                  <th scope="col" className="p-2.5">
                    NCI C-Code
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y studio-divide-subtle">
                {sdtmMatrix.map((row, idx) => (
                  <tr key={idx} className="studio-hover-subtle">
                    <td className="p-2.5 font-bold studio-fg-cyan">
                      {row.formDomain}
                    </td>
                    <td className="p-2.5 studio-fg-primary">
                      {row.variableName}
                    </td>
                    <td className="p-2.5 studio-fg-secondary font-sans text-xs">
                      {row.label}
                    </td>
                    <td className="p-2.5 studio-fg-muted">{row.dataType}</td>
                    <td className="p-2.5 studio-fg-sky font-bold">
                      {row.sdtmTarget}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                          row.origin === "Derived"
                            ? "studio-accent-purple"
                            : row.origin === "Assigned"
                              ? "studio-accent-cyan"
                              : "studio-accent-sky"
                        }`}
                      >
                        {row.origin}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                          row.core === "HR"
                            ? "studio-accent-red"
                            : "studio-surface-muted studio-fg-muted studio-border-default"
                        }`}
                      >
                        {row.core}
                      </span>
                    </td>
                    <td className="p-2.5 studio-fg-muted">
                      {row.nciCode || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
