/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DiagnosticsDrawer } from "@/components/crf/DiagnosticsDrawer";
import { InspectorPanel } from "@/components/crf/RightInspector/InspectorPanel";
import { BrandingConfigModal } from "@/components/crf/Branding/BrandingConfigModal";
import { ExportDocumentModal } from "@/components/crf/Modes/ExportDocumentModal";
import { SandboxTerminal } from "@/components/SandboxTerminal";
import { FreeSurferTerminal } from "@/components/neuro/FreeSurferTerminal";
import { WorkingWithDuck } from "@/components/WorkingWithDuck";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import { DEFAULT_STUDY_BRANDING, getOncologyPresetSync } from "@/lib/crf";

// Mock canvas
const mockCtx = {
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  arcTo: vi.fn(),
  arc: vi.fn(),
  ellipse: vi.fn(),
  roundRect: vi.fn(),
  rect: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 40 })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  setLineDash: vi.fn(),
};

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as any);
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  left: 0,
  top: 0,
  width: 360,
  height: 225,
  right: 360,
  bottom: 225,
  x: 0,
  y: 0,
  toJSON: () => {},
}));

// Mock ResizeObserver and IntersectionObserver
global.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

global.IntersectionObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

// Mock audio & announcer
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
    playKeystroke: vi.fn(),
    playAutocomplete: vi.fn(),
    volume: 0.8,
    muted: false,
    profile: "8-bit",
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setProfile: vi.fn(),
  }),
  AudioProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/providers/A11yProvider", () => ({
  useAnnouncer: () => ({
    announce: vi.fn(),
  }),
  A11yProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock("@/lib/crf/export-docx", () => ({
  generateStudyDocx: vi.fn().mockResolvedValue(new Blob(["mock-docx"])),
}));

vi.mock("@/lib/crf/export-pdf", () => ({
  generateStudyPdf: vi.fn().mockResolvedValue(new Blob(["mock-pdf"])),
}));

