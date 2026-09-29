import * as fc from "fast-check";
import type {
  StudyProtocol,
  CRFForm,
  CRFSection,
  CRFField,
  StudyVisit,
  StudyArm,
  StudyEpoch,
  StudyCohort,
  BiomedicalConcept,
  CodelistDefinition,
  CodelistOption,
  ClinicalDataType,
} from "@/lib/crf/types";

export const clinicalDataTypeArbitrary: fc.Arbitrary<ClinicalDataType> =
  fc.constantFrom(
    "text",
    "textarea",
    "number",
    "integer",
    "date",
    "partial_date",
    "precision_date",
    "time",
    "datetime",
    "single_select",
    "multi_select",
    "radio",
    "checkbox",
    "vas_scale",
    "nrs_scale",
    "calculated",
    "repeating_table",
    "signature"
  );

export const codelistOptionArbitrary: fc.Arbitrary<CodelistOption> = fc.record({
  code: fc.stringMatching(/^[A-Za-z0-9_-]{1,15}$/),
  label: fc.string({ minLength: 1, maxLength: 50 }),
  nciCode: fc.option(fc.stringMatching(/^C\d{4,6}$/), { nil: undefined }),
  order: fc.integer({ min: 1, max: 100 }),
});

export const codelistDefinitionArbitrary: fc.Arbitrary<CodelistDefinition> =
  fc.record({
    id: fc.stringMatching(/^CL_[A-Z0-9_]{1,15}$/),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    nciCodelistCode: fc.option(fc.stringMatching(/^C\d{4,6}$/), {
      nil: undefined,
    }),
    isStandard: fc.boolean(),
    options: fc.array(codelistOptionArbitrary, { minLength: 0, maxLength: 5 }),
  });

export const crfFieldArbitrary: fc.Arbitrary<CRFField> = fc.record({
  id: fc.stringMatching(/^f_[a-z0-9_]{1,10}$/),
  variableName: fc.stringMatching(/^[A-Z][A-Z0-9_]{1,8}$/),
  label: fc.string({ minLength: 1, maxLength: 60 }),
  dataType: clinicalDataTypeArbitrary,
  required: fc.boolean(),
  columnSpan: fc.constantFrom(3 as const, 6 as const, 12 as const),
  codelistId: fc.option(fc.stringMatching(/^CL_[A-Z0-9_]{1,15}$/), {
    nil: undefined,
  }),
  customOptions: fc.option(
    fc.array(codelistOptionArbitrary, { minLength: 0, maxLength: 3 }),
    { nil: undefined }
  ),
  unit: fc.option(
    fc.constantFrom("mmHg", "kg", "cm", "g/dL", "mg/mL", "mmol/L"),
    { nil: undefined }
  ),
  minValue: fc.option(fc.integer({ min: -100, max: 100 }), { nil: undefined }),
  maxValue: fc.option(fc.integer({ min: 101, max: 500 }), { nil: undefined }),
  conceptId: fc.option(fc.stringMatching(/^bc_[a-z0-9_]{1,10}$/), {
    nil: undefined,
  }),
});

export const crfSectionArbitrary: fc.Arbitrary<CRFSection> = fc.record({
  id: fc.stringMatching(/^sec_[a-z0-9_]{1,10}$/),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  isRepeating: fc.option(fc.boolean(), { nil: undefined }),
  fields: fc.array(crfFieldArbitrary, { minLength: 1, maxLength: 4 }),
});

export const crfFormArbitrary: fc.Arbitrary<CRFForm> = fc.record({
  id: fc.stringMatching(/^form_[a-z0-9_]{1,10}$/),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  domain: fc.stringMatching(/^[A-Z]{2,4}$/),
  description: fc.string({ maxLength: 100 }),
  version: fc.constantFrom("1.0", "1.1", "2.0"),
  isLogForm: fc.option(fc.boolean(), { nil: undefined }),
  sections: fc.array(crfSectionArbitrary, { minLength: 1, maxLength: 3 }),
  rules: fc.constant<import("@/lib/crf/types").EditCheckRule[]>([]),
});

