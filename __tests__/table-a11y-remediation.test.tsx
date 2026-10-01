// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { InteractiveTruthTable } from "@/components/proof/InteractiveTruthTable";
import { AcrfOverlayViewer } from "@/components/crf/Modes/AcrfOverlayViewer";
import { ClinicalTrialChaos } from "@/components/ClinicalTrialChaos";
import { ExportImportModal } from "@/components/crf/Modes/ExportImportModal";
import { LiveEdcSimulator } from "@/components/crf/Modes/LiveEdcSimulator";
import { ActiveFormGrid } from "@/components/crf/Modes/ActiveFormGrid";
import { getFallacyDiagnosis } from "@/lib/proof-utils";
import { getOncologyPresetSync } from "@/lib/crf";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Mock window.matchMedia for components that use it
if (typeof window !== "undefined") {
  window.matchMedia =
    window.matchMedia ||
    function () {
      return {
        matches: false,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      };
    };
}

describe("Table Accessibility Remediation", () => {
  afterEach(() => {
    cleanup();
  });

  it("InteractiveTruthTable includes <caption> and scope='col' on table header cells", () => {
    const diagnosis = getFallacyDiagnosis("C", "A", []);
    const { container } = render(
      <InteractiveTruthTable diagnosis={diagnosis} />
    );

    const table = container.querySelector("table");
    expect(table).not.toBeNull();

    const caption = table?.querySelector("caption");
    expect(caption).not.toBeNull();
    expect(caption?.textContent).toContain(
      "Truth Table with Live Valuation Highlight"
    );

    const ths = table?.querySelectorAll("th");
    expect(ths && ths.length).toBeGreaterThan(0);
    ths?.forEach((th) => {
      expect(th.getAttribute("scope")).toBe("col");
    });
  });

  it("AcrfOverlayViewer includes <caption> and scope='col' on table header cells in both book and matrix views", () => {
    const study = getOncologyPresetSync();
    const { container } = render(
      <AcrfOverlayViewer study={study} activeFormId={study.forms[0].id} />
    );

    // Switch to book view
    const bookBtn = screen.getByText(/Unified Study aCRF Book/i);
    fireEvent.click(bookBtn);

    const bookTable = container.querySelector("table");
    expect(bookTable).not.toBeNull();
    expect(bookTable?.querySelector("caption")?.textContent).toContain(
      "aCRF Book Table of Contents"
    );
    bookTable?.querySelectorAll("th").forEach((th) => {
      expect(th.getAttribute("scope")).toBe("col");
    });

    // Switch to SDTM matrix view
    const matrixBtn = screen.getByText(/SDTM Mapping Matrix/i);
    fireEvent.click(matrixBtn);

    const matrixTable = container.querySelector("table");
    expect(matrixTable).not.toBeNull();
    expect(matrixTable?.querySelector("caption")?.textContent).toContain(
      "CDISC SDTMIG v3.4 Target Variable Mapping Matrix"
    );
    matrixTable?.querySelectorAll("th").forEach((th) => {
      expect(th.getAttribute("scope")).toBe("col");
    });
  });

  it("ClinicalTrialChaos includes <caption> and scope='col' on SDTM table header cells", () => {
    const { container } = render(<ClinicalTrialChaos />);

    // Switch to SDTM Studio tab
    const sdtmTabBtn = screen.getByText(/Live SDTM Studio/i);
    fireEvent.click(sdtmTabBtn);

    const table = container.querySelector("table");
    expect(table).not.toBeNull();

    const caption = table?.querySelector("caption");
    expect(caption).not.toBeNull();
    expect(caption?.textContent).toContain("Clinical Trial SDTM Dataset");

    const ths = table?.querySelectorAll("th");
    expect(ths && ths.length).toBeGreaterThan(0);
    ths?.forEach((th) => {
      expect(th.getAttribute("scope")).toBe("col");
    });
  });

  it("ExportImportModal includes <caption> and scope='col' on SDTM spec table header cells", () => {
    const study = getOncologyPresetSync();
    const { container } = render(
      <ExportImportModal study={study} onImportStudy={() => {}} />
    );

    // Click SDTM Mapping Specs tab
    const specTabBtn = screen.getByRole("tab", { name: /SDTM Mapping Specs/i });
    fireEvent.click(specTabBtn);

    const table = container.querySelector("table");
    expect(table).not.toBeNull();

    const caption = table?.querySelector("caption");
    expect(caption).not.toBeNull();
    expect(caption?.textContent).toContain("SDTM Mapping Specifications");

    const ths = table?.querySelectorAll("th");
    expect(ths && ths.length).toBeGreaterThan(0);
    ths?.forEach((th) => {
      expect(th.getAttribute("scope")).toBe("col");
    });
  });

  it("LiveEdcSimulator includes <caption> and scope='col' on matrix and audit trail tables", () => {
    const study = getOncologyPresetSync();
    const { container } = render(<LiveEdcSimulator study={study} />);

    // Switch to Visit Matrix view
    const matrixBtn = screen.getByText(/Subject Status Matrix/i);
    fireEvent.click(matrixBtn);

    const matrixTable = container.querySelector("table");
    expect(matrixTable).not.toBeNull();
    expect(matrixTable?.querySelector("caption")?.textContent).toContain(
      "Subject Status Progression Matrix"
    );
    matrixTable?.querySelectorAll("th[scope='col']").forEach((th) => {
      expect(th.getAttribute("scope")).toBe("col");
    });

    // Switch to Audit Trail view
    const auditBtn = screen.getByText(/Part 11 Audit Trail/i);
    fireEvent.click(auditBtn);

    const auditTable = container.querySelector("table");
    expect(auditTable).not.toBeNull();
    expect(auditTable?.querySelector("caption")?.textContent).toContain(
      "21 CFR Part 11 Immutable Audit Trail Log"
    );
    auditTable?.querySelectorAll("th").forEach((th) => {
      expect(th.getAttribute("scope")).toBe("col");
    });
  });

  it("ActiveFormGrid includes <caption> and scope='col' on table header cells", () => {
    const study = getOncologyPresetSync();
    const form = study.forms[0];
    const { container } = render(
      <ActiveFormGrid
        form={form}
        study={study}
        selectedFieldId={null}
        onSelectField={() => {}}
        onUpdateField={() => {}}
        onUpdateStudy={() => {}}
      />
    );

    const table = container.querySelector("table");
    expect(table).not.toBeNull();

    const caption = table?.querySelector("caption");
    expect(caption).not.toBeNull();
    expect(caption?.textContent).toContain("Form Fields Spreadsheet Grid");

    const ths = table?.querySelectorAll("th");
    expect(ths && ths.length).toBeGreaterThan(0);
    ths?.forEach((th) => {
      expect(th.getAttribute("scope")).toBe("col");
    });
  });
});
