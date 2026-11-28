"use client";

import { CLINICAL_STANDARDS_PROFILE } from "@/lib/clinical-standards";
import React, { useState, useEffect, useMemo } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import type {
  CRFField,
  CRFForm,
  StudyProtocol,
  ComplianceViolation,
} from "@/lib/crf/types";
import { useTelemetry } from "@/hooks/useTelemetry";
import { downloadFile } from "@/lib/download";
import {
  IconDownload,
  IconUpload,
  IconCode,
  IconFileSpreadsheet,
  IconFlame,
  IconPalette,
  IconFileText,
  IconTerminal,
  IconFileCode,
  IconAdjustments,
  IconCalendar,
  IconLoader2,
  IconAlertCircle,
  IconWand,
  IconArchive,
  IconPlayerPlay,
} from "@tabler/icons-react";

import { exportUniversalCrfJson, type ParsedStudyFileResult } from "@/lib/crf";
import {
  STUDY_DATA_HANDOFF_PATH,
  storeStudyHandoff,
} from "@/components/study-data/handoff-storage";
import { ImportDropzone } from "../ImportDropzone";

interface ExportImportModalProps {
  study: StudyProtocol;
  onImportStudy: (importedStudy: StudyProtocol) => void;
  onOpenExportDocument?: () => void;
  onOpenBranding?: () => void;
  /** Opens the one-revision review package flow (#680). */
  onOpenReviewPackage?: () => void;
}

type ExportTab =
  "universal" | "usdm" | "odm" | "sas" | "r" | "json" | "fhir" | "sdtm_spec";

/** Formats that always describe the whole study, so the scope selector is off. */
const WHOLE_STUDY_TABS: ReadonlySet<ExportTab> = new Set([
  "universal",
  "usdm",
  "odm",
  "json",
]);

const SPEC_COLUMNS = [
  "Domain",
  "Form",
  "Variable (CDASH)",
  "Label",
  "Data Type",
  "Core",
  "aCRF Overlay Tag",
];

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function specRow(field: CRFField, form: CRFForm): string[] {
  return [
    form.domain,
    form.name,
    field.variableName,
    field.label,
    field.dataType,
    field.cdashMetadata?.core || (field.required ? "R" : "O"),
    field.cdashMetadata?.acrfAnnotation ||
      `${form.domain}.${field.variableName}`,
  ];
}

