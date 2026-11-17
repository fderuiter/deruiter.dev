"use client";

import React, { Component, type ReactNode, type ErrorInfo } from "react";
import {
  IconAlertTriangle,
  IconRefresh,
  IconDownload,
} from "@tabler/icons-react";
import { reportClientError } from "@/lib/client-sentry";
import { safeGetRawItem } from "@/lib/safe-storage";
import { downloadFile, sanitizeFilename } from "@/lib/download";
import { logger } from "@/lib/logger";

const SENSITIVE_KEY_PATTERN =
  /^(?:api[_-]?key|password|pass|secret|token|authorization|auth|private[_-]?key|credential|jwt|access_token|refresh_token|ssn|social_security_number)$/i;
const SSN_PATTERN = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g;
const BEARER_PATTERN = /bearer\s+[a-zA-Z0-9_\-\.]+/gi;

/**
 * Sanitizes arbitrary draft structures before emergency export so private credentials,
 * API keys, authentication tokens, and sensitive patient identifiers (SSNs)
 * are never leaked into downloaded draft files.
 */
export function sanitizeDraftForExport(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data === "string") {
    return data
      .replace(SSN_PATTERN, "***-**-****")
      .replace(BEARER_PATTERN, "Bearer [REDACTED]");
  }
  if (typeof data === "number" || typeof data === "boolean") {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeDraftForExport);
  }
  if (typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = sanitizeDraftForExport(val);
      }
    }
    return result;
  }
  return data;
}

interface StudioErrorBoundaryProps {
  children: ReactNode;
  /** Human-readable studio or canvas name, e.g. "CRF Studio" or "NeuroRecon 3D Viewer" */
  studioName?: string;
  /** Local storage key holding draft data. Defaults to "crf_studio_draft_v1". */
  draftStorageKey?: string;
  /** Whether to attempt automatic recovery upon catching a render error. Defaults to false. */
  autoRecover?: boolean;
  /** Optional callback invoked when the user triggers a workspace reset. */
  onReset?: () => void;
  /** Custom draft extractor when in-memory draft is not yet serialized to storage. */
  onExportDraft?: () => unknown;
  /** Custom fallback renderer. */
  fallback?:
    | ReactNode
    | ((props: {
        error: Error | null;
        reset: () => void;
        consecutiveFailures: number;
      }) => ReactNode);
}

interface StudioErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  consecutiveFailures: number;
  retryKey: number;
}

/**
 * Scoped Error Boundary for interactive studio and canvas routes.
 *
 * Catches render-phase exceptions within studio workspaces (e.g. CRF Studio,
 * NeuroRecon 3D canvas), logs telemetry via `reportClientError`, isolates crashes
 * to prevent full-page unmounting (keeping top navigation, breadcrumbs, and studio
 * documentation intact), and provides inline emergency actions:
 * - One-click canvas/workspace retry with auto-recovery throttled to <= 3 consecutive attempts.
 * - Emergency draft export reading acknowledged state from localStorage with PII sanitization.
 */
export class StudioErrorBoundary extends Component<
  StudioErrorBoundaryProps,
  StudioErrorBoundaryState
