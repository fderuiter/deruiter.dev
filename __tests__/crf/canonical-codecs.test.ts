// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DEFAULT_FORMAT_CODEC_REGISTRY,
  UniversalJsonCodec,
  UniversalYamlCodec,
  OdmXml132Codec,
  FhirR4QuestionnaireCodec,
  RedcapCsvCodec,
  CdiscCsvSpecCodec,
  UsdmV4Codec,
  UsdmV3Codec,
  CodecValidationError,
  toCanonicalCrfDocument,
  fromCanonicalCrfDocument,
  validateCanonicalCrfDocument,
  parseYamlAst,
  evaluateYamlAst,
  parseXmlDocument,
  detectAndParseStudyFile,
  importStudyFromUsdm,
  importStudyFromCsvSpec,
  exportStudyToCdiscOdmXml,
  importStudyFromCdiscOdmXml,
  exportFormToFhirQuestionnaire,
  exportStudyToFhirQuestionnaire,
  isStudyProtocolShape,
  loadStudyDraft,
  saveStudyDraft,
  saveStudySnapshot,
  listStudySnapshots,
  isDraftDirty,
  STUDY_DRAFT_STORAGE_KEY,
  STUDY_DRAFT_CORRUPT_BACKUP_KEY,
  STUDY_SNAPSHOTS_STORAGE_KEY,
  STUDY_DRAFT_ENVELOPE_VERSION,
  StudyProtocolEngine,
  evaluateStudyConformance,
} from "@/lib/crf";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import type {
  FhirBundle,
  FhirQuestionnaire,
  FormatCodecId,
  StudyProtocol,
} from "@/lib/crf/types";

