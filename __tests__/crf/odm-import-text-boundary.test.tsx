// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  detectAndParseStudyFile,
  exportStudyToCdiscOdmXml,
  importStudyFromCdiscOdmXml,
} from "@/lib/crf";
import { FieldRenderer } from "@/components/crf/CenterCanvas/FieldRenderer";
import { LiveEdcSimulator } from "@/components/crf/Modes/LiveEdcSimulator";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import type { EdcSimulationState } from "@/lib/crf/types";

/**
 * CodeQL js/xss-through-dom regression boundary for ODM-XML uploads across
 * ExportImportModal, ImportDropzone, and LiveEdcSimulator. ODM-XML is parsed by
 * a pure zero-DOM scanner (`lib/crf/internal/xml-tree.ts`) with single-pass
 * entity decoding rather than `DOMParser`, ensuring uploaded XML never enters
 * an HTML/DOM reinterpretation sink and markup-looking payloads stay plain text.
 */
const MARKUP = '<img src=x onerror="window.__odmPwned=1">';
const ENCODED = "&lt;img src=x onerror=&quot;window.__odmPwned=1&quot;&gt;";

const HOSTILE_ODM = `<?xml version="1.0" encoding="UTF-8"?>
<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3" xmlns:def="http://www.cdisc.org/ns/def/v2.1" ODMVersion="1.3.2" CreationDateTime="2026-11-14T10:00:00Z">
  <Study OID="STUDY.XSS_01">
    <GlobalVariables>
      <StudyName>Study ${ENCODED}</StudyName>
      <StudyDescription>${ENCODED}</StudyDescription>
      <ProtocolName>XSS-01</ProtocolName>
    </GlobalVariables>
    <MetaDataVersion OID="MDV.1.0" Name="v1">
      <Protocol>
        <StudyEventRef StudyEventOID="SE.V1" OrderNumber="1" Mandatory="Yes"/>
      </Protocol>
      <StudyEventDef OID="SE.V1" Name="Visit ${ENCODED}" Repeating="No" Type="Scheduled">
        <FormRef FormOID="FORM.DM" OrderNumber="1" Mandatory="Yes"/>
      </StudyEventDef>
      <FormDef OID="FORM.DM" Name="Form ${ENCODED}" Repeating="No">
        <ItemGroupRef ItemGroupOID="IG.DM" OrderNumber="1" Mandatory="Yes"/>
      </FormDef>
      <ItemGroupDef OID="IG.DM" Name="Section ${ENCODED}" Repeating="No">
        <ItemRef ItemOID="IT.AGE" OrderNumber="1" Mandatory="Yes"/>
        <ItemRef ItemOID="IT.SEX" OrderNumber="2" Mandatory="No"/>
      </ItemGroupDef>
      <ItemDef OID="IT.AGE" Name="AGE" DataType="integer">
        <Description><TranslatedText xml:lang="en">Age ${ENCODED}</TranslatedText></Description>
      </ItemDef>
      <ItemDef OID="IT.SEX" Name="SEX" DataType="text" CodeListOID="CL_SEX">
        <Description><TranslatedText xml:lang="en">Sex <![CDATA[<script>window.__odmPwned=2</script>]]></TranslatedText></Description>
      </ItemDef>
      <CodeList OID="CL_SEX" Name="Sex ${ENCODED}" DataType="text">
        <CodeListItem CodedValue="M">
          <Decode><TranslatedText xml:lang="en">Male ${ENCODED}</TranslatedText></Decode>
        </CodeListItem>
        <CodeListItem CodedValue="F">
          <Decode><TranslatedText xml:lang="en">Female</TranslatedText></Decode>
        </CodeListItem>
      </CodeList>
    </MetaDataVersion>
  </Study>
</ODM>`;

type Pwned = { __odmPwned?: number };

