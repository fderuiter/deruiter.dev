import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_EDC_SUBJECTS,
  StudyProtocolEngine,
  evaluateDerivedFormValues,
  exportUniversalCrfJson,
  getEdcRoleActorLabel,
  getEdcRolePermissions,
  getFormSignatureStatus,
  getOncologyPresetSync,
  getScheduledFormsForVisit,
  getSubjectFormStatus,
  parseUniversalCrf,
  reduceEdcSimulationState,
  scaffoldCdashDomain,
  seedEdcSimulationState,
  stampEdcSimulationAction,
  validateEdcFormSubmission,
} from "@/lib/crf";
import type {
  EdcSimulationAction,
  EdcUserRole,
  StudyProtocol,
} from "@/lib/crf/types";

describe("Pure Part 11 EDC Simulation Engine", () => {
  it("seeds stamped protocol fields (f_brthyr_1, f_age_2, f_sex_3, VS vitals) and computes rounded BMI = 24.6", () => {
    const study = getOncologyPresetSync();
    const seeded = seedEdcSimulationState(
      study,
      undefined,
      "2026-08-15T08:30:00Z"
    );

    expect(seeded.availableSubjects).toEqual([...DEFAULT_EDC_SUBJECTS]);

    const dmForm = study.forms.find((f) => f.domain === "DM")!;
    const dmFields = dmForm.sections.flatMap((s) => s.fields);
    const brthyr = dmFields.find((f) => f.variableName === "BRTHYR")!;
    const age = dmFields.find((f) => f.variableName === "AGE")!;
    const sex = dmFields.find((f) => f.variableName === "SEX")!;

    expect(brthyr.id).toMatch(/^f_brthyr(_\d+)?$/);
    expect(age.id).toMatch(/^f_age(_\d+)?$/);
    expect(sex.id).toMatch(/^f_sex(_\d+)?$/);

    const screenVisitId = study.visits[0]!.id;
    expect(seeded.formValues?.[`001-101_${screenVisitId}_${brthyr.id}`]).toBe(
      1982
    );
    expect(seeded.formValues?.[`001-101_${screenVisitId}_${age.id}`]).toBe(44);
    expect(seeded.formValues?.[`001-101_${screenVisitId}_${sex.id}`]).toBe("M");

    const vsForm = study.forms.find((f) => f.domain === "VS")!;
    const vsFields = vsForm.sections.flatMap((s) => s.fields);
    const height = vsFields.find((f) => f.variableName === "HEIGHT")!;
    const weight = vsFields.find((f) => f.variableName === "WEIGHT")!;
    const bmi = vsFields.find((f) => f.variableName === "BMI")!;

    expect(seeded.formValues?.[`001-101_${screenVisitId}_${height.id}`]).toBe(
      178
    );
    expect(seeded.formValues?.[`001-101_${screenVisitId}_${weight.id}`]).toBe(
      78
    );
    expect(seeded.formValues?.[`001-101_${screenVisitId}_${bmi.id}`]).toBe(
      24.6
    );
    expect(seeded.auditLog?.[0]?.actionType).toBe("FIELD_UPDATE");
    expect(seeded.auditLog?.[0]?.changedBy).toBe(
      getEdcRoleActorLabel("Site Coordinator")
    );
  });

  it("scaffolds VS domain template with rounded BMI formula yielding 24.6 for 78kg and 178cm", () => {
    const vsForm = scaffoldCdashDomain("VS");
    const fields = vsForm.sections.flatMap((s) => s.fields);
    const height = fields.find((f) => f.variableName === "HEIGHT")!;
    const weight = fields.find((f) => f.variableName === "WEIGHT")!;
    const bmi = fields.find((f) => f.variableName === "BMI")!;

    expect(bmi.calculationFormula).toBe(
      "round(weight / ((height / 100) * (height / 100)), 1)"
    );

    const derived = evaluateDerivedFormValues(vsForm, "001-101", "v_screen", {
      [`001-101_v_screen_${height.id}`]: 178,
      [`001-101_v_screen_${weight.id}`]: 78,
    });
    expect(derived[`001-101_v_screen_${bmi.id}`]).toBe(24.6);
  });

  it("filters scheduled forms per visit plus continuous AE and CM log forms", () => {
    const base = getOncologyPresetSync();
    const cmForm = scaffoldCdashDomain("CM");
    const study: StudyProtocol = {
      ...base,
      forms: [...base.forms, cmForm],
    };

    for (const visit of study.visits) {
      const scheduled = getScheduledFormsForVisit(study, visit.id);
      const viaEngine = StudyProtocolEngine.getScheduledFormsForVisit(
        study,
        visit.id
      );
      expect(viaEngine.map((f) => f.id)).toEqual(scheduled.map((f) => f.id));

      for (const form of scheduled) {
        const isAssigned = visit.assignedFormIds.includes(form.id);
        const isContinuousLog =
          Boolean(form.isLogForm) ||
          form.domain === "AE" ||
          form.domain === "CM";
        expect(isAssigned || isContinuousLog).toBe(true);
      }

      expect(scheduled.some((f) => f.domain === "AE")).toBe(true);
      expect(scheduled.some((f) => f.domain === "CM")).toBe(true);
    }

    // Follow-up visit does not schedule Screening-only DM form
    const followUpVisit = study.visits.find((v) => v.id === "v_eos");
    if (
      followUpVisit &&
      !followUpVisit.assignedFormIds.includes("form_dm_onc")
    ) {
      const eosForms = getScheduledFormsForVisit(study, followUpVisit.id);
      expect(eosForms.some((f) => f.domain === "DM")).toBe(false);
    }
  });

  it("enforces all four UserRole permission matrices and changedBy actor labels across edits, SDV, and queries", () => {
    const study = getOncologyPresetSync();
    const visitId = study.visits[0]!.id;
    const vsForm = study.forms.find((f) => f.domain === "VS")!;
    const sysbp = vsForm.sections
      .flatMap((s) => s.fields)
      .find((f) => f.variableName === "SYSBP")!;

    const expectedMatrix: Record<
      EdcUserRole,
      {
        canEditUnlocked: boolean;
        canToggleSdv: boolean;
        canLockAndSign: boolean;
        canManageQueries: boolean;
        canRespondToQueries: boolean;
      }
    > = {
      "Site Coordinator": {
        canEditUnlocked: true,
        canToggleSdv: false,
        canLockAndSign: false,
        canManageQueries: false,
        canRespondToQueries: true,
      },
      "Principal Investigator": {
        canEditUnlocked: true,
        canToggleSdv: false,
        canLockAndSign: true,
        canManageQueries: false,
        canRespondToQueries: true,
      },
      "CRA Monitor": {
        canEditUnlocked: false,
        canToggleSdv: true,
        canLockAndSign: false,
        canManageQueries: true,
        canRespondToQueries: false,
      },
      "Data Manager": {
        canEditUnlocked: false,
        canToggleSdv: false,
        canLockAndSign: false,
        canManageQueries: true,
        canRespondToQueries: false,
      },
    };

    for (const [role, expected] of Object.entries(expectedMatrix) as Array<
      [EdcUserRole, (typeof expectedMatrix)[EdcUserRole]]
    >) {
      const perms = getEdcRolePermissions(role, { isLocked: false });
      expect(perms.actorLabel).toBe(getEdcRoleActorLabel(role));
      expect(perms.canEditActiveForm).toBe(expected.canEditUnlocked);
      expect(perms.canToggleSdv).toBe(expected.canToggleSdv);
      expect(perms.canLockAndSign).toBe(expected.canLockAndSign);
      expect(perms.canManageQueries).toBe(expected.canManageQueries);
      expect(perms.canRespondToQueries).toBe(expected.canRespondToQueries);
      expect(perms.canUnlockForm).toBe(false);
    }

    let state = seedEdcSimulationState(study);
    const fieldKey = `001-101_${visitId}_${sysbp.id}`;
    const baselineVal = state.formValues?.[fieldKey];

    // CRA Monitor and Data Manager field edits are rejected
    for (const readOnlyRole of ["CRA Monitor", "Data Manager"] as const) {
      const blocked = reduceEdcSimulationState(study, state, {
        type: "UPDATE_FIELD_VALUE",
        subjectId: "001-101",
        visitId,
        formId: vsForm.id,
        fieldId: sysbp.id,
        value: 155,
        role: readOnlyRole,
        reasonForChange: "Attempted unauthorized edit",
        timestamp: "2026-08-15T10:00:00Z",
      });
      expect(blocked.formValues?.[fieldKey]).toBe(baselineVal);
    }

    // Site Coordinator and Principal Investigator edits succeed with accurate changedBy labels
    state = reduceEdcSimulationState(study, state, {
      type: "UPDATE_FIELD_VALUE",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      fieldId: sysbp.id,
      value: 128,
      role: "Site Coordinator",
      reasonForChange: "Triage cuff reading verified",
      timestamp: "2026-08-15T10:01:00Z",
    });
    expect(state.formValues?.[fieldKey]).toBe(128);
    expect(state.auditLog?.[0]?.changedBy).toBe(
      getEdcRoleActorLabel("Site Coordinator")
    );
    expect(state.auditLog?.[0]?.userRole).toBe("Site Coordinator");

    state = reduceEdcSimulationState(study, state, {
      type: "UPDATE_FIELD_VALUE",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      fieldId: sysbp.id,
      value: 126,
      role: "Principal Investigator",
      reasonForChange: "Repeat seated BP confirmed by PI",
      timestamp: "2026-08-15T10:02:00Z",
    });
    expect(state.formValues?.[fieldKey]).toBe(126);
    expect(state.auditLog?.[0]?.changedBy).toBe(
      getEdcRoleActorLabel("Principal Investigator")
    );

    // Only CRA Monitor can toggle SDV
    for (const nonCraRole of [
      "Site Coordinator",
      "Principal Investigator",
      "Data Manager",
    ] as const) {
      const unchanged = reduceEdcSimulationState(study, state, {
        type: "TOGGLE_SDV",
        subjectId: "001-101",
        visitId,
        formId: vsForm.id,
        fieldId: sysbp.id,
        fieldName: "SYSBP",
        role: nonCraRole,
        timestamp: "2026-08-15T10:03:00Z",
      });
      expect(unchanged.sdvMap?.[fieldKey]).toBeUndefined();
    }

    state = reduceEdcSimulationState(study, state, {
      type: "TOGGLE_SDV",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      fieldId: sysbp.id,
      fieldName: "SYSBP",
      role: "CRA Monitor",
      timestamp: "2026-08-15T10:04:00Z",
    });
    expect(state.sdvMap?.[fieldKey]?.verified).toBe(true);
    expect(state.auditLog?.[0]?.actionType).toBe("SDV_VERIFY");
    expect(state.auditLog?.[0]?.changedBy).toBe(
      getEdcRoleActorLabel("CRA Monitor")
    );

    state = reduceEdcSimulationState(study, state, {
      type: "TOGGLE_SDV",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      fieldId: sysbp.id,
      fieldName: "SYSBP",
      role: "CRA Monitor",
      timestamp: "2026-08-15T10:05:00Z",
    });
    expect(state.sdvMap?.[fieldKey]?.verified).toBe(false);
    expect(state.auditLog?.[0]?.actionType).toBe("SDV_REVOKE");
  });

  it("records FORM_LOCK + Data Lock signature and requires PI justification on FORM_UNLOCK to revoke Data Lock", () => {
    const study = getOncologyPresetSync();
    const visitId = study.visits[0]!.id;
    const vsForm = study.forms.find((f) => f.domain === "VS")!;
    const weight = vsForm.sections
      .flatMap((s) => s.fields)
      .find((f) => f.variableName === "WEIGHT")!;

    let state = seedEdcSimulationState(study);

    // Non-PI roles cannot lock
    for (const nonPiRole of [
      "Site Coordinator",
      "CRA Monitor",
      "Data Manager",
    ] as const) {
      const denied = reduceEdcSimulationState(study, state, {
        type: "LOCK_FORM",
        subjectId: "001-101",
        visitId,
        formId: vsForm.id,
        role: nonPiRole,
        timestamp: "2026-08-15T11:20:00Z",
      });
      expect(
        getFormSignatureStatus(denied, "001-101", visitId, vsForm.id).isLocked
      ).toBe(false);
    }

    // PI locks and signs form
    state = reduceEdcSimulationState(study, state, {
      type: "LOCK_FORM",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      role: "Principal Investigator",
      timestamp: "2026-08-15T11:20:41Z",
    });

    const lockedStatus = getFormSignatureStatus(
      state,
      "001-101",
      visitId,
      vsForm.id
    );
    expect(lockedStatus.isLocked).toBe(true);
    expect(lockedStatus.isSigned).toBe(true);
    expect(lockedStatus.activeDataLockSignature?.meaning).toBe("Data Lock");
    expect(lockedStatus.activeDataLockSignature?.digest).toMatch(
      /^sim_[0-9a-z]+$/
    );
    expect(state.auditLog?.[0]?.actionType).toBe("FORM_LOCK");
    expect(state.auditLog?.[0]?.changedBy).toBe(
      getEdcRoleActorLabel("Principal Investigator")
    );

    // While locked, even PI cannot edit field values or toggle SDV without unlocking first
    const weightKey = `001-101_${visitId}_${weight.id}`;
    const whileLocked = reduceEdcSimulationState(study, state, {
      type: "UPDATE_FIELD_VALUE",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      fieldId: weight.id,
      value: 82,
      role: "Principal Investigator",
      reasonForChange: "Attempt while locked",
      timestamp: "2026-08-15T11:25:00Z",
    });
    expect(whileLocked.formValues?.[weightKey]).toBe(78);

    // Unlock without reason or by non-PI is rejected
    const emptyReasonUnlock = reduceEdcSimulationState(study, state, {
      type: "UNLOCK_FORM",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      role: "Principal Investigator",
      reasonForChange: "   ",
      timestamp: "2026-08-15T11:26:00Z",
    });
    expect(
      getFormSignatureStatus(emptyReasonUnlock, "001-101", visitId, vsForm.id)
        .isLocked
    ).toBe(true);

    const nonPiUnlock = reduceEdcSimulationState(study, state, {
      type: "UNLOCK_FORM",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      role: "Site Coordinator",
      reasonForChange: "Coordinator attempted unlock",
      timestamp: "2026-08-15T11:27:00Z",
    });
    expect(
      getFormSignatureStatus(nonPiUnlock, "001-101", visitId, vsForm.id)
        .isLocked
    ).toBe(true);

    // PI unlocks with mandatory justification -> revokes Data Lock signature and logs FORM_UNLOCK
    const justification =
      "Amend screening weight after calibrated scale source reconciliation";
    state = reduceEdcSimulationState(study, state, {
      type: "UNLOCK_FORM",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      role: "Principal Investigator",
      reasonForChange: justification,
      timestamp: "2026-08-15T11:35:00Z",
    });

    const unlockedStatus = getFormSignatureStatus(
      state,
      "001-101",
      visitId,
      vsForm.id
    );
    expect(unlockedStatus.isLocked).toBe(false);
    expect(unlockedStatus.isSigned).toBe(false);
    expect(unlockedStatus.activeDataLockSignature).toBeUndefined();
    expect(state.auditLog?.[0]?.actionType).toBe("FORM_UNLOCK");
    expect(state.auditLog?.[0]?.reasonForChange).toBe(justification);
    expect(state.auditLog?.[0]?.changedBy).toBe(
      getEdcRoleActorLabel("Principal Investigator")
    );

    // Round-trip through Universal CRF JSON schema preserves FORM_LOCK and FORM_UNLOCK entries
    const updatedStudy = StudyProtocolEngine.dispatchSimulationAction(study, {
      type: "REPLACE_SIMULATION_STATE",
      simulationState: state,
    });
    const parsed = parseUniversalCrf(exportUniversalCrfJson(updatedStudy));
    expect(parsed.simulationState?.auditLog?.[0]?.actionType).toBe(
      "FORM_UNLOCK"
    );
    expect(parsed.simulationState?.auditLog?.[1]?.actionType).toBe("FORM_LOCK");
  });

  it("enforces Hard Stop on missing VSDAT and disallowed CDISC null flavors when allowNullFlavor is not true", () => {
    const study = getOncologyPresetSync();
    const visitId = study.visits[0]!.id;
    const vsForm = study.forms.find((f) => f.domain === "VS")!;
    const vsFields = vsForm.sections.flatMap((s) => s.fields);
    const vsdat = vsFields.find((f) => f.variableName === "VSDAT")!;
    const bmi = vsFields.find((f) => f.variableName === "BMI")!;

    expect(Boolean(vsdat.allowNullFlavor)).toBe(false);
    expect(Boolean(bmi.allowNullFlavor)).toBe(false);

    const seeded = seedEdcSimulationState(study);

    // Empty VSDAT blocks submission with Hard Stop
    const missingVsdatResult = validateEdcFormSubmission(
      study,
      vsForm,
      "001-101",
      visitId,
      seeded.formValues || {},
      "2026-08-15T12:00:00Z"
    );
    expect(missingVsdatResult.isValid).toBe(false);
    expect(missingVsdatResult.hardStops).toContain("VSDAT");

    // Supplying a disallowed null flavor on VSDAT also triggers Hard Stop
    const disallowedNfResult = validateEdcFormSubmission(
      study,
      vsForm,
      "001-101",
      visitId,
      {
        ...(seeded.formValues || {}),
        [`001-101_${visitId}_${vsdat.id}`]: "UNK",
      },
      "2026-08-15T12:01:00Z"
    );
    expect(disallowedNfResult.isValid).toBe(false);
    expect(disallowedNfResult.hardStops).toContain("VSDAT");
    expect(disallowedNfResult.errors[vsdat.id]).toMatch(/not permitted/i);

    // Supplying a valid ISO date passes validation
    const validResult = validateEdcFormSubmission(
      study,
      vsForm,
      "001-101",
      visitId,
      {
        ...(seeded.formValues || {}),
        [`001-101_${visitId}_${vsdat.id}`]: "2026-08-15",
      },
      "2026-08-15T12:02:00Z"
    );
    expect(validResult.isValid).toBe(true);
    expect(validResult.hardStops).toEqual([]);

    const status = getSubjectFormStatus(
      study,
      seeded,
      "001-101",
      visitId,
      vsForm.id
    );
    expect(status.isComplete).toBe(true);
  });

  it("handles SEED_SIMULATION, ENROLL_SUBJECT, SAVE_FORM auto-queries/range checks, and role-gated query actions", () => {
    const study = getOncologyPresetSync();
    const visitId = study.visits[0]!.id;
    const vsForm = study.forms.find((f) => f.domain === "VS")!;
    const vsFields = vsForm.sections.flatMap((s) => s.fields);
    const vsdat = vsFields.find((f) => f.variableName === "VSDAT")!;
    const resp = vsFields.find((f) => f.variableName === "RESP")!;
    const sysbp = vsFields.find((f) => f.variableName === "SYSBP")!;

    // SEED_SIMULATION hydrates undefined state and preserves existing state
    let state = reduceEdcSimulationState(study, undefined, {
      type: "SEED_SIMULATION",
      timestamp: "2026-08-15T08:00:00Z",
    });
    expect(state.availableSubjects).toEqual([...DEFAULT_EDC_SUBJECTS]);
    const reseeded = reduceEdcSimulationState(study, state, {
      type: "SEED_SIMULATION",
      timestamp: "2026-08-15T08:05:00Z",
    });
    expect(reseeded.auditLog).toEqual(state.auditLog);

    // ENROLL_SUBJECT trims, deduplicates, and ignores blank strings
    state = reduceEdcSimulationState(study, state, {
      type: "ENROLL_SUBJECT",
      subjectId: "  001-104  ",
    });
    expect(state.availableSubjects).toContain("001-104");
    const dupEnroll = reduceEdcSimulationState(study, state, {
      type: "ENROLL_SUBJECT",
      subjectId: "001-104",
    });
    expect(dupEnroll.availableSubjects).toHaveLength(4);
    const blankEnroll = reduceEdcSimulationState(study, state, {
      type: "ENROLL_SUBJECT",
      subjectId: "   ",
    });
    expect(blankEnroll.availableSubjects).toHaveLength(4);

    // Set VSDAT valid and out-of-range optional/auto_query RESP to exercise SAVE_FORM range & auto-query deduplication
    state = reduceEdcSimulationState(study, state, {
      type: "UPDATE_FIELD_VALUE",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      fieldId: vsdat.id,
      value: "2026-08-15",
      role: "Site Coordinator",
      timestamp: "2026-08-15T08:50:00Z",
    });
    if (resp && resp.maxValue !== undefined) {
      state = reduceEdcSimulationState(study, state, {
        type: "UPDATE_FIELD_VALUE",
        subjectId: "001-101",
        visitId,
        formId: vsForm.id,
        fieldId: resp.id,
        value: resp.maxValue + 50,
        role: "Site Coordinator",
        timestamp: "2026-08-15T08:55:00Z",
      });
    }

    state = reduceEdcSimulationState(study, state, {
      type: "SAVE_FORM",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      role: "Site Coordinator",
      timestamp: "2026-08-15T09:00:00Z",
    });
    const queryCountAfterFirstSave = state.queries?.length || 0;

    // Repeated SAVE_FORM deduplicates generated queries
    state = reduceEdcSimulationState(study, state, {
      type: "SAVE_FORM",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      role: "Site Coordinator",
      timestamp: "2026-08-15T09:01:00Z",
    });
    expect(state.queries?.length || 0).toBe(queryCountAfterFirstSave);

    // Query lifecycle role guards: Site Coordinator cannot raise/close/cancel/reopen; CRA Monitor/Data Manager cannot answer
    const deniedRaise = reduceEdcSimulationState(study, state, {
      type: "RAISE_QUERY",
      input: {
        id: "qry_manual_1",
        subjectId: "001-101",
        visitId,
        formId: vsForm.id,
        fieldId: sysbp.id,
        fieldName: "SYSBP",
        severity: "warning",
        message: "Confirm sitting position",
        actor: "",
        userRole: "Site Coordinator",
        timestamp: "2026-08-15T09:10:00Z",
      },
    });
    expect(
      deniedRaise.queries?.find((q) => q.id === "qry_manual_1")
    ).toBeUndefined();

    state = reduceEdcSimulationState(study, state, {
      type: "RAISE_QUERY",
      input: {
        id: "qry_manual_1",
        subjectId: "001-101",
        visitId,
        formId: vsForm.id,
        fieldId: sysbp.id,
        fieldName: "SYSBP",
        severity: "warning",
        message: "Confirm sitting position",
        actor: "",
        userRole: "CRA Monitor",
        timestamp: "2026-08-15T09:11:00Z",
      },
    });
    expect(state.queries?.find((q) => q.id === "qry_manual_1")?.status).toBe(
      "Open"
    );

    // CRA Monitor cannot answer query
    const deniedAnswer = reduceEdcSimulationState(study, state, {
      type: "ANSWER_QUERY",
      input: {
        queryId: "qry_manual_1",
        response: "Unauthorized answer",
        actor: "",
        userRole: "CRA Monitor",
        timestamp: "2026-08-15T09:12:00Z",
      },
    });
    expect(
      deniedAnswer.queries?.find((q) => q.id === "qry_manual_1")?.status
    ).toBe("Open");

    // Site Coordinator answers query
    state = reduceEdcSimulationState(study, state, {
      type: "ANSWER_QUERY",
      input: {
        queryId: "qry_manual_1",
        response: "Confirmed seated 5 minutes",
        actor: "",
        userRole: "Site Coordinator",
        timestamp: "2026-08-15T09:13:00Z",
      },
    });
    expect(state.queries?.find((q) => q.id === "qry_manual_1")?.status).toBe(
      "Answered"
    );

    // Principal Investigator cannot close query; Data Manager closes, reopens, and cancels
    const deniedClose = reduceEdcSimulationState(study, state, {
      type: "CLOSE_QUERY",
      input: {
        queryId: "qry_manual_1",
        actor: "",
        userRole: "Principal Investigator",
        timestamp: "2026-08-15T09:14:00Z",
      },
    });
    expect(
      deniedClose.queries?.find((q) => q.id === "qry_manual_1")?.status
    ).toBe("Answered");

    state = reduceEdcSimulationState(study, state, {
      type: "CLOSE_QUERY",
      input: {
        queryId: "qry_manual_1",
        actor: "",
        userRole: "Data Manager",
        resolutionReason: "Verified against chart",
        timestamp: "2026-08-15T09:15:00Z",
      },
    });
    expect(state.queries?.find((q) => q.id === "qry_manual_1")?.status).toBe(
      "Closed"
    );

    const deniedReopen = reduceEdcSimulationState(study, state, {
      type: "REOPEN_QUERY",
      input: {
        queryId: "qry_manual_1",
        actor: "",
        userRole: "Site Coordinator",
        timestamp: "2026-08-15T09:16:00Z",
      },
    });
    expect(
      deniedReopen.queries?.find((q) => q.id === "qry_manual_1")?.status
    ).toBe("Closed");

    state = reduceEdcSimulationState(study, state, {
      type: "REOPEN_QUERY",
      input: {
        queryId: "qry_manual_1",
        actor: "",
        userRole: "CRA Monitor",
        reason: "Follow-up cuff check",
        timestamp: "2026-08-15T09:17:00Z",
      },
    });
    expect(state.queries?.find((q) => q.id === "qry_manual_1")?.status).toBe(
      "Open"
    );

    const deniedCancel = reduceEdcSimulationState(study, state, {
      type: "CANCEL_QUERY",
      input: {
        queryId: "qry_manual_1",
        actor: "",
        userRole: "Site Coordinator",
        timestamp: "2026-08-15T09:18:00Z",
      },
    });
    expect(
      deniedCancel.queries?.find((q) => q.id === "qry_manual_1")?.status
    ).toBe("Open");

    state = reduceEdcSimulationState(study, state, {
      type: "CANCEL_QUERY",
      input: {
        queryId: "qry_manual_1",
        actor: "",
        userRole: "Data Manager",
        resolutionReason: "Duplicate check",
        timestamp: "2026-08-15T09:19:00Z",
      },
    });
    expect(state.queries?.find((q) => q.id === "qry_manual_1")?.status).toBe(
      "Cancelled"
    );
  });

  it("is clock-free and deterministic: reducing the same action twice yields deep-equal results across every action type", () => {
    const engineSource = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../lib/crf/internal/edc-simulation-engine.ts"
      ),
      "utf-8"
    );
    expect(engineSource).not.toMatch(/\bnew\s+Date\b/);
    expect(engineSource).not.toMatch(/\bDate\.now\b/);
    expect(engineSource).not.toMatch(/\brandomUUID\b/);
    expect(engineSource).not.toMatch(/\bMath\.random\b/);
    expect(engineSource).not.toMatch(/\bgenerateId\b/);

    const study = getOncologyPresetSync();
    const visitId = study.visits[0]!.id;
    const vsForm = study.forms.find((f) => f.domain === "VS")!;
    const vsFields = vsForm.sections.flatMap((s) => s.fields);
    const sysbp = vsFields.find((f) => f.variableName === "SYSBP")!;
    const resp = vsFields.find((f) => f.variableName === "RESP")!;

    const reduceTwiceAndAssertEqual = (
      currentState: StudyProtocol["simulationState"],
      action: EdcSimulationAction
    ) => {
      const first = reduceEdcSimulationState(study, currentState, action);
      const second = reduceEdcSimulationState(study, currentState, action);
      expect(first).toEqual(second);
      return first;
    };

    let state = reduceTwiceAndAssertEqual(undefined, {
      type: "SEED_SIMULATION",
      timestamp: "2026-08-15T08:30:00Z",
    });

    state = reduceTwiceAndAssertEqual(state, {
      type: "UPDATE_FIELD_VALUE",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      fieldId: sysbp.id,
      value: 210,
      role: "Site Coordinator",
      reasonForChange: "Elevated reading confirmed",
      timestamp: "2026-08-15T09:00:00Z",
    });

    if (resp && resp.maxValue !== undefined) {
      state = reduceTwiceAndAssertEqual(state, {
        type: "UPDATE_FIELD_VALUE",
        subjectId: "001-101",
        visitId,
        formId: vsForm.id,
        fieldId: resp.id,
        value: resp.maxValue + 20,
        role: "Site Coordinator",
        timestamp: "2026-08-15T09:01:00Z",
      });
    }

    const valFirst = validateEdcFormSubmission(
      study,
      vsForm,
      "001-101",
      visitId,
      state.formValues || {},
      "2026-08-15T09:02:00Z"
    );
    const valSecond = validateEdcFormSubmission(
      study,
      vsForm,
      "001-101",
      visitId,
      state.formValues || {},
      "2026-08-15T09:02:00Z"
    );
    expect(valFirst).toEqual(valSecond);

    state = reduceTwiceAndAssertEqual(state, {
      type: "SAVE_FORM",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      role: "Site Coordinator",
      timestamp: "2026-08-15T09:02:00Z",
    });

    state = reduceTwiceAndAssertEqual(state, {
      type: "TOGGLE_SDV",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      fieldId: sysbp.id,
      fieldName: "SYSBP",
      role: "CRA Monitor",
      timestamp: "2026-08-15T09:05:00Z",
    });

    state = reduceTwiceAndAssertEqual(state, {
      type: "LOCK_FORM",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      role: "Principal Investigator",
      timestamp: "2026-08-15T09:10:00Z",
    });
    expect(state.signatures?.[0]?.digest).toMatch(/^sim_[0-9a-f]{12}$/);
    expect(state.signatures?.[0]?.digest).not.toMatch(/sha/i);

    state = reduceTwiceAndAssertEqual(state, {
      type: "UNLOCK_FORM",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      role: "Principal Investigator",
      reasonForChange: "Amend post-reconciliation vitals",
      timestamp: "2026-08-15T09:15:00Z",
    });

    state = reduceTwiceAndAssertEqual(state, {
      type: "RAISE_QUERY",
      input: {
        subjectId: "001-101",
        visitId,
        formId: vsForm.id,
        fieldId: sysbp.id,
        fieldName: "SYSBP",
        severity: "warning",
        message: "Verify supine vs seated measurement",
        actor: "",
        userRole: "CRA Monitor",
        timestamp: "2026-08-15T09:20:00Z",
      },
    });
    const raisedQueryId = state.queries?.[0]?.id;
    expect(raisedQueryId).toMatch(/^q_man_[0-9a-f]{12}$/);

    state = reduceTwiceAndAssertEqual(state, {
      type: "ANSWER_QUERY",
      input: {
        queryId: raisedQueryId!,
        response: "Seated measurement after 5 min rest",
        actor: "",
        userRole: "Site Coordinator",
        timestamp: "2026-08-15T09:25:00Z",
      },
    });

    state = reduceTwiceAndAssertEqual(state, {
      type: "CLOSE_QUERY",
      input: {
        queryId: raisedQueryId!,
        actor: "",
        userRole: "Data Manager",
        resolutionReason: "Confirmed",
        timestamp: "2026-08-15T09:30:00Z",
      },
    });

    state = reduceTwiceAndAssertEqual(state, {
      type: "REOPEN_QUERY",
      input: {
        queryId: raisedQueryId!,
        actor: "",
        userRole: "CRA Monitor",
        reason: "Need arm cuff size",
        timestamp: "2026-08-15T09:35:00Z",
      },
    });

    state = reduceTwiceAndAssertEqual(state, {
      type: "CANCEL_QUERY",
      input: {
        queryId: raisedQueryId!,
        actor: "",
        userRole: "Data Manager",
        resolutionReason: "Resolved in separate note",
        timestamp: "2026-08-15T09:40:00Z",
      },
    });

    // Ensure every audit entry ID in the accumulated log is unique
    const auditIds = (state.auditLog || []).map((a) => a.id);
    expect(new Set(auditIds).size).toBe(auditIds.length);

    // Verify stampEdcSimulationAction and StudyProtocolEngine.dispatchSimulationAction stamp once
    const stamped = stampEdcSimulationAction(
      {
        type: "LOCK_FORM",
        subjectId: "001-101",
        visitId,
        formId: vsForm.id,
        role: "Principal Investigator",
      },
      "2026-08-15T10:00:00Z"
    );
    expect(stamped).toEqual({
      type: "LOCK_FORM",
      subjectId: "001-101",
      visitId,
      formId: vsForm.id,
      role: "Principal Investigator",
      timestamp: "2026-08-15T10:00:00Z",
    });

    const d1 = StudyProtocolEngine.dispatchSimulationAction(
      study,
      {
        type: "LOCK_FORM",
        subjectId: "001-101",
        visitId,
        formId: vsForm.id,
        role: "Principal Investigator",
      },
      "2026-08-15T10:00:00Z"
    );
    const d2 = StudyProtocolEngine.dispatchSimulationAction(
      study,
      {
        type: "LOCK_FORM",
        subjectId: "001-101",
        visitId,
        formId: vsForm.id,
        role: "Principal Investigator",
      },
      "2026-08-15T10:00:00Z"
    );
    expect(d1.simulationState).toEqual(d2.simulationState);
  });
});
