// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { VisitMatrixEditor } from "@/components/crf/Modes/VisitMatrixEditor";
import type { StudyProtocol } from "@/lib/crf/types";

describe("VisitMatrixEditor Bulk Actions and Tri-State Logic", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
    root = null;
  });

  const mockStudy: StudyProtocol = {
    id: "study_bulk_test",
    protocolNumber: "BULK-2026-001",
    studyName: "Bulk Action Test Study",
    phase: "Phase II",
    sponsor: "Pharma Dev",
    therapeuticArea: "Oncology",
    version: "1.0",
    lastModified: "2026-10-01T12:00:00.000Z",
    codelists: [],
    forms: [
      {
        id: "form_demog",
        name: "Demographics",
        domain: "DM",
        description: "Demographics form",
        version: "1.0",
        sections: [],
        rules: [],
      },
      {
        id: "form_vitals",
        name: "Vital Signs",
        domain: "VS",
        description: "Vital signs form",
        version: "1.0",
        sections: [],
        rules: [],
      },
      {
        id: "form_lab",
        name: "Laboratory Results",
        domain: "LB",
        description: "Lab form",
        version: "1.0",
        sections: [],
        rules: [],
      },
    ],
    visits: [
      {
        id: "v1",
        oid: "SE.V1",
        name: "Visit 1",
        visitType: "Scheduled",
        targetDay: 0,
        windowBefore: 0,
        windowAfter: 0,
        assignedFormIds: ["form_demog"], // Partial (1 of 3 forms)
      },
      {
        id: "v2",
        oid: "SE.V2",
        name: "Visit 2",
        visitType: "Scheduled",
        targetDay: 14,
        windowBefore: 2,
        windowAfter: 2,
        assignedFormIds: [], // Empty (0 of 3 forms)
      },
    ],
    arms: [
      {
        id: "arm_a",
        name: "Arm A - Experimental",
        type: "Experimental",
      },
      {
        id: "arm_b",
        name: "Arm B - Placebo",
        type: "Placebo",
      },
    ],
  };

  it("renders bulk toggle buttons for visits, forms, and global matrix", async () => {
    const onUpdateVisits = vi.fn();

    await act(async () => {
      root?.render(
        <VisitMatrixEditor study={mockStudy} onUpdateVisits={onUpdateVisits} />
      );
    });

    const globalBtn = container?.querySelector(
      '[data-testid="bulk-global-toggle"]'
    );
    const colBtnV1 = container?.querySelector(
      '[data-testid="bulk-column-toggle-v1"]'
    );
    const colBtnV2 = container?.querySelector(
      '[data-testid="bulk-column-toggle-v2"]'
    );
    const rowBtnDemog = container?.querySelector(
      '[data-testid="bulk-row-toggle-form_demog"]'
    );
    const rowBtnVitals = container?.querySelector(
      '[data-testid="bulk-row-toggle-form_vitals"]'
    );

    expect(globalBtn).not.toBeNull();
    expect(colBtnV1).not.toBeNull();
    expect(colBtnV2).not.toBeNull();
    expect(rowBtnDemog).not.toBeNull();
    expect(rowBtnVitals).not.toBeNull();
  });

  it("toggles column bulk action: fills column when partial/empty, clears column when full", async () => {
    const onUpdateVisits = vi.fn();

    await act(async () => {
      root?.render(
        <VisitMatrixEditor study={mockStudy} onUpdateVisits={onUpdateVisits} />
      );
    });

    // Visit 1 has form_demog assigned (1/3 -> partial).
    // Clicking bulk toggle for Visit 1 should assign all forms to Visit 1.
    const colBtnV1 = container?.querySelector(
      '[data-testid="bulk-column-toggle-v1"]'
    ) as HTMLButtonElement;

    await act(async () => {
      colBtnV1.click();
    });

    expect(onUpdateVisits).toHaveBeenCalledTimes(1);
    const updatedVisits1 = onUpdateVisits.mock.calls[0][0];
    const updatedV1 = updatedVisits1.find((v: { id: string }) => v.id === "v1");
    expect(updatedV1.assignedFormIds).toEqual([
      "form_demog",
      "form_vitals",
      "form_lab",
    ]);

    // Test secondary click when full:
    const studyFullV1: StudyProtocol = {
      ...mockStudy,
      visits: [
        {
          ...mockStudy.visits[0],
          assignedFormIds: ["form_demog", "form_vitals", "form_lab"],
        },
        mockStudy.visits[1],
      ],
    };

    onUpdateVisits.mockClear();

    await act(async () => {
      root?.render(
        <VisitMatrixEditor
          study={studyFullV1}
          onUpdateVisits={onUpdateVisits}
        />
      );
    });

    const colBtnV1Full = container?.querySelector(
      '[data-testid="bulk-column-toggle-v1"]'
    ) as HTMLButtonElement;

    await act(async () => {
      colBtnV1Full.click();
    });

    expect(onUpdateVisits).toHaveBeenCalledTimes(1);
    const updatedVisits2 = onUpdateVisits.mock.calls[0][0];
    const updatedV1Cleared = updatedVisits2.find(
      (v: { id: string }) => v.id === "v1"
    );
    expect(updatedV1Cleared.assignedFormIds).toEqual([]);
  });

  it("toggles row bulk action: fills form across all visits when partial, clears form when full", async () => {
    const onUpdateVisits = vi.fn();

    await act(async () => {
      root?.render(
        <VisitMatrixEditor study={mockStudy} onUpdateVisits={onUpdateVisits} />
      );
    });

    // form_demog is assigned to V1 but not V2 (partial).
    // Clicking bulk row toggle for form_demog should assign it to all visits (V1 and V2).
    const rowBtnDemog = container?.querySelector(
      '[data-testid="bulk-row-toggle-form_demog"]'
    ) as HTMLButtonElement;

    await act(async () => {
      rowBtnDemog.click();
    });

    expect(onUpdateVisits).toHaveBeenCalledTimes(1);
    const updatedVisits = onUpdateVisits.mock.calls[0][0];
    expect(updatedVisits[0].assignedFormIds).toContain("form_demog");
    expect(updatedVisits[1].assignedFormIds).toContain("form_demog");

    // Test secondary click when form_demog is in all visits:
    const studyFullRow: StudyProtocol = {
      ...mockStudy,
      visits: [
        { ...mockStudy.visits[0], assignedFormIds: ["form_demog"] },
        { ...mockStudy.visits[1], assignedFormIds: ["form_demog"] },
      ],
    };

    onUpdateVisits.mockClear();

    await act(async () => {
      root?.render(
        <VisitMatrixEditor
          study={studyFullRow}
          onUpdateVisits={onUpdateVisits}
        />
      );
    });

    const rowBtnDemogFull = container?.querySelector(
      '[data-testid="bulk-row-toggle-form_demog"]'
    ) as HTMLButtonElement;

    await act(async () => {
      rowBtnDemogFull.click();
    });

    expect(onUpdateVisits).toHaveBeenCalledTimes(1);
    const updatedClearedVisits = onUpdateVisits.mock.calls[0][0];
    expect(updatedClearedVisits[0].assignedFormIds).not.toContain("form_demog");
    expect(updatedClearedVisits[1].assignedFormIds).not.toContain("form_demog");
  });

  it("toggles global matrix bulk action: fills all cells when partial, clears all cells when full", async () => {
    const onUpdateVisits = vi.fn();

    await act(async () => {
      root?.render(
        <VisitMatrixEditor study={mockStudy} onUpdateVisits={onUpdateVisits} />
      );
    });

    // Matrix is partial. Click global toggle -> should assign all forms to all visits.
    const globalBtn = container?.querySelector(
      '[data-testid="bulk-global-toggle"]'
    ) as HTMLButtonElement;

    await act(async () => {
      globalBtn.click();
    });

    expect(onUpdateVisits).toHaveBeenCalledTimes(1);
    const updatedVisits = onUpdateVisits.mock.calls[0][0];
    expect(updatedVisits[0].assignedFormIds).toEqual([
      "form_demog",
      "form_vitals",
      "form_lab",
    ]);
    expect(updatedVisits[1].assignedFormIds).toEqual([
      "form_demog",
      "form_vitals",
      "form_lab",
    ]);

    // Test secondary click when entire matrix is full:
    const studyFullMatrix: StudyProtocol = {
      ...mockStudy,
      visits: [
        {
          ...mockStudy.visits[0],
          assignedFormIds: ["form_demog", "form_vitals", "form_lab"],
        },
        {
          ...mockStudy.visits[1],
          assignedFormIds: ["form_demog", "form_vitals", "form_lab"],
        },
      ],
    };

    onUpdateVisits.mockClear();

    await act(async () => {
      root?.render(
        <VisitMatrixEditor
          study={studyFullMatrix}
          onUpdateVisits={onUpdateVisits}
        />
      );
    });

    const globalBtnFull = container?.querySelector(
      '[data-testid="bulk-global-toggle"]'
    ) as HTMLButtonElement;

    await act(async () => {
      globalBtnFull.click();
    });

    expect(onUpdateVisits).toHaveBeenCalledTimes(1);
    const updatedClearedVisits = onUpdateVisits.mock.calls[0][0];
    expect(updatedClearedVisits[0].assignedFormIds).toEqual([]);
    expect(updatedClearedVisits[1].assignedFormIds).toEqual([]);
  });

  it("respects active study arm scoping when toggling bulk actions", async () => {
    const onUpdateVisits = vi.fn();

    await act(async () => {
      root?.render(
        <VisitMatrixEditor study={mockStudy} onUpdateVisits={onUpdateVisits} />
      );
    });

    // Switch to Arm A scope by clicking the Arm A button
    const armButtons = Array.from(container?.querySelectorAll("button") || []);
    const armABtn = armButtons.find((b) => b.textContent?.includes("Arm A"));
    expect(armABtn).toBeDefined();

    await act(async () => {
      armABtn?.click();
    });

    // Toggle column bulk action for Visit 1 in Arm A scope
    const colBtnV1 = container?.querySelector(
      '[data-testid="bulk-column-toggle-v1"]'
    ) as HTMLButtonElement;

    await act(async () => {
      colBtnV1.click();
    });

    expect(onUpdateVisits).toHaveBeenCalledTimes(1);
    const updatedVisits = onUpdateVisits.mock.calls[0][0];

    // Visit 1 armFormAssignments for arm_a should contain all 3 forms
    expect(updatedVisits[0].armFormAssignments?.arm_a).toEqual([
      "form_demog",
      "form_vitals",
      "form_lab",
    ]);

    // Default assignedFormIds should remain unchanged
    expect(updatedVisits[0].assignedFormIds).toEqual(["form_demog"]);
    expect(updatedVisits[0].armIds).toContain("arm_a");
  });
});
