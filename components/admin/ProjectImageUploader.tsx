"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { formatBytes } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import {
  IconUpload,
  IconX,
  IconRefresh,
  IconCheck,
  IconAlertTriangle,
  IconPhoto,
  IconTrash,
} from "@tabler/icons-react";
import { useAnnouncer } from "@/hooks/useAnnouncer";

interface ProjectOption {
  slug: string;
  title: string;
  hero_image_url?: string | null;
}

interface ProjectImageUploaderProps {
  initialProjects?: ProjectOption[];
  defaultSlug?: string;
  onUploadSuccess?: (slug: string, heroImageUrl: string) => void;
}

const UPLOADING_MESSAGE = "Sending multipart image buffer to server...";
const SUCCESS_MESSAGE = "Image uploaded & persisted successfully!";
const CANCELLED_MESSAGE = "Upload cancelled. Prior asset preserved.";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
];

export function ProjectImageUploader({
  initialProjects = [],
  defaultSlug = "laser-loon",
  onUploadSuccess,
}: ProjectImageUploaderProps) {
  const [selectedSlug, setSelectedSlug] = useState<string>(
    defaultSlug || initialProjects[0]?.slug || "laser-loon"
  );
  const [overriddenAssets, setOverriddenAssets] = useState<
    Record<string, string | null>
  >({});
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "validating" | "uploading" | "success" | "error" | "cancelled"
  >("idle");
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Status changes are spoken through the root A11yProvider regions: the
  // banners below mount with their text already present, which most screen
  // readers skip when the banner itself is the live region.
  const { announce } = useAnnouncer();
  const announceError = useCallback(
    (message: string) => announce(`Upload Failed. ${message}`, "assertive"),
    [announce]
  );

  const cleanupPreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const cleanupProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupPreviewUrl();
      cleanupProgressTimer();
    };
  }, [cleanupPreviewUrl, cleanupProgressTimer]);

  const activeProject = initialProjects.find((p) => p.slug === selectedSlug);
  const currentAssetUrl =
    overriddenAssets[selectedSlug] !== undefined
      ? overriddenAssets[selectedSlug]
      : activeProject?.hero_image_url || null;

  const handleSlugChange = (newSlug: string) => {
    cleanupPreviewUrl();
    cleanupProgressTimer();
    setSelectedSlug(newSlug);
    setFile(null);
    setPreviewUrl(null);
    setStatus("idle");
    setProgress(0);
    setErrorMessage(null);
  };

  const validateFile = (selectedFile: File): string | null => {
    if (selectedFile.size > MAX_SIZE_BYTES) {
      return "File size exceeds maximum allowed limit of 5MB.";
    }
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      return "Invalid file format. Allowed types: PNG, JPEG, WebP, GIF, SVG, and AVIF.";
    }
    return null;
  };

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      cleanupPreviewUrl();
      const error = validateFile(selectedFile);
      if (error) {
        setErrorMessage(error);
        setStatus("error");
        setFile(null);
        setPreviewUrl(null);
        announceError(error);
        return;
      }

      setErrorMessage(null);
      setFile(selectedFile);
      setStatus("idle");

      const objectUrl = URL.createObjectURL(selectedFile);
      previewUrlRef.current = objectUrl;
      setPreviewUrl(objectUrl);
    },
    [cleanupPreviewUrl, announceError]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    cleanupProgressTimer();
    cleanupPreviewUrl();
    setStatus("cancelled");
    setProgress(0);
    setErrorMessage("Upload cancelled by user.");
    announce(CANCELLED_MESSAGE, "polite");
  };

  const executeUpload = async () => {
    if (!file) return;

    setStatus("uploading");
    setProgress(10);
    setErrorMessage(null);
    announce(UPLOADING_MESSAGE, "polite");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Simulated smooth progress increments for responsive UX
      cleanupProgressTimer();
      progressTimerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 85) {
            cleanupProgressTimer();
            return prev;
          }
          return prev + 15;
        });
      }, 120);

      const response = await apiClient.post<{
        hero_image_url?: string;
        data?: { hero_image_url?: string };
      }>(`/api/admin/projects/${selectedSlug}/image`, formData, {
        signal: controller.signal,
      });

      cleanupProgressTimer();

      if (controller.signal.aborted) {
        setStatus("cancelled");
        setErrorMessage("Upload cancelled by user.");
        return;
      }

      if (!response.ok) {
        const errText = response.error || "Failed to upload project image.";
        throw new Error(errText);
      }

      const resData = response.data;
      const heroImageUrl =
        resData?.hero_image_url || resData?.data?.hero_image_url;

      setProgress(100);
      setStatus("success");
      announce(SUCCESS_MESSAGE, "polite");
      setOverriddenAssets((prev) => ({
        ...prev,
        [selectedSlug]: heroImageUrl || null,
      }));

      if (onUploadSuccess && heroImageUrl) {
        onUploadSuccess(selectedSlug, heroImageUrl);
      }
    } catch (err: unknown) {
      if (
        (err instanceof Error && err.name === "AbortError") ||
        controller.signal.aborted
      ) {
        // Only cancelUpload aborts the request, and it has already
        // announced the cancellation, so stay silent here.
        setStatus("cancelled");
        setErrorMessage("Upload cancelled by user.");
      } else {
        const message =
          err instanceof Error
            ? err.message
            : "An unexpected upload error occurred.";
        setStatus("error");
        setErrorMessage(message);
        announceError(message);
      }
    } finally {
      cleanupProgressTimer();
      abortControllerRef.current = null;
    }
  };

  const handleClearImage = async () => {
    try {
      const response = await apiClient.delete(
        `/api/admin/projects/${selectedSlug}/image`
      );
      if (response.ok) {
        cleanupPreviewUrl();
        setOverriddenAssets((prev) => ({
          ...prev,
          [selectedSlug]: null,
        }));
        setPreviewUrl(null);
        setFile(null);
        setStatus("idle");
      }
    } catch {
      // Ignore clear failure
    }
  };

  return (
    <div
      className="p-6 rounded-lg border border-white/10 bg-[#0d0e11] flex flex-col gap-5 w-full text-zinc-100 font-sans"
      data-testid="project-image-uploader"
    >
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <IconPhoto className="w-5 h-5" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold font-mono">
              Project Image Asset Manager
            </h2>
          </div>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/5">
            Admin Endpoint
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          Upload and persist validated media assets for public project hero
          displays. Maximum 5MB (PNG, JPEG, WebP, SVG, AVIF).
        </p>
      </div>

      {/* Target Project Selection */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="project-slug-select"
          className="text-xs font-mono font-semibold text-zinc-300"
        >
          Target Project Slug:
        </label>
        <select
          id="project-slug-select"
          value={selectedSlug}
          onChange={(e) => handleSlugChange(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-100 focus:outline-none focus:border-cyan-500"
        >
          {initialProjects.length > 0 ? (
            initialProjects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title} ({p.slug})
              </option>
            ))
          ) : (
            <>
              <option value="laser-loon">Laser Loon (laser-loon)</option>
              <option value="schemaflow">SchemaFlow (schemaflow)</option>
              <option value="clinical-data-mapper">
                Clinical Data Mapper (clinical-data-mapper)
              </option>
              <option value="imednet-python-sdk">
                iMednet Python SDK (imednet-python-sdk)
              </option>
            </>
          )}
        </select>
      </div>

      {/* Current Persisted Asset Preview */}
      {currentAssetUrl && (
        <div className="p-3 rounded-md bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-12 h-12 relative rounded border border-zinc-700 overflow-hidden shrink-0 bg-black">
              <Image
                src={currentAssetUrl}
                alt={`Hero preview for ${selectedSlug}`}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                <IconCheck className="w-3.5 h-3.5" /> Active Persisted Asset
              </span>
              <span
                className="text-[11px] font-mono text-zinc-400 truncate"
                title={currentAssetUrl}
              >
                {currentAssetUrl}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearImage}
            className="p-2 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 text-xs font-mono flex items-center gap-1 transition-colors shrink-0"
            title="Remove active project image"
          >
            <IconTrash className="w-4 h-4" /> Clear
          </button>
        </div>
      )}

      {/* Drag & Drop Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
          isDragging
            ? "border-cyan-400 bg-cyan-950/20"
            : "border-zinc-700 hover:border-zinc-500 bg-zinc-950/50"
        }`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-label="Upload project image dropzone"
      >
        <input
          ref={fileInputRef}
          type="file"
          data-testid="project-image-input"
          accept={ALLOWED_TYPES.join(",")}
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
        />
        <IconUpload className="w-8 h-8 text-zinc-400" />
        <div className="text-center">
          <p className="text-xs font-medium text-zinc-200">
            Drag & drop project image here, or{" "}
            <span className="text-cyan-400 underline">browse</span>
          </p>
          <p className="text-[10px] text-zinc-400 font-mono mt-1">
            PNG, JPEG, WebP, SVG, AVIF • Max size 5MB
          </p>
        </div>
      </div>

      {/* Selected File & Local Preview */}
      {file && (
        <div className="p-3 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            {previewUrl && (
              <div className="w-10 h-10 relative rounded border border-zinc-700 overflow-hidden shrink-0 bg-black">
                {/* Standard img for local blob preview URL */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Local file preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-mono font-medium truncate text-zinc-200">
                {file.name}
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {formatBytes(file.size, {
                  unit: "MB",
                  decimals: 2,
                  trimZeros: false,
                })}{" "}
                • {file.type}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              cleanupPreviewUrl();
              setFile(null);
              setPreviewUrl(null);
              setStatus("idle");
            }}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100"
            title="Remove selected file"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Progress State */}
      {status === "uploading" && (
        <div
          className="flex flex-col gap-2"
          role="region"
          aria-label="Upload Progress"
        >
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-cyan-400 font-semibold animate-pulse">
              Uploading asset...
            </span>
            <span className="text-zinc-400">{progress}%</span>
          </div>
          <div
            className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
          >
            <div
              className="h-full bg-cyan-500 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-[10px] font-mono text-zinc-400">
              {UPLOADING_MESSAGE}
            </span>
            <button
              type="button"
              onClick={cancelUpload}
              className="px-2.5 py-1 text-xs font-mono text-red-400 hover:text-red-300 border border-red-500/30 rounded bg-red-950/20"
            >
              Cancel Upload
            </button>
          </div>
        </div>
      )}

      {/* Success State */}
      {status === "success" && (
        <div
          className="p-3 rounded-md bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center justify-between"
          data-testid="project-image-upload-success"
        >
          <div className="flex items-center gap-2">
            <IconCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{SUCCESS_MESSAGE}</span>
          </div>
        </div>
      )}

      {/* Cancelled State */}
      {status === "cancelled" && (
        <div
          className="p-3 rounded-md bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-center justify-between"
          data-testid="project-image-upload-cancelled"
        >
          <div className="flex items-center gap-2">
            <IconAlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{CANCELLED_MESSAGE}</span>
          </div>
          {file && (
            <button
              type="button"
              onClick={executeUpload}
              className="px-2 py-0.5 rounded bg-amber-900/50 hover:bg-amber-800/60 border border-amber-500/30 text-amber-200 text-xs font-mono"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Recoverable Error & Retry State */}
      {status === "error" && errorMessage && (
        <div
          className="p-3 rounded-md bg-red-950/40 border border-red-500/40 text-red-300 text-xs font-mono flex flex-col gap-2"
          data-testid="project-image-upload-error"
        >
          <div className="flex items-start gap-2">
            <IconAlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-red-200">Upload Failed</span>
              <span className="text-red-300">{errorMessage}</span>
            </div>
          </div>
          {file && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={executeUpload}
                className="inline-flex items-center gap-1 px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-mono transition-colors"
              >
                <IconRefresh className="w-3.5 h-3.5" />
                <span>Retry Upload</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Primary Upload Trigger Button */}
      {file && status !== "uploading" && (
        <button
          type="button"
          onClick={executeUpload}
          className="w-full py-2.5 px-4 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <IconUpload className="w-4 h-4" />
          <span>Confirm &amp; Upload Project Image</span>
        </button>
      )}
    </div>
  );
}
