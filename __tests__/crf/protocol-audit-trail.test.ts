import { describe, it, expect } from "vitest";
import { StudyProtocolEngine } from "@/lib/crf/study-engine";
import { StudyAuditor } from "@/lib/crf/study-auditor";
import {
  exportUniversalCrfJson,
  exportUniversalCrfYaml,
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
