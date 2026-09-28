import { describe, it, expect } from "vitest";
import {
  StudyProtocolEngine,
  appendProtocolAuditEntry,
} from "@/lib/crf/study-engine";
import { StudyAuditor } from "@/lib/crf/study-auditor";
import {
  exportUniversalCrfJson,
  exportUniversalCrfYaml,
  validateUniversalCrf,
  parseUniversalCrf,
} from "@/lib/crf/universal-schema";
import { exportStudyToCdiscOdmXml } from "@/lib/crf/odm-xml-serializer";
import type { StudyProtocol } from "@/lib/crf/types";

function createMockStudy(): StudyProtocol {
  return {
    id: "study_test_101",
    protocolNumber: "TEST-2026-001",
    studyName: "Test Audit Protocol",
    phase: "Phase III",
    sponsor: "Test Sponsor",
    therapeuticArea: "Oncology",
    version: "1.0",
    lastModified: new Date().toISOString(),
    forms: [
      {
        id: "form_dm",
        name: "Demographics",
        domain: "DM",
        description: "Demographics Data",
        version: "1.0",
        sections: [
          {
            id: "sec_dm_gen",
            title: "General",
            fields: [
              {
                id: "fld_age",
                variableName: "AGE",
                label: "Subject Age",
                dataType: "integer",
                required: true,
                columnSpan: 6,
              },
            ],
          },
        ],
        rules: [],
      },
    ],
    visits: [
      {
        id: "vis_screening",
        oid: "SE.SCREENING",
        name: "Screening",
        visitType: "Scheduled",
        targetDay: 0,
        windowBefore: 0,
        windowAfter: 0,
        assignedFormIds: ["form_dm"],
      },
    ],
    codelists: [],
    auditTrail: [],
  };
}

