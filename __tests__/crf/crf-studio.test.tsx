/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
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
import {
  A11yProvider,
  LiveAnnouncer,
} from "@/components/providers/A11yProvider";
import { ToastProvider } from "@/hooks/useToast";

describe("CRFStudioContainer Component", () => {
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
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  it("renders the CRF Studio header and initial form successfully", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<CRFStudioContainer />);
    });

    expect(container.textContent).toContain("CRF Studio");
    expect(container.textContent).toContain("Form Designer");
    expect(container.textContent).toContain("Visit Matrix (SoA)");
    expect(container.textContent).toContain("Logic & AST Rules");
    expect(container.textContent).toContain("Live 21 CFR EDC");
  });

  it(
    "switches studio modes when clicking header tabs",
    { timeout: 45000 },
    async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<CRFStudioContainer />);
      });

      // Find and click Visit Matrix tab
      const buttons = Array.from(container.querySelectorAll("button"));
      const matrixBtn = buttons.find((b) =>
        b.textContent?.includes("Visit Matrix")
      );
      expect(matrixBtn).toBeDefined();

      await act(async () => {
        matrixBtn?.click();
      });
      expect(container.textContent).toContain("Protocol Visit Schedule Matrix");

      // Click Logic & Rules
      const rulesBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Logic & AST Rules")
      );
      await act(async () => {
        rulesBtn?.click();
      });
      expect(container.textContent).toContain(
        "Logic Dependency DAG & AST Rule Studio"
      );

      // Click Live EDC Test
      const edcBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Live 21 CFR EDC")
      );
      await act(async () => {
        edcBtn?.click();
      });
      expect(container.textContent).toContain(
        "Live 21 CFR Part 11 EDC Simulation Mode"
      );

      // Click Submission aCRF
      const acrfBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Annotated aCRF")
      );
      await act(async () => {
        acrfBtn?.click();
      });
      expect(container.textContent).toContain(
        "Visual Annotated CRF (aCRF) Submission Studio"
      );

      // Click Export / CDISC
      const exportBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("CDISC / Exports")
      );
      await act(async () => {
        exportBtn?.click();
      });
      expect(container.textContent).toContain(
        "CDISC Standards & Interoperability Exporter"
      );
    }
  );

  it("switches between study presets cleanly", { timeout: 45000 }, async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<CRFStudioContainer />);
    });

    const selectEl = container.querySelector("select");
    expect(selectEl).toBeDefined();

    await act(async () => {
      if (selectEl) {
        selectEl.value = "cns_neuro";
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    expect(container.textContent).toContain("Phase II");
  });

  it("does not hijack Ctrl/Cmd+Z from a focused form control (#658)", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<CRFStudioContainer />);
    });

    const selectEl = container.querySelector("select") as HTMLSelectElement;
    expect(selectEl).toBeTruthy();
    selectEl.focus();
    expect(document.activeElement).toBe(selectEl);

    let event!: KeyboardEvent;
    await act(async () => {
      event = new KeyboardEvent("keydown", {
        key: "z",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      selectEl.dispatchEvent(event);
    });

    // The studio's document-level undo shortcut must leave native browser/editor
    // shortcuts alone while a form control (select, input, textarea, or a
    // contentEditable field) has focus, instead of calling preventDefault()
    // and jumping the whole study back regardless of what's focused.
    expect(event.defaultPrevented).toBe(false);
  });

  it(
    "recovers the acknowledged draft with identical content after a simulated refresh (#657)",
    { timeout: 20000 },
    async () => {
      vi.useFakeTimers();
      try {
        await act(async () => {
          root = createRoot(container);
          root.render(<CRFStudioContainer />);
        });

        const selectEl = container.querySelector("select") as HTMLSelectElement;
        expect(selectEl).toBeTruthy();

        await act(async () => {
          selectEl.value = "cns_neuro";
          selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        });
        expect(container.textContent).toContain("Phase II");

        // Let the debounced autosave commit the acknowledged draft.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });

        expect(window.localStorage.getItem("crf_studio_draft_v1")).toBeTruthy();

        // Simulate a refresh: unmount and mount a brand-new instance.
        await act(async () => {
          root.unmount();
        });
        await act(async () => {
          root = createRoot(container);
          root.render(<CRFStudioContainer />);
        });

        expect(container.textContent).toContain("Phase II");
      } finally {
        vi.useRealTimers();
      }
    }
  );

  it(
    "traps focus in the mobile widget palette sheet and returns it to the FAB on close (#660)",
    { timeout: 20000 },
    async () => {
      vi.useFakeTimers();
      try {
        await act(async () => {
          root = createRoot(container);
          root.render(<CRFStudioContainer />);
        });

        // A prior test in this file may leave the studio on a non-designer
        // mode via the URL hash (window.location.hash persists across tests
        // in the same jsdom document); force back to Designer mode, where
        // the mobile widget palette FAB lives, for a deterministic start.
        const designerBtn = Array.from(
          container.querySelectorAll("button")
        ).find((b) => b.textContent?.includes("Form Designer"));
        if (designerBtn) {
          await act(async () => {
            designerBtn.click();
          });
        }

        const fabBtn = container.querySelector(
          'button[aria-label="Add Field Widget"]'
        ) as HTMLButtonElement;
        expect(fabBtn).toBeTruthy();

        fabBtn.focus();
        expect(document.activeElement).toBe(fabBtn);

        await act(async () => {
          fabBtn.click();
        });

        // Flush useFocusTrap's initial-focus setTimeout.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(60);
        });

        const dialog = container.querySelector(
          '[role="dialog"][aria-labelledby="mobile-widget-sheet-title"]'
        ) as HTMLElement;
        expect(dialog).toBeTruthy();
        expect(document.activeElement).not.toBe(fabBtn);
        expect(dialog.contains(document.activeElement)).toBe(true);

        const closeBtn = dialog.querySelector(
          'button[aria-label="Close Widget Palette"]'
        ) as HTMLButtonElement;
        expect(closeBtn).toBeTruthy();

        await act(async () => {
          closeBtn.click();
        });

        // Flush useFocusTrap's returnFocus setTimeout(0).
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10);
        });

        expect(
          container.querySelector(
            '[role="dialog"][aria-labelledby="mobile-widget-sheet-title"]'
          )
        ).toBeNull();
        expect(document.activeElement).toBe(fabBtn);
      } finally {
        vi.useRealTimers();
      }
    }
  );

  it("labels the header's copy-link action as a view link, not study sharing (#662)", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    const announcer = new LiveAnnouncer({ expirationMs: 60_000 });
    const announceSpy = vi.spyOn(announcer, "announce");

    await act(async () => {
      root = createRoot(container);
      root.render(
        <A11yProvider announcer={announcer}>
          <ToastProvider>
            <CRFStudioContainer />
          </ToastProvider>
        </A11yProvider>
      );
    });

    const moreActionsBtn = container.querySelector(
      'button[aria-label="More Studio Actions"]'
    ) as HTMLButtonElement;
    expect(moreActionsBtn).toBeTruthy();

    await act(async () => {
      moreActionsBtn.click();
    });

    // Previously labeled "Share Studio Protocol" with "Copy direct link with
    // state" — implying it shares the authored study — when it only ever
    // copies the current navigation URL (mode/form/tab hash params). The
    // study document itself lives in localStorage and never leaves this
    // browser, so opening that link elsewhere shows a different study.
    expect(container.textContent).not.toContain("Share Studio Protocol");
    const copyLinkBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Copy View Link")
    );
    expect(copyLinkBtn).toBeDefined();
    expect(copyLinkBtn?.textContent).toContain(
      "does not include study content"
    );

    await act(async () => {
      copyLinkBtn?.click();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    // The confirmation now renders in the global toast stack (#1134)...
    const toast = container.querySelector('[data-testid="toast"]');
    expect(toast?.getAttribute("data-variant")).toBe("success");
    expect(toast?.textContent).toContain(
      "not the authored study; recipients need their own copy of the study data"
    );
    // ...and is spoken exactly once: useClipboard announces it, the toast does not repeat it.
    const spoken = announceSpy.mock.calls.filter(([message]) =>
      String(message).includes("not the authored study")
    );
    expect(spoken).toHaveLength(1);
  });

  it("inserts a new field into the section whose Add Field control was used, not always the form's first section (#669)", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<CRFStudioContainer />);
    });

    const designerBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Form Designer")
    );
    if (designerBtn) {
      await act(async () => {
        designerBtn.click();
      });
    }

    const sectionIdsBefore = new Set(
      Array.from(container.querySelectorAll("[data-section-id]")).map((el) =>
        el.getAttribute("data-section-id")
      )
    );

    const addSectionBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Add New Section to Form")
    );
    expect(addSectionBtn).toBeTruthy();

    await act(async () => {
      addSectionBtn!.click();
    });

    const newSectionId = Array.from(
      container.querySelectorAll("[data-section-id]")
    )
      .map((el) => el.getAttribute("data-section-id"))
      .find((id) => id && !sectionIdsBefore.has(id));
    expect(newSectionId).toBeTruthy();

    const newSectionEl = container.querySelector(
      `[data-section-id="${newSectionId}"]`
    ) as HTMLElement;
    expect(newSectionEl).toBeTruthy();

    const addFieldBtn = Array.from(
      newSectionEl.querySelectorAll("button")
    ).find((b) => b.getAttribute("aria-label")?.startsWith("Add field to")) as
      HTMLButtonElement | undefined;
    expect(addFieldBtn).toBeTruthy();

    await act(async () => {
      addFieldBtn!.click();
    });

    // The section's control opens the keyboard-accessible slash command
    // palette (#538), which resolves the field to the section id the
    // trigger passed it — not through the plain widget palette.
    const slashDialog = container.querySelector(
      '[role="dialog"][aria-labelledby="slash-palette-title"]'
    ) as HTMLElement;
    expect(slashDialog).toBeTruthy();

    const insertTextBtn = slashDialog.querySelector(
      'button[aria-label="Insert Single-Line Text"]'
    ) as HTMLButtonElement | undefined;
    expect(insertTextBtn).toBeTruthy();

    await act(async () => {
      insertTextBtn!.click();
    });

    // The inserted field's default label must land inside the section whose
    // Add Field control was actually used...
    const newSectionAfter = container.querySelector(
      `[data-section-id="${newSectionId}"]`
    ) as HTMLElement;
    expect(newSectionAfter.textContent).toContain("Text Variable");

    // ...and every other section (in particular, the form's original first
    // section) must be untouched by it.
    const otherSections = Array.from(
      container.querySelectorAll("[data-section-id]")
    ).filter((el) => el.getAttribute("data-section-id") !== newSectionId);
    for (const el of otherSections) {
      expect(el.textContent).not.toContain("Text Variable");
    }
  });
});
