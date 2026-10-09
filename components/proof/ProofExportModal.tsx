"use client";

import React, { useId, useState } from "react";
import { ModalContainer } from "@/components/ui/ModalContainer";
import { IconDownload, IconX } from "@tabler/icons-react";
import { CopyButton } from "@/components/ui/CopyButton";
import { downloadFile } from "@/lib/download";
import {
  evaluateProofStatus,
  exportWorkspaceProof,
  getExportFilename,
  getExportMimeType,
  ProofExportFormat,
  TheoremId,
  TheoremDefinition,
  Edge,
} from "@/lib/proof-utils";

interface ProofExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTheoremId: TheoremId;
  theorem?: TheoremDefinition;
  edges: Edge[];
}

export const ProofExportModal: React.FC<ProofExportModalProps> = ({
  isOpen,
  onClose,
  activeTheoremId,
  edges,
  theorem,
}) => {
  const titleId = useId();
  const [exportFormat, setExportFormat] = useState<ProofExportFormat>("lean");

  const getExportText = () =>
    exportWorkspaceProof(exportFormat, edges, theorem ?? activeTheoremId);
  const graphComplete = evaluateProofStatus(
    edges,
    theorem ?? activeTheoremId
  ).isE_Proven;
  const canCopy =
    (activeTheoremId !== "custom" || theorem?.id === "custom") &&
    (graphComplete ||
      exportFormat === "markdown" ||
      exportFormat === "mermaid");

  const handleDownload = () => {
    const text = getExportText();
    const filename = getExportFilename(
      exportFormat,
      theorem ?? activeTheoremId
    );
    const mimeType = getExportMimeType(exportFormat);
    downloadFile(text, filename, { mimeType });
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
          <IconDownload className="w-5 h-5 text-brand-cyan" />
          Export Workspace State
        </h3>
        <button
          onClick={onClose}
          aria-label="Close Export Modal"
          className="shrink-0 p-1 rounded text-slate-400 hover:text-white cursor-pointer"
        >
          <IconX className="w-5 h-5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["lean", "latex", "markdown", "mermaid"] as const).map((fmt) => (
          <button
            key={fmt}
            onClick={() => setExportFormat(fmt)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase font-bold border transition cursor-pointer active:scale-[0.98] ${
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
      <div className="flex justify-end gap-3 pt-2">
        {canCopy && (
          <>
            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-[0.98]"
            >
              <IconDownload className="w-4 h-4 text-brand-cyan" />
              <span>Download File</span>
            </button>
            <CopyButton
              text={getExportText}
              label="Copy to Clipboard"
              copiedLabel="Copied!"
              successMessage="Workspace export copied to clipboard"
              className="px-4 py-2 rounded-xl bg-brand-cyan hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-[0.98]"
            />
          </>
        )}
      </div>
    </ModalContainer>
  );
};