const EXPORT_TABS: ExportTab[] = [
  "universal",
  "usdm",
  "odm",
  "sas",
  "r",
  "fhir",
  "sdtm_spec",
  "json",
];

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  study,
  onImportStudy,
  onOpenExportDocument,
  onOpenBranding,
  onOpenReviewPackage,
}) => {
  const { recordEvent } = useTelemetry();
  const [activeTab, setActiveTab] = useState<ExportTab>("universal");
  const [selectedFormId, setSelectedFormId] = useState<string>("all");
  const [importJsonText, setImportJsonText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [activeContent, setActiveContent] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [preflightViolations, setPreflightViolations] = useState<
    ComplianceViolation[]
  >([]);
  const [pendingStudy, setPendingStudy] = useState<StudyProtocol | null>(null);

  const tabRefs = React.useRef<Record<ExportTab, HTMLButtonElement | null>>({
    universal: null,
    usdm: null,
    odm: null,
    sas: null,
    r: null,
    fhir: null,
    sdtm_spec: null,
    json: null,
  });

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: ExportTab
  ) => {
    const currentIndex = EXPORT_TABS.indexOf(currentTab);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % EXPORT_TABS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + EXPORT_TABS.length) % EXPORT_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = EXPORT_TABS.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = EXPORT_TABS[nextIndex];
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  const isWholeStudyTab = WHOLE_STUDY_TABS.has(activeTab);
  const scopeFormId = isWholeStudyTab ? "all" : selectedFormId;
  const selectedForm =
    scopeFormId === "all"
      ? undefined
      : study.forms.find((f) => f.id === scopeFormId);

  // Compile SDTM variables for specification table, filtered by scope
  // Memoized: it feeds the content effect's deps, and a fresh array each
  // render would re-run that effect forever (see #1199).
  const specFields = useMemo(
    () =>
      (selectedForm ? [selectedForm] : study.forms).flatMap((f) =>
        f.sections.flatMap((s) => s.fields.map((field) => ({ field, form: f })))
      ),
    [selectedForm, study.forms]
  );

  useEffect(() => {
    let isMounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsGenerating(true);

    const computeContent = async () => {
      let content = "";
      if (activeTab === "universal") {
        content = exportUniversalCrfJson(study);
      } else if (activeTab === "usdm") {
        const { exportStudyToUsdm } = await import("@/lib/crf");
        content = exportStudyToUsdm(study);
      } else if (activeTab === "odm") {
        const { exportStudyToCdiscOdmXml } = await import("@/lib/crf");
        content = exportStudyToCdiscOdmXml(study);
      } else if (activeTab === "sas") {
        const { exportStudyToSas } = await import("@/lib/crf");
        content = exportStudyToSas(study, {
          selectedFormId: selectedForm?.id,
          includeSampleData: true,
          includeProcContents: true,
          includeProcFreq: true,
        });
      } else if (activeTab === "r") {
        const { exportStudyToR } = await import("@/lib/crf");
        content = exportStudyToR(study, {
          selectedFormId: selectedForm?.id,
          includeSampleData: true,
          includeGlimpse: true,
          useLabelledPackage: true,
        });
      } else if (activeTab === "fhir") {
        const {
          exportFormToFhirQuestionnaire,
          exportStudyToFhirQuestionnaire,
        } = await import("@/lib/crf");
        // One Questionnaire for a single form, a Bundle of all of them for
        // the whole study (#1202).
        content = JSON.stringify(
          selectedForm
            ? exportFormToFhirQuestionnaire(selectedForm, study)
            : exportStudyToFhirQuestionnaire(study),
          null,
          2
        );
      } else if (activeTab === "sdtm_spec") {
        content = [
          SPEC_COLUMNS,
          ...specFields.map(({ field, form }) => specRow(field, form)),
        ]
          .map((row) =>
            row.map((cell) => csvCell(String(cell ?? ""))).join(",")
          )
          .join("\n");
      } else {
        content = JSON.stringify(study, null, 2);
      }

      if (isMounted) {
        setActiveContent(content);
        setIsGenerating(false);
      }
    };

    computeContent();
    return () => {
      isMounted = false;
    };
  }, [activeTab, study, selectedForm, specFields]);

  // The USDM tab's content is the export itself, so the handoff stores it
  // synchronously and lets the link navigate in the same tab, where
  // sessionStorage carries it to /study-data.
  const handleRunPipeline = (event: React.MouseEvent<HTMLAnchorElement>) => {
    recordEvent("crf", "project_click");
    let failure: ReturnType<typeof storeStudyHandoff> = "unavailable";
    if (!isGenerating) {
      try {
        failure = storeStudyHandoff(JSON.parse(activeContent));
      } catch {
        failure = "unavailable";
      }
    }
    if (!failure) return;
    event.preventDefault();
    setHandoffError(
      failure === "too-large"
        ? "This study is too large to hand over in this browser tab. Download the USDM file instead."
        : "The study could not be handed over in this browser tab. Download the USDM file instead."
    );
  };

  const handleDownload = () => {
    recordEvent("crf", "project_click");
    let filename = `${study.protocolNumber}.study-bundle.json`;
    let mimeType = "application/json";
    const content = activeContent;
    const domainSuffix = selectedForm
      ? `-${selectedForm.domain || selectedForm.id}`
      : "";

    if (activeTab === "universal") {
      filename = `${study.protocolNumber}.crf.json`;
      mimeType = "application/json";
    } else if (activeTab === "usdm") {
      filename = `${study.protocolNumber}.usdm.json`;
      mimeType = "application/json";
    } else if (activeTab === "odm") {
      filename = `study-${study.protocolNumber}-odm.xml`;
      mimeType = "application/xml";
    } else if (activeTab === "sas") {
      filename = `study-${study.protocolNumber}${domainSuffix}.sas`;
      mimeType = "text/x-sas";
    } else if (activeTab === "r") {
      filename = `study-${study.protocolNumber}${domainSuffix}.R`;
      mimeType = "text/x-r";
    } else if (activeTab === "fhir") {
      filename = selectedForm
        ? `fhir-questionnaire-${study.protocolNumber}${domainSuffix}.json`
        : `fhir-bundle-${study.protocolNumber}.json`;
      mimeType = "application/fhir+json";
    } else if (activeTab === "sdtm_spec") {
      filename = `${study.protocolNumber}${domainSuffix}-sdtm-spec.csv`;
      mimeType = "text/csv";
    }

    downloadFile(content, filename, { mimeType });
  };

  const attachProvenance = (st: StudyProtocol): StudyProtocol => {
    const now = new Date().toISOString();
    const existingProv = st.provenance || {};
    const sourceFormat = existingProv.sourceFormat || "CDISC USDM JSON";
    const author = existingProv.author;
    return {
      ...st,
      provenance: {
        ...existingProv,
        ...(author ? { author } : {}),
        importedAt: now,
        importedBy: "Unverified Session",
        sourceFormat,
        sourceVersion:
          existingProv.sourceVersion ||
          st.schemaVersion ||
          st.version ||
          "1.0.0",
        timestamp: now,
        notes: existingProv.notes
          ? existingProv.notes.includes("Imported via ExportImportModal")
            ? existingProv.notes
            : `${existingProv.notes} | Imported via ExportImportModal at ${now}`
          : `Imported via ExportImportModal at ${now}`,
      },
    };
  };

  const handleStudyParsed = async (
    parsedResult: ParsedStudyFileResult,
    rawText: string
  ) => {
    setImportError(null);
    setPreflightViolations([]);
    setPendingStudy(null);
    setImportJsonText(rawText);

    try {
      const { validateStudyCompliance } = await import("@/lib/crf");
      const violations = validateStudyCompliance(parsedResult.study);

      if (violations.length > 0) {
        setPreflightViolations(violations);
        setPendingStudy(parsedResult.study);
        return;
      }

      const studyWithProvenance = attachProvenance(parsedResult.study);
      onImportStudy(studyWithProvenance);
      setImportJsonText("");
      setPreflightViolations([]);
      setPendingStudy(null);
    } catch (err: unknown) {
      setImportError(
        (err as Error).message || "Failed to validate imported study protocol"
      );
    }
  };

  const handlePerformImport = async () => {
    setImportError(null);
    setPreflightViolations([]);
    setPendingStudy(null);
    try {
      const { detectAndParseStudyFile } = await import("@/lib/crf");
      const result = detectAndParseStudyFile(
        importJsonText,
        "pasted_protocol.json"
      );
      const imported = result.study;

      const { validateStudyCompliance } = await import("@/lib/crf");
      const violations = validateStudyCompliance(imported);

      if (violations.length > 0) {
        setPreflightViolations(violations);
        setPendingStudy(imported);
        return;
      }

      const studyWithProvenance = attachProvenance(imported);
      onImportStudy(studyWithProvenance);
      setImportJsonText("");
      setPreflightViolations([]);
      setPendingStudy(null);
    } catch (err: unknown) {
      setImportError(
        (err as Error).message ||
          "Invalid Protocol, USDM JSON, FHIR JSON, ODM XML, or CSV syntax"
      );
    }
  };

  const handleAutoFixAndImport = async () => {
    if (!pendingStudy) return;
    const { autoFixAllViolations, validateStudyCompliance } =
      await import("@/lib/crf");
    const { updatedStudy } = autoFixAllViolations(pendingStudy);

    const remainingViolations = validateStudyCompliance(updatedStudy);
    const hasRemainingErrors = remainingViolations.some(
      (v) => v.severity === "error"
    );

    if (hasRemainingErrors) {
      setPendingStudy(updatedStudy);
      setPreflightViolations(remainingViolations);
      return;
    }

    const studyWithProvenance = attachProvenance(updatedStudy);
    onImportStudy(studyWithProvenance);
    setImportJsonText("");
    setPreflightViolations([]);
    setPendingStudy(null);
  };

  const handleBypassAndImport = () => {
    if (!pendingStudy) return;
    const criticalViolations = preflightViolations.filter(
      (v) => v.severity === "error"
    );
    if (criticalViolations.length > 0) return;

    const studyWithProvenance = attachProvenance(pendingStudy);
    onImportStudy(studyWithProvenance);
    setImportJsonText("");
    setPreflightViolations([]);
    setPendingStudy(null);
  };

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col h-full studio-surface-subtle p-4 sm:p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b studio-border-default">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg studio-accent-purple border">
              <IconCode className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold studio-fg-primary font-mono">
              CDISC Standards &amp; Interoperability Exporter
            </h2>
          </div>
          <p className="text-xs studio-fg-muted font-sans mt-1">
            Export study protocols and CRFs to CDISC ODM-XML, SAS programs (PROC
            FORMAT &amp; ATTRIB), R tidyverse tibbles, HL7 FHIR Questionnaires,
            and JSON Study Bundles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenBranding && (
            <button
              onClick={onOpenBranding}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl studio-surface-card studio-hover-surface border studio-border-default studio-fg-secondary text-xs font-mono transition-all"
            >
              <IconPalette className="w-4 h-4 studio-fg-cyan" />
              <span>Branding</span>
            </button>
          )}

          {onOpenExportDocument && (
            <button
              onClick={onOpenExportDocument}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl studio-btn-sky font-mono text-xs font-bold transition-all shadow-sm"
            >
              <IconFileText className="w-4 h-4" />
              <span>Export Word / PDF</span>
            </button>
          )}

          {onOpenReviewPackage && (
            <button
              type="button"
              onClick={onOpenReviewPackage}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl studio-surface-card studio-hover-surface border studio-border-default studio-fg-primary font-mono text-xs font-bold transition-all"
            >
              <IconArchive className="w-4 h-4 studio-fg-amber" />
              <span>Review Package</span>
            </button>
          )}

          <CopyButton
            text={activeContent}
            label="Copy Code"
            copiedLabel="Copied!"
            successMessage="Export code copied to clipboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl studio-surface-muted studio-hover-active border studio-border-strong studio-fg-primary text-xs font-mono transition-all cursor-pointer"
          />
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl studio-btn-cyan font-mono text-xs font-bold transition-all shadow-sm"
          >
            <IconDownload className="w-4 h-4" />
            <span>Download File</span>
          </button>
          {/* Office hours stay one click away, after the export's own
              actions rather than ahead of them. */}
          <a
            href="/schedule"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordEvent("crf", "project_click")}
            className="inline-flex items-center gap-1.5 px-2 py-1.5 studio-fg-muted studio-hover-fg-primary font-mono text-xs underline decoration-current underline-offset-4 transition-colors"
          >
            <IconCalendar className="w-4 h-4" />
            <span>Schedule Consultation</span>
          </a>
        </div>
      </div>

      {/* Domain / Form Filter Control */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl studio-surface-subtle border studio-border-default">
        <div className="flex items-center gap-2 text-xs font-mono studio-fg-secondary">
          <IconAdjustments className="w-4 h-4 studio-fg-cyan" />
          <span className="font-bold">Domain &amp; Form Scope:</span>
        </div>
        <div className="flex items-center gap-2">
          {isWholeStudyTab && (
            <span
              id="export-scope-note"
              className="text-[11px] font-sans studio-fg-muted"
            >
              This format always exports the whole study.
            </span>
          )}
          <select
            value={scopeFormId}
            onChange={(e) => setSelectedFormId(e.target.value)}
            disabled={isWholeStudyTab}
            aria-describedby={isWholeStudyTab ? "export-scope-note" : undefined}
            className="px-3 py-1.5 studio-surface-subtle border studio-border-default rounded-lg text-xs font-mono studio-fg-primary studio-focus-input focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Filter export domain scope"
          >
            <option value="all">All Study Domains (Full Protocol Suite)</option>
            {study.forms.map((form) => (
              <option key={form.id} value={form.id}>
                {form.domain ? `[${form.domain}] ` : ""}
                {form.name}
              </option>
            ))}
          </select>
          {scopeFormId !== "all" && (
            <button
              onClick={() => setSelectedFormId("all")}
              className="text-[11px] font-mono studio-fg-muted studio-hover-fg-cyan underline"
            >
              Reset to Full Study
            </button>
          )}
        </div>
      </div>

      {/* Tabs. Children of this scrolling flex column that clip their own
          overflow resolve min-height to 0, so without shrink-0 they collapse
          to fit the viewport instead of letting the column scroll (#1784). */}
      <div
        className="flex shrink-0 min-w-0 border-b studio-border-default gap-2 overflow-x-auto"
        role="tablist"
        aria-label="Export Format Tabs"
      >
        <button
          ref={(node) => {
            tabRefs.current.universal = node;
          }}
          type="button"
          id="export-tab-universal"
          role="tab"
          aria-selected={activeTab === "universal"}
          aria-controls="export-panel-universal"
          tabIndex={activeTab === "universal" ? 0 : -1}
          onClick={() => setActiveTab("universal")}
          onKeyDown={(e) => handleTabKeyDown(e, "universal")}
          className={`px-3 sm:px-4 py-2 text-xs font-mono transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "universal"
              ? "studio-border-cyan studio-fg-cyan font-bold"
              : "border-transparent studio-fg-muted studio-hover-fg-primary"
          }`}
        >
          <IconFileText className="w-4 h-4 studio-fg-cyan" />
          <span>Universal CRF (.json)</span>
        </button>

        <button
          ref={(node) => {
            tabRefs.current.usdm = node;
          }}
          type="button"
          id="export-tab-usdm"
          role="tab"
          aria-selected={activeTab === "usdm"}
          aria-controls="export-panel-usdm"
          tabIndex={activeTab === "usdm" ? 0 : -1}
          onClick={() => setActiveTab("usdm")}
          onKeyDown={(e) => handleTabKeyDown(e, "usdm")}
          className={`px-3 sm:px-4 py-2 text-xs font-mono transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "usdm"
              ? "studio-border-cyan studio-fg-cyan font-bold"
              : "border-transparent studio-fg-muted studio-hover-fg-primary"
          }`}
        >
          <IconCode className="w-4 h-4 studio-fg-purple" />
          <span>CDISC USDM v{CLINICAL_STANDARDS_PROFILE.USDM} (.json)</span>
        </button>

        <button
          ref={(node) => {
            tabRefs.current.odm = node;
          }}
          type="button"
          id="export-tab-odm"
          role="tab"
          aria-selected={activeTab === "odm"}
          aria-controls="export-panel-odm"
          tabIndex={activeTab === "odm" ? 0 : -1}
          onClick={() => setActiveTab("odm")}
          onKeyDown={(e) => handleTabKeyDown(e, "odm")}
          className={`px-3 sm:px-4 py-2 text-xs font-mono transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "odm"
              ? "studio-border-cyan studio-fg-cyan font-bold"
              : "border-transparent studio-fg-muted studio-hover-fg-primary"
          }`}
        >
          <IconCode className="w-4 h-4" />
          <span>CDISC ODM-XML</span>
        </button>

        <button
          ref={(node) => {
            tabRefs.current.sas = node;
          }}
          type="button"
          id="export-tab-sas"
          role="tab"
          aria-selected={activeTab === "sas"}
          aria-controls="export-panel-sas"
          tabIndex={activeTab === "sas" ? 0 : -1}
          onClick={() => setActiveTab("sas")}
          onKeyDown={(e) => handleTabKeyDown(e, "sas")}
          className={`px-3 sm:px-4 py-2 text-xs font-mono transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "sas"
              ? "studio-border-cyan studio-fg-cyan font-bold"
              : "border-transparent studio-fg-muted studio-hover-fg-primary"
          }`}
        >
          <IconTerminal className="w-4 h-4 studio-fg-emerald" />
          <span>SAS Script (.sas)</span>
        </button>

        <button
          ref={(node) => {
            tabRefs.current.r = node;
          }}
          type="button"
          id="export-tab-r"
          role="tab"
          aria-selected={activeTab === "r"}
          aria-controls="export-panel-r"
          tabIndex={activeTab === "r" ? 0 : -1}
          onClick={() => setActiveTab("r")}
          onKeyDown={(e) => handleTabKeyDown(e, "r")}
          className={`px-3 sm:px-4 py-2 text-xs font-mono transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "r"
              ? "studio-border-cyan studio-fg-cyan font-bold"
              : "border-transparent studio-fg-muted studio-hover-fg-primary"
          }`}
        >
          <IconFileCode className="w-4 h-4 studio-fg-sky" />
          <span>R Scaffolding (.R)</span>
        </button>

        <button
          ref={(node) => {
            tabRefs.current.fhir = node;
          }}
          type="button"
          id="export-tab-fhir"
          role="tab"
          aria-selected={activeTab === "fhir"}
          aria-controls="export-panel-fhir"
          tabIndex={activeTab === "fhir" ? 0 : -1}
          onClick={() => setActiveTab("fhir")}
          onKeyDown={(e) => handleTabKeyDown(e, "fhir")}
          className={`px-3 sm:px-4 py-2 text-xs font-mono transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "fhir"
              ? "studio-border-cyan studio-fg-cyan font-bold"
              : "border-transparent studio-fg-muted studio-hover-fg-primary"
          }`}
        >
          <IconFlame className="w-4 h-4 studio-fg-amber" />
          <span>HL7 FHIR R4</span>
        </button>

        <button
          ref={(node) => {
            tabRefs.current.sdtm_spec = node;
          }}
          type="button"
          id="export-tab-sdtm_spec"
          role="tab"
          aria-selected={activeTab === "sdtm_spec"}
          aria-controls="export-panel-sdtm_spec"
          tabIndex={activeTab === "sdtm_spec" ? 0 : -1}
          onClick={() => setActiveTab("sdtm_spec")}
          onKeyDown={(e) => handleTabKeyDown(e, "sdtm_spec")}
          className={`px-3 sm:px-4 py-2 text-xs font-mono transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "sdtm_spec"
              ? "studio-border-cyan studio-fg-cyan font-bold"
              : "border-transparent studio-fg-muted studio-hover-fg-primary"
          }`}
        >
          <IconFileSpreadsheet className="w-4 h-4" />
          <span>SDTM Mapping Specs</span>
        </button>

        <button
          ref={(node) => {
            tabRefs.current.json = node;
          }}
          type="button"
          id="export-tab-json"
          role="tab"
          aria-selected={activeTab === "json"}
          aria-controls="export-panel-json"
          tabIndex={activeTab === "json" ? 0 : -1}
          onClick={() => setActiveTab("json")}
          onKeyDown={(e) => handleTabKeyDown(e, "json")}
          className={`px-3 sm:px-4 py-2 text-xs font-mono transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "json"
              ? "studio-border-cyan studio-fg-cyan font-bold"
              : "border-transparent studio-fg-muted studio-hover-fg-primary"
          }`}
        >
          <IconCode className="w-4 h-4" />
          <span>JSON Study Bundle</span>
        </button>
      </div>

      {activeTab === "usdm" && (
        <div className="shrink-0 min-w-0 flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl studio-surface-subtle border studio-border-default">
          <p className="min-w-0 flex-1 text-xs font-sans studio-fg-secondary break-words">
            Run the study data pipeline on {study.protocolNumber}: this USDM
            export opens in the Study Data Pipeline, which lists the domains it
            tabulates and the ones it leaves out before anything runs.
          </p>
          <a
            href={STUDY_DATA_HANDOFF_PATH}
            onClick={handleRunPipeline}
            aria-disabled={isGenerating || undefined}
            className="inline-flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-xl studio-accent-amber studio-hover-amber border font-mono text-xs font-bold transition-all active:scale-[0.98] aria-disabled:opacity-60"
          >
            <IconPlayerPlay className="w-4 h-4" />
            <span>Run the pipeline on this study</span>
          </a>
          {handoffError && (
            <p role="alert" className="basis-full text-xs studio-fg-red">
              {handoffError}
            </p>
          )}
        </div>
      )}

      {/* Main Tab Content */}
      {EXPORT_TABS.map((tabId) => {
        if (tabId === "sdtm_spec") {
          return (
            <div
              key={tabId}
              id="export-panel-sdtm_spec"
              role="tabpanel"
              aria-labelledby="export-tab-sdtm_spec"
              tabIndex={0}
              hidden={activeTab !== "sdtm_spec"}
              className={
                activeTab === "sdtm_spec"
                  ? "shrink-0 min-w-0 rounded-2xl border studio-border-default studio-surface-subtle overflow-x-auto shadow-xl"
                  : "hidden"
              }
            >
              <table className="w-full text-left border-collapse text-xs font-mono">
                <caption className="sr-only">
                  SDTM Mapping Specifications
                </caption>
                <thead>
                  <tr className="border-b studio-border-default studio-surface-subtle studio-fg-muted">
                    <th scope="col" className="p-3">
                      Domain
                    </th>
                    <th scope="col" className="p-3">
                      Form
                    </th>
                    <th scope="col" className="p-3">
                      Variable (CDASH)
                    </th>
                    <th scope="col" className="p-3">
                      Label
                    </th>
                    <th scope="col" className="p-3">
                      Data Type
                    </th>
                    <th scope="col" className="p-3">
                      Core
                    </th>
                    <th scope="col" className="p-3">
                      aCRF Overlay Tag
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y studio-divide-default">
                  {specFields.map(({ field, form }) => (
                    <tr
                      key={`${form.id}_${field.id}`}
                      className="studio-hover-surface"
                    >
                      <td className="p-3 font-bold studio-fg-cyan">
                        {form.domain}
                      </td>
                      <td className="p-3 studio-fg-secondary font-sans">
                        {form.name}
                      </td>
                      <td className="p-3 font-bold studio-fg-primary">
                        {field.variableName}
                      </td>
                      <td className="p-3 studio-fg-secondary font-sans">
                        {field.label}
                      </td>
                      <td className="p-3 studio-fg-muted">{field.dataType}</td>
                      <td className="p-3 studio-fg-muted">
                        {field.cdashMetadata?.core ||
                          (field.required ? "R" : "O")}
                      </td>
                      <td className="p-3 studio-fg-sky">
                        {field.cdashMetadata?.acrfAnnotation ||
                          `${form.domain}.${field.variableName}`}
                      </td>
                    </tr>
                  ))}
                  {specFields.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-4 text-center studio-fg-muted"
                      >
                        No fields found for selected form/domain scope.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <div
            key={tabId}
            id={`export-panel-${tabId}`}
            role="tabpanel"
            aria-labelledby={`export-tab-${tabId}`}
            tabIndex={0}
            hidden={activeTab !== tabId}
            className={
              activeTab === tabId
                ? "shrink-0 min-w-0 h-auto rounded-2xl border studio-border-default studio-surface-subtle p-4 font-mono text-xs overflow-x-auto max-h-[450px]"
                : "hidden"
            }
          >
            {activeTab === tabId &&
              (isGenerating ? (
                <div className="flex items-center gap-2 studio-fg-muted py-6 justify-center font-mono">
                  <IconLoader2 className="w-4 h-4 animate-spin studio-fg-cyan" />
                  <span>Generating export representation...</span>
                </div>
              ) : (
                <pre className="studio-fg-secondary whitespace-pre-wrap leading-relaxed">
                  {activeContent}
                </pre>
              ))}
          </div>
        );
      })}

      {/* Import Section */}
      <div className="p-5 rounded-2xl studio-surface-subtle border studio-border-default space-y-4">
        <div className="flex items-center gap-2">
          <IconUpload className="w-4 h-4 studio-fg-cyan" />
          <h2 className="text-xs font-bold studio-fg-primary font-mono uppercase">
            Multi-Format Protocol Import &amp; Ingestion
          </h2>
        </div>

        <ImportDropzone
          onFileParsed={handleStudyParsed}
          onError={(err) => setImportError(err)}
        />

        <div className="space-y-1.5 pt-1">
          <label
            htmlFor="export-raw-study-import-textarea"
            className="text-[11px] font-mono studio-fg-muted block"
          >
            Or paste raw JSON (Universal CRF, USDM, or HL7 FHIR R4) / XML / CSV
            text directly:
          </label>
          <textarea
            id="export-raw-study-import-textarea"
            rows={3}
            value={importJsonText}
            onChange={(e) => setImportJsonText(e.target.value)}
            placeholder="Paste exported StudyProtocol JSON here to load... (or USDM, HL7 FHIR R4 JSON, ODM-XML, CSV)"
            className="w-full p-3 studio-surface-subtle border studio-border-default rounded-xl text-xs font-mono studio-fg-secondary studio-focus-input focus:outline-none"
          />
        </div>

        {importError && (
          <div className="p-2.5 rounded-lg studio-accent-red border text-xs font-mono">
            {importError}
          </div>
        )}

        {preflightViolations.length > 0 && (
          <div className="p-4 rounded-xl studio-bg-red border studio-border-red space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 studio-fg-red font-bold text-xs uppercase">
                <IconAlertCircle className="w-4 h-4 studio-fg-red" />
                <span>
                  CDISC Conformance Pre-Flight Violations (
                  {preflightViolations.length})
                </span>
              </div>
              <span className="text-[11px] studio-fg-muted">
                {
                  preflightViolations.filter((v) => v.severity === "error")
                    .length
                }{" "}
                Critical Errors ·{" "}
                {
                  preflightViolations.filter((v) => v.severity === "warning")
                    .length
                }{" "}
                Warnings
              </span>
            </div>

            <p className="text-xs studio-fg-secondary font-sans">
              Import halted due to CDISC conformance violations in the protocol
              specification. Review the pre-flight violation summary below or
              click Auto-Fix to remediate.
            </p>

            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {preflightViolations.map((viol) => (
                <div
                  key={viol.id}
                  className="p-2.5 rounded-lg studio-surface-subtle border studio-border-default text-xs flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          viol.severity === "error"
                            ? "studio-accent-red-strong border"
                            : "studio-accent-amber-strong border"
                        }`}
                      >
                        {viol.ruleId} ({viol.severity})
                      </span>
                      {viol.formName && (
                        <span className="studio-fg-secondary font-bold">
                          Form: {viol.formName}
                        </span>
                      )}
                      {viol.variableName && (
                        <span className="studio-fg-cyan font-mono text-[11px]">
                          Variable: {viol.variableName}
                        </span>
                      )}
                    </div>
                    {viol.autoFixAvailable && (
                      <span className="text-[10px] studio-fg-emerald font-sans font-semibold">
                        Auto-Fix Available
                      </span>
                    )}
                  </div>

                  <p className="studio-fg-secondary font-sans">
                    {viol.message}
                  </p>
                  {viol.suggestedFix && (
                    <p className="studio-fg-muted text-[11px] font-sans italic">
                      Suggested Fix: {viol.suggestedFix}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t studio-border-default">
              <button
                type="button"
                onClick={handleAutoFixAndImport}
                className="inline-flex items-center gap-1.5 px-4 py-2 studio-btn-emerald font-mono text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <IconWand className="w-4 h-4" />
                <span>1-Click Auto-Fix &amp; Import Protocol</span>
              </button>

              {preflightViolations.every((v) => v.severity !== "error") && (
                <button
                  type="button"
                  onClick={handleBypassAndImport}
                  className="px-3 py-1.5 studio-surface-muted studio-hover-active studio-fg-secondary text-xs font-mono rounded-xl transition-all cursor-pointer"
                >
                  Proceed with Warnings
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handlePerformImport}
            disabled={!importJsonText.trim()}
            className="px-4 py-2 studio-surface-muted studio-fg-primary studio-hover-cyan font-mono text-xs font-bold rounded-xl transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            Import Protocol into Studio
          </button>
        </div>
      </div>
    </div>
  );
};