export const studyVisitArbitrary: fc.Arbitrary<StudyVisit> = fc.record({
  id: fc.stringMatching(/^v_[a-z0-9_]{1,10}$/),
  oid: fc.stringMatching(/^SE\.VIS_[A-Z0-9_]{1,10}$/),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  visitType: fc.constantFrom(
    "Scheduled" as const,
    "Unscheduled" as const,
    "Common" as const
  ),
  targetDay: fc.integer({ min: 1, max: 365 }),
  windowBefore: fc.integer({ min: 0, max: 14 }),
  windowAfter: fc.integer({ min: 0, max: 14 }),
  assignedFormIds: fc.array(fc.stringMatching(/^form_[a-z0-9_]{1,10}$/), {
    minLength: 0,
    maxLength: 3,
  }),
  epochId: fc.option(fc.stringMatching(/^e_[a-z0-9_]{1,8}$/), {
    nil: undefined,
  }),
  armIds: fc.option(fc.array(fc.stringMatching(/^arm_[a-z0-9_]{1,8}$/)), {
    nil: undefined,
  }),
  isRepeating: fc.option(fc.boolean(), { nil: undefined }),
});

export const studyArmArbitrary: fc.Arbitrary<StudyArm> = fc.record({
  id: fc.stringMatching(/^arm_[a-z0-9_]{1,8}$/),
  name: fc.string({ minLength: 1, maxLength: 40 }),
  type: fc.constantFrom(
    "Experimental",
    "Active Comparator",
    "Placebo Comparator"
  ),
  description: fc.option(fc.string({ maxLength: 80 }), { nil: undefined }),
  epochIds: fc.option(fc.array(fc.stringMatching(/^e_[a-z0-9_]{1,8}$/)), {
    nil: undefined,
  }),
});

export const studyEpochArbitrary: fc.Arbitrary<StudyEpoch> = fc.record({
  id: fc.stringMatching(/^e_[a-z0-9_]{1,8}$/),
  name: fc.string({ minLength: 1, maxLength: 40 }),
  sequenceNumber: fc.integer({ min: 1, max: 10 }),
  type: fc.option(fc.constantFrom("Screening", "Treatment", "Follow-Up"), {
    nil: undefined,
  }),
});

export const studyCohortArbitrary: fc.Arbitrary<StudyCohort> = fc.record({
  id: fc.stringMatching(/^c_[a-z0-9_]{1,8}$/),
  name: fc.string({ minLength: 1, maxLength: 40 }),
  armIds: fc.option(fc.array(fc.stringMatching(/^arm_[a-z0-9_]{1,8}$/)), {
    nil: undefined,
  }),
  targetSize: fc.option(fc.integer({ min: 10, max: 1000 }), { nil: undefined }),
});

export const biomedicalConceptArbitrary: fc.Arbitrary<BiomedicalConcept> =
  fc.record({
    id: fc.stringMatching(/^bc_[a-z0-9_]{1,10}$/),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    conceptId: fc.option(fc.stringMatching(/^C\d{4,6}$/), { nil: undefined }),
    code: fc.option(fc.stringMatching(/^C\d{4,6}$/), { nil: undefined }),
    domain: fc.stringMatching(/^[A-Z]{2,4}$/),
    synonyms: fc.option(
      fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
        minLength: 0,
        maxLength: 3,
      }),
      { nil: undefined }
    ),
    properties: fc.option(
      fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 30 })
      ),
      { nil: undefined }
    ),
    variableName: fc.option(fc.stringMatching(/^[A-Z][A-Z0-9_]{1,8}$/), {
      nil: undefined,
    }),
    dataType: fc.option(clinicalDataTypeArbitrary, { nil: undefined }),
    label: fc.option(fc.string({ minLength: 1, maxLength: 50 }), {
      nil: undefined,
    }),
    unit: fc.option(fc.string({ minLength: 1, maxLength: 10 }), {
      nil: undefined,
    }),
  });

