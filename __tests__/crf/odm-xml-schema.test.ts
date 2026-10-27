/**
 * CRF Studio's ODM export against the official CDISC ODM 1.3.2 schema
 * (#3022, epic #2992). Every preset must validate as plain ODM; a study with
 * a design audit trail must validate as ODM plus CRF Studio's extension, and
 * fail plain ODM only because of the extension.
 */
import { describe, expect, it } from "vitest";
import {
  CRF_STUDIO_ODM_NAMESPACE,
  exportStudyToCdiscOdmXml,
  importStudyFromCdiscOdmXml,
} from "@/lib/crf";
import * as presets from "@/lib/crf/presets";
import type { StudyProtocol } from "@/lib/crf/types";
import { validateOdmXml } from "../helpers/odm-xml-schema";

const STUDIES = Object.entries(presets).filter(
  (entry): entry is [string, StudyProtocol] => {
    const value = entry[1] as unknown;
    return (
      typeof value === "object" &&
      value !== null &&
      Array.isArray((value as StudyProtocol).forms) &&
      Array.isArray((value as StudyProtocol).visits)
    );
  }
);

const withAudit = (study: StudyProtocol): StudyProtocol => ({
  ...study,
  auditTrail: [
    {
      id: "AUD_1",
      timestamp: "2026-10-26T12:00:00Z",
      changedBy: "DM_USER",
      userRole: "Data Manager",
      actionType: "FIELD_UPDATE",
      formId: study.forms[0]?.id,
      fieldId: "fld_age",
      previousValue: { label: "Age" },
      newValue: { label: "Age at consent" },
      reasonForChange: "Protocol amendment 2",
      diagnosticId: "DIAG-1",
      details: "Label aligned with CDASHIG",
    },
    {
      id: "AUD_2",
      timestamp: "2026-10-26T12:05:00Z",
      changedBy: "DM_USER",
    },
  ],
});

describe("CRF Studio ODM export and the CDISC ODM 1.3.2 schema (#3022)", () => {
  it("covers every preset study", () => {
    expect(STUDIES.length).toBeGreaterThanOrEqual(6);
  });

  it("validates every preset as plain ODM 1.3.2", async () => {
    const documents = Object.fromEntries(
      STUDIES.map(([name, study]) => [
        name,
        exportStudyToCdiscOdmXml({ ...study, auditTrail: [] }),
      ])
    );
    const errors = await validateOdmXml(documents);
    for (const [name, list] of Object.entries(errors))
      expect(list, name).toEqual([]);
  });

  it("validates a study with a design audit trail against ODM 1.3.2 and the CRF Studio extension", async () => {
    const documents = Object.fromEntries(
      STUDIES.map(([name, study]) => [
        name,
        exportStudyToCdiscOdmXml(withAudit(study)),
      ])
    );
    const extended = await validateOdmXml(documents, "odm-1.3.2+crf-studio");
    for (const [name, list] of Object.entries(extended))
      expect(list, name).toEqual([]);
    const plain = await validateOdmXml(documents);
    for (const [name, list] of Object.entries(plain)) {
      expect(list.length, name).toBeGreaterThan(0);
      for (const message of list.filter((item) => /validity error/.test(item)))
        expect(message, name).toContain(
          `{${CRF_STUDIO_ODM_NAMESPACE}}AuditTrail`
        );
    }
  });

  it("round-trips codelist references, NCI codes and the audit trail through import", () => {
    const [, study] = STUDIES.find(
      ([name]) => name === "ONCOLOGY_RECIST_PRESET"
    )!;
    const back = importStudyFromCdiscOdmXml(
      exportStudyToCdiscOdmXml(withAudit(study))
    );
    const planned = study.codelists?.find((list) => list.id === "CL_SEX");
    const sex = back.codelists?.find((list) => list.id === "CL_SEX");
    expect(planned?.nciCodelistCode).toBe("C66731");
    expect(sex?.nciCodelistCode).toBe(planned?.nciCodelistCode);
    expect(sex?.options.map((option) => [option.code, option.nciCode])).toEqual(
      planned?.options.map((option) => [option.code, option.nciCode])
    );
    const fields = back.forms.flatMap((form) =>
      form.sections.flatMap((section) => section.fields)
    );
    expect(
      fields.find((field) => field.variableName === "SEX")?.codelistId
    ).toBe("CL_SEX");
    expect(back.auditTrail?.map((entry) => entry.id)).toEqual([
      "AUD_1",
      "AUD_2",
    ]);
    expect(back.auditTrail?.[0]).toMatchObject({
      changedBy: "DM_USER",
      reasonForChange: "Protocol amendment 2",
      diagnosticId: "DIAG-1",
    });
  });

  it("still imports the attributes earlier CRF Studio exports wrote", () => {
    const legacy = `<?xml version="1.0" encoding="UTF-8"?>
<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3" xmlns:def="http://www.cdisc.org/ns/def/v2.1" ODMVersion="1.3.2" FileType="Snapshot" FileOID="F" CreationDateTime="2026-10-01T00:00:00Z">
  <Study OID="S"><GlobalVariables><StudyName>S</StudyName><StudyDescription>d</StudyDescription><ProtocolName>P</ProtocolName></GlobalVariables>
    <MetaDataVersion OID="MDV.1" Name="v1">
      <ItemDef OID="IT.SEX" Name="SEX" DataType="text" CodeListOID="CL_SEX"><Description><TranslatedText>Sex</TranslatedText></Description></ItemDef>
      <CodeList OID="CL_SEX" Name="Sex" DataType="text" def:NCICode="C66742">
        <CodeListItem CodedValue="M" def:NCICode="C20197"><Decode><TranslatedText>Male</TranslatedText></Decode></CodeListItem>
      </CodeList>
    </MetaDataVersion>
  </Study>
</ODM>`;
    const back = importStudyFromCdiscOdmXml(legacy);
    expect(back.codelists?.[0]?.nciCodelistCode).toBe("C66742");
    expect(back.codelists?.[0]?.options[0]?.nciCode).toBe("C20197");
  });
});
