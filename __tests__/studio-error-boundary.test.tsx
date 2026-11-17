// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  StudioErrorBoundary,
  sanitizeDraftForExport,
} from "@/components/StudioErrorBoundary";

const { mockReportClientError, mockDownloadFile } = vi.hoisted(() => ({
  mockReportClientError: vi.fn(),
  mockDownloadFile: vi.fn(),
}));

vi.mock("@/lib/client-sentry", () => ({
  reportClientError: (err: unknown) => mockReportClientError(err),
}));

vi.mock("@/lib/download", () => ({
  downloadFile: (data: unknown, filename: string, options?: unknown) =>
    mockDownloadFile(data, filename, options),
  sanitizeFilename: (name: string, fallback: string) => name || fallback,
}));

function CrashingComponent({
  shouldThrow = true,
  message = "Artificial render crash",
}: {
  shouldThrow?: boolean;
  message?: string;
}) {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div data-testid="child-content">Studio Workspace Active</div>;
}

describe("StudioErrorBoundary & Draft Recovery Suite", () => {
  let container: HTMLDivElement;
  let root: Root;
  let storageMap: Map<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    storageMap = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storageMap.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) =>
        storageMap.set(key, value)
      ),
      removeItem: vi.fn((key: string) => storageMap.delete(key)),
      clear: vi.fn(() => storageMap.clear()),
      key: vi.fn(
        (index: number) => Array.from(storageMap.keys())[index] ?? null
      ),
      get length() {
        return storageMap.size;
      },
    });

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders children normally when no exception is thrown", () => {
    act(() => {
      root.render(
        <StudioErrorBoundary studioName="CRF Studio">
          <CrashingComponent shouldThrow={false} />
        </StudioErrorBoundary>
      );
    });

    expect(
      container.querySelector('[data-testid="child-content"]')?.textContent
    ).toBe("Studio Workspace Active");
    expect(
      container.querySelector('[data-testid="studio-error-boundary-fallback"]')
    ).toBeNull();
    expect(mockReportClientError).not.toHaveBeenCalled();
  });

  it("catches render exception, logs telemetry via reportClientError, and renders recovery card", () => {
    act(() => {
      root.render(
        <StudioErrorBoundary studioName="CRF Studio">
          <CrashingComponent
            shouldThrow={true}
            message="Simulation state reducer crashed"
          />
        </StudioErrorBoundary>
      );
    });

    const fallback = container.querySelector(
      '[data-testid="studio-error-boundary-fallback"]'
    );
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toContain(
      "CRF Studio encountered an unexpected error"
    );
    expect(fallback?.textContent).toContain("STUDIO_RUNTIME_ERROR");
    expect(mockReportClientError).toHaveBeenCalledTimes(1);
    expect(mockReportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Simulation state reducer crashed" })
    );
  });

  it("resets boundary state and re-renders children when Retry button is clicked", () => {
    function FlakyStudioWrapper() {
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <div>
          <button
            data-testid="fix-state-btn"
            onClick={() => setShouldThrow(false)}
          >
            Fix State
          </button>
          <StudioErrorBoundary studioName="CRF Studio">
            <CrashingComponent shouldThrow={shouldThrow} />
          </StudioErrorBoundary>
        </div>
      );
    }

    act(() => {
      root.render(<FlakyStudioWrapper />);
    });

    // Initially in error state
    expect(
      container.querySelector('[data-testid="studio-error-boundary-fallback"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="child-content"]')).toBeNull();

    // User or environment fixes the issue and clicks retry
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="fix-state-btn"]')
        ?.click();
    });

    const retryBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="studio-error-retry-btn"]'
    );
    expect(retryBtn).not.toBeNull();

    act(() => {
      retryBtn?.click();
    });

    // Boundary recovers and re-renders the children
    expect(
      container.querySelector('[data-testid="child-content"]')?.textContent
    ).toBe("Studio Workspace Active");
    expect(
      container.querySelector('[data-testid="studio-error-boundary-fallback"]')
    ).toBeNull();
  });

  it("reads stored draft from localStorage and triggers browser download upon clicking Export Draft", () => {
    const draftPayload = {
      envelopeVersion: 1,
      savedAt: "2026-11-17T04:30:00Z",
      study: {
        id: "ONCOLOGY-PHASE3",
        title: "DRAFT PROTOCOL 101",
        forms: [{ id: "f1", name: "Demographics" }],
      },
    };
    storageMap.set("crf_studio_draft_v1", JSON.stringify(draftPayload));

    act(() => {
      root.render(
        <StudioErrorBoundary
          studioName="CRF Studio"
          draftStorageKey="crf_studio_draft_v1"
        >
          <CrashingComponent shouldThrow={true} />
        </StudioErrorBoundary>
      );
    });

    const fallback = container.querySelector(
      '[data-testid="studio-error-boundary-fallback"]'
    );
    expect(fallback?.textContent).toContain("Stored draft available");

    const exportBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="studio-error-export-btn"]'
    );
    expect(exportBtn).not.toBeNull();

    act(() => {
      exportBtn?.click();
    });

    expect(mockDownloadFile).toHaveBeenCalledTimes(1);
    const [downloadedContent, filename, options] =
      mockDownloadFile.mock.calls[0];
    expect(filename).toContain("ONCOLOGY-PHASE3");
    expect(filename).toContain("recovery-draft.json");
    expect(options).toEqual({ mimeType: "application/json" });

    const parsed = JSON.parse(downloadedContent as string);
    expect(parsed.id).toBe("ONCOLOGY-PHASE3");
    expect(parsed.title).toBe("DRAFT PROTOCOL 101");
  });

  it("sanitizes patient SSNs, bearer tokens, and private credentials before draft export", () => {
    const sensitiveDraft = {
      id: "STUDY-SECURE",
      apiKey: "sk_live_998877665544",
      secret: "super-secret-passphrase",
      password: "admin_password123",
      token: "jwt.token.here",
      authorization: "Bearer secret-auth-token-12345",
      patientRecords: [
        {
          subjectId: "SUBJ-001",
          ssn: "000-12-3456",
          notes: "Patient SSN is 123-45-6789 verified with clinic.",
          description: "Authorization header was Bearer abc.xyz.123 for export",
        },
      ],
    };

    const sanitized = sanitizeDraftForExport(sensitiveDraft) as Record<
      string,
      unknown
    >;
    expect(sanitized.apiKey).toBe("[REDACTED]");
    expect(sanitized.secret).toBe("[REDACTED]");
    expect(sanitized.password).toBe("[REDACTED]");
    expect(sanitized.token).toBe("[REDACTED]");
    expect(sanitized.authorization).toBe("[REDACTED]");

    const records = sanitized.patientRecords as Array<{
      ssn: string;
      notes: string;
      description: string;
    }>;
    expect(records[0].ssn).toBe("[REDACTED]");
    expect(records[0].notes).toBe(
      "Patient SSN is ***-**-**** verified with clinic."
    );
    expect(records[0].description).toBe(
      "Authorization header was Bearer [REDACTED] for export"
    );
  });

  it("halts automatic recovery attempts after three consecutive failures", () => {
    vi.useFakeTimers();

    act(() => {
      root.render(
        <StudioErrorBoundary studioName="CRF Studio" autoRecover={true}>
          <CrashingComponent shouldThrow={true} />
        </StudioErrorBoundary>
      );
    });

    // Attempt 1 -> triggers timer
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Attempt 2 -> triggers timer
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Attempt 3 -> reaches limit 3
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Further timers do not fire auto-recovery
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const guard = container.querySelector(
      '[data-testid="studio-error-loop-guard"]'
    );
    expect(guard).not.toBeNull();
    expect(guard?.textContent).toContain(
      "Automatic recovery halted after 3 consecutive failures"
    );

    vi.useRealTimers();
  });

  it("keeps page layout, breadcrumbs, and studio navigation visible when isolated error triggers", () => {
    act(() => {
      root.render(
        <div>
          <nav data-testid="global-navbar">Global Site Navbar</nav>
          <div data-testid="page-breadcrumbs">Home / CRF Studio</div>
          <button data-testid="studio-guide-btn">Studio Guide</button>
          <div className="workspace-container">
            <StudioErrorBoundary studioName="CRF Studio">
              <CrashingComponent shouldThrow={true} />
            </StudioErrorBoundary>
          </div>
          <footer data-testid="page-footer">Footer Navigation</footer>
        </div>
      );
    });

    // Studio workspace is isolated in fallback
    expect(
      container.querySelector('[data-testid="studio-error-boundary-fallback"]')
    ).not.toBeNull();

    // Global navigation, breadcrumbs, and guide buttons remain intact!
    expect(
      container.querySelector('[data-testid="global-navbar"]')?.textContent
    ).toBe("Global Site Navbar");
    expect(
      container.querySelector('[data-testid="page-breadcrumbs"]')?.textContent
    ).toBe("Home / CRF Studio");
    expect(
      container.querySelector('[data-testid="studio-guide-btn"]')?.textContent
    ).toBe("Studio Guide");
    expect(
      container.querySelector('[data-testid="page-footer"]')?.textContent
    ).toBe("Footer Navigation");
  });

  it("isolates WebGL / Three.js canvas crashes in Neuro 3D Viewer", () => {
    function CrashingWebGLCanvas(): React.ReactNode {
      throw new Error(
        "WebGL context lost: uniformMatrix4fv on invalid program"
      );
    }

    act(() => {
      root.render(
        <div data-testid="neuro-page">
          <div data-testid="neuro-header">NeuroRecon Studio Header</div>
          <div data-testid="slice-viewer">
            2D Multi-Planar Orthoview Slices (Active)
          </div>
          <StudioErrorBoundary
            studioName="NeuroRecon 3D Viewer"
            draftStorageKey="neuro_studio_draft_v1"
          >
            <CrashingWebGLCanvas />
          </StudioErrorBoundary>
        </div>
      );
    });

    // 3D Canvas error is caught
    const fallback = container.querySelector(
      '[data-testid="studio-error-boundary-fallback"]'
    );
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toContain(
      "NeuroRecon 3D Viewer encountered an unexpected error"
    );

    // Slices and studio header stay functional
    expect(
      container.querySelector('[data-testid="neuro-header"]')?.textContent
    ).toBe("NeuroRecon Studio Header");
    expect(
      container.querySelector('[data-testid="slice-viewer"]')?.textContent
    ).toContain("2D Multi-Planar Orthoview Slices (Active)");
  });
});