export const studyProtocolArbitrary: fc.Arbitrary<StudyProtocol> = fc
  .record({
    id: fc.stringMatching(/^std_[a-z0-9_]{1,10}$/),
    protocolNumber: fc.stringMatching(/^[A-Z0-9_-]{3,15}$/),
    studyName: fc.string({ minLength: 1, maxLength: 60 }),
    phase: fc.constantFrom("Phase I", "Phase II", "Phase III", "Phase IV"),
    sponsor: fc.string({ minLength: 1, maxLength: 50 }),
    therapeuticArea: fc.string({ minLength: 1, maxLength: 40 }),
    version: fc.constantFrom("1.0", "1.1", "2.0"),
    lastModified: fc.constant("2026-09-29T10:00:00.000Z"),
    forms: fc.array(crfFormArbitrary, { minLength: 1, maxLength: 3 }),
    visits: fc.array(studyVisitArbitrary, { minLength: 1, maxLength: 4 }),
    codelists: fc.array(codelistDefinitionArbitrary, {
      minLength: 1,
      maxLength: 3,
    }),
    arms: fc.option(
      fc.array(studyArmArbitrary, { minLength: 0, maxLength: 2 }),
      { nil: undefined }
    ),
    epochs: fc.option(
      fc.array(studyEpochArbitrary, { minLength: 0, maxLength: 3 }),
      { nil: undefined }
    ),
    cohorts: fc.option(
      fc.array(studyCohortArbitrary, { minLength: 0, maxLength: 2 }),
      { nil: undefined }
    ),
    biomedicalConcepts: fc.option(
      fc.array(biomedicalConceptArbitrary, { minLength: 0, maxLength: 3 }),
      { nil: undefined }
    ),
    rules: fc.constant<import("@/lib/crf/types").EditCheckRule[]>([]),
  })
  .map((study) => {
    // Enforce unique IDs and variable names
    const codelistIds = study.codelists.map((c, i) => `CL_${i + 1}`);
    const codelists = study.codelists.map((c, i) => ({
      ...c,
      id: codelistIds[i],
    }));

    let globalFieldCounter = 1;
    const forms = study.forms.map((f, fIdx) => {
      const formId = `form_${fIdx + 1}`;
      const domain = f.domain || "CRF";
      return {
        ...f,
        id: formId,
        sections: f.sections.map((s, sIdx) => ({
          ...s,
          id: `sec_${fIdx + 1}_${sIdx + 1}`,
          fields: s.fields.map((field) => {
            const fieldIdx = globalFieldCounter++;
            const varName = `${domain}_VAR_${fieldIdx}`;
            const useSharedCodelist =
              codelistIds.length > 0 && fieldIdx % 2 === 0;
            return {
              ...field,
              id: `f_${fIdx + 1}_${fieldIdx}`,
              variableName: varName,
              conceptId: `bc_${fIdx + 1}_${fieldIdx}`,
              codelistId: useSharedCodelist
                ? codelistIds[fieldIdx % codelistIds.length]
                : undefined,
              customOptions: useSharedCodelist
                ? undefined
                : field.customOptions,
            };
          }),
        })),
      };
    });

    const formIds = forms.map((f) => f.id);
    const visits = study.visits.map((v, vIdx) => ({
      ...v,
      id: `v_${vIdx + 1}`,
      oid: `SE.VIS_${vIdx + 1}`,
      assignedFormIds: formIds.slice(0, Math.min(2, formIds.length)),
    }));

    return {
      ...study,
      codelists,
      forms,
      visits,
    };
  });

export const malformedXmlStringArbitrary: fc.Arbitrary<string> = fc.oneof(
  fc.string(),
  fc.string({ minLength: 0, maxLength: 200 }),
  fc.constantFrom(
    '<script>alert("xss")</script>',
    '"><test attr="val&foo">',
    "<!-- comment --> & <tag> 'quote' \"double\"",
    "]]></CDATA>",
    '<?xml version="1.0" encoding="UTF-8"?><root>&bad;</root>'
  )
);

export const malformedCodelistArbitrary: fc.Arbitrary<unknown> = fc.oneof(
  fc.anything(),
  fc.record({ codeList: fc.anything() }),
  fc.record({ valueSet: fc.anything() }),
  fc.record({ codelist: fc.anything() }),
  fc.record({
    id: fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
    name: fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
    options: fc.array(
      fc.oneof(
        fc.string(),
        fc.integer(),
        fc.boolean(),
        fc.constant(null),
        fc.record({
          code: fc.anything(),
          label: fc.anything(),
          nciCode: fc.anything(),
        })
      ),
      { minLength: 0, maxLength: 5 }
    ),
  })
);

export const malformedUsdmDocArbitrary: fc.Arbitrary<unknown> = fc.oneof(
  fc.jsonValue(),
  fc.record({
    study: fc.oneof(
      fc.anything(),
      fc.record({
        studyDesigns: fc.oneof(
          fc.anything(),
          fc.array(
            fc.record({
              arms: fc.anything(),
              epochs: fc.anything(),
              encounters: fc.anything(),
              activities: fc.anything(),
              biomedicalConcepts: fc.anything(),
              codeLists: fc.anything(),
            }),
            { minLength: 0, maxLength: 2 }
          )
        ),
      })
    ),
    valueSets: fc.anything(),
    codeLists: fc.anything(),
  })
);