describe("Functional Audit Middleware and Protocol Audit Log Integration", () => {
  it("Requirement 1: StudyProtocol supports append-only auditTrail property", () => {
    const study = createMockStudy();
    expect(study.auditTrail).toBeDefined();
    expect(Array.isArray(study.auditTrail)).toBe(true);
    expect(study.auditTrail).toHaveLength(0);
  });

  it("Requirement 3 & Acceptance Criterion 2: StudyProtocolEngine.addForm appends FORM_CREATE audit entry", () => {
    const study = createMockStudy();
    const actor = { name: "Dr. Alice Smith", role: "Data Manager" as const };

    const { study: updatedStudy, form } = StudyProtocolEngine.addForm(
      study,
      "VS",
      "Vital Signs",
      actor
    );

    expect(updatedStudy.auditTrail).toBeDefined();
    expect(updatedStudy.auditTrail!.length).toBe(1);

    const entry = updatedStudy.auditTrail![0];
    expect(entry.actionType).toBe("FORM_CREATE");
    expect(entry.targetId).toBe(form.id);
    expect(entry.formId).toBe(form.id);
    expect(entry.changedBy).toBe("Dr. Alice Smith");
    expect(entry.userRole).toBe("Data Manager");
    expect(entry.timestamp).toBeTruthy();
  });

  it("Requirement 3: StudyProtocolEngine.removeForm appends FORM_REMOVE audit entry", () => {
    const study = createMockStudy();
    const actor = "Clara Monitor";

    const { study: updatedStudy, removedForm } = StudyProtocolEngine.removeForm(
      study,
      "form_dm",
      actor
    );

    expect(removedForm?.id).toBe("form_dm");
    expect(updatedStudy.auditTrail!.length).toBe(1);

    const entry = updatedStudy.auditTrail![0];
    expect(entry.actionType).toBe("FORM_REMOVE");
    expect(entry.targetId).toBe("form_dm");
    expect(entry.changedBy).toBe("Clara Monitor");
  });

  it("Requirement 3: StudyProtocolEngine.insertField & addField append FIELD_INSERT audit entries", () => {
    const study = createMockStudy();
    const actor = { name: "Bob Bio", role: "Biostatistician" as const };

    const { study: studyWithField, field } = StudyProtocolEngine.insertField(
      study,
      "form_dm",
      {
        variableName: "SEX",
        label: "Sex at Birth",
        dataType: "single_select",
      },
      { actor }
    );

    expect(field).toBeDefined();
    expect(studyWithField.auditTrail!.length).toBe(1);

    const entry = studyWithField.auditTrail![0];
    expect(entry.actionType).toBe("FIELD_INSERT");
    expect(entry.fieldName).toBe("SEX");
    expect(entry.changedBy).toBe("Bob Bio");
  });

  it("Requirement 3 & Acceptance Criterion 3: StudyProtocolEngine.updateField logs field-level previous and updated values", () => {
    const study = createMockStudy();
    const actor = {
      name: "Sarah Investigator",
      role: "Principal Investigator" as const,
    };

    const { study: updatedStudy } = StudyProtocolEngine.updateField(
      study,
      "form_dm",
      "fld_age",
      { label: "Updated Subject Age Label", required: false },
      actor
    );

    expect(updatedStudy.auditTrail!.length).toBe(1);

    const entry = updatedStudy.auditTrail![0];
    expect(entry.actionType).toBe("FIELD_UPDATE");
    expect(entry.targetId).toBe("fld_age");
    expect(entry.fieldName).toBe("AGE");
    expect(entry.previousValue).toBeDefined();
    expect(entry.newValue).toBeDefined();
    expect((entry.newValue as Record<string, unknown>).label).toBe(
      "Updated Subject Age Label"
    );
    expect(entry.changedBy).toBe("Sarah Investigator");
  });

  it("Requirement 4 & Acceptance Criterion 4: StudyAuditor.applyAutoFix appends AUTO_FIX system audit entry", () => {
    const study = createMockStudy();
    // Intentionally add an unassigned form to trigger a fixable diagnostic
    const { study: studyWithUnassigned } = StudyProtocolEngine.addForm(
      study,
      "AE",
      "Adverse Events"
    );

    const report = StudyAuditor.audit(studyWithUnassigned);
    const fixable = report.diagnostics.find((d) => d.autoFixAvailable);

    expect(fixable).toBeDefined();

    if (fixable) {
      const fixedStudy = StudyAuditor.applyAutoFix(
        studyWithUnassigned,
        fixable.id
      );

      // Previous audit trail (1 for addForm) + 1 for applyAutoFix = 2
      expect(fixedStudy.auditTrail!.length).toBe(2);

      const autoFixEntry = fixedStudy.auditTrail![1];
      expect(autoFixEntry.actionType).toBe("AUTO_FIX");
      expect(autoFixEntry.diagnosticId).toBe(fixable.id);
      expect(autoFixEntry.changedBy).toBe("System Auditor");
    }
  });

  it("Requirement 5 & Acceptance Criterion 5: Exports (JSON, YAML, ODM-XML) and imports retain audit trail history", () => {
    let study = createMockStudy();
    const res1 = StudyProtocolEngine.addForm(
      study,
      "VS",
      "Vital Signs",
      "User A"
    );
    study = res1.study;

    const res2 = StudyProtocolEngine.updateField(
      study,
      "form_dm",
      "fld_age",
      { label: "Age at Baseline" },
      "User B"
    );
    study = res2.study;

    expect(study.auditTrail!.length).toBe(2);

    // 1. JSON Export & Import
    const jsonOutput = exportUniversalCrfJson(study);
    expect(jsonOutput).toContain('"auditTrail"');
    expect(jsonOutput).toContain('"FORM_CREATE"');
    expect(jsonOutput).toContain('"FIELD_UPDATE"');

    const importedFromJson = parseUniversalCrf(jsonOutput);
    expect(importedFromJson.auditTrail).toBeDefined();
    expect(importedFromJson.auditTrail!.length).toBe(2);

    // 2. YAML Export
    const yamlOutput = exportUniversalCrfYaml(study);
    expect(yamlOutput).toContain("auditTrail:");
    expect(yamlOutput).toContain("FORM_CREATE");

    // 3. ODM-XML Export
    const xmlOutput = exportStudyToCdiscOdmXml(study);
    expect(xmlOutput).toContain("<AuditTrail>");
    expect(xmlOutput).toContain("<AuditRecord");
    expect(xmlOutput).toContain("FORM_CREATE");
    expect(xmlOutput).toContain("User A");
    expect(xmlOutput).toContain("<PreviousValue>");
    expect(xmlOutput).toContain("<NewValue>");
  });

  it("Regression: prevents reference retention and historical entry mutation when caller objects or live fields are mutated later", () => {
    let study = createMockStudy();

    const callerPrevious = { nested: { value: "original_previous" } };
    const callerNew = { nested: { value: "original_new" } };
    const callerDetails = { note: "original_note" };

    // 1. Direct appendProtocolAuditEntry with nested objects
    study = appendProtocolAuditEntry(study, {
      actionType: "CUSTOM_TEST",
      previousValue: callerPrevious,
      newValue: callerNew,
      details: callerDetails,
    });

    // Mutate caller input objects
    callerPrevious.nested.value = "changed_later_previous";
    callerNew.nested.value = "changed_later_new";
    callerDetails.note = "changed_later_note";

    // Historical entry in auditTrail must NOT reflect the post-mutation changes
    const customEntry = study.auditTrail![study.auditTrail!.length - 1];
    const prevObj = customEntry.previousValue as Record<
      string,
      Record<string, unknown>
    >;
    const newObj = customEntry.newValue as Record<
      string,
      Record<string, unknown>
    >;
    const detailsObj = customEntry.details as Record<string, unknown>;

    expect(prevObj.nested.value).toBe("original_previous");
    expect(newObj.nested.value).toBe("original_new");
    expect(detailsObj.note).toBe("original_note");

    // 2. Engine updateField mutation test
    const { study: updatedStudy, field: liveField } =
      StudyProtocolEngine.updateField(
        study,
        "form_dm",
        "fld_age",
        { label: "Label Before Mutation" },
        "Investigator"
      );

    expect(liveField).toBeDefined();

    // Mutate the live returned field object
    liveField!.label = "MUTATED_AFTER_UPDATE";
    liveField!.variableName = "MUTATED_VAR";

    const updateEntry =
      updatedStudy.auditTrail![updatedStudy.auditTrail!.length - 1];
    const updateNewValue = updateEntry.newValue as Record<string, unknown>;
    expect(updateNewValue.label).toBe("Label Before Mutation");
    expect(updateNewValue.variableName).toBe("AGE");
  });

  it("Lossless ODM XML export preserves PreviousValue, NewValue, DiagnosticID, and Details elements", () => {
    let study = createMockStudy();

    study = appendProtocolAuditEntry(study, {
      actionType: "AUTO_FIX",
      diagnosticId: "DIAG-1001",
      previousValue: { state: "old_val" },
      newValue: { state: "new_val" },
      reasonForChange: "Auto fix unassigned form",
      details: { resolution: "Assigned to Screening visit" },
    });

    const xmlOutput = exportStudyToCdiscOdmXml(study);
    expect(xmlOutput).toContain("<DiagnosticID>DIAG-1001</DiagnosticID>");
    expect(xmlOutput).toContain(
      "<PreviousValue>{&quot;state&quot;:&quot;old_val&quot;}</PreviousValue>"
    );
    expect(xmlOutput).toContain(
      "<NewValue>{&quot;state&quot;:&quot;new_val&quot;}</NewValue>"
    );
    expect(xmlOutput).toContain(
      "<Details>{&quot;resolution&quot;:&quot;Assigned to Screening visit&quot;}</Details>"
    );
  });

  it("Reconciles audit contract to support both scalar-valued (EDC simulation) and object snapshot audit entries", () => {
    // 1. Scalar-valued EDC simulation style audit entry
    const scalarEntry = {
      id: "aud_edc_1",
      timestamp: new Date().toISOString(),
      subjectId: "SUBJ-001",
      formId: "form_dm",
      fieldId: "fld_age",
      fieldName: "AGE",
      previousValue: 25,
      newValue: 26,
      changedBy: "Dr. Smith",
      userRole: "Site Coordinator",
      reasonForChange: "Subject birthday correction",
    };

    // 2. Object snapshot protocol engine audit entry
    const objectEntry = {
      id: "aud_engine_1",
      timestamp: new Date().toISOString(),
      actionType: "FIELD_UPDATE",
      targetId: "fld_age",
      subjectId: "PROTOCOL",
      formId: "form_dm",
      fieldId: "fld_age",
      fieldName: "AGE",
      previousValue: { label: "Old Age Label", required: true },
      newValue: { label: "New Age Label", required: false },
      changedBy: "System Auditor",
      reasonForChange: "Label update",
      diagnosticId: "DIAG-999",
      details: { automated: true },
    };

    const studyWithBoth = {
      ...createMockStudy(),
      auditTrail: [scalarEntry, objectEntry],
    };

    const validation = validateUniversalCrf(studyWithBoth);
    expect(validation.success).toBe(true);

    const parsed = parseUniversalCrf(studyWithBoth);
    expect(parsed.auditTrail).toHaveLength(2);

    expect(parsed.auditTrail![0].previousValue).toBe(25);
    expect(parsed.auditTrail![0].newValue).toBe(26);

    const parsedPrev = parsed.auditTrail![1].previousValue as Record<
      string,
      unknown
    >;
    const parsedNew = parsed.auditTrail![1].newValue as Record<string, unknown>;
    const parsedDetails = parsed.auditTrail![1].details as Record<
      string,
      unknown
    >;

    expect(parsedPrev.label).toBe("Old Age Label");
    expect(parsedNew.label).toBe("New Age Label");
    expect(parsed.auditTrail![1].diagnosticId).toBe("DIAG-999");
    expect(parsedDetails.automated).toBe(true);
  });

  it("Enforces strict append-only semantics across multiple mutations", () => {
    let study = createMockStudy();
    expect(study.auditTrail?.length || 0).toBe(0);

    study = StudyProtocolEngine.addForm(study, "LB", "Laboratory").study;
    expect(study.auditTrail!.length).toBe(1);

    study = StudyProtocolEngine.addField(study, "LB", {
      variableName: "LBTEST",
      label: "Lab Test Name",
      dataType: "text",
    }).study;
    expect(study.auditTrail!.length).toBe(2);

    study = StudyProtocolEngine.updateField(study, "LB", "LBTEST", {
      required: true,
    }).study;
    expect(study.auditTrail!.length).toBe(3);

    // Verify chronological order and distinct IDs
    const ids = study.auditTrail!.map((e) => e.id);
    expect(new Set(ids).size).toBe(3);
    expect(study.auditTrail![0].actionType).toBe("FORM_CREATE");
    expect(study.auditTrail![1].actionType).toBe("FIELD_INSERT");
    expect(study.auditTrail![2].actionType).toBe("FIELD_UPDATE");
  });
});
