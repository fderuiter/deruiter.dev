// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  StudyProtocolEngine,
  UniversalStudyProtocolSchema,
  exportStudyToCdiscOdmXml,
  importStudyFromCdiscOdmXml,
  exportStudyToSas,
  exportStudyToR,
  formatRfc4180Csv,
  parseRfc4180Csv,
  detectClinicalCsvKind,
} from "@/lib/crf";
import { STUDY_PRESETS } from "@/lib/crf/presets";
import type { EdcSimulationState, StudyProtocol } from "@/lib/crf/types";
import { STANDARDS_BOM_SPECS } from "@/lib/clinical-standards";
import {
  checkRegulatoryWording,
  findClinicalClaims,
} from "@/lib/clinical-platform";
import { validateOdmXml } from "../helpers/odm-xml-schema";

/**
 * Builds a rich simulated EDC dataset tailored to each preset's visits, forms,
 * and fields so ODM 1.3.2 XSD validation and round-trip parsing exercise all
 * 6 presets in STUDY_PRESETS.
 */
function buildPopulatedSimulationState(
  study: StudyProtocol
): EdcSimulationState {
  const visit = study.visits[0]!;
  const form =
    study.forms.find((f) => visit.assignedFormIds.includes(f.id)) ??
    study.forms[0]!;
  const allFields = form.sections.flatMap((s) => s.fields);
  const firstField = allFields[0]!;
  const secondField = allFields[1] ?? firstField;

  const sampleValueFor = (
    field: typeof firstField,
    variant: 0 | 1
  ): string | number | boolean => {
    if (field.dataType === "number" || field.dataType === "integer") {
      return variant === 0 ? 48 : 61;
    }
    if (field.dataType === "checkbox") {
      return variant === 0;
    }
    if (field.dataType === "date") {
      return variant === 0 ? "2026-08-15" : "2026-09-02";
    }
    if (
      field.dataType === "partial_date" ||
      field.dataType === "precision_date"
    ) {
      return variant === 0 ? "2026-08" : "2026-09-02";
    }
    if (field.dataType === "datetime") {
      return variant === 0 ? "2026-08-15T08:30:00Z" : "2026-09-02T10:15:00Z";
    }
    if (field.dataType === "time") {
      return variant === 0 ? "08:30:00" : "10:15:00";
    }
    if (field.codelistId && study.codelists) {
      const cl = study.codelists.find((c) => c.id === field.codelistId);
      if (cl && cl.options.length > 0) {
        return cl.options[variant % cl.options.length]!.code;
      }
    }
    return variant === 0 ? "Baseline observation" : "Follow-up note, verified";
  };

  const subj1 = "001-101";
  const subj2 = "SUBJ_202";
  const key1 = `${subj1}_${visit.id}_${firstField.id}`;
  const key1b = `${subj1}_${visit.id}_${secondField.id}`;
  const key2 = `${subj2}_${visit.id}_${firstField.id}`;

  return {
    availableSubjects: [subj1, subj2],
    formValues: {
      [key1]: sampleValueFor(firstField, 0),
      [key1b]: sampleValueFor(secondField, 1),
      [key2]: sampleValueFor(firstField, 1),
    },
    sdvMap: {
      [key1]: {
        verified: true,
        timestamp: "2026-08-16T09:00:00Z",
        auditedBy: "M. Vance, CRA (Monitor)",
      },
    },
    lockedForms: {
      [`${subj1}_${visit.id}_${form.id}`]: {
        locked: true,
        lockedBy: "Dr. A. Patel, MD (PI)",
        timestamp: "2026-08-16T11:30:00Z",
      },
    },
    queries: [
      {
        id: "qry_closed_1",
        subjectId: subj1,
        visitId: visit.id,
        formId: form.id,
        fieldId: firstField.id,
        fieldName: firstField.variableName || firstField.label,
        severity: "warning",
        status: "Closed",
        message: "Confirm baseline source chart value.",
        raisedBy: "M. Vance, CRA (Monitor)",
        raisedAt: "2026-08-15T12:00:00Z",
        respondedBy: "S. Jenkins, RN (Site 001)",
        respondedAt: "2026-08-15T14:00:00Z",
        response: "Verified against source chart page 4.",
        resolvedBy: "M. Vance, CRA (Monitor)",
        resolvedAt: "2026-08-16T09:05:00Z",
        resolutionReason: "Source document matches recorded value",
      },
      {
        id: "qry_open_2",
        subjectId: subj2,
        visitId: visit.id,
        formId: form.id,
        fieldId: firstField.id,
        fieldName: firstField.variableName || firstField.label,
        severity: "error",
        status: "Open",
        message: "Please clarify outlier reading.",
        raisedBy: "K. Lin, CCDM (Data Manager)",
        raisedAt: "2026-08-17T10:00:00Z",
      },
    ],
    auditLog: [
      {
        id: "aud_entry_1",
        timestamp: "2026-08-15T08:30:00Z",
        subjectId: subj1,
        formId: form.id,
        fieldId: firstField.id,
        fieldName: firstField.variableName || firstField.label,
        previousValue: null,
        newValue: sampleValueFor(firstField, 0),
        changedBy: "S. Jenkins, RN (Site 001)",
        userRole: "Site Coordinator",
        reasonForChange: "Initial baseline entry",
      },
      {
        id: "aud_entry_2",
        timestamp: "2026-08-15T09:15:00Z",
        subjectId: subj2,
        formId: form.id,
        fieldId: firstField.id,
        fieldName: firstField.variableName || firstField.label,
        previousValue: "Draft",
        newValue: sampleValueFor(firstField, 1),
        changedBy: "Dr. A. Patel, MD (PI)",
        userRole: "Principal Investigator",
        reasonForChange: "Investigator chart reconciliation",
      },
    ],
    signatures: [
      {
        id: "sig_pi_1",
        subjectId: subj1,
        formId: form.id,
        visitId: visit.id,
        signedBy: "Dr. A. Patel, MD (PI)",
        userRole: "Principal Investigator",
        meaning: "Investigator Approval",
        timestamp: "2026-08-16T11:30:00Z",
        digest: "sim-sig-9f8e7d6c5b4a",
      },
    ],
  };
}

