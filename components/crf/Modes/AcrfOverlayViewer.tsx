"use client";

import React, { useState, useEffect, useMemo } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { StudyProtocol } from "@/lib/crf/types";
import type { SdtmMappingRow } from "@/lib/crf/export-acrf";
import {
  IconFileCode,
  IconPrinter,
  IconBook,
  IconTable,
  IconPalette,
  IconFileSpreadsheet,
} from "@tabler/icons-react";
import { getStudyBranding } from "@/lib/crf/branding-defaults";

interface AcrfOverlayViewerProps {
  study: StudyProtocol;
  activeFormId: string;
  onOpenExportModal?: () => void;
  onOpenBranding?: () => void;
}

type AcrfViewMode = "single_form" | "study_book" | "sdtm_matrix";

/* jscpd:ignore-start */
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
    import("@/lib/crf/export-acrf").then(
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
        await import("@/lib/crf/export-acrf");
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
/* jscpd:ignore-end */
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 p-4 sm:p-6 overflow-y-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <IconFileCode className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-white font-mono">
              Visual Annotated CRF (aCRF) Submission Studio
            </h2>
          </div>
          <p className="text-xs text-zinc-400 font-sans mt-1">
            Publication-ready blank case report form with SDTMIG v3.4 / CDASH
            variable annotation overlays for FDA, EMA, and PMDA filings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onOpenBranding && (
            <button
              onClick={onOpenBranding}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-mono transition-all"
            >
              <IconPalette className="w-4 h-4 text-brand-cyan" />
              <span>Branding</span>
            </button>
          )}

          {onOpenExportModal && (
            <button
              onClick={onOpenExportModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold transition-all shadow-sm"
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-200 text-xs font-mono transition-all cursor-pointer"
          />
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-brand-cyan text-black hover:bg-white font-mono text-xs font-bold transition-all shadow-sm"
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
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setViewMode("single_form")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
            viewMode === "single_form"
              ? "bg-brand-cyan text-black font-bold"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
          }`}
        >
          <IconFileCode className="w-4 h-4" />
          <span>Single Form aCRF</span>
        </button>
        <button
          onClick={() => setViewMode("study_book")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
            viewMode === "study_book"
              ? "bg-brand-cyan text-black font-bold"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
          }`}
        >
          <IconBook className="w-4 h-4" />
          <span>Unified Study aCRF Book ({study.forms.length} Forms)</span>
        </button>
        <button
          onClick={() => setViewMode("sdtm_matrix")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
            viewMode === "sdtm_matrix"
              ? "bg-brand-cyan text-black font-bold"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
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
                    ? "bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan font-bold"
                    : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                <span>[{f.domain}]</span>
                <span>{f.name}</span>
              </button>
            ))}
          </div>

          {/* Form Paper Document Card */}
          <div className="bg-white text-zinc-900 p-8 sm:p-10 rounded-2xl shadow-2xl border border-zinc-300 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="border-b-2 border-zinc-900 pb-4 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-black uppercase text-zinc-900 tracking-tight">
                  {study.studyName}
                </h2>
                <div className="font-mono text-xs text-zinc-600 mt-1">
                  Protocol: {study.protocolNumber} | Phase: {study.phase} |
                  Sponsor: {study.sponsor}
                </div>
              </div>
              <div className="text-right">
                <span className="bg-zinc-900 text-white font-mono font-bold text-xs px-2.5 py-1 rounded">
                  SUBMISSION aCRF
                </span>
                <div className="font-mono text-xs text-zinc-500 mt-1">
                  Domain: {activeForm.domain} | v{activeForm.version}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-base font-bold text-sky-700 font-mono">
                {activeForm.name}
              </h3>
              <p className="text-xs text-zinc-600 mt-0.5">
                {activeForm.description}
              </p>
            </div>

            {/* Sections & Fields with SDTM Overlays */}
            {activeForm.sections.map((sec) => (
              <div
                key={sec.id}
                className="border border-zinc-300 rounded-lg overflow-hidden space-y-0"
              >
                <div className="bg-zinc-100 px-4 py-2 font-bold font-mono text-xs text-zinc-800 border-b border-zinc-300">
                  {sec.title}
                </div>
                <div className="grid grid-cols-12 gap-3 p-4 bg-zinc-50/50">
                  {sec.fields.map((field) => {
                    const sdtmTag =
                      field.cdashMetadata?.acrfAnnotation ||
                      `${activeForm.domain}.${field.variableName}`;
                    const isDerived = field.dataType === "calculated";

                    return (
                      <div
                        key={field.id}
                        className="relative border border-zinc-200 bg-white rounded-lg p-3 shadow-xs"
                        style={{ gridColumn: `span ${field.columnSpan || 12}` }}
                      >
                        {/* SDTM Annotation Badge */}
                        <div
                          className={`absolute -top-2.5 right-2 font-mono text-[9px] font-bold text-white px-2 py-0.5 rounded shadow-sm flex items-center gap-1 ${
                            isDerived ? "bg-purple-600" : "bg-sky-600"
                          }`}
                        >
                          <span>{sdtmTag}</span>
                          <span className="opacity-75 text-[8px]">
                            {isDerived ? "[Derived]" : "[CRF]"}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-zinc-800 mb-1">
                          {field.label}
                          {field.required && (
                            <span className="text-red-500 ml-0.5">*</span>
                          )}
                        </div>

                        {field.description && (
                          <p className="text-[10px] text-zinc-500 mb-2">
                            {field.description}
                          </p>
                        )}

                        <div className="h-6 border-b border-dashed border-zinc-300 flex items-end pb-0.5 text-[11px] text-zinc-400 font-mono">
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
        <div className="bg-white text-zinc-900 p-8 sm:p-12 rounded-2xl shadow-2xl border border-zinc-300 max-w-4xl mx-auto space-y-8">
          <div className="text-center py-8 border-b-2 border-zinc-900 space-y-3">
            <span className="text-xs font-mono font-bold tracking-widest text-sky-700 uppercase">
              Regulatory Submission Annotated CRF Book (aCRF)
            </span>
            <h2 className="text-2xl font-black text-zinc-900">
              {study.studyName}
            </h2>
            <p className="text-xs font-mono text-zinc-600">
              Protocol: {study.protocolNumber} | Phase: {study.phase} | Version:{" "}
              {study.version}
            </p>
          </div>

          {/* Table of Contents */}
          <div className="space-y-3">
            <h3 className="font-mono font-bold text-sm text-zinc-900 uppercase border-b border-zinc-300 pb-1">
              Table of Contents
            </h3>
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-zinc-300 bg-zinc-100">
                  <th className="p-2">Section #</th>
                  <th className="p-2">Domain</th>
                  <th className="p-2">Form Title</th>
                  <th className="p-2 text-right">Fields</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
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
        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white font-mono">
              CDISC SDTMIG v3.4 Target Variable Mapping Matrix
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                [CRF] Direct Collected
              </span>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                [Derived] Algorithm
              </span>
              <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                [Assigned] System
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400">
                  <th className="p-2.5">Domain</th>
                  <th className="p-2.5">Variable</th>
                  <th className="p-2.5">CDASH Label / Question Prompt</th>
                  <th className="p-2.5">Data Type</th>
                  <th className="p-2.5">SDTM Target</th>
                  <th className="p-2.5">Origin</th>
                  <th className="p-2.5">Core</th>
                  <th className="p-2.5">NCI C-Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {sdtmMatrix.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-850/30">
                    <td className="p-2.5 font-bold text-brand-cyan">
                      {row.formDomain}
                    </td>
                    <td className="p-2.5 text-white">{row.variableName}</td>
                    <td className="p-2.5 text-zinc-300 font-sans text-xs">
                      {row.label}
                    </td>
                    <td className="p-2.5 text-zinc-500">{row.dataType}</td>
                    <td className="p-2.5 text-sky-400 font-bold">
                      {row.sdtmTarget}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          row.origin === "Derived"
                            ? "bg-purple-500/20 text-purple-300"
                            : row.origin === "Assigned"
                              ? "bg-teal-500/20 text-teal-300"
                              : "bg-sky-500/20 text-sky-300"
                        }`}
                      >
                        {row.origin}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          row.core === "HR"
                            ? "bg-red-500/20 text-red-300"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {row.core}
                      </span>
                    </td>
                    <td className="p-2.5 text-zinc-500">
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
