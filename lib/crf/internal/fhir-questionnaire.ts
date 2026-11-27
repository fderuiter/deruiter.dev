import {
  StudyProtocol,
  CRFForm,
  CRFSection,
  CRFField,
  ClinicalDataType,
  CodelistDefinition,
  CodelistOption,
  StudyVisit,
} from "../types";
import {
  CDASH_STANDARD_VARIABLES,
  STANDARD_CODELISTS,
} from "./cdisc-cdash-library";
import { consultationUrl } from "./export-annotations";

/** The NCI Thesaurus code system URI that HL7 terminology assigns. */
const NCIT_SYSTEM = "http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl";
/** CRF Studio's code system for values that are not CDISC terms. */
const CRF_STUDIO_CODE_SYSTEM = "https://deruiter.dev/crf-studio";
/** HL7 FHIR Questionnaire unit extension URI. */
const FHIR_UNIT_EXT_URL =
  "http://hl7.org/fhir/StructureDefinition/questionnaire-unit";
/** NLM LHC-Forms Questionnaire unit option extension URI. */
const FHIR_UNIT_OPTION_EXT_URL =
  "http://hl7.org/fhir/StructureDefinition/questionnaire-unitOption";
/** HL7 FHIR SDC / LHC-Forms itemControl extension URI. */
const FHIR_ITEM_CONTROL_EXT_URL =
  "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl";

const TABLE_ITEM_CONTROLS = new Set([
  "gtable",
  "table",
  "htable",
  "grid",
  "atable",
]);

/** Maximum nested `Questionnaire.item` levels accepted before rejecting import. */
const MAX_FHIR_ITEM_DEPTH = 32;

/**
 * Maps ClinicalDataType to FHIR QuestionnaireItemType
 */
function mapToFhirItemType(type: string): string {
  switch (type) {
    case "integer":
      return "integer";
    case "number":
    case "calculated":
    case "vas_scale":
    case "nrs_scale":
      return "decimal";
    case "date":
    case "partial_date":
    case "precision_date":
      return "date";
    case "time":
      return "time";
    case "datetime":
      return "dateTime";
    case "single_select":
    case "radio":
      return "choice";
    case "multi_select":
    case "checkbox":
      return "open-choice";
    case "textarea":
      return "text";
    case "text":
      return "string";
    case "repeating_table":
      return "group";
    default:
      return "string";
  }
}

/**
 * Converts a CRFForm into an HL7 FHIR R4 Questionnaire Resource
 */
export function exportFormToFhirQuestionnaire(
  form: CRFForm,
  study: StudyProtocol
): object {
  return {
    resourceType: "Questionnaire",
    id: `crf-${form.id.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
    url: `https://clinicaltrials.gov/fhir/Questionnaire/${study.protocolNumber}/${form.domain || form.id}`,
    identifier: [
      {
        system: "urn:ietf:rfc:3986",
        value: `urn:uuid:${form.id}`,
      },
    ],
    version: form.version || "1.0",
    name: form.name.replace(/[^A-Za-z0-9]/g, ""),
    title: form.name,
    status: "active",
    date: new Date().toISOString().split("T")[0],
    publisher: study.sponsor || "Clinical Study Sponsor",
    description: form.description
      ? `${form.description} • Schedule Consultation: ${consultationUrl()}`
      : `Schedule Consultation: ${consultationUrl()}`,
    item: form.sections.map((sec, sIdx) => ({
      linkId: `section-${sIdx + 1}`,
      text: sec.title,
      type: "group",
      item: sec.fields.map((field) => {
        const itemObj: Record<string, unknown> = {
          linkId: field.variableName || field.id,
          text: field.label,
          type: mapToFhirItemType(field.dataType),
          required: !!field.required,
        };

        if (field.unit) {
          itemObj.extension = [
            {
              url: "http://hl7.org/fhir/StructureDefinition/questionnaire-unit",
              valueCoding: {
                system: "http://unitsofmeasure.org",
                code: field.unit,
                display: field.unit,
              },
            },
          ];
        }

        // Codelist options
        const codelist = study.codelists.find(
          (cl) => cl.id === field.codelistId
        );
        const options = field.customOptions || codelist?.options;
        if (options && options.length > 0) {
          // A CDISC term is coded by its NCI Thesaurus concept, under the
          // NCIt system URI HL7 assigns; any other option keeps its
          // submission value under CRF Studio's own code system.
          itemObj.answerOption = options.map((opt) => ({
            valueCoding: opt.nciCode
              ? { system: NCIT_SYSTEM, code: opt.nciCode, display: opt.label }
              : {
                  system: CRF_STUDIO_CODE_SYSTEM,
                  code: opt.code,
                  display: opt.label,
                },
          }));
        }

        return itemObj;
      }),
    })),
  };
}

