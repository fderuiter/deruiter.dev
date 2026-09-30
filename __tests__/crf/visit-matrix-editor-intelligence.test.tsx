// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { VisitMatrixEditor } from "@/components/crf/Modes/VisitMatrixEditor";
import type { StudyProtocol } from "@/lib/crf/types";

describe("VisitMatrixEditor Schedule Intelligence & Conflict Integration", () => {
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
    id: "study_test_101",
    protocolNumber: "ONC-2026-001",
    studyName: "Test Oncology Protocol",
    phase: "Phase II",
    sponsor: "Global Pharma Inc.",
    therapeuticArea: "Oncology",
    version: "1.0",
    lastModified: "2026-09-30T10:00:00.000Z",
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
    ],
    visits: [
      {
        id: "v1",
        oid: "SE.VISIT1",
        name: "Visit 1",
        visitType: "Scheduled",
        targetDay: 0,
        windowBefore: 0,
        windowAfter: 5, // Day 0 to 5
        assignedFormIds: ["form_demog"],
      },
      {
        id: "v2",
        oid: "SE.VISIT2",
        name: "Visit 2",
        visitType: "Scheduled",
        targetDay: 7,
        windowBefore: 3, // Day 4 to 10 -> Overlaps with Visit 1
        windowAfter: 3,
        assignedFormIds: ["form_demog"],
      },
    ],
  };

  it("renders matrix table and highlights conflicting visit headers with warning badges", async () => {
    const onUpdateVisits = vi.fn();

    await act(async () => {
      root?.render(
        <VisitMatrixEditor study={mockStudy} onUpdateVisits={onUpdateVisits} />
      );
    });

    expect(container?.textContent).toContain("Protocol Visit Schedule Matrix");
    expect(container?.textContent).toContain("Visit 1");
    expect(container?.textContent).toContain("Visit 2");

    // Check that warning badge is rendered for overlapping visit
    const badgeV1 = container?.querySelector(
      '[data-testid="visit-conflict-badge-v1"]'
    );
    const badgeV2 = container?.querySelector(
      '[data-testid="visit-conflict-badge-v2"]'
    );

    expect(badgeV1).not.toBeNull();
    expect(badgeV2).not.toBeNull();
    expect(badgeV1?.textContent).toContain("Overlap Warning");
  });

  it("opens Schedule Intelligence drawer and displays KPI metrics, baseline drift, and milestone forecasts", async () => {
    const onUpdateVisits = vi.fn();

    await act(async () => {
      root?.render(
        <VisitMatrixEditor study={mockStudy} onUpdateVisits={onUpdateVisits} />
      );
    });

    // Find and click the Schedule Intelligence button
    const buttons = Array.from(container?.querySelectorAll("button") || []);
    const intelligenceBtn = buttons.find((b) =>
      b.textContent?.includes("Schedule Intelligence")
    );
    expect(intelligenceBtn).toBeDefined();

    await act(async () => {
      intelligenceBtn?.click();
    });

    // Verify Schedule Intelligence panel content
    expect(container?.textContent).toContain(
      "Schedule Intelligence & Milestone Forecasting Engine"
    );
    expect(container?.textContent).toContain("Target Schedule Span");
    expect(container?.textContent).toContain("Max Expansion Bounds");
    expect(container?.textContent).toContain("Max Contraction Bounds");
    expect(container?.textContent).toContain(
      "Calculated Protocol Milestone Projections"
    );
    expect(container?.textContent).toContain("First Subject In (FSI)");
    expect(container?.textContent).toContain("Last Subject Last Visit (LSLV)");
  });
});
