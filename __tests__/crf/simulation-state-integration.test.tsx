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

    // Enroll a custom subject in active EDC simulation
    const enrollBtn = await screen.findByTitle(/Enroll New Simulated Subject/i);
    fireEvent.click(enrollBtn);

    const subjectInput = await screen.findByPlaceholderText(/e.g. 001-104/i);
    fireEvent.change(subjectInput, { target: { value: "001-CUSTOM-999" } });

    // Click confirm button (IconCheck)
    const confirmBtn = subjectInput.nextElementSibling;
    if (confirmBtn) fireEvent.click(confirmBtn);

    // Verify custom subject is present before replacement
    expect(await screen.findByText(/001-CUSTOM-999/i)).toBeDefined();

    // Wait for autosave debounce to ensure simulationState is persisted to draft
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });
    const draftBefore = loadStudyDraft();
    expect(draftBefore.status).toBe("recovered");
    if (draftBefore.status === "recovered") {
      expect(draftBefore.study.simulationState?.availableSubjects).toContain(
        "001-CUSTOM-999"
      );
    }

    // 1. Switch to a preset study without simulationState (different study ID)
    const presetSelect = screen.getAllByRole("combobox", {
      name: /Select Clinical Protocol Preset/i,
    })[0];
    fireEvent.change(presetSelect, { target: { value: "cns_neuro" } });

    // If dirty draft confirmation modal appears, confirm replacement
    const confirmReplacementBtn = screen.queryByRole("button", {
      name: /Discard & Replace/i,
    });
    if (confirmReplacementBtn) {
      fireEvent.click(confirmReplacementBtn);
    }

    // Confirm that custom subject is NOT present in new study UI or autosaved simulationState
    expect(screen.queryByText(/001-CUSTOM-999/i)).toBeNull();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });
    const draftAfterPreset = loadStudyDraft();
    if (draftAfterPreset.status === "recovered") {
      expect(
        draftAfterPreset.study.simulationState?.availableSubjects
      ).not.toContain("001-CUSTOM-999");
    }

    // 2. Same-ID JSON Replacement
    // Enroll another custom subject on the new active study
    const enrollBtn2 = await screen.findByTitle(
      /Enroll New Simulated Subject/i
    );
    fireEvent.click(enrollBtn2);

    const subjectInput2 = await screen.findByPlaceholderText(/e.g. 001-104/i);
    fireEvent.change(subjectInput2, {
      target: { value: "001-SAME-ID-CUSTOM" },
    });
    const confirmBtn2 = subjectInput2.nextElementSibling;
    if (confirmBtn2) fireEvent.click(confirmBtn2);

    expect(await screen.findByText(/001-SAME-ID-CUSTOM/i)).toBeDefined();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });
    const draftBeforeSameId = loadStudyDraft();
    expect(draftBeforeSameId.status).toBe("recovered");

    if (draftBeforeSameId.status === "recovered") {
      const currentStudy = draftBeforeSameId.study;
      // Construct a same-ID study import JSON with no simulationState
      const sameIdStudyWithoutSim: StudyProtocol = {
        ...currentStudy,
        simulationState: undefined,
      };

      // Navigate to Export/Import mode
      act(() => {
        window.location.hash = "#mode=export";
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });

      const importTextarea = await screen.findByPlaceholderText(
        /Paste exported StudyProtocol JSON here to load\.\.\./i
      );
      fireEvent.change(importTextarea, {
        target: { value: exportUniversalCrfJson(sameIdStudyWithoutSim) },
      });

      const importBtn = await screen.findByRole("button", {
        name: /Import Protocol into Studio/i,
      });
      await act(async () => {
        fireEvent.click(importBtn);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const confirmReplacementBtn2 = await screen.findByRole("button", {
        name: /Discard & Replace/i,
      });
      fireEvent.click(confirmReplacementBtn2);

      // Return to EDC Simulator mode
      act(() => {
        window.location.hash = "#mode=edc";
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });

      // Verify custom subject is gone and state is isolated even for same-ID study replacement
      expect(screen.queryByText(/001-SAME-ID-CUSTOM/i)).toBeNull();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      });
      const draftAfterSameId = loadStudyDraft();
      if (draftAfterSameId.status === "recovered") {
        expect(
          draftAfterSameId.study.simulationState?.availableSubjects
        ).not.toContain("001-SAME-ID-CUSTOM");
      }
    }
  });

  it("6. UniversalCrfProtocolSchema validates AuditTrailEntry with object values, actionType, diagnosticId, and details without stripping", () => {
    const studyWithComplexAudit: StudyProtocol = {
      ...getOncologyPresetSync(),
      auditTrail: [
        {
          id: "aud_fu_1",
          timestamp: "2026-09-28T12:00:00Z",
          changedBy: "System Auditor",
          actionType: "FIELD_UPDATE",
          diagnosticId: "diag_rule_404",
          previousValue: { val: 70, unit: "kg" },
          newValue: { val: 72, unit: "kg" },
          details: { reason: "Recalibration", source: "automated_scale" },
          subjectId: "001-101",
          formId: "form_vitals",
          fieldId: "f_weight",
        },
      ],
      simulationState: {
        auditLog: [
          {
            id: "aud_fu_sim_1",
            timestamp: "2026-09-28T12:05:00Z",
            changedBy: "Dr. Investigator",
            actionType: "FIELD_UPDATE",
            diagnosticId: "diag_sim_101",
            previousValue: { sys: 120, dia: 80 },
            newValue: { sys: 130, dia: 85 },
            details: "Manual adjustment",
            subjectId: "001-101",
          },
        ],
      },
    };

    const jsonStr = exportUniversalCrfJson(studyWithComplexAudit);
    const parsedStudy = parseUniversalCrf(jsonStr);

    expect(parsedStudy.auditTrail).toHaveLength(1);
    const entry = parsedStudy.auditTrail?.[0];
    expect(entry?.actionType).toBe("FIELD_UPDATE");
    expect(entry?.diagnosticId).toBe("diag_rule_404");
    expect(entry?.previousValue).toEqual({ val: 70, unit: "kg" });
    expect(entry?.newValue).toEqual({ val: 72, unit: "kg" });
    expect(entry?.details).toEqual({
      reason: "Recalibration",
      source: "automated_scale",
    });

    const simEntry = parsedStudy.simulationState?.auditLog?.[0];
    expect(simEntry?.actionType).toBe("FIELD_UPDATE");
    expect(simEntry?.diagnosticId).toBe("diag_sim_101");
    expect(simEntry?.previousValue).toEqual({ sys: 120, dia: 80 });
    expect(simEntry?.newValue).toEqual({ sys: 130, dia: 85 });
    expect(simEntry?.details).toBe("Manual adjustment");
  });

  it("7. Attempting malformed same-ID import in full studio preserves active state and saved draft", async () => {
    window.location.hash = "#mode=edc";
    render(<CRFStudioContainer />);

    // Switch role to Principal Investigator and lock form to generate electronic signature
    const piRoleBtn = await screen.findByRole("button", {
      name: "Principal Investigator",
    });
    fireEvent.click(piRoleBtn);

    const lockBtn = await screen.findByRole("button", {
      name: /Lock & Sign/i,
    });
    fireEvent.click(lockBtn);

    // Verify signature was created and form is locked
    expect(await screen.findByText(/Locked \(PI\)/i)).toBeDefined();

    // Wait for useStudyAutosave debounce (1000ms) to ensure draft is saved
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    const draftBefore = loadStudyDraft();
    expect(draftBefore.status).toBe("recovered");
    if (draftBefore.status !== "recovered") {
      throw new Error("Draft not recovered");
    }

    const activeStudyId = draftBefore.study.id;
    const activeProtocolNumber = draftBefore.study.protocolNumber;
    expect(
      draftBefore.study.simulationState?.signatures?.length
    ).toBeGreaterThan(0);

    // Navigate to Export/Import mode (#mode=export)
    act(() => {
      window.location.hash = "#mode=export";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    // Paste malformed same-ID USDM JSON (auditLog is string instead of array)
    const malformedSameIdUsdm = JSON.stringify({
      study: {
        id: activeStudyId,
        protocolNumber: activeProtocolNumber,
        title: "Malformed Same-ID Replacement Protocol",
        phase: "Phase III",
        sponsor: "Test Sponsor",
        studyDesigns: [],
        simulationState: {
          auditLog: "INVALID_AUDIT_LOG_STRING_NOT_ARRAY",
        },
      },
    });

    const importTextarea = await screen.findByPlaceholderText(
      /Paste exported StudyProtocol JSON here to load\.\.\./i
    );
    fireEvent.change(importTextarea, {
      target: { value: malformedSameIdUsdm },
    });

    const importBtn = await screen.findByRole("button", {
      name: /Import Protocol into Studio/i,
    });

    await act(async () => {
      fireEvent.click(importBtn);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Assert error message is displayed in modal
    expect(
      await screen.findByText(/Invalid supplied simulationState extension/i)
    ).toBeDefined();

    // Wait for autosave tick
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    // Assert saved draft in localStorage remains unchanged
    const draftAfter = loadStudyDraft();
    expect(draftAfter.status).toBe("recovered");
    if (draftAfter.status === "recovered") {
      expect(draftAfter.study.id).toBe(activeStudyId);
      expect(
        draftAfter.study.simulationState?.signatures?.length
      ).toBeGreaterThan(0);
      expect(draftAfter.study.simulationState?.signatures?.[0].meaning).toBe(
        "Data Lock"
      );
    }

    // Navigate back to EDC Simulator mode and verify active studio UI still reflects saved state
    act(() => {
      window.location.hash = "#mode=edc";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(await screen.findByText(/Locked \(PI\)/i)).toBeDefined();
  });
});