> {
  private autoRecoverTimer: ReturnType<typeof setTimeout> | null = null;

  state: StudioErrorBoundaryState = {
    hasError: false,
    error: null,
    consecutiveFailures: 0,
    retryKey: 0,
  };

  static getDerivedStateFromError(
    error: Error
  ): Partial<StudioErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    void reportClientError(error);
    logger.error(`[StudioErrorBoundary] Caught render exception:`, error, {
      componentStack: errorInfo?.componentStack,
    });

    this.setState((prev) => {
      const nextFailures = prev.consecutiveFailures + 1;

      // Automatic recovery attempts MUST stop after three consecutive failures
      // to prevent infinite render loops.
      if (this.props.autoRecover && nextFailures < 3) {
        if (this.autoRecoverTimer) clearTimeout(this.autoRecoverTimer);
        this.autoRecoverTimer = setTimeout(() => {
          this.handleRetry();
        }, 150);
      }

      return { consecutiveFailures: nextFailures };
    });
  }

  componentWillUnmount(): void {
    if (this.autoRecoverTimer) {
      clearTimeout(this.autoRecoverTimer);
      this.autoRecoverTimer = null;
    }
  }

  handleRetry = (): void => {
    if (this.autoRecoverTimer) {
      clearTimeout(this.autoRecoverTimer);
      this.autoRecoverTimer = null;
    }

    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryKey: prev.retryKey + 1,
    }));

    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (err) {
        logger.warn("[StudioErrorBoundary] Error in onReset callback:", err);
      }
    }
  };

  handleExportDraft = (): void => {
    let draftData: unknown = null;
    let draftId: string | null = null;
    const studioName = this.props.studioName || "Studio";
    const storageKey = this.props.draftStorageKey || "crf_studio_draft_v1";

    if (this.props.onExportDraft) {
      try {
        draftData = this.props.onExportDraft();
      } catch (err) {
        logger.warn(
          "[StudioErrorBoundary] onExportDraft callback failed:",
          err
        );
      }
    }

    if (!draftData && typeof window !== "undefined") {
      try {
        const raw = safeGetRawItem(storageKey);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && "study" in parsed) {
              draftData = (parsed as { study: unknown }).study;
            } else {
              draftData = parsed;
            }
          } catch {
            draftData = raw;
          }
        }
      } catch (err) {
        logger.warn("[StudioErrorBoundary] safeGetRawItem failed:", err);
      }
    }

    if (!draftData) {
      draftData = {
        studio: studioName,
        status: "empty_draft",
        exportedAt: new Date().toISOString(),
      };
    }

    if (
      draftData &&
      typeof draftData === "object" &&
      "id" in draftData &&
      typeof (draftData as { id: unknown }).id === "string"
    ) {
      draftId = (draftData as { id: string }).id;
    }

    const sanitized = sanitizeDraftForExport(draftData);
    const stem =
      draftId || studioName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const sanitizedStem = sanitizeFilename(stem, "studio-draft");
    const filename = `${sanitizedStem}-recovery-draft.json`;

    downloadFile(
      typeof sanitized === "string"
        ? sanitized
        : JSON.stringify(sanitized, null, 2),
      filename,
      { mimeType: "application/json" }
    );
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return (
        <React.Fragment key={this.state.retryKey}>
          {this.props.children}
        </React.Fragment>
      );
    }

    if (typeof this.props.fallback === "function") {
      return this.props.fallback({
        error: this.state.error,
        reset: this.handleRetry,
        consecutiveFailures: this.state.consecutiveFailures,
      });
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const studioName = this.props.studioName || "Studio Workspace";
    const storageKey = this.props.draftStorageKey || "crf_studio_draft_v1";

    let savedAt: string | null = null;
    let hasDraftInStorage = false;

    if (typeof window !== "undefined") {
      try {
        const raw = safeGetRawItem(storageKey);
        if (raw) {
          hasDraftInStorage = true;
          try {
            const parsed = JSON.parse(raw);
            if (
              parsed &&
              typeof parsed === "object" &&
              "savedAt" in parsed &&
              typeof (parsed as { savedAt: unknown }).savedAt === "string"
            ) {
              savedAt = (parsed as { savedAt: string }).savedAt;
            }
          } catch {
            // Non-envelope string draft
          }
        }
      } catch {
        // Storage restricted
      }
    }

    const consecutiveFailures = this.state.consecutiveFailures;

    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="studio-error-boundary-fallback"
        className="relative flex min-h-[360px] w-full flex-col items-center justify-center p-6 sm:p-8 bg-zinc-950 text-zinc-100 rounded-2xl border border-zinc-800 shadow-2xl text-center"
      >
        <div className="relative z-10 w-full max-w-lg p-6 sm:p-8 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-mono font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-md mb-4">
            <IconAlertTriangle className="w-4 h-4" aria-hidden="true" />
            <span>STUDIO_RUNTIME_ERROR</span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold font-mono text-zinc-100 mb-2">
            {studioName} encountered an unexpected error
          </h2>

          <p className="text-sm text-zinc-400 leading-relaxed mb-4">
            An isolated rendering error was intercepted. Page navigation,
            breadcrumbs, and studio documentation remain operational.
          </p>

          {hasDraftInStorage && (
            <div className="mb-4 w-full p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-xs font-mono text-zinc-400 text-left flex items-center justify-between">
              <span>Stored draft available</span>
              {savedAt ? (
                <span className="text-zinc-500">{savedAt}</span>
              ) : (
                <span className="text-emerald-500/80">Ready to export</span>
              )}
            </div>
          )}

          {consecutiveFailures >= 3 && (
            <div
              data-testid="studio-error-loop-guard"
              className="mb-4 w-full p-2.5 rounded-lg bg-red-950/20 border border-red-900/40 text-xs font-mono text-red-400 text-center"
            >
              Automatic recovery halted after 3 consecutive failures to prevent
              infinite loops.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 w-full mt-2">
            <button
              type="button"
              onClick={this.handleRetry}
              data-testid="studio-error-retry-btn"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-brand-cyan text-zinc-950 hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-cyan transition-colors shadow cursor-pointer active:scale-[0.98]"
            >
              <IconRefresh className="w-4 h-4" aria-hidden="true" />
              <span>Reload Canvas</span>
            </button>

            <button
              type="button"
              onClick={this.handleExportDraft}
              data-testid="studio-error-export-btn"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 hover:border-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-400 transition-colors cursor-pointer active:scale-[0.98]"
            >
              <IconDownload className="w-4 h-4" aria-hidden="true" />
              <span>Export Draft</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
