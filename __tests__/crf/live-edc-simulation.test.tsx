// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LiveEdcSimulator } from "@/components/crf/Modes/LiveEdcSimulator";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import { scaffoldCdashDomain } from "@/lib/crf";
import { StudyProtocol } from "@/lib/crf/types";
import {
  checkRegulatoryWording,
  findClinicalClaims,
} from "@/lib/clinical-platform";

describe("Live EDC Simulation Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
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

  it("renders the EDC Simulator header and initial Patient Form Entry view", async () => {
    await act(async () => {
      root.render(<LiveEdcSimulator study={ONCOLOGY_RECIST_PRESET} />);
    });

    expect(container.textContent).toContain("Live EDC data entry");
    expect(container.textContent).toContain("Patient Form Entry");
    expect(container.textContent).toContain("Subject Status Matrix");
    expect(container.textContent).toContain("Discrepancy Queries");
    expect(container.textContent).toContain("Part 11 Audit Trail");
  });

  it("switches between EDC sub-views (Status Matrix, Queries, Audit Trail)", async () => {
    await act(async () => {
      root.render(<LiveEdcSimulator study={ONCOLOGY_RECIST_PRESET} />);
    });

    // 1. Switch to Subject Status Matrix
    const matrixTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Subject Status Matrix")
    );
    expect(matrixTab).toBeDefined();

    await act(async () => {
      matrixTab?.click();
    });

    expect(container.textContent).toContain(
      "Longitudinal Subject vs. Visit Progression Matrix"
    );
    expect(container.textContent).toContain("001-101");

    // 2. Switch to Discrepancy Queries
    const queriesTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Discrepancy Queries")
    );
    await act(async () => {
      queriesTab?.click();
    });

    expect(container.textContent).toContain(
      "Clinical Discrepancy & Query Management Ledger"
    );

    // 3. Switch to Audit Trail
    const auditTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Part 11 Audit Trail")
    );
    await act(async () => {
      auditTab?.click();
    });

    expect(container.textContent).toContain(
      "Part 11-style audit trail (simulation)"
    );
  });

  it("allows CRA role to toggle Source Data Verification (SDV) on fields", async () => {
    await act(async () => {
      root.render(<LiveEdcSimulator study={ONCOLOGY_RECIST_PRESET} />);
    });

    // Click CRA Monitor role button
    const craRoleBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "CRA Monitor"
    );
    expect(craRoleBtn).toBeDefined();

    await act(async () => {
      craRoleBtn?.click();
    });

    // Find CRA SDV button on field
    const sdvBtn = Array.from(container.querySelectorAll("button")).find(
      (b) =>
        b.textContent?.includes("SDV Verify") ||
        b.textContent?.includes("SDV Done")
    );
    expect(sdvBtn).toBeDefined();

    await act(async () => {
      sdvBtn?.click();
    });

    // Verify SDV verified status
    expect(container.textContent).toContain("SDV Done");
  });

  it("supports Principal Investigator (PI) Form Locking and digital signatures", async () => {
    await act(async () => {
      root.render(<LiveEdcSimulator study={ONCOLOGY_RECIST_PRESET} />);
    });

    // Click Principal Investigator role button
    const piRoleBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Principal Investigator"
    );
    expect(piRoleBtn).toBeDefined();

    await act(async () => {
      piRoleBtn?.click();
    });

    // Find Lock & Sign Form button
    const lockBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Lock & Sign (PI)")
    );
    expect(lockBtn).toBeDefined();

    await act(async () => {
      lockBtn?.click();
    });

    // Verify form is now locked with digital signature badge
    expect(container.textContent).toContain("Locked (PI)");
  });

  it("does not carry a form's signed/locked status over to the same form at a different visit (#663)", async () => {
    const studyTwoVisitsSameForm: StudyProtocol = {
      ...ONCOLOGY_RECIST_PRESET,
      forms: [
        {
          id: "form_shared",
          name: "Shared Vitals Form",
          domain: "VS",
          description: "Reused across visits",
          version: "1.0",
          rules: [],
          sections: [
            {
              id: "sec_1",
              title: "Vitals",
              fields: [
                {
                  id: "f_hr",
                  variableName: "HR",
                  label: "Heart Rate",
                  dataType: "number",
                  columnSpan: 6,
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      visits: [
        {
          id: "visit_a",
          oid: "SE.A",
          name: "Visit A",
          visitType: "Scheduled",
          targetDay: 1,
          windowBefore: 0,
          windowAfter: 0,
          assignedFormIds: ["form_shared"],
        },
        {
          id: "visit_b",
          oid: "SE.B",
          name: "Visit B",
          visitType: "Scheduled",
          targetDay: 22,
          windowBefore: 0,
          windowAfter: 0,
          assignedFormIds: ["form_shared"],
        },
      ],
    };

    await act(async () => {
      root.render(<LiveEdcSimulator study={studyTwoVisitsSameForm} />);
    });

    const piRoleBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Principal Investigator"
    );
    await act(async () => {
      piRoleBtn?.click();
    });

    // Visit selector is the second <select> in the Patient Form Entry view
    // (Subject, then Protocol Visit, then CRF Form).
    const visitSelect = container.querySelectorAll(
      "select"
    )[1] as HTMLSelectElement;
    expect(visitSelect).toBeTruthy();
    expect(visitSelect.value).toBe("visit_a");

    const lockBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Lock & Sign (PI)")
    );
    expect(lockBtn).toBeDefined();

    await act(async () => {
      lockBtn?.click();
    });

    expect(container.textContent).toContain("Locked (PI)");
    expect(container.textContent).toContain("Signed");

    // Switch to Visit B — the same form there has never been locked/signed.
    await act(async () => {
      visitSelect.value = "visit_b";
      visitSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).not.toContain("Locked (PI)");
    expect(container.textContent).not.toContain("Signed");
  });

  it("opens the 21 CFR Part 11 Unlock & Signature Revocation modal on PI unlock, revokes Data Lock, hides Signed, and records justification in auditLog", async () => {
    await act(async () => {
      root.render(<LiveEdcSimulator study={ONCOLOGY_RECIST_PRESET} />);
    });

    const formSelect = container.querySelector(
      "#edc-crf-form-select"
    ) as HTMLSelectElement;
    const vsForm = ONCOLOGY_RECIST_PRESET.forms.find((f) => f.domain === "VS")!;
    await act(async () => {
      formSelect.value = vsForm.id;
      formSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const hasSignedBadge = () =>
      Array.from(container.querySelectorAll("span")).some(
        (s) => s.textContent?.trim() === "Signed"
      );

    const piRoleBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Principal Investigator"
    );
    await act(async () => {
      piRoleBtn?.click();
    });

    const lockBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Lock & Sign (PI)")
    );
    await act(async () => {
      lockBtn?.click();
    });

    expect(container.textContent).toContain("Locked (PI)");
    expect(hasSignedBadge()).toBe(true);
    expect(container.textContent).toContain("1 records");

    const unlockBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Unlock Form")
    );
    expect(unlockBtn).toBeDefined();
    await act(async () => {
      unlockBtn?.click();
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain(
      "21 CFR Part 11 Unlock & Signature Revocation"
    );
    expect(checkRegulatoryWording(dialog?.textContent || "")).toEqual([]);
    expect(findClinicalClaims(dialog?.textContent || "")).toEqual([]);

    const revokeBtn = Array.from(dialog?.querySelectorAll("button") || []).find(
      (b) => b.textContent?.includes("Revoke Signature & Unlock")
    ) as HTMLButtonElement | undefined;
    expect(revokeBtn).toBeDefined();
    expect(revokeBtn?.disabled).toBe(true);

    const reasonInput = dialog?.querySelector(
      "#edc-unlock-justification-reason"
    ) as HTMLTextAreaElement | null;
    expect(reasonInput).not.toBeNull();

    const justification =
      "Amend screening blood pressure after source chart reconciliation";
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set?.call(reasonInput, justification);
      reasonInput?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(revokeBtn?.disabled).toBe(false);

    await act(async () => {
      revokeBtn?.click();
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).not.toContain("Locked (PI)");
    expect(hasSignedBadge()).toBe(false);
    expect(container.textContent).toContain("0 records");

    // Verify justification is recorded in Part 11 Audit Trail
    const auditTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Part 11 Audit Trail")
    );
    await act(async () => {
      auditTab?.click();
    });

    expect(container.textContent).toContain(justification);
    expect(container.textContent).toContain("Locked & Signed");
    expect(container.textContent).toContain("Unlocked");
  });

  it("lists only scheduled forms plus AE and CM log forms per visit matching Subject Status Matrix", async () => {
    const cmForm = scaffoldCdashDomain("CM");
    const studyWithCm: StudyProtocol = {
      ...ONCOLOGY_RECIST_PRESET,
      forms: [...ONCOLOGY_RECIST_PRESET.forms, cmForm],
    };

    await act(async () => {
      root.render(<LiveEdcSimulator study={studyWithCm} />);
    });

    const visitSelect = container.querySelector(
      "#edc-protocol-visit-select"
    ) as HTMLSelectElement;
    const formSelect = container.querySelector(
      "#edc-crf-form-select"
    ) as HTMLSelectElement;
    expect(visitSelect).not.toBeNull();
    expect(formSelect).not.toBeNull();

    // Switch to End of Study / Follow-up visit where DM is not scheduled
    const lastVisit = studyWithCm.visits.at(-1)!;
    await act(async () => {
      visitSelect.value = lastVisit.id;
      visitSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const dropdownFormIds = Array.from(formSelect.options).map((o) => o.value);
    expect(dropdownFormIds).toContain(cmForm.id);
    expect(
      dropdownFormIds.some((id) =>
        studyWithCm.forms.some((f) => f.id === id && f.domain === "AE")
      )
    ).toBe(true);
    if (!lastVisit.assignedFormIds.includes("form_dm_onc")) {
      expect(dropdownFormIds).not.toContain("form_dm_onc");
    }

    // Switch to Subject Status Matrix and confirm the last visit cell renders the same domains
    const matrixTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Subject Status Matrix")
    );
    await act(async () => {
      matrixTab?.click();
    });

    const firstSubjectRow = container.querySelector("tbody tr");
    const visitCells = firstSubjectRow?.querySelectorAll('td[role="gridcell"]');
    const lastVisitCell = visitCells?.[studyWithCm.visits.length - 1];
    const matrixDomains = Array.from(
      lastVisitCell?.querySelectorAll("button") || []
    ).map((b) => (b.textContent || "").trim());
    const dropdownDomains = dropdownFormIds.map(
      (id) => studyWithCm.forms.find((f) => f.id === id)?.domain || ""
    );
    expect(matrixDomains).toEqual(dropdownDomains);
  });

  it("renders BMI = 24.6 kg/m², omits null-flavor pills on VSDAT and BMI, enforces VSDAT Hard Stop, prints activeVisit.name on save, and uses inline role banners without window.alert", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    await act(async () => {
      root.render(<LiveEdcSimulator study={ONCOLOGY_RECIST_PRESET} />);
    });

    const formSelect = container.querySelector(
      "#edc-crf-form-select"
    ) as HTMLSelectElement;
    const vsForm = ONCOLOGY_RECIST_PRESET.forms.find((f) => f.domain === "VS")!;

    await act(async () => {
      formSelect.value = vsForm.id;
      formSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // BMI renders 24.6 with kg/m² unit
    const bmiBox = container.querySelector("#ecrf-input-vs-bmi");
    expect(bmiBox?.textContent).toContain("24.6");
    expect(bmiBox?.textContent).toContain("kg/m²");

    // Neither VSDAT nor BMI displays ND / NA / UNK null-flavor toggle pills
    const vsdatCard = container
      .querySelector("#ecrf-input-vs-vsdat")
      ?.closest("div.p-3");
    const bmiCard = bmiBox?.closest("div.p-3");
    expect(
      Array.from(vsdatCard?.querySelectorAll("button") || []).some((b) =>
        ["ND", "NA", "UNK"].includes((b.textContent || "").trim())
      )
    ).toBe(false);
    expect(
      Array.from(bmiCard?.querySelectorAll("button") || []).some((b) =>
        ["ND", "NA", "UNK"].includes((b.textContent || "").trim())
      )
    ).toBe(false);

    // Empty VSDAT blocks Save Form with Hard Stop
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Save Form")
    );
    await act(async () => {
      saveBtn?.click();
    });
    expect(container.textContent).toContain("Form submission blocked!");
    expect(container.textContent).toContain("VSDAT");

    // Populate VSDAT (precision_date: Day, Month, Year) and re-save -> prints activeVisit.name
    const daySelect = container.querySelector(
      "#ecrf-input-vs-vsdat-day"
    ) as HTMLSelectElement | null;
    const monthSelect = container.querySelector(
      "#ecrf-input-vs-vsdat-month"
    ) as HTMLSelectElement | null;
    const vsdatInput = container.querySelector(
      "#ecrf-input-vs-vsdat"
    ) as HTMLInputElement | null;

    if (daySelect && monthSelect && vsdatInput) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set?.call(vsdatInput, "2026");
        vsdatInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        monthSelect.value = "08";
        monthSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await act(async () => {
        daySelect.value = "15";
        daySelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
    } else if (vsdatInput) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set?.call(vsdatInput, "2026-08-15");
        vsdatInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    // Dismiss Part 11 Reason for Change modal if partial date transition opened it
    const confirmReasonBtn = Array.from(
      container.querySelectorAll("button")
    ).find((b) => b.textContent?.includes("Confirm Audit Signature"));
    if (confirmReasonBtn) {
      await act(async () => {
        confirmReasonBtn.click();
      });
    }

    await act(async () => {
      saveBtn?.click();
    });

    const screenVisitName = ONCOLOGY_RECIST_PRESET.visits[0]!.name;
    expect(container.textContent).toContain(
      `Form saved successfully for Subject 001-101 at ${screenVisitName}.`
    );

    // Switch to Data Manager and CRA Monitor -> inline role banner is displayed, zero window.alert calls
    const dmRoleBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Data Manager"
    );
    await act(async () => {
      dmRoleBtn?.click();
    });
    const banner = container.querySelector(
      '[data-testid="edc-role-signature-banner"]'
    );
    expect(banner?.textContent).toMatch(/Data Manager role is read-only/i);
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
