"use client";

import React, { useId, useRef, useState } from "react";
import { ModalContainer } from "@/components/ui/ModalContainer";
import {
  IconAlertTriangle,
  IconDownload,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { CopyButton } from "@/components/ui/CopyButton";
import { downloadFile } from "@/lib/download";
import {
  evaluateProofStatus,
  exportWorkspaceProof,
  getExportFilename,
  getExportMimeType,
  THEOREMS,
  type ProofExportFormat,
  type TheoremId,
  type TheoremDefinition,
  type Edge,
} from "@/lib/proof";
import { serializeProofWorkspaceJson } from "@/lib/proof-custom";

interface ProofExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTheoremId: TheoremId;
  theorem?: TheoremDefinition;
  edges: Edge[];
  nodeOffsets?: Record<string, { x: number; y: number }>;
  defaultFormat?: ProofExportFormat;
  shareLimitNotice?: string | null;
  onImportWorkspace?: (rawInput: string | Uint8Array) => {
    ok: boolean;
    error?: string;
  };
}

const EXPORT_FORMATS: readonly ProofExportFormat[] = [
  "lean",
  "latex",
  "markdown",
  "mermaid",
  "proof.json",
];

export const ProofExportModal: React.FC<ProofExportModalProps> = ({
  isOpen,
  onClose,
  activeTheoremId,
  edges,
  theorem,
  nodeOffsets,
  defaultFormat = "lean",
  shareLimitNotice,
  onImportWorkspace,
}) => {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportFormat, setExportFormat] =
    useState<ProofExportFormat>(defaultFormat);
  const [importError, setImportError] = useState<string | null>(null);
  const openSyncKey = isOpen
    ? `${defaultFormat}:${shareLimitNotice ?? ""}`
    : "";
  const [prevOpenSyncKey, setPrevOpenSyncKey] = useState(openSyncKey);
  if (openSyncKey !== prevOpenSyncKey) {
    setPrevOpenSyncKey(openSyncKey);
    if (isOpen) {
      setExportFormat(defaultFormat);
      setImportError(null);
    }
  }

  const resolvedTheorem = theorem ?? THEOREMS[activeTheoremId];

  const getExportText = () => {
    if (exportFormat === "proof.json") {
      if (!theorem && activeTheoremId === "custom") {
        return exportWorkspaceProof("proof.json", edges, activeTheoremId);
      }
      return serializeProofWorkspaceJson(resolvedTheorem, edges, nodeOffsets);
    }
    return exportWorkspaceProof(
      exportFormat,
      edges,
      theorem ?? activeTheoremId
    );
  };

  const graphComplete = evaluateProofStatus(
    edges,
    theorem ?? activeTheoremId
  ).isE_Proven;
  const canCopy =
    (activeTheoremId !== "custom" || Boolean(theorem)) &&
    (graphComplete ||
      exportFormat === "markdown" ||
      exportFormat === "mermaid" ||
      exportFormat === "proof.json");

  const handleDownload = () => {
    const text = getExportText();
    const filename = getExportFilename(
      exportFormat,
      theorem ?? activeTheoremId
    );
    const mimeType = getExportMimeType(exportFormat);
    downloadFile(text, filename, { mimeType });
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onImportWorkspace) return;

    if (file.size > 65_536) {
      setImportError(
        `Workspace file exceeds the 64 KB import limit (${file.size} bytes).`
      );
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const outcome = onImportWorkspace(new Uint8Array(buffer));
      if (!outcome.ok) {
        setImportError(outcome.error ?? "Invalid .proof.json workspace file.");
      } else {
        setImportError(null);
      }
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Unable to read .proof.json workspace file."
      );
    }
  };

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      titleId={titleId}
      className="p-4 sm:p-6 gap-4"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3
          id={titleId}
          className="min-w-0 text-lg font-bold text-white flex items-center gap-2"
        >
          <IconDownload className="w-5 h-5 text-brand-cyan shrink-0" />
          <span className="truncate">Export Workspace State</span>
        </h3>
        <button
          onClick={onClose}
          aria-label="Close Export Modal"
          className="shrink-0 p-1 rounded text-slate-400 hover:text-white cursor-pointer"
        >
          <IconX className="w-5 h-5" />
        </button>
      </div>

      {shareLimitNotice && (
        <div
          role="status"
          className="p-3 rounded-xl border border-amber-500/50 bg-amber-950/40 text-amber-200 text-xs flex items-start gap-2"
        >
          <IconAlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{shareLimitNotice}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {EXPORT_FORMATS.map((fmt) => (
          <button
            key={fmt}
            type="button"
            onClick={() => setExportFormat(fmt)}
            className={`px-3 py-1.5 pointer-coarse:min-h-11 rounded-lg text-xs font-mono uppercase font-bold border transition cursor-pointer active:scale-[0.98] ${
              exportFormat === fmt
                ? "border-brand-cyan bg-brand-cyan/20 text-brand-cyan"
                : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white"
            }`}
          >
            {fmt}
          </button>
        ))}
      </div>

      <div
        role="region"
        aria-label="Proof export"
        tabIndex={0}
        className="min-w-0 p-4 rounded-xl bg-slate-950 border border-slate-800 max-h-72 overflow-y-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-cyan"
      >
        <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap break-all">
          {getExportText()}
        </pre>
      </div>

      {importError && (
        <p
          role="alert"
          className="text-xs font-mono text-rose-300 bg-rose-950/50 border border-rose-800/70 rounded-lg px-3 py-2"
        >
          {importError}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        hidden
        tabIndex={-1}
        accept=".json,.proof.json,application/json"
        aria-label="Upload .proof.json workspace file"
        onChange={handleFileChange}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        {onImportWorkspace ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 pointer-coarse:min-h-11 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-[0.98]"
          >
            <IconUpload className="w-4 h-4 text-brand-cyan" />
            <span>Import .proof.json</span>
          </button>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap justify-end gap-3">
          {canCopy && (
            <>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 pointer-coarse:min-h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-[0.98]"
              >
                <IconDownload className="w-4 h-4 text-brand-cyan" />
                <span>Download File</span>
              </button>
              <CopyButton
                text={getExportText}
                label="Copy to Clipboard"
                copiedLabel="Copied!"
                successMessage="Workspace export copied to clipboard"
                className="px-4 py-2 pointer-coarse:min-h-11 rounded-xl bg-brand-cyan hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-[0.98]"
              />
            </>
          )}
        </div>
      </div>
    </ModalContainer>
  );
};
