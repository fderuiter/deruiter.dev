"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconDownload, IconX } from "@tabler/icons-react";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  evaluateProofStatus,
  exportWorkspaceProof,
  TheoremId,
  Edge,
} from "@/lib/proof-utils";

interface ProofExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTheoremId: TheoremId;
  edges: Edge[];
}

export const ProofExportModal: React.FC<ProofExportModalProps> = ({
  isOpen,
  onClose,
  activeTheoremId,
  edges,
}) => {
  const [exportFormat, setExportFormat] = useState<
    "lean" | "latex" | "markdown" | "mermaid"
  >("lean");

  const getExportText = () =>
    exportWorkspaceProof(exportFormat, edges, activeTheoremId);
  const graphComplete = evaluateProofStatus(edges, activeTheoremId).isE_Proven;
  const canCopy =
    activeTheoremId !== "custom" &&
    (graphComplete ||
      exportFormat === "markdown" ||
      exportFormat === "mermaid");

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 flex flex-col gap-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <IconDownload className="w-5 h-5 text-brand-cyan" />
                Export Workspace State
              </h3>
              <button
                onClick={onClose}
                aria-label="Close Export Modal"
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2">
              {(["lean", "latex", "markdown", "mermaid"] as const).map(
                (fmt) => (
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
                )
              )}
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 max-h-72 overflow-y-auto">
              <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap">
                {getExportText()}
              </pre>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              {canCopy && (
                <CopyButton
                  text={getExportText}
                  label="Copy to Clipboard"
                  copiedLabel="Copied!"
                  successMessage="Workspace export copied to clipboard"
                  className="px-4 py-2 rounded-xl bg-brand-cyan hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-[0.98]"
                />
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