describe("ODM import keeps markup-looking text as text (CodeQL alert 30)", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    delete (window as Pwned).__odmPwned;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
    container.remove();
  });

  it("decodes entities to plain strings in the model, through the upload path", () => {
    const { study, format } = detectAndParseStudyFile(HOSTILE_ODM, "x.xml");
    expect(format).toBe("xml_odm");
    expect(study.studyName).toBe(`Study ${MARKUP}`);

    const form = study.forms[0];
    expect(form.name).toBe(`Form ${MARKUP}`);
    const fields = form.sections.flatMap((s) => s.fields);
    expect(fields.map((f) => f.label)).toEqual([
      `Age ${MARKUP}`,
      "Sex <script>window.__odmPwned=2</script>",
    ]);
    const sex = study.codelists?.find((c) =>
      c.options.some((o) => o.code === "M")
    );
    expect(sex?.options.find((o) => o.code === "M")?.label).toBe(
      `Male ${MARKUP}`
    );
  });

  it("renders imported labels and options as text, never as elements", async () => {
    const study = importStudyFromCdiscOdmXml(HOSTILE_ODM);
    const fields = study.forms[0].sections.flatMap((s) => s.fields);

    await act(async () => {
      root = createRoot(container);
      root.render(
        <>
          {fields.map((field) => (
            <FieldRenderer
              key={field.id}
              field={field}
              isSelected={false}
              onSelect={vi.fn()}
              onDuplicate={vi.fn()}
              onDelete={vi.fn()}
              codelists={study.codelists ?? []}
            />
          ))}
        </>
      );
    });

    expect(
      container.querySelector("img, script, iframe, svg[onload]")
    ).toBeNull();
    const handlerAttributes = Array.from(
      container.querySelectorAll("*")
    ).flatMap((el) =>
      el.getAttributeNames().filter((name) => name.startsWith("on"))
    );
    expect(handlerAttributes).toEqual([]);
    expect(container.textContent).toContain(`Age ${MARKUP}`);
    expect(container.textContent).toContain(
      "<script>window.__odmPwned=2</script>"
    );
    expect((window as Pwned).__odmPwned).toBeUndefined();
  });

  it("re-encodes the decoded text when the study is exported again", () => {
    const study = importStudyFromCdiscOdmXml(HOSTILE_ODM);
    const xml = exportStudyToCdiscOdmXml(study);

    expect(xml).not.toContain(MARKUP);
    expect(xml).not.toContain("<script>");
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(doc.getElementsByTagNameNS("*", "img")).toHaveLength(0);
    expect(doc.getElementsByTagNameNS("*", "script")).toHaveLength(0);

    const again = importStudyFromCdiscOdmXml(xml);
    expect(
      again.forms[0].sections.flatMap((s) => s.fields).map((f) => f.label)
    ).toEqual(
      study.forms[0].sections.flatMap((s) => s.fields).map((f) => f.label)
    );
  });

  it("reports malformed markup as an error message string, not a document", () => {
    let caught: unknown;
    try {
      detectAndParseStudyFile(
        `<?xml version="1.0"?><ODM><Study>${MARKUP}<Study></ODM>`,
        "bad.xml"
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/^CDISC ODM XML Parsing Error: /);
    expect((window as Pwned).__odmPwned).toBeUndefined();
  });

  it("never calls DOMParser and keeps hostile ClinicalData uploads inert in LiveEdcSimulator", async () => {
    const domParserSpy = vi
      .spyOn(globalThis, "DOMParser")
      .mockImplementation(() => {
        throw new Error("DOMParser must not be used for ODM-XML import");
      });

    let updatedSim: EdcSimulationState | undefined;
    try {
      const visitId = ONCOLOGY_RECIST_PRESET.visits[0]!.id;
      const form = ONCOLOGY_RECIST_PRESET.forms[0]!;
      const section = form.sections[0]!;
      const field = section.fields[0]!;

      const baseXml = exportStudyToCdiscOdmXml({
        ...ONCOLOGY_RECIST_PRESET,
        simulationState: {
          availableSubjects: [`SUBJ-${MARKUP}`],
          formValues: {
            [`SUBJ-${MARKUP}_${visitId}_${field.id}`]: `Note ${MARKUP}`,
          },
          queries: [
            {
              id: "qry_xss_1",
              subjectId: `SUBJ-${MARKUP}`,
              visitId,
              formId: form.id,
              fieldId: field.id,
              fieldName: field.variableName,
              severity: "warning",
              status: "Open",
              message: `Query ${MARKUP}`,
              raisedBy: "CRA Monitor",
              raisedAt: "2026-11-14T10:00:00Z",
            },
          ],
          auditLog: [],
          signatures: [],
        },
      });

      await act(async () => {
        root = createRoot(container);
        root.render(
          <LiveEdcSimulator
            study={ONCOLOGY_RECIST_PRESET}
            onUpdateSimulationState={(next) => {
              updatedSim = next;
            }}
          />
        );
      });

      const fileInput = container.querySelector(
        'input[aria-label="Import ODM-XML or RFC 4180 CSV file"]'
      ) as HTMLInputElement;
      expect(fileInput).not.toBeNull();

      const file = new File([baseXml], "hostile-clinical-data.xml", {
        type: "application/xml",
      });
      Object.defineProperty(fileInput, "files", {
        value: [file],
        configurable: true,
      });

      await act(async () => {
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((r) => setTimeout(r, 15));
      });

      expect(domParserSpy).not.toHaveBeenCalled();
      expect(updatedSim?.availableSubjects).toContain(`SUBJ-${MARKUP}`);
      expect(updatedSim?.queries?.[0]?.message).toBe(`Query ${MARKUP}`);
      expect(
        container.querySelector("img, script, iframe, svg[onload]")
      ).toBeNull();
      expect((window as Pwned).__odmPwned).toBeUndefined();
    } finally {
      domParserSpy.mockRestore();
    }
  });
});
