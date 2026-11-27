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
import { detectAndParseStudyFile, ParsedStudyFileResult } from "@/lib/crf";
import { clamp, formatBytes } from "@/lib/utils";
import { NoPhiNotice } from "./NoPhiNotice";

import { TooltipButton } from "@/components/ui/Tooltip";
interface ImportDropzoneProps {
  onFileParsed: (result: ParsedStudyFileResult, rawText: string) => void;
  onError: (errorMsg: string | null) => void;
  className?: string;
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

  const progressPercent = clamp(readProgress, 0, 100);

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
        aria-label={
          isReading
            ? `Upload study protocol dropzone: Reading and parsing study protocol... Supports CDISC ODM-XML (.xml), USDM / Universal CRF (.json), and Study Specs (.csv) up to 50MB ${progressPercent}% uploaded and parsed`
            : activeFile
              ? `Upload study protocol dropzone: ${activeFile.name} Supports CDISC ODM-XML (.xml), USDM / Universal CRF (.json), and Study Specs (.csv) up to 50MB`
              : "Upload study protocol dropzone: Drag & drop study file here, or click to browse Supports CDISC ODM-XML (.xml), USDM / Universal CRF (.json), and Study Specs (.csv) up to 50MB CDISC ODM-XML (.xml) USDM JSON (.json) CSV Spec (.csv)"
        }
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={handleKeyDown}
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 outline-none focus:ring-2 studio-focus-input ${
          isDragging
            ? "studio-border-cyan studio-bg-cyan scale-[1.01]"
            : activeFile
              ? "studio-border-emerald studio-bg-emerald studio-hover-border-emerald"
              : "studio-border-default studio-surface-subtle studio-hover-border-strong studio-hover-subtle"
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          {isReading ? (
            <div className="p-3 rounded-full studio-accent-cyan border motion-safe:animate-pulse">
              <IconLoader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : activeFile ? (
            <div className="p-3 rounded-full studio-accent-emerald border">
              <IconCheck className="w-8 h-8" />
            </div>
          ) : (
            <div className="p-3 rounded-full studio-accent-purple border">
              <IconUpload className="w-8 h-8" />
            </div>
          )}

          <div className="space-y-1">
            <p className="text-sm font-bold studio-fg-primary font-mono">
              {isReading
                ? "Reading and parsing study protocol... "
                : activeFile
                  ? `${activeFile.name} `
                  : "Drag & drop study file here, or click to browse "}
            </p>
            <p className="text-xs studio-fg-muted font-sans">
              Supports CDISC ODM-XML (.xml), USDM / Universal CRF (.json), and
              Study Specs (.csv) up to 50MB{" "}
            </p>
          </div>

          {/* Format Badges */}
          {!activeFile && !isReading && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full studio-accent-purple border text-[11px] font-mono font-medium">
                <IconFileCode className="w-3.5 h-3.5" />
                CDISC ODM-XML (.xml){" "}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full studio-accent-cyan border text-[11px] font-mono font-medium">
                <IconFileText className="w-3.5 h-3.5" />
                USDM JSON (.json){" "}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full studio-accent-emerald border text-[11px] font-mono font-medium">
                <IconFileSpreadsheet className="w-3.5 h-3.5" />
                CSV Spec (.csv)
              </span>
            </div>
          )}

          {/* Active File Metadata Badge */}
          {activeFile && (
            <div className="flex items-center gap-2 pt-1 font-mono text-xs">
              <span className="px-2.5 py-1 rounded-lg studio-surface-card border studio-border-default studio-fg-secondary">
                Size: {formatBytes(activeFile.size)}
              </span>
              {activeFile.formatLabel && (
                <span className="px-2.5 py-1 rounded-lg studio-accent-emerald-strong border font-bold">
                  Format: {activeFile.formatLabel}
                </span>
              )}
              <TooltipButton
                type="button"
                onClick={clearSelectedFile}
                className="p-1 rounded-lg studio-surface-muted studio-hover-active studio-fg-muted studio-hover-fg-primary transition-colors"
                tooltip="Remove selected file"
                aria-label="Remove selected file"
              >
                <IconX className="w-4 h-4" />
              </TooltipButton>
            </div>
          )}

          {/* Progress Bar */}
          {isReading && (
            <div className="w-full max-w-xs space-y-1.5 pt-2">
              <div className="w-full h-2 studio-surface-muted rounded-full overflow-hidden">
                <div
                  className="h-full studio-dot-cyan transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[11px] font-mono studio-fg-muted">
                {progressPercent}% uploaded and parsed
              </p>
            </div>
          )}
        </div>
      </div>

      <NoPhiNotice />
    </div>
  );
};
