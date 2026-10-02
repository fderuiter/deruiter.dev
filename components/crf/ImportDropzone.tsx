"use client";

import React, { useState, useRef } from "react";
import {
  IconUpload,
  IconFileCode,
  IconFileText,
  IconFileSpreadsheet,
  IconCheck,
  IconLoader2,
  IconX,
} from "@tabler/icons-react";
import {
  detectAndParseStudyFile,
  ParsedStudyFileResult,
} from "@/lib/crf/file-ingestion";

interface ImportDropzoneProps {
  onFileParsed: (result: ParsedStudyFileResult, rawText: string) => void;
  onError: (errorMsg: string | null) => void;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export const ImportDropzone: React.FC<ImportDropzoneProps> = ({
  onFileParsed,
  onError,
  className = "",
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const [activeFile, setActiveFile] = useState<{
    name: string;
    size: number;
    formatLabel?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    onError(null);

    if (file.size > 50 * 1024 * 1024) {
      onError(
        `File size (${formatBytes(file.size)}) exceeds maximum supported limit of 50MB.`
      );
      return;
    }

    setIsReading(true);
    setReadProgress(30);
    setActiveFile({
      name: file.name,
      size: file.size,
    });

    try {
      let text = "";
      if (typeof file.text === "function") {
        text = await file.text();
      } else {
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () =>
            reject(reader.error || new Error("Failed to read file"));
          reader.readAsText(file);
        });
      }

      setReadProgress(100);
      setIsReading(false);
      const parsed = detectAndParseStudyFile(text, file.name, file.size);
      setActiveFile({
        name: file.name,
        size: file.size,
        formatLabel: parsed.formatLabel,
      });
      onFileParsed(parsed, text);
    } catch (err: unknown) {
      setIsReading(false);
      setActiveFile(null);
      onError((err as Error).message || "Failed to parse study protocol file.");
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      processFile(droppedFile);
      e.dataTransfer.clearData();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const clearSelectedFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveFile(null);
    onError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json,.xml,.csv"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload study protocol dropzone. Drag and drop CDISC ODM XML, USDM JSON, or CSV study specification files here or press Enter to browse."
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={handleKeyDown}
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 outline-none focus:ring-2 focus:ring-brand-cyan ${
          isDragging
            ? "border-brand-cyan bg-brand-cyan/10 scale-[1.01]"
            : activeFile
              ? "border-emerald-500/50 bg-emerald-950/20 hover:border-emerald-500"
              : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900/60"
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          {isReading ? (
            <div className="p-3 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan animate-pulse">
              <IconLoader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : activeFile ? (
            <div className="p-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <IconCheck className="w-8 h-8" />
            </div>
          ) : (
            <div className="p-3 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <IconUpload className="w-8 h-8" />
            </div>
          )}

          <div className="space-y-1">
            <p className="text-sm font-bold text-white font-mono">
              {isReading
                ? "Reading and parsing study protocol..."
                : activeFile
                  ? activeFile.name
                  : "Drag & drop study file here, or click to browse"}
            </p>
            <p className="text-xs text-zinc-400 font-sans">
              Supports CDISC ODM-XML (.xml), USDM / Universal CRF (.json), and
              Study Specs (.csv) up to 50MB
            </p>
          </div>

          {/* Format Badges */}
          {!activeFile && !isReading && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-[11px] font-mono font-medium text-purple-300">
                <IconFileCode className="w-3.5 h-3.5" />
                CDISC ODM-XML (.xml)
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-[11px] font-mono font-medium text-brand-cyan">
                <IconFileText className="w-3.5 h-3.5" />
                USDM JSON (.json)
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono font-medium text-emerald-300">
                <IconFileSpreadsheet className="w-3.5 h-3.5" />
                CSV Spec (.csv)
              </span>
            </div>
          )}

          {/* Active File Metadata Badge */}
          {activeFile && (
            <div className="flex items-center gap-2 pt-1 font-mono text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                Size: {formatBytes(activeFile.size)}
              </span>
              {activeFile.formatLabel && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold">
                  Format: {activeFile.formatLabel}
                </span>
              )}
              <button
                type="button"
                onClick={clearSelectedFile}
                className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                title="Remove selected file"
                aria-label="Remove selected file"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Progress Bar */}
          {isReading && (
            <div className="w-full max-w-xs space-y-1.5 pt-2">
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-cyan transition-all duration-200"
                  style={{ width: `${readProgress}%` }}
                />
              </div>
              <p className="text-[11px] font-mono text-zinc-400">
                {readProgress}% uploaded and parsed
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
