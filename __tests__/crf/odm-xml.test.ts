// @vitest-environment node
import { describe, it, expect } from "vitest";
import { exportStudyToCdiscOdmXml } from "@/lib/crf/odm-xml-serializer";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

describe("CRF Studio - CDISC ODM-XML v1.3.2 Serializer", () => {
  it("serializes an entire study into compliant ODM-XML format", () => {
    const xml = exportStudyToCdiscOdmXml(ONCOLOGY_RECIST_PRESET);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3"');
    expect(xml).toContain('ODMVersion="1.3.2"');
    expect(xml).toContain(
      `<ProtocolName>${ONCOLOGY_RECIST_PRESET.protocolNumber}</ProtocolName>`
    );
  });

  it("contains StudyEventDefs (Visits) and FormDefs", () => {
    const xml = exportStudyToCdiscOdmXml(ONCOLOGY_RECIST_PRESET);

    ONCOLOGY_RECIST_PRESET.visits.forEach((v) => {
      expect(xml).toContain(`StudyEventDef OID="${v.oid}"`);
    });

    ONCOLOGY_RECIST_PRESET.forms.forEach((f) => {
      expect(xml).toContain(`FormDef OID="FORM.${f.id}"`);
    });
  });

  it("exports Codelists with standard NCI Concept C-Codes", () => {
    const xml = exportStudyToCdiscOdmXml(ONCOLOGY_RECIST_PRESET);

    expect(xml).toContain('<CodeList OID="CL_SEX"');
    expect(xml).toContain('def:NCICode="C66742"');
    expect(xml).toContain('<CodeListItem CodedValue="M"');
    expect(xml).toContain('<CodeListItem CodedValue="F"');
  });

  it("properly escapes XML special characters in labels and descriptions", () => {
    const specialStudy = {
      ...ONCOLOGY_RECIST_PRESET,
      studyName: "Phase III Study <A & B> with \"quotes\" & 'apostrophes'",
    };

    const xml = exportStudyToCdiscOdmXml(specialStudy);
    expect(xml).toContain(
      "Phase III Study &lt;A &amp; B&gt; with &quot;quotes&quot; &amp; &apos;apostrophes&apos;"
    );
  });

  it("escapes all reserved XML characters in object identifier attributes (OIDs)", () => {
    const specialOidStudy = {
      ...ONCOLOGY_RECIST_PRESET,
      protocolNumber: 'PROTO&1<2>"3"',
      version: '1.0&"beta"',
      visits: [
        {
          id: 'v_&1<2>"3"',
          oid: 'SE.VIS&1<2>"3"',
          name: 'Visit &1 <2> "3"',
          visitType: "Scheduled" as const,
          targetDay: 1,
          windowBefore: 0,
          windowAfter: 0,
          assignedFormIds: ['f_&1<2>"3"'],
        },
      ],
      forms: [
        {
          id: 'f_&1<2>"3"',
          name: "Form &1 <2>",
          description: "Special test form",
          domain: "DM&VS",
          version: "1.0",
          rules: [],
          sections: [
            {
              id: 'sec_&1<2>"3"',
              title: "Section &1",
              fields: [
                {
                  id: 'field_&1<2>"3"',
                  variableName: 'VAR&1<2>"3"',
                  label: "Field Label &1 <2>",
                  dataType: "text" as const,
                  columnSpan: 6,
                  required: true,
                  codelistId: 'CL_&1<2>"3"',
                },
              ],
            },
          ],
        },
      ],
    };

    const xml = exportStudyToCdiscOdmXml(specialOidStudy);

    expect(xml).toContain(
      'StudyEventRef StudyEventOID="SE.VIS&amp;1&lt;2&gt;&quot;3&quot;"'
    );
    expect(xml).toContain(
      'FormRef FormOID="FORM.f_&amp;1&lt;2&gt;&quot;3&quot;"'
    );
    expect(xml).toContain('FormDef OID="FORM.f_&amp;1&lt;2&gt;&quot;3&quot;"');
    expect(xml).toContain(
      'ItemGroupRef ItemGroupOID="IG.DM&amp;VS.sec_&amp;1&lt;2&gt;&quot;3&quot;"'
    );
    expect(xml).toContain(
      'ItemGroupDef OID="IG.DM&amp;VS.sec_&amp;1&lt;2&gt;&quot;3&quot;"'
    );
    expect(xml).toContain(
      'ItemRef ItemOID="IT.VAR&amp;1&lt;2&gt;&quot;3&quot;"'
    );
    expect(xml).toContain('ItemDef OID="IT.VAR&amp;1&lt;2&gt;&quot;3&quot;"');
    expect(xml).toContain('CodeListOID="CL_&amp;1&lt;2&gt;&quot;3&quot;"');
  });
});