describe("Accessible button aria-label attributes (WCAG 4.1.2 / ADR 0005)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const mockCreateUrl = vi.fn(() => "blob:mock-url");
    const mockRevokeUrl = vi.fn();
    window.URL.createObjectURL = mockCreateUrl;
    window.URL.revokeObjectURL = mockRevokeUrl;
    globalThis.URL.createObjectURL = mockCreateUrl;
    globalThis.URL.revokeObjectURL = mockRevokeUrl;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  describe("Clinical Dialog Controls", () => {
    it("DiagnosticsDrawer close button has aria-label='Close diagnostics drawer'", async () => {
      await act(async () => {
        root.render(
          <DiagnosticsDrawer
            isOpen={true}
            study={ONCOLOGY_RECIST_PRESET}
            onClose={vi.fn()}
            onSelectForm={vi.fn()}
          />
        );
      });

      const button = container.querySelector(
        'button[aria-label="Close diagnostics drawer"]'
      );
      expect(button).not.toBeNull();
      expect(button?.getAttribute("aria-label")).toBe(
        "Close diagnostics drawer"
      );
    });

    it("InspectorPanel deselect button has aria-label='Deselect'", async () => {
      const study = getOncologyPresetSync();
      const form = study.forms[0];
      const field = form.sections[0]?.fields[0];

      await act(async () => {
        root.render(
          <InspectorPanel
            form={form}
            selectedField={field}
            codelists={study.codelists ?? []}
            onClose={vi.fn()}
            onUpdateField={vi.fn()}
            onUpdateFormMeta={vi.fn()}
            onUpdateRules={vi.fn()}
            reviewAuthor={{ name: "Auditor", role: "Clinical Reviewer" }}
            onReviewAuthorChange={vi.fn()}
            onAddReviewComment={vi.fn()}
            onSetReviewThreadStatus={vi.fn()}
            onCommitReviewTargetChange={vi.fn()}
          />
        );
      });

      const button = container.querySelector('button[aria-label="Deselect"]');
      expect(button).not.toBeNull();
      expect(button?.getAttribute("aria-label")).toBe("Deselect");
    });

    it("BrandingConfigModal close button has aria-label='Close branding modal'", async () => {
      await act(async () => {
        root.render(
          <BrandingConfigModal
            initialBranding={DEFAULT_STUDY_BRANDING}
            onSave={vi.fn()}
            onClose={vi.fn()}
          />
        );
      });

      const button = container.querySelector(
        'button[aria-label="Close branding modal"]'
      );
      expect(button).not.toBeNull();
      expect(button?.getAttribute("aria-label")).toBe("Close branding modal");
    });

    it("ExportDocumentModal close button has aria-label='Close export modal'", async () => {
      await act(async () => {
        root.render(
          <ExportDocumentModal
            study={ONCOLOGY_RECIST_PRESET}
            activeFormId="form_dm_onc"
            onClose={vi.fn()}
            onOpenBranding={vi.fn()}
          />
        );
      });

      const button = container.querySelector(
        'button[aria-label="Close export modal"]'
      );
      expect(button).not.toBeNull();
      expect(button?.getAttribute("aria-label")).toBe("Close export modal");
    });
  });

  describe("Terminal Toolbar Controls", () => {
    it("SandboxTerminal renders Step back, Step forward, and Reset sequence buttons with aria-labels", async () => {
      await act(async () => {
        root.render(<SandboxTerminal slug="recist" />);
      });

      const stepBackBtn = container.querySelector(
        'button[aria-label="Step back"]'
      );
      const stepForwardBtn = container.querySelector(
        'button[aria-label="Step forward"]'
      );
      const resetBtn = container.querySelector(
        'button[aria-label="Reset sequence"]'
      );

      expect(stepBackBtn).not.toBeNull();
      expect(stepBackBtn?.getAttribute("aria-label")).toBe("Step back");

      expect(stepForwardBtn).not.toBeNull();
      expect(stepForwardBtn?.getAttribute("aria-label")).toBe("Step forward");

      expect(resetBtn).not.toBeNull();
      expect(resetBtn?.getAttribute("aria-label")).toBe("Reset sequence");
    });

    it("FreeSurferTerminal buffer clear button has aria-label='Clear terminal buffer'", async () => {
      await act(async () => {
        root.render(
          <FreeSurferTerminal
            logs={[]}
            onExecuteCommand={vi.fn()}
            onClearLogs={vi.fn()}
          />
        );
      });

      const clearBtn = container.querySelector(
        'button[aria-label="Clear terminal buffer"]'
      );
      expect(clearBtn).not.toBeNull();
      expect(clearBtn?.getAttribute("aria-label")).toBe(
        "Clear terminal buffer"
      );
    });
  });

  describe("Game Strip Controls", () => {
    it("WorkingWithDuck renders mobile and desktop wardrobe and scrapbook buttons with aria-labels", async () => {
      await act(async () => {
        root.render(<WorkingWithDuck />);
      });

      const mobileWardrobeBtn = container.querySelector(
        'button[aria-label="Wardrobe"]'
      );
      const mobileScrapbookBtn = container.querySelector(
        'button[aria-label="Scrapbook"]'
      );
      const desktopWardrobeBtn = container.querySelector(
        'button[aria-label="Duck Wardrobe & Accessories"]'
      );
      const desktopScrapbookBtn = container.querySelector(
        'button[aria-label="Duck Scrapbook & Facts"]'
      );

      expect(mobileWardrobeBtn).not.toBeNull();
      expect(mobileWardrobeBtn?.getAttribute("aria-label")).toBe("Wardrobe");

      expect(mobileScrapbookBtn).not.toBeNull();
      expect(mobileScrapbookBtn?.getAttribute("aria-label")).toBe("Scrapbook");

      expect(desktopWardrobeBtn).not.toBeNull();
      expect(desktopWardrobeBtn?.getAttribute("aria-label")).toBe(
        "Duck Wardrobe & Accessories"
      );

      expect(desktopScrapbookBtn).not.toBeNull();
      expect(desktopScrapbookBtn?.getAttribute("aria-label")).toBe(
        "Duck Scrapbook & Facts"
      );
    });
  });
});