describe("CanonicalCrfDocument & Symmetric Format Codecs", () => {
  it("indexes forms, fields, visits, codelists, and rules in CanonicalCrfDocument and projects losslessly", () => {
    const base = StudyProtocolEngine.addReviewComment(
      ONCOLOGY_RECIST_PRESET,
      ONCOLOGY_RECIST_PRESET.forms[0].sections[0].fields[0].id,
      "Verify informed consent date alignment with screening visit",
      { name: "Lead Biostatistician", role: "Biostatistician" },
      "2026-08-15T10:00:00.000Z"
    ).study;

    const studyWithScenario: StudyProtocol = {
      ...base,
      testScenarios: [
        {
          id: "scen_dm_1",
          formId: base.forms[0].id,
          name: "Baseline Adult Subject",
          scope: { subjectId: "SUBJ-001", visitId: base.visits[0].id },
          inputs: { AGE: 58, SEX: "F" },
          expectations: [],
          createdAt: "2026-08-15T10:05:00.000Z",
          updatedAt: "2026-08-15T10:05:00.000Z",
        },
      ],
    };

    const doc = toCanonicalCrfDocument(studyWithScenario);
    expect(doc.kind).toBe("CanonicalCrfDocument");
    expect(doc.irVersion).toBe("1.0.0");
    expect(doc.forms.order).toEqual(studyWithScenario.forms.map((f) => f.id));
    expect(doc.visits.order).toEqual(studyWithScenario.visits.map((v) => v.id));
    expect(doc.codelists.order.length).toBe(studyWithScenario.codelists.length);
    expect(doc.indexes.formIdsByDomain.DM).toContain(base.forms[0].id);

    const firstField = base.forms[0].sections[0].fields[0];
    expect(
      doc.indexes.fieldKeysByFormVariable[
        `${base.forms[0].id}::${firstField.variableName.toUpperCase()}`
      ]
    ).toContain(`${base.forms[0].id}::${firstField.id}`);
    expect(
      doc.indexes.visitIdsByFormId[base.forms[0].id].length
    ).toBeGreaterThan(0);

    // Conformance engine accepts CanonicalCrfDocument directly without re-indexing
    const evalFromDoc = evaluateStudyConformance(doc);
    expect(evalFromDoc.document).toBe(doc);

    const projected = fromCanonicalCrfDocument(doc);
    expect(projected).toEqual(studyWithScenario);
  });

  it("quarantines malformed draft and baseline arrays in isStudyProtocolShape", () => {
    expect(isStudyProtocolShape(ONCOLOGY_RECIST_PRESET)).toBe(true);
    expect(
      isStudyProtocolShape({
        ...ONCOLOGY_RECIST_PRESET,
        forms: ["not-a-form-object"],
      })
    ).toBe(false);
    expect(
      isStudyProtocolShape({
        ...ONCOLOGY_RECIST_PRESET,
        visits: [null],
      })
    ).toBe(false);
    expect(
      isStudyProtocolShape({
        ...ONCOLOGY_RECIST_PRESET,
        codelists: [42],
      })
    ).toBe(false);
    expect(
      isStudyProtocolShape({
        ...ONCOLOGY_RECIST_PRESET,
        forms: [
          {
            ...ONCOLOGY_RECIST_PRESET.forms[0],
            sections: [
              {
                id: "sec_bad",
                title: "Bad Section",
                fields: [{ id: "", variableName: "AGE", dataType: "integer" }],
              },
            ],
          },
        ],
      })
    ).toBe(false);

    // Verify loadStudyDraft quarantines malformed envelope payloads cleanly
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => {
        store.set(key, val);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
    mockStorage.setItem(
      STUDY_DRAFT_STORAGE_KEY,
      JSON.stringify({
        envelopeVersion: STUDY_DRAFT_ENVELOPE_VERSION,
        savedAt: "2026-08-15T00:00:00.000Z",
        study: {
          id: "study_corrupt",
          protocolNumber: "CORRUPT-01",
          forms: ["corrupt_entry"],
          visits: [],
          codelists: [],
        },
      })
    );

    const loaded = loadStudyDraft(mockStorage);
    expect(loaded.status).toBe("corrupt");
    expect(mockStorage.getItem(STUDY_DRAFT_CORRUPT_BACKUP_KEY)).toContain(
      "corrupt_entry"
    );

    // Verify listStudySnapshots filters out malformed snapshot entries while keeping valid ones
    const snapRes = saveStudySnapshot(
      ONCOLOGY_RECIST_PRESET,
      "Valid Baseline",
      mockStorage
    );
    expect(snapRes.status).toBe("saved");
    const validSnapshots = listStudySnapshots(mockStorage);
    expect(validSnapshots).toHaveLength(1);
    mockStorage.setItem(
      STUDY_SNAPSHOTS_STORAGE_KEY,
      JSON.stringify([
        ...validSnapshots,
        {
          id: "snap_corrupt",
          label: "Corrupt Snapshot",
          savedAt: "2026-08-15T00:00:00.000Z",
          study: {
            id: "study_bad_snap",
            forms: [null],
            visits: [],
            codelists: [],
          },
        },
      ])
    );
    expect(listStudySnapshots(mockStorage)).toHaveLength(1);

    saveStudyDraft(ONCOLOGY_RECIST_PRESET, mockStorage);
    expect(isDraftDirty(ONCOLOGY_RECIST_PRESET, null, mockStorage)).toBe(false);
    expect(
      isDraftDirty(
        { ...ONCOLOGY_RECIST_PRESET, studyName: "Amended Study Title" },
        null,
        mockStorage
      )
    ).toBe(true);
  });

  it("enforces disjoint FormatCodecRegistry predicates across all 8 codecs", () => {
    const canonicalDoc = toCanonicalCrfDocument(ONCOLOGY_RECIST_PRESET);
    const universalJson = DEFAULT_FORMAT_CODEC_REGISTRY.encodeWith(
      "json_universal",
      canonicalDoc
    );
    const universalYaml = DEFAULT_FORMAT_CODEC_REGISTRY.encodeWith(
      "yaml_universal",
      canonicalDoc
    );
    const odmXml = DEFAULT_FORMAT_CODEC_REGISTRY.encodeWith(
      "xml_odm_1_3_2",
      canonicalDoc
    );
    const fhirJson = DEFAULT_FORMAT_CODEC_REGISTRY.encodeWith(
      "json_fhir_r4",
      canonicalDoc
    );
    const usdmV4Json = DEFAULT_FORMAT_CODEC_REGISTRY.encodeWith(
      "json_usdm_v4",
      canonicalDoc
    );
    const usdmV3Json = JSON.stringify({
      study: {
        name: "USDM v3 Trial",
      },
      studyDesigns: [],
    });
    const redcapCsv = [
      "Variable / Field Name,Form Name,Section Header,Field Type,Field Label,Choices, Calculations, OR Slider Labels",
      "enrollment_consent_date,demographics_intake,Baseline,text,Informed Consent Date,",
      "weight_kg,demographics_intake,Baseline,text,Weight (kg),",
      "bmi_calc,demographics_intake,Baseline,calc,BMI,[weight_kg] / 3",
    ].join("\n");
    const cdiscCsv = [
      "Form Name,Domain,Variable Name,Field Label,Data Type,Required",
      "Vital Signs,VS,SYSBP,Systolic Blood Pressure,integer,Y",
    ].join("\n");

    const samples: Array<[FormatCodecId, string, string]> = [
      ["json_universal", universalJson, "study.crf.json"],
      ["yaml_universal", universalYaml, "study.crf.yaml"],
      ["json_usdm_v4", usdmV4Json, "study.usdm.json"],
      ["json_usdm_v3", usdmV3Json, "study-v3.json"],
      ["xml_odm_1_3_2", odmXml, "study.odm.xml"],
      ["json_fhir_r4", fhirJson, "study.fhir.json"],
      ["csv_redcap", redcapCsv, "dictionary.csv"],
      ["csv_cdisc_spec", cdiscCsv, "spec.csv"],
    ];

    const allCodecs = [
      UniversalJsonCodec,
      UniversalYamlCodec,
      UsdmV4Codec,
      UsdmV3Codec,
      OdmXml132Codec,
      FhirR4QuestionnaireCodec,
      RedcapCsvCodec,
      CdiscCsvSpecCodec,
    ];

    for (const [expectedId, raw, fileName] of samples) {
      const matching = allCodecs
        .filter((c) => c.canDecode({ raw, fileName }))
        .map((c) => c.id);
      expect(matching, `Disjoint match for ${fileName}`).toEqual([expectedId]);
      expect(
        DEFAULT_FORMAT_CODEC_REGISTRY.resolveCodec({ raw, fileName })?.id
      ).toBe(expectedId);
    }
  });

  it("rejects invalid Universal .crf.json without USDM v3 fallback and rejects prose or positional CSVs", () => {
    const brokenNativeJson = JSON.stringify({
      $schema: "https://deruiter.dev/schemas/crf/v1/universal-crf.schema.json",
      id: "study_broken",
      protocolNumber: "BROKEN-001",
      forms: "not-an-array",
    });

    expect(() =>
      DEFAULT_FORMAT_CODEC_REGISTRY.decodeAuto({
        raw: brokenNativeJson,
        fileName: "broken.crf.json",
      })
    ).toThrow(CodecValidationError);
    expect(() =>
      detectAndParseStudyFile(brokenNativeJson, "broken.crf.json")
    ).toThrow(/Universal CRF validation failed/);
    expect(() => importStudyFromUsdm(brokenNativeJson)).toThrow();

    // Bare invalid .crf.json without $schema or protocolNumber is still claimed by UniversalJsonCodec
    const bareInvalidCrfJson = JSON.stringify({ forms: "bad" });
    expect(
      DEFAULT_FORMAT_CODEC_REGISTRY.resolveCodec({
        raw: bareInvalidCrfJson,
        fileName: "bare.crf.json",
      })?.id
    ).toBe("json_universal");
    expect(() =>
      DEFAULT_FORMAT_CODEC_REGISTRY.decodeAuto({
        raw: bareInvalidCrfJson,
        fileName: "bare.crf.json",
      })
    ).toThrow(CodecValidationError);

    // protocolNumber payload with custom $schema stays isolated in UniversalJsonCodec (no USDM v3 hijack)
    const customSchemaNativeJson = JSON.stringify({
      $schema: "https://custom.org/crf-schema.json",
      protocolNumber: "CUSTOM-001",
      forms: "not-an-array",
    });
    expect(
      DEFAULT_FORMAT_CODEC_REGISTRY.resolveCodec({
        raw: customSchemaNativeJson,
        fileName: "custom.json",
      })?.id
    ).toBe("json_universal");

    const proseNotes = [
      "Protocol synopsis: Phase II single-arm study in advanced melanoma.",
      "Subjects complete baseline laboratory assessments, vital signs, and ECG.",
      "Safety follow-up occurs 30 days after final dose.",
    ].join("\n");
    expect(() =>
      DEFAULT_FORMAT_CODEC_REGISTRY.decodeAuto({
        raw: proseNotes,
        fileName: "synopsis.txt",
      })
    ).toThrow(CodecValidationError);
    expect(() => detectAndParseStudyFile(proseNotes, "synopsis.txt")).toThrow(
      /Unsupported file format/
    );

    const headerlessPositionalCsv = [
      "Vital Signs,SYSBP,Systolic Blood Pressure,integer,Y",
      "Vital Signs,DIABP,Diastolic Blood Pressure,integer,Y",
    ].join("\n");
    expect(() =>
      DEFAULT_FORMAT_CODEC_REGISTRY.decodeAuto({
        raw: headerlessPositionalCsv,
        fileName: "positional.csv",
      })
    ).toThrow(CodecValidationError);
    expect(() =>
      detectAndParseStudyFile(headerlessPositionalCsv, "positional.csv")
    ).toThrow(/Missing required REDCap or CDISC/);
  });

  it("validates CanonicalCrfDocument on UniversalJsonCodec and UniversalYamlCodec encode and round-trips REDCap and protocolId-only studies", () => {
    const validDoc = toCanonicalCrfDocument(ONCOLOGY_RECIST_PRESET);
    const brokenDoc = {
      ...validDoc,
      metadata: {
        ...validDoc.metadata,
        protocolNumber: "",
        protocolId: undefined,
      },
    };
    expect(
      validateCanonicalCrfDocument({
        ...ONCOLOGY_RECIST_PRESET,
        protocolNumber: "",
        protocolId: undefined,
      }).valid
    ).toBe(false);
    expect(() => UniversalJsonCodec.encode(brokenDoc)).toThrow(
      CodecValidationError
    );
    expect(() => UniversalYamlCodec.encode(brokenDoc)).toThrow(
      CodecValidationError
    );

    // REDCap >8-char identifiers round-trip through UniversalJsonCodec and UniversalYamlCodec
    const redcapCsv = [
      "Variable / Field Name,Form Name,Section Header,Field Type,Field Label,Choices, Calculations, OR Slider Labels,Text Validation Type OR Show Slider Number,Text Validation Min,Text Validation Max,Identifier?,Branching Logic (Show field only if...),Required Field?",
      "subject_enrollment_identifier,baseline_demographics,Demographics,text,Subject Enrollment Identifier,,,,,y,,y",
      "baseline_weight_kilograms,baseline_demographics,Vitals,text,Baseline Weight (kg),,number,30,250,,,y",
    ].join("\n");

    const redcapStudy = importStudyFromCsvSpec(redcapCsv);
    const enrichedRedcap: StudyProtocol = {
      ...redcapStudy,
      visits: [
        {
          id: "vis_redcap_1",
          oid: "SE.REDCAP.1",
          name: "Baseline Visit",
          visitType: "Scheduled",
          targetDay: 1,
          windowBefore: 0,
          windowAfter: 3,
          assignedFormIds: [redcapStudy.forms[0].id],
        },
      ],
      reviewThreads: [
        {
          id: "rt_redcap_1",
          target: {
            formId: redcapStudy.forms[0].id,
            formName: redcapStudy.forms[0].name,
            fieldId: redcapStudy.forms[0].sections[0].fields[0].id,
            variableName: "subject_enrollment_identifier",
            label: "Subject Enrollment Identifier",
          },
          events: [
            {
              id: "ev_1",
              type: "comment",
              body: "Retain long REDCap variable during authoring before SDTM mapping",
              author: { name: "Clinical Author", role: "Data Manager" },
              at: "2026-08-15T12:00:00.000Z",
            },
          ],
        },
      ],
      testScenarios: [
        {
          id: "scen_rc_1",
          formId: redcapStudy.forms[0].id,
          name: "Valid Weight Check",
          scope: {
            subjectId: "SUBJ-001",
            visitId: "vis_redcap_1",
          },
          inputs: { baseline_weight_kilograms: 72.5 },
          expectations: [],
          createdAt: "2026-08-15T12:05:00.000Z",
          updatedAt: "2026-08-15T12:05:00.000Z",
        },
      ],
    };

    const encodedJson = UniversalJsonCodec.encode(
      toCanonicalCrfDocument(enrichedRedcap)
    );
    const encodedYaml = UniversalYamlCodec.encode(
      toCanonicalCrfDocument(enrichedRedcap)
    );

    const fromJson = fromCanonicalCrfDocument(
      UniversalJsonCodec.decode(encodedJson)
    );
    const fromYaml = fromCanonicalCrfDocument(
      UniversalYamlCodec.decode(encodedYaml)
    );

    expect(fromJson.forms[0].sections[0].fields[0].variableName).toBe(
      "subject_enrollment_identifier"
    );
    expect(fromYaml.forms[0].sections[0].fields[0].variableName).toBe(
      "subject_enrollment_identifier"
    );
    expect(fromJson.visits).toHaveLength(1);
    expect(fromYaml.visits).toHaveLength(1);
    expect(fromJson.reviewThreads).toHaveLength(1);
    expect(fromYaml.reviewThreads).toHaveLength(1);
    expect(fromJson.testScenarios).toHaveLength(1);
    expect(fromYaml.testScenarios).toHaveLength(1);

    // protocolId-only YAML input decodes and re-encodes cleanly via pure YAML AST lexer
    const protocolIdOnlyYaml = [
      "# Pure AST YAML protocolId-only specification",
      "id: study_pid_only",
      "protocolId: PID-ONLY-2026",
      'studyName: "ProtocolId Only Study"',
      "phase: Phase II",
      "sponsor: Pure YAML Bio",
      "therapeuticArea: Oncology",
      'version: "1.0"',
      'lastModified: "2026-08-15T00:00:00.000Z"',
      "title: |",
      "  Multiline clinical study synopsis",
      "  preserved via pure YAML AST lexer.",
      "visits:",
      "  - id: v_1",
      "    oid: SE.V1",
      "    name: Screening",
      "    visitType: Scheduled",
      "    targetDay: -7",
      "    windowBefore: 7",
      "    windowAfter: 0",
      "    assignedFormIds: [f_1]",
      "codelists: []",
      "forms:",
      "  - id: f_1",
      "    name: Demographics",
      "    domain: DM",
      '    version: "1.0"',
      '    description: "DM Form"',
      "    rules: []",
      "    sections:",
      "      - id: s_1",
      "        title: Subject Info",
      "        fields:",
      "          - id: fld_1",
      "            variableName: SUBJID",
      "            label: Subject Identifier",
      "            dataType: text",
      "            columnSpan: 6",
      "            required: true",
    ].join("\n");

    const parsedYamlAst = parseYamlAst(protocolIdOnlyYaml);
    expect(parsedYamlAst.kind).toBe("mapping");
    if (parsedYamlAst.kind === "mapping") {
      const pidEntry = parsedYamlAst.entries.find(
        (e) => e.key === "protocolId"
      );
      const titleEntry = parsedYamlAst.entries.find((e) => e.key === "title");
      expect(
        pidEntry?.value.kind === "scalar" ? pidEntry.value.value : undefined
      ).toBe("PID-ONLY-2026");
      expect(
        titleEntry?.value.kind === "scalar"
          ? String(titleEntry.value.value)
          : ""
      ).toContain(
        "Multiline clinical study synopsis\npreserved via pure YAML AST lexer."
      );
    }

    const decodedPidOnly = UniversalYamlCodec.decode(protocolIdOnlyYaml);
    expect(decodedPidOnly.metadata.protocolNumber).toBe("PID-ONLY-2026");
    expect(decodedPidOnly.visits.byId.v_1.assignedFormIds).toEqual(["f_1"]);
  });

  it("round-trips ODM-XML 1.3.2 in Node.js without DOMParser, scoping ItemDef per form and preserving units, ranges, formulas, rules, and visit windows", () => {
    expect(
      (globalThis as unknown as Record<string, unknown>).DOMParser
    ).toBeUndefined();

    // Reject XML with DTD <!ENTITY> declarations
    expect(() =>
      parseXmlDocument(
        '<?xml version="1.0"?><!DOCTYPE ODM [<!ENTITY xxe "bad">]><ODM/>'
      )
    ).toThrow();

    const sharedVarStudy: StudyProtocol = {
      id: "study_odm_roundtrip",
      protocolNumber: "ODM-RT-2026",
      studyName: "ODM Roundtrip Fidelity Study",
      phase: "Phase II",
      sponsor: "CDISC Labs",
      therapeuticArea: "Cardiology",
      version: "2.0",
      lastModified: "2026-08-15T00:00:00.000Z",
      codelists: [],
      visits: [
        {
          id: "vis_scr",
          oid: "SE.SCR",
          name: "Screening",
          visitType: "Scheduled",
          targetDay: -14,
          windowBefore: 7,
          windowAfter: 3,
          assignedFormIds: ["form_scr_vs", "form_surg_vs"],
        },
      ],
      forms: [
        {
          id: "form_scr_vs",
          name: "Screening Vitals",
          domain: "VS",
          description: "Outpatient screening vitals",
          version: "1.0",
          sections: [
            {
              id: "sec_scr_1",
              title: "Anthropometrics",
              fields: [
                {
                  id: "f_scr_wt",
                  variableName: "WEIGHT",
                  label: "Outpatient Weight",
                  dataType: "number",
                  unit: "kg",
                  minValue: 35,
                  maxValue: 220,
                  columnSpan: 6,
                  required: true,
                },
                {
                  id: "f_scr_ht",
                  variableName: "HEIGHT",
                  label: "Outpatient Height",
                  dataType: "number",
                  unit: "cm",
                  minValue: 120,
                  maxValue: 230,
                  columnSpan: 6,
                  required: true,
                },
                {
                  id: "f_scr_bmi",
                  variableName: "BMI",
                  label: "Screening BMI",
                  dataType: "calculated",
                  calculationFormula:
                    "WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100))",
                  columnSpan: 6,
                  required: false,
                },
              ],
            },
          ],
          rules: [
            {
              id: "rule_bmi_alert",
              name: "High BMI Query",
              description: "Raise query when BMI exceeds 40",
              triggerFieldIds: ["f_scr_bmi"],
              targetFieldId: "f_scr_bmi",
              actionType: "raise_query",
              queryMessage: "Confirm BMI > 40 eligibility",
              logicalOperator: "AND",
              conditions: [
                {
                  fieldId: "f_scr_bmi",
                  operator: "gt",
                  value: 40,
                },
              ],
            },
          ],
        },
        {
          id: "form_surg_vs",
          name: "Pre-Op Weight Check",
          domain: "VS",
          description: "Day-of-procedure weight in pounds",
          version: "1.0",
          sections: [
            {
              id: "sec_surg_1",
              title: "Pre-Op Weight",
              fields: [
                {
                  id: "f_surg_wt",
                  variableName: "WEIGHT",
                  label: "Pre-Op Weight (lb)",
                  dataType: "number",
                  unit: "lb",
                  minValue: 80,
                  maxValue: 480,
                  columnSpan: 6,
                  required: true,
                },
              ],
            },
          ],
          rules: [],
        },
      ],
    };

    const xmlA = exportStudyToCdiscOdmXml(sharedVarStudy);
    const xmlB = exportStudyToCdiscOdmXml(sharedVarStudy);
    // Deterministic output without wall-clock timestamps or consultationUrl
    expect(xmlA).toBe(xmlB);
    expect(xmlA).not.toContain("/schedule");
    expect(xmlA).toContain('ItemDef OID="IT.form_scr_vs.WEIGHT"');
    expect(xmlA).toContain('ItemDef OID="IT.form_surg_vs.WEIGHT"');
    expect(xmlA).toContain("<BasicDefinitions>");
    expect(xmlA).toContain("<MeasurementUnit ");
    expect(xmlA).toContain('<RangeCheck Comparator="GE"');
    expect(xmlA).toContain('<RangeCheck Comparator="LE"');
    expect(xmlA).toContain("<ConditionDef ");
    expect(xmlA).toContain("<MethodDef ");
    expect(xmlA).toContain("<FormalExpression ");

    const reimported = importStudyFromCdiscOdmXml(xmlA);
    expect(reimported.visits[0]).toMatchObject({
      visitType: "Scheduled",
      targetDay: -14,
      windowBefore: 7,
      windowAfter: 3,
    });

    const scrWt = reimported.forms[0].sections[0].fields.find(
      (f) => f.variableName === "WEIGHT"
    );
    const surgWt = reimported.forms[1].sections[0].fields.find(
      (f) => f.variableName === "WEIGHT"
    );
    expect(scrWt?.label).toBe("Outpatient Weight");
    expect(scrWt?.unit).toBe("kg");
    expect(scrWt?.minValue).toBe(35);
    expect(scrWt?.maxValue).toBe(220);

    expect(surgWt?.label).toBe("Pre-Op Weight (lb)");
    expect(surgWt?.unit).toBe("lb");
    expect(surgWt?.minValue).toBe(80);
    expect(surgWt?.maxValue).toBe(480);

    const bmiField = reimported.forms[0].sections[0].fields.find(
      (f) => f.variableName === "BMI"
    );
    expect(bmiField?.dataType).toBe("calculated");
    expect(bmiField?.calculationFormula).toContain("WEIGHT");
    expect(reimported.forms[0].rules).toHaveLength(1);
    expect(reimported.forms[0].rules[0].actionType).toBe("raise_query");

    // Reject invalid visitType on ODM decode and encode
    const badVisitTypeXml = xmlA.replace(
      'Type="Scheduled"',
      'Type="TeleportedVisit"'
    );
    expect(() => importStudyFromCdiscOdmXml(badVisitTypeXml)).toThrow();
    expect(() =>
      exportStudyToCdiscOdmXml({
        ...sharedVarStudy,
        visits: [
          {
            ...sharedVarStudy.visits[0],
            visitType:
              "TeleportedVisit" as StudyProtocol["visits"][0]["visitType"],
          },
        ],
      })
    ).toThrow();
  });

  it("exports typed FhirQuestionnaire and FhirBundle models without consultationUrl or wall-clock dates", () => {
    const fixedStudy: StudyProtocol = {
      ...ONCOLOGY_RECIST_PRESET,
      lastModified: "2026-08-15",
    };

    const singleQuestionnaire: FhirQuestionnaire =
      exportFormToFhirQuestionnaire(fixedStudy.forms[0], fixedStudy);
    const studyBundle: FhirBundle = exportStudyToFhirQuestionnaire(fixedStudy);
    const studyBundleRepeat: FhirBundle =
      exportStudyToFhirQuestionnaire(fixedStudy);

    expect(singleQuestionnaire.resourceType).toBe("Questionnaire");
    expect(singleQuestionnaire.status).toBe("active");
    expect(singleQuestionnaire.date).toBe("2026-08-15");
    expect(studyBundle.resourceType).toBe("Bundle");
    expect(studyBundle.type).toBe("collection");
    expect(studyBundle.entry).toHaveLength(fixedStudy.forms.length);
    expect(JSON.stringify(studyBundle)).toBe(JSON.stringify(studyBundleRepeat));
    expect(JSON.stringify(studyBundle)).not.toContain("/schedule");

    const decoded = FhirR4QuestionnaireCodec.decode(
      JSON.stringify(studyBundle)
    );
    expect(decoded.forms.order).toHaveLength(fixedStudy.forms.length);
  });

  it("round-trips symmetric RedcapCsvCodec, CdiscCsvSpecCodec, OdmXml132Codec, UsdmV4Codec, UsdmV3Codec, and YAML flow/quote syntax with strict CodecValidationError handling", () => {
    const richCsvStudy: StudyProtocol = {
      ...ONCOLOGY_RECIST_PRESET,
      forms: [
        {
          id: "form_all_types",
          name: "Comprehensive Acquisition, Notes",
          domain: "VS",
          description: "Exercises CSV and codec field mappings",
          version: "1.0",
          sections: [
            {
              id: "sec_main",
              title: 'Primary Section, "A"',
              fields: [
                {
                  id: "f_txt",
                  variableName: "VSTXT",
                  label: 'Short Text, "Quoted"',
                  description: "Enter short text",
                  dataType: "text",
                  columnSpan: 6,
                  required: true,
                },
                {
                  id: "f_notes",
                  variableName: "VSNOTES",
                  label: "Clinical Notes",
                  dataType: "textarea",
                  columnSpan: 12,
                  required: false,
                },
                {
                  id: "f_rad",
                  variableName: "VSPOS",
                  label: "Position",
                  dataType: "radio",
                  customOptions: [
                    { code: "SUPINE", label: "Supine", order: 1 },
                    { code: "SITTING", label: "Sitting", order: 2 },
                  ],
                  columnSpan: 6,
                  required: true,
                },
                {
                  id: "f_dd",
                  variableName: "VSLOC",
                  label: "Location",
                  dataType: "single_select",
                  codelistId: ONCOLOGY_RECIST_PRESET.codelists[0]?.id,
                  columnSpan: 6,
                  required: false,
                },
                {
                  id: "f_chk",
                  variableName: "VSFLAGS",
                  label: "Flags",
                  dataType: "checkbox",
                  customOptions: [{ code: "FAST", label: "Fasting", order: 1 }],
                  columnSpan: 6,
                  required: false,
                },
                {
                  id: "f_int",
                  variableName: "PULSE",
                  label: "Pulse",
                  dataType: "integer",
                  unit: "bpm",
                  minValue: 30,
                  maxValue: 220,
                  columnSpan: 4,
                  required: true,
                },
                {
                  id: "f_num",
                  variableName: "WEIGHT",
                  label: "Weight",
                  dataType: "number",
                  unit: "kg",
                  minValue: 20,
                  maxValue: 250,
                  columnSpan: 4,
                  required: true,
                },
                {
                  id: "f_calc",
                  variableName: "WTRATIO",
                  label: "Weight Ratio",
                  dataType: "calculated",
                  calculationFormula: "WEIGHT / 2",
                  columnSpan: 4,
                  required: false,
                },
                {
                  id: "f_vas",
                  variableName: "PAINVAS",
                  label: "Pain VAS",
                  dataType: "vas_scale",
                  columnSpan: 6,
                  required: false,
                },
                {
                  id: "f_dt",
                  variableName: "VSDAT",
                  label: "Assessment Date",
                  dataType: "date",
                  columnSpan: 4,
                  required: true,
                },
                {
                  id: "f_dtm",
                  variableName: "VSDTM",
                  label: "Assessment DateTime",
                  dataType: "datetime",
                  columnSpan: 4,
                  required: false,
                },
                {
                  id: "f_tm",
                  variableName: "VSTIM",
                  label: "Assessment Time",
                  dataType: "time",
                  columnSpan: 4,
                  required: false,
                },
              ],
            },
          ],
          rules: [],
        },
      ],
    };

    const canonical = toCanonicalCrfDocument(richCsvStudy);

    // RedcapCsvCodec encode + decode + error wrapping
    const redcapCsv = RedcapCsvCodec.encode(canonical);
    expect(RedcapCsvCodec.canDecode({ raw: redcapCsv })).toBe(true);
    expect(CdiscCsvSpecCodec.canDecode({ raw: redcapCsv })).toBe(false);
    const decodedRedcap = RedcapCsvCodec.decode(redcapCsv);
    expect(decodedRedcap.forms.order.length).toBe(1);
    expect(() => CdiscCsvSpecCodec.decode(redcapCsv)).toThrow(
      CodecValidationError
    );
    expect(() => RedcapCsvCodec.decode("")).toThrow(CodecValidationError);

    // CdiscCsvSpecCodec encode + decode + error wrapping
    const cdiscCsv = CdiscCsvSpecCodec.encode(canonical);
    expect(CdiscCsvSpecCodec.canDecode({ raw: cdiscCsv })).toBe(true);
    expect(RedcapCsvCodec.canDecode({ raw: cdiscCsv })).toBe(false);
    const decodedCdisc = CdiscCsvSpecCodec.decode(cdiscCsv);
    expect(decodedCdisc.forms.order.length).toBe(1);
    expect(() => CdiscCsvSpecCodec.decode("just prose")).toThrow(
      CodecValidationError
    );

    // OdmXml132Codec encode + decode + error wrapping
    const odmXml = OdmXml132Codec.encode(canonical);
    expect(OdmXml132Codec.canDecode({ raw: odmXml })).toBe(true);
    const decodedOdm = OdmXml132Codec.decode(odmXml);
    expect(decodedOdm.forms.order).toEqual(["form_all_types"]);
    expect(() => OdmXml132Codec.decode("<ODM><unclosed>")).toThrow(
      CodecValidationError
    );

    // UsdmV4Codec and UsdmV3Codec encode + decode + error wrapping
    const usdmV4Json = UsdmV4Codec.encode(canonical);
    expect(UsdmV4Codec.canDecode({ raw: usdmV4Json })).toBe(true);
    expect(UsdmV3Codec.canDecode({ raw: usdmV4Json })).toBe(false);
    expect(UsdmV4Codec.decode(usdmV4Json).forms.order.length).toBe(1);
    expect(() => UsdmV4Codec.decode("{bad json")).toThrow(CodecValidationError);

    const usdmV3Payload = JSON.stringify({
      study: {
        name: "USDM-V3-STUDY",
        studyTitle: "Legacy V3 Study",
        studyDesigns: [
          {
            id: "sd_1",
            activities: [{ id: "act_dm", name: "Demographics" }],
          },
        ],
      },
    });
    expect(UsdmV3Codec.canDecode({ raw: usdmV3Payload })).toBe(true);
    expect(UsdmV4Codec.canDecode({ raw: usdmV3Payload })).toBe(false);
    const decodedV3 = UsdmV3Codec.decode(usdmV3Payload);
    expect(UsdmV3Codec.encode(decodedV3)).toContain("usdmVersion");
    expect(() => UsdmV3Codec.decode("{bad json")).toThrow(CodecValidationError);

    // YAML lexer flow collections, single-quoted escapes, and comments
    const parsedYaml = parseYamlAst(
      [
        "# YAML subset features",
        "title: 'Patient''s Baseline Summary'",
        'tags: [alpha, "beta", 42, true, null]',
        "meta: { reviewed: true, count: 3 }",
      ].join("\n")
    );
    expect(parsedYaml.kind).toBe("mapping");
    expect(evaluateYamlAst(parsedYaml)).toEqual({
      title: "Patient's Baseline Summary",
      tags: ["alpha", "beta", 42, true, null],
      meta: { reviewed: true, count: 3 },
    });
  });
});