describe("Bidirectional ODM 1.3.2 ClinicalData, EDC query lifecycle, live SAS/R, and CSV exchange", () => {
  it("validates all 6 STUDY_PRESETS against plain ODM 1.3.2 XSD when simulationState holds subjects, audits, queries, and signatures", async () => {
    expect(STUDY_PRESETS.length).toBe(6);

    const documents = Object.fromEntries(
      STUDY_PRESETS.map((preset) => {
        const sim = buildPopulatedSimulationState(preset.study);
        const xml = exportStudyToCdiscOdmXml({
          ...preset.study,
          auditTrail: [],
          simulationState: sim,
        });
        return [preset.id, xml];
      })
    );

    for (const [id, xml] of Object.entries(documents)) {
      expect(xml, id).toContain("<AdminData");
      expect(xml, id).toContain("<ClinicalData");
      expect(xml, id).toContain("<SubjectData");
      expect(xml, id).toContain("<AuditRecords>");
      expect(xml, id).toContain("<Signatures>");
      expect(xml, id).toContain("<Annotations>");
    }

    const errors = await validateOdmXml(documents, "odm-1.3.2");
    for (const [id, list] of Object.entries(errors)) {
      expect(list, id).toEqual([]);
    }
  });

  it("round-trips availableSubjects, formValues, auditLog, signatures, and queries through importStudyFromCdiscOdmXml across all 6 presets", () => {
    for (const preset of STUDY_PRESETS) {
      const sim = buildPopulatedSimulationState(preset.study);
      const xml = exportStudyToCdiscOdmXml({
        ...preset.study,
        auditTrail: [],
        simulationState: sim,
      });

      const restored = importStudyFromCdiscOdmXml(xml);
      const restoredSim = restored.simulationState;
      expect(restoredSim, preset.id).toBeDefined();

      expect(restoredSim?.availableSubjects, preset.id).toEqual(
        sim.availableSubjects
      );
      expect(restoredSim?.formValues, preset.id).toEqual(sim.formValues);

      expect(restoredSim?.auditLog?.length, preset.id).toBe(
        sim.auditLog?.length
      );
      const restoredFirstAudit = restoredSim?.auditLog?.find(
        (a) => a.subjectId === "001-101"
      );
      expect(restoredFirstAudit, preset.id).toMatchObject({
        subjectId: "001-101",
        changedBy: "S. Jenkins, RN (Site 001)",
        userRole: "Site Coordinator",
        reasonForChange: "Initial baseline entry",
      });

      expect(restoredSim?.signatures?.length, preset.id).toBe(1);
      expect(restoredSim?.signatures?.[0], preset.id).toMatchObject({
        subjectId: "001-101",
        signedBy: "Dr. A. Patel, MD (PI)",
        userRole: "Principal Investigator",
        digest: "sim-sig-9f8e7d6c5b4a",
      });

      expect(restoredSim?.queries?.length, preset.id).toBe(2);
      const closedQuery = restoredSim?.queries?.find(
        (q) => q.status === "Closed"
      );
      expect(closedQuery, preset.id).toMatchObject({
        subjectId: "001-101",
        status: "Closed",
        severity: "warning",
        message: "Confirm baseline source chart value.",
        response: "Verified against source chart page 4.",
        resolvedBy: "M. Vance, CRA (Monitor)",
        resolvedAt: "2026-08-16T09:05:00Z",
        resolutionReason: "Source document matches recorded value",
      });
    }
  });

  it("imports external plain ODM 1.3.2 ClinicalData and AdminData without CRF Studio aliases", async () => {
    const externalOdm = `<?xml version="1.0" encoding="UTF-8"?>
<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3" ODMVersion="1.3.2" FileType="Snapshot" FileOID="EXT-ODM-1" CreationDateTime="2026-10-12T10:00:00Z">
  <Study OID="ST.EXT">
    <GlobalVariables>
      <StudyName>External Trial</StudyName>
      <StudyDescription>External EDC ODM snapshot</StudyDescription>
      <ProtocolName>EXT-001</ProtocolName>
    </GlobalVariables>
    <MetaDataVersion OID="MDV.EXT.1" Name="v1.0">
      <Protocol>
        <StudyEventRef StudyEventOID="SE.SCRN" Mandatory="Yes"/>
      </Protocol>
      <StudyEventDef OID="SE.SCRN" Name="Screening" Repeating="No" Type="Scheduled">
        <FormRef FormOID="FR.VS" Mandatory="Yes"/>
      </StudyEventDef>
      <FormDef OID="FR.VS" Name="Vital Signs" Repeating="No">
        <ItemGroupRef ItemGroupOID="IG.VS" Mandatory="Yes"/>
      </FormDef>
      <ItemGroupDef OID="IG.VS" Name="Vital Signs Section" Repeating="No" Domain="VS">
        <ItemRef ItemOID="IT.VS.SYSBP" Mandatory="Yes"/>
      </ItemGroupDef>
      <ItemDef OID="IT.VS.SYSBP" Name="SYSBP" DataType="integer" SDSVarName="VSORRES">
        <Description><TranslatedText>Systolic Blood Pressure</TranslatedText></Description>
      </ItemDef>
    </MetaDataVersion>
  </Study>
  <AdminData StudyOID="ST.EXT">
    <User OID="USR.1" UserType="Investigator">
      <FullName>Dr. Alice Rivera</FullName>
    </User>
    <Location OID="LOC.SITE1" Name="Site 01" LocationType="Site">
      <MetaDataVersionRef StudyOID="ST.EXT" MetaDataVersionOID="MDV.EXT.1" EffectiveDate="2026-10-01"/>
    </Location>
    <SignatureDef OID="SD.PI" Methodology="Electronic">
      <Meaning>Investigator form review (simulated, not a validated system)</Meaning>
      <LegalReason>Simulated review record</LegalReason>
    </SignatureDef>
  </AdminData>
  <ClinicalData StudyOID="ST.EXT" MetaDataVersionOID="MDV.EXT.1">
    <SubjectData SubjectKey="EXT-SUBJ-01">
      <StudyEventData StudyEventOID="SE.SCRN">
        <FormData FormOID="FR.VS">
          <Signature>
            <UserRef UserOID="USR.1"/>
            <LocationRef LocationOID="LOC.SITE1"/>
            <SignatureRef SignatureOID="SD.PI"/>
            <DateTimeStamp>2026-10-12T09:30:00Z</DateTimeStamp>
          </Signature>
          <ItemGroupData ItemGroupOID="IG.VS">
            <ItemData ItemOID="IT.VS.SYSBP" Value="128">
              <AuditRecord>
                <UserRef UserOID="USR.1"/>
                <LocationRef LocationOID="LOC.SITE1"/>
                <DateTimeStamp>2026-10-12T09:15:00Z</DateTimeStamp>
                <ReasonForChange>Initial chart capture</ReasonForChange>
              </AuditRecord>
            </ItemData>
          </ItemGroupData>
        </FormData>
      </StudyEventData>
    </SubjectData>
  </ClinicalData>
</ODM>`;

    const xsdErrors = await validateOdmXml({ externalOdm }, "odm-1.3.2");
    expect(xsdErrors.externalOdm).toEqual([]);

    const imported = importStudyFromCdiscOdmXml(externalOdm);
    expect(imported.simulationState?.availableSubjects).toEqual([
      "EXT-SUBJ-01",
    ]);
    const visitId = imported.visits[0]!.id;
    const fieldId = imported.forms[0]!.sections[0]!.fields[0]!.id;
    expect(
      imported.simulationState?.formValues?.[
        `EXT-SUBJ-01_${visitId}_${fieldId}`
      ]
    ).toBe(128);
    expect(imported.simulationState?.signatures?.[0]?.signedBy).toBe(
      "Dr. Alice Rivera"
    );
    expect(imported.simulationState?.auditLog?.[0]?.changedBy).toBe(
      "Dr. Alice Rivera"
    );
  });

  it("supports pure StudyProtocolEngine query lifecycle transitions and schema validation", () => {
    const baseStudy = STUDY_PRESETS[0]!.study;
    const visit = baseStudy.visits[0]!;
    const form = baseStudy.forms[0]!;
    const field = form.sections[0]!.fields[0]!;

    const raised = StudyProtocolEngine.raiseQuery(baseStudy, {
      id: "qry_lifecycle_1",
      subjectId: "001-101",
      visitId: visit.id,
      formId: form.id,
      fieldId: field.id,
      fieldName: field.variableName,
      severity: "warning",
      message: "Verify date against lab requisition.",
      actor: "M. Vance, CRA (Monitor)",
      userRole: "CRA Monitor",
      timestamp: "2026-09-01T10:00:00Z",
    });

    expect(raised.simulationState?.queries).toHaveLength(1);
    expect(raised.simulationState?.queries?.[0]?.status).toBe("Open");
    expect(raised.simulationState?.auditLog?.[0]).toMatchObject({
      changedBy: "M. Vance, CRA (Monitor)",
      userRole: "CRA Monitor",
      newValue: "Open",
    });

    // Answering query
    const answered = StudyProtocolEngine.answerQuery(raised, {
      queryId: "qry_lifecycle_1",
      response: "Lab requisition confirms 2026-08-15.",
      actor: "Dr. A. Patel, MD (PI)",
      userRole: "Principal Investigator",
      timestamp: "2026-09-01T11:00:00Z",
    });
    expect(answered.simulationState?.queries?.[0]).toMatchObject({
      status: "Answered",
      respondedBy: "Dr. A. Patel, MD (PI)",
      response: "Lab requisition confirms 2026-08-15.",
    });
    expect(answered.simulationState?.auditLog?.[0]).toMatchObject({
      userRole: "Principal Investigator",
      previousValue: "Open",
      newValue: "Answered",
    });

    // Reopening answered query
    const reopened = StudyProtocolEngine.reopenQuery(answered, {
      queryId: "qry_lifecycle_1",
      actor: "K. Lin, CCDM (Data Manager)",
      userRole: "Data Manager",
      reason: "Please attach lab accession ID",
      timestamp: "2026-09-01T12:00:00Z",
    });
    expect(reopened.simulationState?.queries?.[0]?.status).toBe("Open");
    expect(reopened.simulationState?.auditLog?.[0]).toMatchObject({
      userRole: "Data Manager",
      previousValue: "Answered",
      newValue: "Open",
    });

    // Re-answering and closing
    const reanswered = StudyProtocolEngine.answerQuery(reopened, {
      queryId: "qry_lifecycle_1",
      response: "Accession ID LAB-88412 verified.",
      actor: "S. Jenkins, RN (Site 001)",
      userRole: "Site Coordinator",
      timestamp: "2026-09-01T13:00:00Z",
    });

    const closed = StudyProtocolEngine.closeQuery(reanswered, {
      queryId: "qry_lifecycle_1",
      actor: "K. Lin, CCDM (Data Manager)",
      userRole: "Data Manager",
      resolutionReason: "Accession ID confirmed in central lab feed",
      timestamp: "2026-09-01T14:00:00Z",
    });
    expect(closed.simulationState?.queries?.[0]).toMatchObject({
      status: "Closed",
      resolvedBy: "K. Lin, CCDM (Data Manager)",
      resolvedAt: "2026-09-01T14:00:00Z",
      resolutionReason: "Accession ID confirmed in central lab feed",
    });

    // Cancelling a second open query
    const withSecond = StudyProtocolEngine.raiseQuery(closed, {
      id: "qry_lifecycle_2",
      subjectId: "001-101",
      visitId: visit.id,
      formId: form.id,
      fieldId: field.id,
      fieldName: field.variableName,
      severity: "info",
      message: "Duplicate check raised in error.",
      actor: "M. Vance, CRA (Monitor)",
      userRole: "CRA Monitor",
      timestamp: "2026-09-01T15:00:00Z",
    });
    const cancelled = StudyProtocolEngine.cancelQuery(withSecond, {
      queryId: "qry_lifecycle_2",
      actor: "M. Vance, CRA (Monitor)",
      userRole: "CRA Monitor",
      resolutionReason: "Raised on wrong visit",
      timestamp: "2026-09-01T15:05:00Z",
    });
    const cancelledQuery = cancelled.simulationState?.queries?.find(
      (q) => q.id === "qry_lifecycle_2"
    );
    expect(cancelledQuery).toMatchObject({
      status: "Cancelled",
      resolvedBy: "M. Vance, CRA (Monitor)",
      resolvedAt: "2026-09-01T15:05:00Z",
      resolutionReason: "Raised on wrong visit",
    });
    const initialAuditCount = baseStudy.simulationState?.auditLog?.length ?? 0;
    expect(cancelled.simulationState?.auditLog).toHaveLength(
      initialAuditCount + 7
    );

    // UniversalStudyProtocolSchema accepts resolvedBy, resolvedAt, resolutionReason
    const parsedSchema = UniversalStudyProtocolSchema.safeParse(cancelled);
    expect(parsedSchema.success).toBe(true);
  });

  it("emits captured simulationState rows in exportStudyToSas and exportStudyToR instead of synthetic 101-1001 rows, with fallback when empty", () => {
    const preset = STUDY_PRESETS[0]!.study;

    // 1. Empty simulationState falls back to synthetic 101-1001
    const fallbackSas = exportStudyToSas({
      ...preset,
      simulationState: undefined,
    });
    const fallbackR = exportStudyToR({
      ...preset,
      simulationState: undefined,
    });
    expect(fallbackSas).toContain("101-1001");
    expect(fallbackR).toContain("101-1001");

    // 2. Populated simulationState emits captured subjects and never 101-1001
    const sim = buildPopulatedSimulationState(preset);
    const liveStudy: StudyProtocol = {
      ...preset,
      simulationState: sim,
    };
    const liveSas = exportStudyToSas(liveStudy);
    const liveR = exportStudyToR(liveStudy);

    expect(liveSas).toContain("001-101");
    expect(liveSas).toContain("SUBJ_202");
    expect(liveSas).not.toContain("101-1001");

    expect(liveR).toContain("001-101");
    expect(liveR).toContain("SUBJ_202");
    expect(liveR).not.toContain("101-1001");
  });

  it("round-trips RFC 4180 CSV files with commas, quotes, and multiline values for subjects, queries, and audits", () => {
    const headers = ["col_a", "col_b", "col_c"];
    const rows = [
      ["plain", 'value, with "quotes"', "multiline\r\nnote inside cell"],
    ];
    const csv = formatRfc4180Csv(headers, rows);
    expect(csv).toContain("\r\n");
    expect(parseRfc4180Csv(csv)).toEqual([
      ["col_a", "col_b", "col_c"],
      ["plain", 'value, with "quotes"', "multiline\r\nnote inside cell"],
    ]);

    const preset = STUDY_PRESETS[0]!.study;
    const sim = buildPopulatedSimulationState(preset);
    sim.queries![0]!.message = 'Confirm "BP, supine"\nagainst chart';
    sim.auditLog![0]!.reasonForChange = 'Corrected "typo", line 2\nverified';

    const studyWithSim: StudyProtocol = {
      ...preset,
      simulationState: sim,
    };

    const subjectsCsv = StudyProtocolEngine.exportSubjectsCsv(studyWithSim);
    const queriesCsv = StudyProtocolEngine.exportQueriesCsv(studyWithSim);
    const auditsCsv = StudyProtocolEngine.exportAuditsCsv(studyWithSim);

    expect(detectClinicalCsvKind(subjectsCsv)).toBe("subjects");
    expect(detectClinicalCsvKind(queriesCsv)).toBe("queries");
    expect(detectClinicalCsvKind(auditsCsv)).toBe("audits");

    const emptyStudy: StudyProtocol = { ...preset, simulationState: undefined };
    const afterSubjects = StudyProtocolEngine.importSubjectsCsv(
      emptyStudy,
      subjectsCsv
    );
    expect(afterSubjects.simulationState?.availableSubjects).toEqual(
      sim.availableSubjects
    );
    expect(afterSubjects.simulationState?.formValues).toEqual(sim.formValues);

    const afterQueries = StudyProtocolEngine.importQueriesCsv(
      afterSubjects,
      queriesCsv
    );
    expect(afterQueries.simulationState?.queries?.[0]).toMatchObject({
      id: "qry_closed_1",
      status: "Closed",
      message: 'Confirm "BP, supine"\nagainst chart',
      resolvedBy: "M. Vance, CRA (Monitor)",
      resolutionReason: "Source document matches recorded value",
    });

    const afterAudits = StudyProtocolEngine.importAuditsCsv(
      afterQueries,
      auditsCsv
    );
    expect(afterAudits.simulationState?.auditLog?.[0]).toMatchObject({
      id: "aud_entry_1",
      reasonForChange: 'Corrected "typo", line 2\nverified',
      userRole: "Site Coordinator",
    });
  });

  it("describes simulated ClinicalData in STANDARDS_BOM and passes checkRegulatoryWording and findClinicalClaims with zero findings", () => {
    const odmSpec = STANDARDS_BOM_SPECS.find((s) => s.standard === "ODM");
    expect(odmSpec).toBeDefined();
    expect(odmSpec?.coverage).toContain("ClinicalData");
    expect(odmSpec?.coverage).toContain("SubjectData");
    expect(odmSpec?.coverage).toContain("AuditRecords");
    expect(odmSpec?.coverage).toContain("Signatures");
    expect(odmSpec?.coverage).toContain("Annotations");
    expect(checkRegulatoryWording(odmSpec!.coverage)).toEqual([]);
    expect(findClinicalClaims(odmSpec!.coverage)).toEqual([]);

    // Generated outputs
    const preset = STUDY_PRESETS[0]!.study;
    const studyWithSim: StudyProtocol = {
      ...preset,
      auditTrail: [],
      simulationState: buildPopulatedSimulationState(preset),
    };
    const generatedOdm = exportStudyToCdiscOdmXml(studyWithSim);
    const generatedSas = exportStudyToSas(studyWithSim);
    const generatedR = exportStudyToR(studyWithSim);

    for (const [label, output] of [
      ["ODM-XML", generatedOdm],
      ["SAS", generatedSas],
      ["R", generatedR],
    ] as const) {
      expect(checkRegulatoryWording(output), label).toEqual([]);
      expect(findClinicalClaims(output), label).toEqual([]);
      expect(output, label).not.toMatch(/cryptograph|sha-?256/i);
    }

    // All newly added and export-related CRF modules pass both checkRegulatoryWording and findClinicalClaims
    const strictRegulatoryFiles = [
      "lib/crf/internal/simulation-records.ts",
      "lib/crf/internal/edc-query-lifecycle.ts",
      "lib/crf/internal/clinical-data-csv.ts",
      "lib/crf/internal/odm-xml-serializer.ts",
      "lib/crf/internal/odm-xml-parser.ts",
      "lib/crf/internal/export-sas.ts",
      "lib/crf/internal/export-r.ts",
      "components/crf/Modes/ExportImportModal.tsx",
    ];

    for (const relPath of strictRegulatoryFiles) {
      const source = readFileSync(path.join(process.cwd(), relPath), "utf8");
      expect(checkRegulatoryWording(source), relPath).toEqual([]);
      expect(findClinicalClaims(source), relPath).toEqual([]);
    }

    // All clinical surfaces including bom.ts and LiveEdcSimulator.tsx pass findClinicalClaims
    for (const relPath of [
      "lib/clinical-standards/bom.ts",
      "components/crf/Modes/LiveEdcSimulator.tsx",
    ]) {
      const source = readFileSync(path.join(process.cwd(), relPath), "utf8");
      expect(findClinicalClaims(source), relPath).toEqual([]);
    }
  });
});
