// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  importStudyFromCdiscOdmXml,
  mapOdmDataTypeToClinical,
} from "@/lib/crf/odm-xml-parser";
import { exportStudyToCdiscOdmXml } from "@/lib/crf/odm-xml-serializer";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

describe("CRF Studio - CDISC ODM-XML Parser & Deserializer", () => {
  it("maps ODM data types to ClinicalDataTypes correctly", () => {
    expect(mapOdmDataTypeToClinical("integer")).toBe("integer");
    expect(mapOdmDataTypeToClinical("float")).toBe("number");
    expect(mapOdmDataTypeToClinical("double")).toBe("number");
    expect(mapOdmDataTypeToClinical("date")).toBe("date");
    expect(mapOdmDataTypeToClinical("partialDate")).toBe("partial_date");
    expect(mapOdmDataTypeToClinical("time")).toBe("time");
    expect(mapOdmDataTypeToClinical("datetime")).toBe("datetime");
    expect(mapOdmDataTypeToClinical("boolean")).toBe("radio");
    expect(mapOdmDataTypeToClinical("text")).toBe("text");
  });

  it("parses serialized ODM XML study back into a valid StudyProtocol object", () => {
    const xml = exportStudyToCdiscOdmXml(ONCOLOGY_RECIST_PRESET);
    const parsed = importStudyFromCdiscOdmXml(xml);

    expect(parsed.protocolNumber).toBe(ONCOLOGY_RECIST_PRESET.protocolNumber);
    expect(parsed.forms.length).toBeGreaterThan(0);
    expect(parsed.visits.length).toBeGreaterThan(0);
    expect(parsed.provenance?.sourceFormat).toBe("CDISC ODM XML");
  });

  it("extracts forms, sections, fields, and codelists from ODM XML", () => {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3" xmlns:def="http://www.cdisc.org/ns/def/v2.1" ODMVersion="1.3.2" CreationDateTime="2026-10-01T10:00:00Z">
  <Study OID="STUDY.DEMO_01">
    <GlobalVariables>
      <StudyName>Phase II Demo Study</StudyName>
      <StudyDescription>Phase II Clinical Protocol</StudyDescription>
      <ProtocolName>DEMO-01</ProtocolName>
    </GlobalVariables>
    <MetaDataVersion OID="MDV.1.0" Name="Protocol Definition Version 1.0">
      <Protocol>
        <StudyEventRef StudyEventOID="SE.VISIT1" OrderNumber="1" Mandatory="Yes"/>
      </Protocol>
      <StudyEventDef OID="SE.VISIT1" Name="Baseline Visit" Repeating="No" Type="Scheduled">
        <FormRef FormOID="FORM.DM" OrderNumber="1" Mandatory="Yes"/>
      </StudyEventDef>
      <FormDef OID="FORM.DM" Name="Demographics" Repeating="No">
        <ItemGroupRef ItemGroupOID="IG.DM.SEC1" OrderNumber="1" Mandatory="Yes"/>
      </FormDef>
      <ItemGroupDef OID="IG.DM.SEC1" Name="Subject Demographics" Repeating="No">
        <ItemRef ItemOID="IT.AGE" OrderNumber="1" Mandatory="Yes"/>
        <ItemRef ItemOID="IT.SEX" OrderNumber="2" Mandatory="No"/>
      </ItemGroupDef>
      <ItemDef OID="IT.AGE" Name="AGE" DataType="integer">
        <Description><TranslatedText xml:lang="en">Subject Age</TranslatedText></Description>
      </ItemDef>
      <ItemDef OID="IT.SEX" Name="SEX" DataType="text" CodeListOID="CL_SEX">
        <Description><TranslatedText xml:lang="en">Subject Sex</TranslatedText></Description>
      </ItemDef>
      <CodeList OID="CL_SEX" Name="Sex Codelist" DataType="text" def:NCICode="C66742">
        <CodeListItem CodedValue="M" def:NCICode="C20197">
          <Decode><TranslatedText xml:lang="en">Male</TranslatedText></Decode>
        </CodeListItem>
        <CodeListItem CodedValue="F" def:NCICode="C16576">
          <Decode><TranslatedText xml:lang="en">Female</TranslatedText></Decode>
        </CodeListItem>
      </CodeList>
      <AuditTrail>
        <AuditRecord ID="AUD_1">
          <UserRef UserOID="DM_USER"/>
          <UserRole>Data Manager</UserRole>
          <DateTimeStamp>2026-10-01T10:05:00Z</DateTimeStamp>
          <ActionType>FORM_CREATE</ActionType>
          <FormOID>FORM.DM</FormOID>
          <Details>Created Demographics Form</Details>
        </AuditRecord>
      </AuditTrail>
    </MetaDataVersion>
  </Study>
</ODM>`;

    const parsed = importStudyFromCdiscOdmXml(sampleXml);

    expect(parsed.protocolNumber).toBe("DEMO-01");
    expect(parsed.studyName).toBe("Phase II Demo Study");
    expect(parsed.phase).toBe("Phase II");

    // Forms
    expect(parsed.forms.length).toBe(1);
    const form = parsed.forms[0];
    expect(form.id).toBe("DM");
    expect(form.name).toBe("Demographics");
    expect(form.sections.length).toBe(1);

    // Fields
    const fields = form.sections[0].fields;
    expect(fields.length).toBe(2);
    expect(fields[0].variableName).toBe("AGE");
    expect(fields[0].dataType).toBe("integer");
    expect(fields[0].required).toBe(true);

    expect(fields[1].variableName).toBe("SEX");
    expect(fields[1].codelistId).toBe("CL_SEX");
    expect(fields[1].required).toBe(false);

    // Codelists
    expect(parsed.codelists.length).toBe(1);
    expect(parsed.codelists[0].id).toBe("CL_SEX");
    expect(parsed.codelists[0].options.length).toBe(2);
    expect(parsed.codelists[0].options[0].code).toBe("M");
    expect(parsed.codelists[0].options[0].label).toBe("Male");

    // Visits
    expect(parsed.visits.length).toBe(1);
    expect(parsed.visits[0].name).toBe("Baseline Visit");
    expect(parsed.visits[0].assignedFormIds).toContain("DM");

    // Audit Trail
    expect(parsed.auditTrail).toBeDefined();
    expect(parsed.auditTrail?.length).toBe(1);
    expect(parsed.auditTrail?.[0].changedBy).toBe("DM_USER");
  });

  it("throws actionable errors when XML structure or ODM root is invalid", () => {
    expect(() => importStudyFromCdiscOdmXml("")).toThrow("Empty XML payload");
    expect(() => importStudyFromCdiscOdmXml("<invalid>xml markup")).toThrow(
      "Invalid CDISC ODM XML structure"
    );
    expect(() => importStudyFromCdiscOdmXml("<root><child/></root>")).toThrow(
      "Missing root <ODM> element"
    );
  });
});
