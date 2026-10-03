/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * Container wiring for form variants (#675), with the same lazy-panel stubs
 * as crf-studio.test.tsx. The original note on those stubs follows.
 *
 * This file tests CRFStudioContainer's own tab-routing and preset-switching
 * orchestration, not each lazily-loaded panel's internals — those already
 * have dedicated real-component coverage elsewhere (rule-graph-studio.test.tsx,
 * live-edc-simulation.test.tsx, branding-modal.test.tsx, workflow-wizard.test.tsx,
 * diagnostics-drawer.test.tsx, export-statistical-modal.test.tsx). Mounting
 * all nine real panels here paid their full AST/DAG/canvas setup cost on
 * every test and intermittently exceeded the timeout under full-suite CPU
 * contention (#651) despite finishing in well under a second in isolation.
 * These stubs render only the heading text this file asserts on, so the
 * container's own routing logic stays fully exercised without the redundant
 * real-panel cost.
 */
const VisitMatrixEditor = () => (
  <div>Protocol Visit Schedule Matrix (Schedule of Assessments)</div>
);
const RuleGraphStudio = () => (
  <div>Logic Dependency DAG &amp; AST Rule Studio</div>
);
const LiveEdcSimulator = () => (
  <div>Live 21 CFR Part 11 EDC Simulation Mode</div>
);
const AcrfOverlayViewer = () => (
  <div>Visual Annotated CRF (aCRF) Submission Studio</div>
);
const ExportImportModal = () => (
  <div>CDISC Standards &amp; Interoperability Exporter</div>
);
// Unasserted-on in this file; the real components early-return null when
// closed (the state these tests always leave them in), so a null stub is
// behaviorally equivalent here and skips their import/transform cost too.
const WorkflowWizardModal = () => null;
const BrandingConfigModal = () => null;
const DiagnosticsDrawer = () => null;
const SpotlightTourOverlay = () => null;

(globalThis as any).mockComponents = {
  VisitMatrixEditor,
  RuleGraphStudio,
  LiveEdcSimulator,
  WorkflowWizardModal,
  AcrfOverlayViewer,
  ExportImportModal,
  BrandingConfigModal,
  DiagnosticsDrawer,
  SpotlightTourOverlay,
};

// Synchronous dynamic import mock for tests using global registry
vi.mock("next/dynamic", () => {
  return {
    default: (loader: any, options: any) => {
      const loaderStr = loader.toString();

      return function DynamicComponent(props: any) {
        const registry = (globalThis as any).mockComponents || {};
        let Component: any = null;

        if (loaderStr.includes("VisitMatrixEditor")) {
          Component = registry.VisitMatrixEditor;
        } else if (loaderStr.includes("RuleGraphStudio")) {
          Component = registry.RuleGraphStudio;
        } else if (loaderStr.includes("LiveEdcSimulator")) {
          Component = registry.LiveEdcSimulator;
        } else if (loaderStr.includes("WorkflowWizardModal")) {
          Component = registry.WorkflowWizardModal;
        } else if (loaderStr.includes("AcrfOverlayViewer")) {
          Component = registry.AcrfOverlayViewer;
        } else if (loaderStr.includes("ExportImportModal")) {
          Component = registry.ExportImportModal;
        } else if (loaderStr.includes("BrandingConfigModal")) {
          Component = registry.BrandingConfigModal;
        } else if (loaderStr.includes("DiagnosticsDrawer")) {
          Component = registry.DiagnosticsDrawer;
        } else if (loaderStr.includes("SpotlightTourOverlay")) {
          Component = registry.SpotlightTourOverlay;
        }

        if (Component) {
          return React.createElement(Component, props);
        }
        if (options && options.loading) {
          return options.loading();
        }
        return null;
      };
    },
  };
});

import { CRFStudioContainer } from "@/components/crf/CRFStudioContainer";

describe("CRFStudioContainer form variant wiring (#675)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", data: {} }),
    } as any);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it(
    "commits a variant as one history entry that Undo reverts",
    { timeout: 45000 },
    async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<CRFStudioContainer />);
      });

      const formsTab = container.querySelector<HTMLButtonElement>(
        'button[title*="Protocol Forms"]'
      )!;
      await act(async () => formsTab.click());

      const trigger = container.querySelector<HTMLButtonElement>(
        'button[aria-label^="Inspect visit uses of form Vital Signs"]'
      )!;
      expect(trigger).not.toBeNull();
      await act(async () => trigger.click());

      const dialog = document.querySelector<HTMLElement>(
        '[data-testid="form-variant-dialog"]'
      )!;
      expect(dialog.textContent).toContain(
        "Ordinary edits to this form change every use"
      );
      const firstArmUse = Array.from(dialog.querySelectorAll("label")).find(
        (l) => l.textContent?.includes("Arm B")
      )!;
      await act(async () => firstArmUse.querySelector("input")!.click());

      const create = Array.from(dialog.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Create variant"
      )!;
      expect(create.disabled).toBe(false);
      await act(async () => create.click());

      const variantRows = () =>
        container.querySelectorAll('[aria-label$="(Variant)"][role="button"]');
      expect(variantRows().length).toBeGreaterThan(0);

      const undo = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Undo"]'
      )!;
      expect(undo.disabled).toBe(false);
      await act(async () => undo.click());
      expect(variantRows()).toHaveLength(0);
    }
  );
});
