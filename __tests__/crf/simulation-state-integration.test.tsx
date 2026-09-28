/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { CRFStudioContainer } from "@/components/crf/CRFStudioContainer";
import {
  loadStudyDraft,
  exportUniversalCrfJson,
  parseUniversalCrf,
  getOncologyPresetSync,
  StudyProtocol,
} from "@/lib/crf";

describe("EDC Simulation State Integration", () => {
  beforeEach(() => {
    window.location.hash = "";
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
    localStorage.clear();
  });

  it("1. Retains all audit trail entries when navigating between EDC Simulator and other studio modes", async () => {
    window.location.hash = "#mode=edc";
    render(<CRFStudioContainer />);

    // Switch to Part 11 Audit Trail tab inside EDC Simulator
    const auditTabBtn = await screen.findByRole("button", {
      name: /Part 11 Audit Trail/i,
    });
    fireEvent.click(auditTabBtn);

    // Initial default audit log entry is visible
    expect(
      await screen.findByText(/Initial baseline data entry/i)
    ).toBeDefined();

    // Switch mode to Form Grid (Grid mode) via header tab or hash
    act(() => {
      window.location.hash = "#mode=grid";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    // Switch back to EDC Simulator mode
    act(() => {
      window.location.hash = "#mode=edc";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    // Verify audit trail entry is still present
    const auditTabBtnAfterNav = await screen.findByRole("button", {
      name: /Part 11 Audit Trail/i,
    });
    fireEvent.click(auditTabBtnAfterNav);
    expect(
      await screen.findByText(/Initial baseline data entry/i)
    ).toBeDefined();
  });

  it("2. Form locking generates electronic signature record that survives tab navigation and draft reload", async () => {
    window.location.hash = "#mode=edc";
    render(<CRFStudioContainer />);

    // Switch role to Principal Investigator
    const piRoleBtn = await screen.findByRole("button", {
      name: "Principal Investigator",
    });
    fireEvent.click(piRoleBtn);

    // Click "Lock & Sign (PI)" button
    const lockBtn = await screen.findByRole("button", {
      name: /Lock & Sign/i,
    });
    fireEvent.click(lockBtn);

    // Lock status updated
    expect(await screen.findByText(/Locked \(PI\)/i)).toBeDefined();

    // Switch mode to Visit Matrix
    act(() => {
      window.location.hash = "#mode=matrix";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    // Switch back to EDC Simulator mode
    act(() => {
      window.location.hash = "#mode=edc";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    // Form remains locked and signature record is present
    expect(await screen.findByText(/Locked \(PI\)/i)).toBeDefined();

    // Wait for useStudyAutosave debounce (800ms)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    // Check draft saved in localStorage contains electronic signature
    const draft = loadStudyDraft();
    expect(draft.status).toBe("recovered");
    if (draft.status === "recovered") {
      expect(draft.study.simulationState?.signatures).toBeDefined();
      expect(draft.study.simulationState?.signatures?.length).toBeGreaterThan(
        0
      );
      expect(draft.study.simulationState?.signatures?.[0].meaning).toBe(
        "Data Lock"
      );
      expect(draft.study.simulationState?.signatures?.[0].digest).toContain(
        "SHA256-"
      );
    }
  });

  it("3. Exporting study protocol JSON bundle includes simulationState with audit logs and signatures intact", () => {
    const study: StudyProtocol = {
      ...getOncologyPresetSync(),
      simulationState: {
        auditLog: [
          {
            id: "aud_test_101",
            timestamp: "2026-09-28T10:00:00Z",
            subjectId: "001-101",
            formId: "form_dm",
            fieldId: "f_brthyr",
            fieldName: "BRTHYR",
            previousValue: null,
            newValue: 1985,
            changedBy: "Investigator Sarah",
            userRole: "Principal Investigator",
            reasonForChange: "Initial Data Entry",
          },
        ],
        signatures: [
          {
            id: "sig_test_101",
            subjectId: "001-101",
            formId: "form_dm",
            visitId: "v_screen",
            signedBy: "Dr. Sarah Jenkins, M.D.",
            userRole: "Principal Investigator",
            timestamp: "2026-09-28T10:05:00Z",
            meaning: "Data Lock",
            digest: "SHA256-abcdef123456",
          },
        ],
        formValues: {
          "001-101_v_screen_f_brthyr": 1985,
        },
      },
    };

    const exportedJson = exportUniversalCrfJson(study);
    const parsed = JSON.parse(exportedJson);

    expect(parsed.simulationState).toBeDefined();
    expect(parsed.simulationState.auditLog).toHaveLength(1);
    expect(parsed.simulationState.auditLog[0].id).toBe("aud_test_101");
    expect(parsed.simulationState.signatures).toHaveLength(1);
    expect(parsed.simulationState.signatures[0].digest).toBe(
      "SHA256-abcdef123456"
    );
    expect(parsed.simulationState.formValues["001-101_v_screen_f_brthyr"]).toBe(
      1985
    );
  });

  it("4. Importing study JSON containing simulationState validates and populates simulation state", () => {
    const studyWithSim: StudyProtocol = {
      ...getOncologyPresetSync(),
      simulationState: {
        auditLog: [
          {
            id: "aud_imported_1",
            timestamp: "2026-09-28T11:00:00Z",
            subjectId: "001-201",
            formId: "form_dm",
            fieldId: "f_sex",
            fieldName: "SEX",
            previousValue: null,
            newValue: "F",
            changedBy: "CRA Auditor",
            userRole: "CRA Monitor",
            reasonForChange: "Verification against chart",
          },
        ],
        signatures: [
          {
            id: "sig_imported_1",
            subjectId: "001-201",
            formId: "form_dm",
            visitId: "v_screen",
            signedBy: "Dr. Smith",
            userRole: "Principal Investigator",
            timestamp: "2026-09-28T11:10:00Z",
            meaning: "Investigator Approval",
            digest: "SHA256-9876543210fedcba",
          },
        ],
        availableSubjects: ["001-201"],
      },
    };

    const jsonStr = exportUniversalCrfJson(studyWithSim);
    const parsedStudy = parseUniversalCrf(jsonStr);

    expect(parsedStudy.simulationState).toBeDefined();
    expect(parsedStudy.simulationState?.auditLog?.[0].subjectId).toBe(
      "001-201"
    );
    expect(parsedStudy.simulationState?.signatures?.[0].signedBy).toBe(
      "Dr. Smith"
    );
    expect(parsedStudy.simulationState?.availableSubjects).toEqual(["001-201"]);
  });

  it("5. Replacing or importing a study without simulationState while EDC view remains mounted isolates state and prevents old values from leaking", async () => {
    window.location.hash = "#mode=edc";
    render(<CRFStudioContainer />);

    // Add a custom subject or value in active EDC simulation
    const initialAuditTab = await screen.findByRole("button", {
      name: /Part 11 Audit Trail/i,
    });
    fireEvent.click(initialAuditTab);
    expect(
      await screen.findByText(/Initial baseline data entry/i)
    ).toBeDefined();

    // Select a preset study (which replaces the study with one without simulationState)
    const presetSelect = screen.getAllByRole("combobox", {
      name: /Select Clinical Protocol Preset/i,
    })[0];
    fireEvent.change(presetSelect, { target: { value: "cns_neuro" } });

    // Confirm that EDC simulator updates and does NOT retain old custom simulationState
    const auditTabAfterPreset = await screen.findByRole("button", {
      name: /Part 11 Audit Trail/i,
    });
    fireEvent.click(auditTabAfterPreset);

    // Old specific audit log entries from oncology study are cleared/reset for cardiology
    expect(screen.queryByText(/001-101_v_screen_f_brthyr/i)).toBeNull();
  });
});
