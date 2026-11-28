"use client";

import React, { useRef, useState } from "react";
import { CLINICAL_STANDARDS_PROFILE } from "@/lib/clinical-standards";
import {
  ClinicalDataCsvKind,
  EdcSimulationState,
  StudyProtocol,
} from "@/lib/crf/types";
import {
  detectClinicalCsvKind,
  exportSimulationAuditsCsv,
  exportSimulationQueriesCsv,
  exportSimulationSubjectsCsv,
  exportStudyToCdiscOdmXml,
  exportStudyToR,
  exportStudyToSas,
  importClinicalCsvIntoSimulationState,
  importStudyFromCdiscOdmXml,
} from "@/lib/crf";
import { downloadFile } from "@/lib/download";
import { IconDownload, IconUpload } from "@tabler/icons-react";

interface EdcClinicalDataExchangePanelProps {
  study: StudyProtocol;
  currentSimSnapshot: EdcSimulationState;
  onApplyImportedSimulationState: (
    importedSim: EdcSimulationState,
    source: "odm" | "csv"
  ) => void;
  announce: (message: string, priority?: "polite" | "assertive") => void;
}

export const EdcClinicalDataExchangePanel: React.FC<
  EdcClinicalDataExchangePanelProps
> = ({
  study,
  currentSimSnapshot,
  onApplyImportedSimulationState,
  announce,
}) => {
  const [exchangeFormat, setExchangeFormat] = useState<"odm" | "stat" | "csv">(
    "odm"
  );
  const [statScriptLang, setStatScriptLang] = useState<"sas" | "r">("sas");
  const [csvDatasetKind, setCsvDatasetKind] =
    useState<ClinicalDataCsvKind>("subjects");
  const [exchangeStatus, setExchangeStatus] = useState<string | null>(null);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const exchangeFileInputRef = useRef<HTMLInputElement | null>(null);

  const availableSubjects = currentSimSnapshot.availableSubjects ?? [];
  const auditLog = currentSimSnapshot.auditLog ?? [];
  const signatures = currentSimSnapshot.signatures ?? [];
  const queries = currentSimSnapshot.queries ?? [];

  const handleExportClinicalData = () => {
    setExchangeError(null);
    const studyWithSim: StudyProtocol = {
      ...study,
      simulationState: currentSimSnapshot,
    };

    if (exchangeFormat === "odm") {
      const xml = exportStudyToCdiscOdmXml(studyWithSim);
      const filename = `study-${study.protocolNumber}-clinical-odm.xml`;
      downloadFile(xml, filename, { mimeType: "application/xml" });
      setExchangeStatus(
        `Exported ${filename} (ODM v${CLINICAL_STANDARDS_PROFILE.ODM} ClinicalData).`
      );
      return;
    }

    if (exchangeFormat === "stat") {
      if (statScriptLang === "sas") {
        const sas = exportStudyToSas(studyWithSim);
        const filename = `study-${study.protocolNumber}-live.sas`;
        downloadFile(sas, filename, { mimeType: "text/x-sas" });
        setExchangeStatus(`Exported ${filename} with live simulation rows.`);
      } else {
        const rCode = exportStudyToR(studyWithSim);
        const filename = `study-${study.protocolNumber}-live.R`;
        downloadFile(rCode, filename, { mimeType: "text/x-r" });
        setExchangeStatus(`Exported ${filename} with live simulation rows.`);
      }
      return;
    }

    const csvContent =
      csvDatasetKind === "subjects"
        ? exportSimulationSubjectsCsv(studyWithSim)
        : csvDatasetKind === "queries"
          ? exportSimulationQueriesCsv(studyWithSim)
          : exportSimulationAuditsCsv(studyWithSim);
    const filename = `${study.protocolNumber}-${csvDatasetKind}.csv`;
    downloadFile(csvContent, filename, { mimeType: "text/csv" });
    setExchangeStatus(`Exported RFC 4180 ${filename}.`);
  };

  const handleImportClinicalFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setExchangeError(null);
    setExchangeStatus(null);

    try {
      const text = await file.text();
      const trimmed = text.trim();
      const isXml =
        file.name.toLowerCase().endsWith(".xml") || trimmed.startsWith("<");

      if (isXml) {
        const importedStudy = importStudyFromCdiscOdmXml(text);
        const importedSim = importedStudy.simulationState;
        if (!importedSim) {
          setExchangeError(
            "The selected ODM-XML file contains study metadata only (no ClinicalData block)."
          );
          return;
        }
        onApplyImportedSimulationState(importedSim, "odm");
        setExchangeStatus(
          `Imported ODM v${CLINICAL_STANDARDS_PROFILE.ODM} ClinicalData (${importedSim.availableSubjects?.length ?? 0} subjects, ${importedSim.auditLog?.length ?? 0} audits, ${importedSim.signatures?.length ?? 0} simulated signatures).`
        );
        announce("ODM ClinicalData imported into simulation.", "polite");
        return;
      }

      const detected = detectClinicalCsvKind(text) || csvDatasetKind;
      const { kind, simulationState: nextSim } =
        importClinicalCsvIntoSimulationState(
          text,
          study,
          currentSimSnapshot,
          detected
        );
      setCsvDatasetKind(kind);
      onApplyImportedSimulationState(nextSim, "csv");
      setExchangeStatus(`Imported RFC 4180 ${kind} CSV into simulation.`);
      announce(`Imported ${kind} CSV into simulation.`, "polite");
    } catch (err: unknown) {
      setExchangeError(
        err instanceof Error
          ? err.message
          : "Failed to import ODM-XML or CSV file."
      );
    }
  };

  return (
    <aside
      aria-label="CDISC Clinical Data Exchange"
      className="xl:col-span-4 min-w-0 p-5 rounded-2xl studio-surface-subtle border studio-border-default space-y-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-bold studio-fg-primary font-mono">
            CDISC Clinical Data Exchange
          </h2>
          <p className="text-xs studio-fg-muted font-sans mt-0.5">
            Bidirectional ODM v{CLINICAL_STANDARDS_PROFILE.ODM} ClinicalData,
            live statistical rows, and RFC 4180 CSV datasets.
          </p>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold studio-accent-cyan border shrink-0">
          ODM v{CLINICAL_STANDARDS_PROFILE.ODM}
        </span>
      </div>

      {/* Exchange Format Selector */}
      <div
        role="group"
        aria-label="Clinical exchange format"
        className="grid grid-cols-3 gap-1.5 p-1 rounded-xl studio-surface-card border studio-border-default"
      >
        <button
          type="button"
          aria-pressed={exchangeFormat === "odm"}
          onClick={() => {
            setExchangeFormat("odm");
            setExchangeError(null);
          }}
          className={`px-2 py-1.5 rounded-lg text-[11px] font-mono transition-all ${
            exchangeFormat === "odm"
              ? "studio-btn-cyan font-bold"
              : "studio-fg-muted studio-hover-fg-primary"
          }`}
        >
          CDISC ODM-XML
        </button>
        <button
          type="button"
          aria-pressed={exchangeFormat === "stat"}
          onClick={() => {
            setExchangeFormat("stat");
            setExchangeError(null);
          }}
          className={`px-2 py-1.5 rounded-lg text-[11px] font-mono transition-all ${
            exchangeFormat === "stat"
              ? "studio-btn-cyan font-bold"
              : "studio-fg-muted studio-hover-fg-primary"
          }`}
        >
          SAS / R Script
        </button>
        <button
          type="button"
          aria-pressed={exchangeFormat === "csv"}
          onClick={() => {
            setExchangeFormat("csv");
            setExchangeError(null);
          }}
          className={`px-2 py-1.5 rounded-lg text-[11px] font-mono transition-all ${
            exchangeFormat === "csv"
              ? "studio-btn-cyan font-bold"
              : "studio-fg-muted studio-hover-fg-primary"
          }`}
        >
          RFC 4180 CSV
        </button>
      </div>

      {/* Live Simulation State Payload Summary */}
      <div className="p-3 rounded-xl studio-surface-card border studio-border-default space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-wider studio-fg-muted font-bold">
          Live Simulation State Payload
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 rounded-lg studio-surface-subtle border studio-border-default min-w-0">
            <div className="text-[10px] studio-fg-muted truncate">
              SubjectData
            </div>
            <div className="font-bold studio-fg-cyan">
              {availableSubjects.length} subjects
            </div>
          </div>
          <div className="p-2 rounded-lg studio-surface-subtle border studio-border-default min-w-0">
            <div className="text-[10px] studio-fg-muted truncate">
              AuditRecords
            </div>
            <div className="font-bold studio-fg-primary">
              {auditLog.length} entries
            </div>
          </div>
          <div className="p-2 rounded-lg studio-surface-subtle border studio-border-default min-w-0">
            <div className="text-[10px] studio-fg-muted truncate">
              Signatures (sim)
            </div>
            <div className="font-bold studio-fg-emerald">
              {signatures.length} records
            </div>
          </div>
          <div className="p-2 rounded-lg studio-surface-subtle border studio-border-default min-w-0">
            <div className="text-[10px] studio-fg-muted truncate">
              Annotations
            </div>
            <div className="font-bold studio-fg-amber">
              {queries.length} queries
            </div>
          </div>
        </div>
        <p className="text-[10px] studio-fg-muted font-sans leading-relaxed">
          Simulated signature tokens (not a validated system) serialize into
          plain ODM v{CLINICAL_STANDARDS_PROFILE.ODM}{" "}
          <code className="font-mono studio-fg-secondary">
            &lt;Signatures&gt;
          </code>{" "}
          and{" "}
          <code className="font-mono studio-fg-secondary">
            &lt;AdminData&gt;
          </code>
          .
        </p>
      </div>

      {/* Format-Specific Options */}
      {exchangeFormat === "odm" && (
        <div className="p-3 rounded-xl studio-surface-card border studio-border-default text-xs studio-fg-muted font-sans space-y-1">
          <div className="font-mono font-bold studio-fg-primary text-[11px]">
            ODM v{CLINICAL_STANDARDS_PROFILE.ODM} AdminData + ClinicalData
          </div>
          <p className="leading-relaxed">
            Emits study metadata plus captured subject items, audit trail
            records, simulated signatures, and discrepancy query annotations.
          </p>
        </div>
      )}

      {exchangeFormat === "stat" && (
        <div className="p-3 rounded-xl studio-surface-card border studio-border-default space-y-2.5">
          <div className="text-[11px] font-mono font-bold studio-fg-primary">
            Statistical Analysis Script Target
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={statScriptLang === "sas"}
              onClick={() => setStatScriptLang("sas")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                statScriptLang === "sas"
                  ? "studio-accent-cyan font-bold"
                  : "studio-surface-subtle studio-border-default studio-fg-muted studio-hover-fg-primary"
              }`}
            >
              SAS (CARDS;)
            </button>
            <button
              type="button"
              aria-pressed={statScriptLang === "r"}
              onClick={() => setStatScriptLang("r")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                statScriptLang === "r"
                  ? "studio-accent-cyan font-bold"
                  : "studio-surface-subtle studio-border-default studio-fg-muted studio-hover-fg-primary"
              }`}
            >
              R (tibble)
            </button>
          </div>
          <p className="text-[11px] studio-fg-muted font-sans leading-relaxed">
            Serializes captured subject values from active simulation rows
            before falling back to synthetic template data.
          </p>
        </div>
      )}

      {exchangeFormat === "csv" && (
        <div className="p-3 rounded-xl studio-surface-card border studio-border-default space-y-2.5">
          <div className="text-[11px] font-mono font-bold studio-fg-primary">
            RFC 4180 CSV Dataset
          </div>
          <div
            role="group"
            aria-label="EDC CSV dataset type"
            className="grid grid-cols-3 gap-1.5"
          >
            <button
              type="button"
              aria-pressed={csvDatasetKind === "subjects"}
              onClick={() => setCsvDatasetKind("subjects")}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-mono border transition-all ${
                csvDatasetKind === "subjects"
                  ? "studio-accent-cyan font-bold"
                  : "studio-surface-subtle studio-border-default studio-fg-muted studio-hover-fg-primary"
              }`}
            >
              Subjects CSV
            </button>
            <button
              type="button"
              aria-pressed={csvDatasetKind === "queries"}
              onClick={() => setCsvDatasetKind("queries")}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-mono border transition-all ${
                csvDatasetKind === "queries"
                  ? "studio-accent-cyan font-bold"
                  : "studio-surface-subtle studio-border-default studio-fg-muted studio-hover-fg-primary"
              }`}
            >
              Queries CSV
            </button>
            <button
              type="button"
              aria-pressed={csvDatasetKind === "audits"}
              onClick={() => setCsvDatasetKind("audits")}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-mono border transition-all ${
                csvDatasetKind === "audits"
                  ? "studio-accent-cyan font-bold"
                  : "studio-surface-subtle studio-border-default studio-fg-muted studio-hover-fg-primary"
              }`}
            >
              Audits CSV
            </button>
          </div>
          <p className="text-[11px] studio-fg-muted font-sans leading-relaxed">
            Quoted CRLF flat files for clinical data review, discrepancy
            tracking, and audit inspection.
          </p>
        </div>
      )}

      {/* Primary Export Action */}
      <button
        type="button"
        onClick={handleExportClinicalData}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl studio-btn-cyan font-mono font-bold text-xs transition-all"
      >
        <IconDownload className="w-4 h-4 shrink-0" />
        <span>
          {exchangeFormat === "odm"
            ? `Export ODM v${CLINICAL_STANDARDS_PROFILE.ODM} + ClinicalData`
            : exchangeFormat === "stat"
              ? statScriptLang === "sas"
                ? "Export Live SAS Script"
                : "Export Live R Script"
              : csvDatasetKind === "subjects"
                ? "Export Subjects CSV"
                : csvDatasetKind === "queries"
                  ? "Export Queries CSV"
                  : "Export Audits CSV"}
        </span>
      </button>

      {/* Bidirectional Import Control */}
      <div className="pt-3 border-t studio-border-default space-y-2">
        <div className="text-[11px] font-mono font-bold studio-fg-secondary">
          Restore Simulation State (ODM-XML or CSV)
        </div>
        <input
          ref={exchangeFileInputRef}
          type="file"
          aria-label="Import ODM-XML or RFC 4180 CSV file"
          accept=".xml,.csv,application/xml,text/xml,text/csv"
          onChange={handleImportClinicalFile}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => exchangeFileInputRef.current?.click()}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl studio-surface-card border studio-border-strong studio-fg-primary studio-hover-border text-xs font-mono font-bold transition-all"
        >
          <IconUpload className="w-4 h-4 studio-fg-cyan shrink-0" />
          <span>Import ODM-XML / RFC 4180 CSV</span>
        </button>
      </div>

      {exchangeStatus && (
        <div
          role="status"
          className="p-2.5 rounded-xl studio-accent-emerald border text-xs font-sans"
        >
          {exchangeStatus}
        </div>
      )}

      {exchangeError && (
        <div
          role="alert"
          className="p-2.5 rounded-xl studio-accent-rose border text-xs font-sans"
        >
          {exchangeError}
        </div>
      )}
    </aside>
  );
};
