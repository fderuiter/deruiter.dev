// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { DiagnosticsDrawer } from "@/components/crf/DiagnosticsDrawer";
import { BrandingConfigModal } from "@/components/crf/Branding/BrandingConfigModal";
import { ExportDocumentModal } from "@/components/crf/Modes/ExportDocumentModal";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import { DEFAULT_STUDY_BRANDING } from "@/lib/crf";

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(true),
  }),
}));

describe("CRF close button accessible names (WCAG 4.1.2 / ADR 0005)", () => {
  afterEach(() => {
    cleanup();
  });

  it("DiagnosticsDrawer renders close button with accessible name", () => {
    render(
      <DiagnosticsDrawer
        isOpen={true}
        study={ONCOLOGY_RECIST_PRESET}
        onClose={vi.fn()}
        onSelectForm={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: "Close diagnostics drawer" })
    ).toBeTruthy();
  });

  it("BrandingConfigModal renders close button with accessible name", () => {
    render(
      <BrandingConfigModal
        initialBranding={DEFAULT_STUDY_BRANDING}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: "Close branding modal" })
    ).toBeTruthy();
  });

  it("ExportDocumentModal renders close button with accessible name", () => {
    render(
      <ExportDocumentModal
        study={ONCOLOGY_RECIST_PRESET}
        activeFormId="form_dm_onc"
        onClose={vi.fn()}
        onOpenBranding={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: "Close export modal" })
    ).toBeTruthy();
  });
});