/**
 * Converts an entire StudyProtocol into an HL7 FHIR Bundle of Questionnaire Resources
 */
export function exportStudyToFhirQuestionnaire(study: StudyProtocol): object {
  const protoNum = study.protocolNumber || "study";
  return {
    resourceType: "Bundle",
    type: "collection",
    id: `bundle-${protoNum.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
    entry: study.forms.map((form) => ({
      resource: exportFormToFhirQuestionnaire(form, study),
    })),
  };
}

interface CodelistCollector {
  byId: Map<string, CodelistDefinition>;
  byFingerprint: Map<string, CodelistDefinition>;
}

interface ParsedFhirFormResult {
  form: CRFForm;
  protocolFromUrl?: string;
  publisher?: string;
  date?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseFhirJsonObject(
  input: string | Record<string, unknown>
): Record<string, unknown> {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new Error("Empty HL7 FHIR JSON payload.");
    }
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) {
      throw new Error("Invalid HL7 FHIR JSON: root value must be an object.");
    }
    return parsed;
  }
  if (!isRecord(input)) {
    throw new Error("Invalid HL7 FHIR JSON: root value must be an object.");
  }
  return input;
}

function stripConsultationSuffix(description: unknown): string {
  if (typeof description !== "string") return "";
  return description
    .replace(/\s*(?:•|\||-)?\s*Schedule Consultation:\s*\S+\s*$/i, "")
    .trim();
}

function extractItemControlCode(extensions: unknown): string | undefined {
  if (!Array.isArray(extensions)) return undefined;
  for (const ext of extensions) {
    if (!isRecord(ext) || ext.url !== FHIR_ITEM_CONTROL_EXT_URL) continue;
    if (isRecord(ext.valueCodeableConcept)) {
      const coding = ext.valueCodeableConcept.coding;
      if (Array.isArray(coding)) {
        for (const c of coding) {
          if (isRecord(c) && typeof c.code === "string" && c.code.trim()) {
            return c.code.trim().toLowerCase();
          }
        }
      }
    }
    if (
      isRecord(ext.valueCoding) &&
      typeof ext.valueCoding.code === "string" &&
      ext.valueCoding.code.trim()
    ) {
      return ext.valueCoding.code.trim().toLowerCase();
    }
    if (typeof ext.valueCode === "string" && ext.valueCode.trim()) {
      return ext.valueCode.trim().toLowerCase();
    }
  }
  return undefined;
}

function extractUnitMetadata(item: Record<string, unknown>): {
  unit?: string;
  unitOptions?: string[];
} {
  let explicitUnit: string | undefined;
  const unitOptions: string[] = [];

  if (Array.isArray(item.extension)) {
    for (const ext of item.extension) {
      if (!isRecord(ext)) continue;
      if (ext.url === FHIR_UNIT_EXT_URL) {
        if (isRecord(ext.valueCoding)) {
          const u =
            (typeof ext.valueCoding.code === "string" &&
              ext.valueCoding.code.trim()) ||
            (typeof ext.valueCoding.display === "string" &&
              ext.valueCoding.display.trim());
          if (u) explicitUnit = u;
        } else if (
          typeof ext.valueString === "string" &&
          ext.valueString.trim()
        ) {
          explicitUnit = ext.valueString.trim();
        }
      } else if (ext.url === FHIR_UNIT_OPTION_EXT_URL) {
        if (isRecord(ext.valueCoding)) {
          const u =
            (typeof ext.valueCoding.code === "string" &&
              ext.valueCoding.code.trim()) ||
            (typeof ext.valueCoding.display === "string" &&
              ext.valueCoding.display.trim());
          if (u && !unitOptions.includes(u)) {
            unitOptions.push(u);
          }
        }
      }
    }
  }

  if (!explicitUnit && unitOptions.length > 0) {
    explicitUnit = unitOptions[0];
  }

  if (!explicitUnit && Array.isArray(item.initial)) {
    for (const initEntry of item.initial) {
      if (isRecord(initEntry) && isRecord(initEntry.valueQuantity)) {
        const qUnit =
          (typeof initEntry.valueQuantity.unit === "string" &&
            initEntry.valueQuantity.unit.trim()) ||
          (typeof initEntry.valueQuantity.code === "string" &&
            initEntry.valueQuantity.code.trim());
        if (qUnit) {
          explicitUnit = qUnit;
          break;
        }
      }
    }
  }

  return {
    unit: explicitUnit,
    unitOptions: unitOptions.length > 0 ? unitOptions : undefined,
  };
}

function mapFhirItemToClinicalType(
  fhirType: string,
  itemControl: string | undefined,
  repeats: boolean,
  hasOptions: boolean
): ClinicalDataType {
  if (itemControl) {
    if (itemControl === "radio-button") return "radio";
    if (itemControl === "check-box") return "checkbox";
    if (itemControl === "drop-down" || itemControl === "autocomplete") {
      return repeats ? "multi_select" : "single_select";
    }
    if (itemControl === "slider") return "vas_scale";
    if (itemControl === "text-box") return "textarea";
    if (TABLE_ITEM_CONTROLS.has(itemControl)) return "repeating_table";
  }

  switch (fhirType) {
    case "integer":
      return "integer";
    case "decimal":
    case "quantity":
      return "number";
    case "date":
      return "date";
    case "dateTime":
    case "instant":
      return "datetime";
    case "time":
      return "time";
    case "boolean":
      return "radio";
    case "choice":
      return repeats ? "multi_select" : "single_select";
    case "open-choice":
      return "multi_select";
    case "text":
      return "textarea";
    case "group":
      return "repeating_table";
    default:
      if (hasOptions) {
        return repeats ? "multi_select" : "single_select";
      }
      return "text";
  }
}

function resolveValueSetAnswerOptions(
  answerValueSetRef: string,
  valueSets: Record<string, unknown>[]
): Record<string, unknown>[] {
  const ref = answerValueSetRef.trim();
  if (!ref) return [];
  const localId = ref.startsWith("#") ? ref.slice(1) : undefined;

  const matched = valueSets.find((vs) => {
    if (vs.resourceType !== "ValueSet") return false;
    if (localId && typeof vs.id === "string" && vs.id === localId) return true;
    if (typeof vs.url === "string" && vs.url === ref) return true;
    return false;
  });

  if (!matched) return [];

  const result: Record<string, unknown>[] = [];
  if (
    isRecord(matched.expansion) &&
    Array.isArray(matched.expansion.contains)
  ) {
    for (const entry of matched.expansion.contains) {
      if (!isRecord(entry)) continue;
      result.push({
        valueCoding: {
          system: entry.system,
          code: entry.code,
          display: entry.display,
        },
      });
    }
    if (result.length > 0) return result;
  }

  if (isRecord(matched.compose) && Array.isArray(matched.compose.include)) {
    for (const inc of matched.compose.include) {
      if (!isRecord(inc) || !Array.isArray(inc.concept)) continue;
      for (const concept of inc.concept) {
        if (!isRecord(concept)) continue;
        result.push({
          valueCoding: {
            system: inc.system,
            code: concept.code,
            display: concept.display,
          },
        });
      }
    }
  }

  return result;
}

function matchesStandardCodelistOptions(
  std: CodelistDefinition,
  rawOptions: Record<string, unknown>[]
): boolean {
  if (std.options.length !== rawOptions.length || rawOptions.length === 0) {
    return false;
  }

  return std.options.every((stdOpt, idx) => {
    const raw = rawOptions[idx];
    if (!isRecord(raw) || !isRecord(raw.valueCoding)) return false;
    const system =
      typeof raw.valueCoding.system === "string"
        ? raw.valueCoding.system.trim()
        : "";
    const code =
      raw.valueCoding.code !== undefined
        ? String(raw.valueCoding.code).trim()
        : "";
    const display =
      typeof raw.valueCoding.display === "string"
        ? raw.valueCoding.display.trim()
        : "";

    if (stdOpt.nciCode && system === NCIT_SYSTEM && code === stdOpt.nciCode) {
      return !display || display === stdOpt.label;
    }
    if (code === stdOpt.code && (!display || display === stdOpt.label)) {
      return true;
    }
    return false;
  });
}

function findMatchingStandardCodelist(
  rawOptions: Record<string, unknown>[],
  variableName: string,
  domain: string
): CodelistDefinition | undefined {
  const varUpper = variableName.toUpperCase();
  const domainUpper = domain.toUpperCase();
  const preferredId =
    CDASH_STANDARD_VARIABLES[domainUpper]?.find(
      (v) => v.sdtmVariable.toUpperCase() === varUpper
    )?.codelistId || `CL_${varUpper}`;

  const preferred = STANDARD_CODELISTS.find((cl) => cl.id === preferredId);
  if (preferred && matchesStandardCodelistOptions(preferred, rawOptions)) {
    return preferred;
  }

  return STANDARD_CODELISTS.find((cl) =>
    matchesStandardCodelistOptions(cl, rawOptions)
  );
}

function resolveSingleNcitStandardOption(
  nciCode: string,
  display: string
): CodelistOption | undefined {
  for (const cl of STANDARD_CODELISTS) {
    for (const opt of cl.options) {
      if (opt.nciCode === nciCode && (!display || opt.label === display)) {
        return opt;
      }
    }
  }
  return undefined;
}

function parseItemAnswerOptions(
  rawOptions: Record<string, unknown>[],
  variableName: string,
  label: string,
  domain: string,
  collector: CodelistCollector
): { codelistId?: string; customOptions?: CodelistOption[] } {
  if (rawOptions.length === 0) return {};

  const matchedStandard = findMatchingStandardCodelist(
    rawOptions,
    variableName,
    domain
  );
  if (matchedStandard) {
    collector.byId.set(matchedStandard.id, {
      ...matchedStandard,
      options: matchedStandard.options.map((o) => ({ ...o })),
    });
    return { codelistId: matchedStandard.id };
  }

  const options: CodelistOption[] = [];
  rawOptions.forEach((raw, idx) => {
    if (!isRecord(raw)) return;

    if (isRecord(raw.valueCoding)) {
      const system =
        typeof raw.valueCoding.system === "string"
          ? raw.valueCoding.system.trim()
          : "";
      const rawCode =
        raw.valueCoding.code !== undefined
          ? String(raw.valueCoding.code).trim()
          : "";
      const display =
        typeof raw.valueCoding.display === "string"
          ? raw.valueCoding.display.trim()
          : "";

      if (system === NCIT_SYSTEM && rawCode) {
        const stdOpt = resolveSingleNcitStandardOption(rawCode, display);
        options.push({
          code: stdOpt ? stdOpt.code : rawCode,
          label: display || stdOpt?.label || rawCode,
          nciCode: rawCode,
          order: options.length + 1,
        });
        return;
      }

      const code = rawCode || display || String(idx + 1);
      const optLabel = display || rawCode || code;
      options.push({
        code,
        label: optLabel,
        order: options.length + 1,
      });
      return;
    }

    const primitive =
      raw.valueString ?? raw.valueInteger ?? raw.valueDate ?? raw.valueTime;
    if (primitive !== undefined && primitive !== null) {
      const text = String(primitive).trim();
      if (text) {
        options.push({
          code: text,
          label: text,
          order: options.length + 1,
        });
      }
    }
  });

  if (options.length === 0) return {};

  const fingerprint = options
    .map((o) => `${o.code}:::${o.label}:::${o.nciCode || ""}`)
    .join("|||");

  const existingByFp = collector.byFingerprint.get(fingerprint);
  if (existingByFp) {
    return {
      codelistId: existingByFp.id,
      customOptions: options.map((o) => ({ ...o })),
    };
  }

  const sanitizedVar = variableName
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "");
  const baseId = sanitizedVar ? `CL_${sanitizedVar}` : "CL_FHIR_OPTIONS";
  let codelistId = baseId;
  let suffix = 1;
  while (collector.byId.has(codelistId)) {
    codelistId = `${baseId}_${suffix++}`;
  }

  const codelistDef: CodelistDefinition = {
    id: codelistId,
    name: `${label || variableName} Codelist`,
    options: options.map((o) => ({ ...o })),
    isStandard: false,
  };

  collector.byId.set(codelistId, codelistDef);
  collector.byFingerprint.set(fingerprint, codelistDef);

  return {
    codelistId,
    customOptions: options,
  };
}

function sanitizeIdentifierToken(raw: string, fallback: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

function extractFormIdentity(
  questionnaire: Record<string, unknown>,
  formIndex: number
): {
  formId: string;
  formName: string;
  domain: string;
  protocolFromUrl?: string;
} {
  let uuidFormId: string | undefined;
  if (Array.isArray(questionnaire.identifier)) {
    for (const ident of questionnaire.identifier) {
      if (isRecord(ident) && typeof ident.value === "string") {
        const val = ident.value.trim();
        if (val.startsWith("urn:uuid:") && val.length > "urn:uuid:".length) {
          uuidFormId = val.slice("urn:uuid:".length).trim();
          break;
        }
      }
    }
  }

  const rawId =
    typeof questionnaire.id === "string" ? questionnaire.id.trim() : "";
  const strippedCrfId = rawId.replace(/^crf-/, "");
  const title =
    typeof questionnaire.title === "string" ? questionnaire.title.trim() : "";
  const name =
    typeof questionnaire.name === "string" ? questionnaire.name.trim() : "";

  const formName =
    title || name || strippedCrfId || `FHIR Questionnaire ${formIndex + 1}`;
  const formId =
    uuidFormId ||
    strippedCrfId ||
    rawId ||
    `f_${sanitizeIdentifierToken(formName, `fhir_${formIndex + 1}`)}`;

  let domain = "GENERAL";
  let protocolFromUrl: string | undefined;

  if (typeof questionnaire.url === "string") {
    const urlStr = questionnaire.url.trim();
    const match = urlStr.match(/\/fhir\/Questionnaire\/([^/]+)\/([^/?#]+)$/);
    if (match) {
      const candidateProto = decodeURIComponent(match[1]);
      const candidateDomain = decodeURIComponent(match[2]);
      const isCrfStudioUrl = urlStr.startsWith(
        "https://clinicaltrials.gov/fhir/Questionnaire/"
      );
      if (isCrfStudioUrl || /^[A-Z][A-Z0-9_]{1,9}$/.test(candidateDomain)) {
        protocolFromUrl = candidateProto;
        if (candidateDomain && candidateDomain !== formId) {
          domain = candidateDomain;
        }
      }
    }
  }

  return { formId, formName, domain, protocolFromUrl };
}

function parseLeafField(
  item: Record<string, unknown>,
  fieldCounter: { count: number },
  domain: string,
  valueSets: Record<string, unknown>[],
  collector: CodelistCollector,
  depth = 0
): CRFField {
  if (depth > MAX_FHIR_ITEM_DEPTH) {
    throw new Error(
      `Questionnaire items are nested more than ${MAX_FHIR_ITEM_DEPTH} levels deep.`
    );
  }
  fieldCounter.count += 1;
  const idx = fieldCounter.count;
  const rawLinkId =
    typeof item.linkId === "string" && item.linkId.trim()
      ? item.linkId.trim()
      : `ITEM_${idx}`;
  const variableName = rawLinkId;
  const label =
    typeof item.text === "string" && item.text.trim()
      ? item.text.trim()
      : variableName;
  const fhirType = typeof item.type === "string" ? item.type.trim() : "string";
  const repeats = item.repeats === true;
  const required = item.required === true;
  const readOnly = item.readOnly === true ? true : undefined;
  const itemControl = extractItemControlCode(item.extension);

  const rawAnswerOptions: Record<string, unknown>[] = Array.isArray(
    item.answerOption
  )
    ? item.answerOption.filter(isRecord)
    : typeof item.answerValueSet === "string"
      ? resolveValueSetAnswerOptions(item.answerValueSet, valueSets)
      : [];

  const dataType = mapFhirItemToClinicalType(
    fhirType,
    itemControl,
    repeats,
    rawAnswerOptions.length > 0
  );

  const { unit, unitOptions } = extractUnitMetadata(item);

  let codelistId: string | undefined;
  let customOptions: CodelistOption[] | undefined;

  if (rawAnswerOptions.length > 0) {
    const parsedOptions = parseItemAnswerOptions(
      rawAnswerOptions,
      variableName,
      label,
      domain,
      collector
    );
    codelistId = parsedOptions.codelistId;
    customOptions = parsedOptions.customOptions;
  } else if (fhirType === "boolean") {
    const ny = STANDARD_CODELISTS.find((cl) => cl.id === "CL_NY");
    if (ny) {
      codelistId = ny.id;
      collector.byId.set(ny.id, {
        ...ny,
        options: ny.options.map((o) => ({ ...o })),
      });
    }
  }

  let repeatingColumns: CRFField[] | undefined;
  if (dataType === "repeating_table" && Array.isArray(item.item)) {
    const cols: CRFField[] = [];
    for (const child of item.item) {
      if (!isRecord(child) || child.type === "display") continue;
      cols.push(
        parseLeafField(
          child,
          fieldCounter,
          domain,
          valueSets,
          collector,
          depth + 1
        )
      );
    }
    if (cols.length > 0) {
      repeatingColumns = cols;
    }
  }

  const domainUpper = domain.toUpperCase();
  const cdashMetadata = CDASH_STANDARD_VARIABLES[domainUpper]?.find(
    (v) => v.sdtmVariable.toUpperCase() === variableName.toUpperCase()
  );

  const field: CRFField = {
    id: `fld_${sanitizeIdentifierToken(variableName, `item_${idx}`)}_${idx}`,
    variableName,
    label,
    dataType,
    columnSpan:
      dataType === "repeating_table" || dataType === "textarea" ? 12 : 6,
    required,
    ...(readOnly ? { readOnly } : {}),
    ...(unit ? { unit } : {}),
    ...(unitOptions ? { unitOptions } : {}),
    ...(codelistId ? { codelistId } : {}),
    ...(customOptions ? { customOptions } : {}),
    ...(repeatingColumns ? { repeatingColumns } : {}),
    ...(cdashMetadata ? { cdashMetadata } : {}),
  };

  return field;
}

function collectSectionFieldsFromItems(
  items: unknown[],
  fieldCounter: { count: number },
  domain: string,
  valueSets: Record<string, unknown>[],
  collector: CodelistCollector,
  depth = 0
): CRFField[] {
  if (depth > MAX_FHIR_ITEM_DEPTH) {
    throw new Error(
      `Questionnaire items are nested more than ${MAX_FHIR_ITEM_DEPTH} levels deep.`
    );
  }

  const fields: CRFField[] = [];

  for (const entry of items) {
    if (!isRecord(entry) || entry.type === "display") continue;

    if (entry.type === "group") {
      const childItems = Array.isArray(entry.item)
        ? entry.item.filter(
            (child) => isRecord(child) && child.type !== "display"
          )
        : [];
      const itemControl = extractItemControlCode(entry.extension);
      const isRepeatingTable =
        childItems.length === 0 ||
        entry.repeats === true ||
        (itemControl !== undefined && TABLE_ITEM_CONTROLS.has(itemControl));

      if (isRepeatingTable) {
        fields.push(
          parseLeafField(
            entry,
            fieldCounter,
            domain,
            valueSets,
            collector,
            depth
          )
        );
      } else {
        fields.push(
          ...collectSectionFieldsFromItems(
            childItems,
            fieldCounter,
            domain,
            valueSets,
            collector,
            depth + 1
          )
        );
      }
      continue;
    }

    fields.push(
      parseLeafField(entry, fieldCounter, domain, valueSets, collector, depth)
    );
  }

  return fields;
}

function parseFhirQuestionnaireInternal(
  questionnaire: Record<string, unknown>,
  formIndex: number,
  externalValueSets: Record<string, unknown>[],
  collector: CodelistCollector
): ParsedFhirFormResult {
  if (questionnaire.resourceType !== "Questionnaire") {
    throw new Error(
      `Unsupported HL7 FHIR resourceType "${String(questionnaire.resourceType ?? "unknown")}". Expected "Questionnaire".`
    );
  }

  const { formId, formName, domain, protocolFromUrl } = extractFormIdentity(
    questionnaire,
    formIndex
  );

  const version =
    typeof questionnaire.version === "string" && questionnaire.version.trim()
      ? questionnaire.version.trim()
      : "1.0";
  const description = stripConsultationSuffix(questionnaire.description);
  const publisher =
    typeof questionnaire.publisher === "string" &&
    questionnaire.publisher.trim()
      ? questionnaire.publisher.trim()
      : undefined;
  const date =
    typeof questionnaire.date === "string" && questionnaire.date.trim()
      ? questionnaire.date.trim()
      : undefined;

  const containedValueSets: Record<string, unknown>[] = Array.isArray(
    questionnaire.contained
  )
    ? questionnaire.contained.filter(
        (r): r is Record<string, unknown> =>
          isRecord(r) && r.resourceType === "ValueSet"
      )
    : [];
  const allValueSets = [...containedValueSets, ...externalValueSets];

  const sections: CRFSection[] = [];
  const fieldCounter = { count: 0 };
  let pendingTopLevelFields: CRFField[] = [];

  const flushPendingTopLevelFields = () => {
    if (pendingTopLevelFields.length === 0) return;
    const secNum = sections.length + 1;
    sections.push({
      id: `sec_${sanitizeIdentifierToken(formId, "fhir")}_${secNum}`,
      title: sections.length === 0 ? formName : `General Items ${secNum}`,
      fields: pendingTopLevelFields,
    });
    pendingTopLevelFields = [];
  };

  const topItems = Array.isArray(questionnaire.item) ? questionnaire.item : [];
  for (const topItem of topItems) {
    if (!isRecord(topItem) || topItem.type === "display") continue;

    if (topItem.type === "group") {
      flushPendingTopLevelFields();
      const secNum = sections.length + 1;
      const rawLinkId =
        typeof topItem.linkId === "string" ? topItem.linkId.trim() : "";
      const secTitle =
        (typeof topItem.text === "string" && topItem.text.trim()) ||
        rawLinkId ||
        `Section ${secNum}`;
      const childItems = Array.isArray(topItem.item) ? topItem.item : [];
      const groupFields = collectSectionFieldsFromItems(
        childItems,
        fieldCounter,
        domain,
        allValueSets,
        collector,
        1
      );

      sections.push({
        id: `sec_${sanitizeIdentifierToken(rawLinkId || `s${secNum}`, `s${secNum}`)}`,
        title: secTitle,
        ...(topItem.repeats === true ? { isRepeating: true } : {}),
        fields: groupFields,
      });
    } else {
      pendingTopLevelFields.push(
        parseLeafField(topItem, fieldCounter, domain, allValueSets, collector)
      );
    }
  }

  flushPendingTopLevelFields();

  if (sections.length === 0) {
    sections.push({
      id: `sec_${sanitizeIdentifierToken(formId, "fhir")}_1`,
      title: formName,
      fields: [],
    });
  }

  const isLogForm = domain === "AE" || domain === "CM" || domain === "MH";

  return {
    form: {
      id: formId,
      name: formName,
      domain,
      description,
      version,
      sections,
      rules: [],
      ...(isLogForm ? { isLogForm: true } : {}),
    },
    protocolFromUrl,
    publisher,
    date,
  };
}

/**
 * Parses an HL7 FHIR R4 Questionnaire JSON string or object into a CRF Studio CRFForm.
 */
export function importFormFromFhirQuestionnaire(
  questionnaireInput: string | Record<string, unknown>
): CRFForm {
  const raw = parseFhirJsonObject(questionnaireInput);
  const collector: CodelistCollector = {
    byId: new Map(),
    byFingerprint: new Map(),
  };
  return parseFhirQuestionnaireInternal(raw, 0, [], collector).form;
}

/**
 * Parses an HL7 FHIR R4 Questionnaire or Bundle of Questionnaires into a StudyProtocol.
 */
export function importStudyFromFhirQuestionnaire(
  fhirInput: string | Record<string, unknown>
): StudyProtocol {
  const raw = parseFhirJsonObject(fhirInput);
  const resourceType = raw.resourceType;

  if (resourceType !== "Questionnaire" && resourceType !== "Bundle") {
    throw new Error(
      `Unsupported HL7 FHIR resourceType "${String(resourceType ?? "unknown")}". Expected "Questionnaire" or "Bundle".`
    );
  }

  const collector: CodelistCollector = {
    byId: new Map(),
    byFingerprint: new Map(),
  };

  let questionnaires: Record<string, unknown>[] = [];
  const bundleValueSets: Record<string, unknown>[] = [];
  let bundleProtocolHint: string | undefined;

  if (resourceType === "Questionnaire") {
    questionnaires = [raw];
  } else {
    const entries = Array.isArray(raw.entry) ? raw.entry : [];
    for (const entry of entries) {
      if (!isRecord(entry) || !isRecord(entry.resource)) continue;
      if (entry.resource.resourceType === "Questionnaire") {
        questionnaires.push(entry.resource);
      } else if (entry.resource.resourceType === "ValueSet") {
        bundleValueSets.push(entry.resource);
      }
    }

    if (questionnaires.length === 0) {
      throw new Error(
        "HL7 FHIR Bundle contains no Questionnaire resources to import."
      );
    }

    if (typeof raw.id === "string" && raw.id.trim()) {
      const stripped = raw.id.trim().replace(/^bundle-/i, "");
      if (stripped) {
        bundleProtocolHint = stripped.toUpperCase();
      }
    }
  }

  const usedFormIds = new Set<string>();
  const parsedResults = questionnaires.map((q, idx) => {
    const parsed = parseFhirQuestionnaireInternal(
      q,
      idx,
      bundleValueSets,
      collector
    );
    let uniqueId = parsed.form.id;
    let suffix = 2;
    while (usedFormIds.has(uniqueId)) {
      uniqueId = `${parsed.form.id}_${suffix++}`;
    }
    usedFormIds.add(uniqueId);
    if (uniqueId !== parsed.form.id) {
      parsed.form = { ...parsed.form, id: uniqueId };
    }
    return parsed;
  });

  const forms = parsedResults.map((r) => r.form);
  const firstMeta = parsedResults[0];

  const fallbackSingleProto =
    resourceType === "Questionnaire" &&
    typeof raw.id === "string" &&
    raw.id.trim()
      ? raw.id.trim().replace(/^crf-/i, "").toUpperCase()
      : undefined;

  const protocolNumber =
    firstMeta?.protocolFromUrl ||
    bundleProtocolHint ||
    fallbackSingleProto ||
    "FHIR-STUDY-001";

  const studyName =
    resourceType === "Questionnaire"
      ? forms[0].name
      : forms.length === 1
        ? forms[0].name
        : `${protocolNumber} (${forms.length} FHIR Questionnaires)`;

  const sponsor = firstMeta?.publisher || "Clinical Study Sponsor";
  const version = forms[0]?.version || "1.0";
  const lastModified = firstMeta?.date || new Date().toISOString();

  const visits: StudyVisit[] = [
    {
      id: "vis_screening",
      oid: "SE.SCREENING",
      name: "Screening Visit",
      visitType: "Scheduled",
      targetDay: 0,
      windowBefore: 0,
      windowAfter: 0,
      assignedFormIds: forms.map((f) => f.id),
    },
  ];

  return {
    id: `study_${sanitizeIdentifierToken(protocolNumber, "fhir_study")}`,
    protocolNumber,
    studyName,
    phase: "Phase III",
    sponsor,
    therapeuticArea: "General",
    version,
    lastModified,
    forms,
    visits,
    codelists: Array.from(collector.byId.values()),
    provenance: {
      sourceFormat: "HL7 FHIR R4 Questionnaire",
      sourceVersion: version,
      importedAt: new Date().toISOString(),
      importedBy: "Unverified Session",
    },
  };
}
