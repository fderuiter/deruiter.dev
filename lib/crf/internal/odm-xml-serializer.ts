import { CLINICAL_STANDARDS_PROFILE } from "@/lib/clinical-standards";
import { AuditTrailEntry, ElectronicSignature, StudyProtocol } from "../types";
import { escapeXml } from "../../utils";
import { consultationUrl } from "./export-annotations";
import {
  discoverSimulationSubjects,
  parseSimulationFormValues,
} from "./simulation-records";

/**
 * Maps ClinicalDataType to CDISC ODM DataType
 */
function mapDataTypeToOdm(type: string): string {
  switch (type) {
    case "integer":
      return "integer";
    case "number":
    case "calculated":
    case "vas_scale":
    case "nrs_scale":
      return "float";
    case "date":
      return "date";
    case "partial_date":
    case "precision_date":
      return "partialDate";
    case "time":
      return "time";
    case "datetime":
      return "datetime";
    case "single_select":
    case "radio":
    case "checkbox":
    case "multi_select":
      return "text";
    default:
      return "text";
  }
}

/**
 * Namespace of CRF Studio's ODM vendor extension. ODM 1.3.2 has no place for
 * a design-change audit trail, so it is written under this namespace in the
 * `MetaDataVersionElementExtension` slot, the way Define-XML extends ODM.
 * Without an audit trail the file is plain ODM 1.3.2.
 */
export const CRF_STUDIO_ODM_NAMESPACE = "https://deruiter.dev/ns/crf-studio/v1";

/** The Alias context Define-XML 2.1 uses for an NCI EVS C-code. */
export const NCI_ALIAS_CONTEXT = "nci:ExtCodeID";

const ISO_XS_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function normalizeXsDateTime(
  raw: string | undefined,
  fallback: string
): string {
  if (raw && ISO_XS_DATETIME_RE.test(raw.trim())) {
    return raw.trim();
  }
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return fallback;
}

function allocateXmlNcNameId(
  prefix: string,
  rawId: string | undefined,
  usedIds: Set<string>
): string {
  const cleaned = (rawId || "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^[^A-Za-z_]+/, "");
  const base = cleaned
    ? cleaned.toUpperCase().startsWith(`${prefix}_`)
      ? cleaned
      : `${prefix}_${cleaned}`
    : `${prefix}_1`;
  let candidate = base;
  let seq = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}_${seq++}`;
  }
  usedIds.add(candidate);
  return candidate;
}

function mapRoleToOdmUserType(
  role?: string
): "Sponsor" | "Investigator" | "Lab" | "Other" {
  switch (role) {
    case "Principal Investigator":
    case "Site Coordinator":
      return "Investigator";
    case "CRA Monitor":
    case "Data Manager":
    case "Biostatistician":
    case "Medical Monitor":
    case "Clinical Reviewer":
      return "Sponsor";
    default:
      return "Other";
  }
}

/**
 * Serializes a StudyProtocol into CDISC ODM-XML v1.3.2, emitting `AdminData`
 * and `ClinicalData` when `study.simulationState` holds simulated records.
 * The output validates against the plain ODM 1.3.2 schema; when a design-change
 * `study.auditTrail` is present, against that schema extended by the CRF Studio
 * namespace.
 */
export function exportStudyToCdiscOdmXml(study: StudyProtocol): string {
  const safeStudy =
    study && typeof study === "object" ? study : ({} as StudyProtocol);
  const timestamp = new Date().toISOString();
  const protoNum = safeStudy.protocolNumber || "STUDY01";
  const studyOid = `STUDY.${String(protoNum).replace(/[^A-Za-z0-9_]/g, "_")}`;
  const metaOid = `MDV.${safeStudy.version || "1.0"}`;
  const studyTitle = safeStudy.studyName || protoNum;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Schedule Consultation: ${consultationUrl()} -->
<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3"
     xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xmlns:crfs="${CRF_STUDIO_ODM_NAMESPACE}"
     FileType="Snapshot"
     FileOID="ODM.${escapeXml(protoNum)}.${Date.now()}"
     CreationDateTime="${timestamp}"
     ODMVersion="${CLINICAL_STANDARDS_PROFILE.ODM}">
  <Study OID="${escapeXml(studyOid)}">
    <GlobalVariables>
      <StudyName>${escapeXml(studyTitle)}</StudyName>
      <StudyDescription>Protocol ${escapeXml(protoNum)} - ${escapeXml(safeStudy.phase || "")} • Schedule Consultation: ${consultationUrl()}</StudyDescription>
      <ProtocolName>${escapeXml(protoNum)}</ProtocolName>
    </GlobalVariables>
    <MetaDataVersion OID="${escapeXml(metaOid)}" Name="Protocol Definition Version ${escapeXml(safeStudy.version || "1.0")}">
      <Protocol>
`;

  const visits = Array.isArray(safeStudy.visits) ? safeStudy.visits : [];
  const forms = Array.isArray(safeStudy.forms) ? safeStudy.forms : [];
  const studyCodelists = Array.isArray(safeStudy.codelists)
    ? safeStudy.codelists
    : [];
  const auditTrail = Array.isArray(safeStudy.auditTrail)
    ? safeStudy.auditTrail
    : [];

  // Precompute deterministic ItemOID per field.id so distinct fields sharing a
  // variableName across forms do not collide on UC-MDV-4 or lose field.id aliases.
  const itemOidByFieldId = new Map<string, string>();
  const claimedItemOids = new Map<string, string>();
  forms.forEach((form) => {
    if (!form || typeof form !== "object") return;
    const sections = Array.isArray(form.sections) ? form.sections : [];
    sections.forEach((sec) => {
      if (!sec || typeof sec !== "object") return;
      const fields = Array.isArray(sec.fields) ? sec.fields : [];
      fields.forEach((field) => {
        if (!field || typeof field !== "object") return;
        const fieldKey = field.id || field.variableName || "field";
        if (itemOidByFieldId.has(fieldKey)) return;
        const baseOid = `IT.${field.variableName || field.id}`;
        const existingOwner = claimedItemOids.get(baseOid);
        if (!existingOwner || existingOwner === fieldKey) {
          claimedItemOids.set(baseOid, fieldKey);
          itemOidByFieldId.set(fieldKey, baseOid);
        } else {
          let disambig = `IT.${field.variableName || "FLD"}.${fieldKey}`;
          let n = 2;
          while (claimedItemOids.has(disambig)) {
            disambig = `IT.${field.variableName || "FLD"}.${fieldKey}_${n++}`;
          }
          claimedItemOids.set(disambig, fieldKey);
          itemOidByFieldId.set(fieldKey, disambig);
        }
      });
    });
  });

  // StudyEventRefs
  visits.forEach((v, idx) => {
    if (!v || typeof v !== "object") return;
    const vOid = v.oid || v.id || `VIS_${idx + 1}`;
    xml += `        <StudyEventRef StudyEventOID="${escapeXml(vOid)}" OrderNumber="${idx + 1}" Mandatory="Yes"/>\n`;
  });

  xml += `      </Protocol>\n\n`;

  // StudyEventDefs (Visits)
  visits.forEach((v, idx) => {
    if (!v || typeof v !== "object") return;
    const vOid = v.oid || v.id || `VIS_${idx + 1}`;
    const formIds = Array.isArray(v.assignedFormIds) ? v.assignedFormIds : [];
    xml += `      <StudyEventDef OID="${escapeXml(vOid)}" Name="${escapeXml(v.name)}" Repeating="${v.isRepeating ? "Yes" : "No"}" Type="${escapeXml(v.visitType || "Scheduled")}">\n`;
    const seenFormRefs = new Set<string>();
    let formOrder = 1;
    formIds.forEach((fId: string) => {
      if (seenFormRefs.has(fId)) return;
      seenFormRefs.add(fId);
      xml += `        <FormRef FormOID="${escapeXml(`FORM.${fId}`)}" OrderNumber="${formOrder++}" Mandatory="Yes"/>\n`;
    });
    if (v.id) {
      xml += `        <Alias Context="crf-studio:visitId" Name="${escapeXml(v.id)}"/>\n`;
    }
    xml += `      </StudyEventDef>\n`;
  });

  xml += `\n`;

  // FormDefs
  forms.forEach((form) => {
    if (!form || typeof form !== "object") return;
    const formOid = `FORM.${form.id}`;
    xml += `      <FormDef OID="${escapeXml(formOid)}" Name="${escapeXml(form.name)}" Repeating="${form.isLogForm ? "Yes" : "No"}">\n`;
    const sections = Array.isArray(form.sections) ? form.sections : [];
    sections.forEach((sec, sIdx) => {
      if (!sec || typeof sec !== "object") return;
      const igOid = `IG.${form.domain || "CRF"}.${sec.id}`;
      xml += `        <ItemGroupRef ItemGroupOID="${escapeXml(igOid)}" OrderNumber="${sIdx + 1}" Mandatory="Yes"/>\n`;
    });
    xml += `      </FormDef>\n`;
  });

  xml += `\n`;

  // ItemGroupDefs (Sections)
  forms.forEach((form) => {
    if (!form || typeof form !== "object") return;
    const sections = Array.isArray(form.sections) ? form.sections : [];
    sections.forEach((sec) => {
      if (!sec || typeof sec !== "object") return;
      const igOid = `IG.${form.domain || "CRF"}.${sec.id}`;
      xml += `      <ItemGroupDef OID="${escapeXml(igOid)}" Name="${escapeXml(sec.title)}" Repeating="${sec.isRepeating ? "Yes" : "No"}">\n`;
      const fields = Array.isArray(sec.fields) ? sec.fields : [];
      const seenGroupItems = new Set<string>();
      let itemOrder = 1;
      fields.forEach((field) => {
        if (!field || typeof field !== "object") return;
        const fieldKey = field.id || field.variableName || "field";
        const itemOid =
          itemOidByFieldId.get(fieldKey) ||
          `IT.${field.variableName || field.id}`;
        if (seenGroupItems.has(itemOid)) return;
        seenGroupItems.add(itemOid);
        xml += `        <ItemRef ItemOID="${escapeXml(itemOid)}" OrderNumber="${itemOrder++}" Mandatory="${field.required ? "Yes" : "No"}"/>\n`;
      });
      if (sec.id) {
        xml += `        <Alias Context="crf-studio:sectionId" Name="${escapeXml(sec.id)}"/>\n`;
      }
      xml += `      </ItemGroupDef>\n`;
    });
  });

  xml += `\n`;

  // ItemDefs (Fields)
  const processedItems = new Set<string>();
  const customFieldCodelists: Map<
    string,
    import("../types").CodelistDefinition
  > = new Map();

  forms.forEach((form) => {
    if (!form || typeof form !== "object") return;
    const sections = Array.isArray(form.sections) ? form.sections : [];
    sections.forEach((sec) => {
      if (!sec || typeof sec !== "object") return;
      const fields = Array.isArray(sec.fields) ? sec.fields : [];
      fields.forEach((field) => {
        if (!field || typeof field !== "object") return;
        const fieldKey = field.id || field.variableName || "field";
        const itemOid =
          itemOidByFieldId.get(fieldKey) ||
          `IT.${field.variableName || field.id}`;
        if (processedItems.has(itemOid)) return;
        processedItems.add(itemOid);

        let effectiveCodelistId = field.codelistId;
        if (
          !effectiveCodelistId &&
          Array.isArray(field.customOptions) &&
          field.customOptions.length > 0
        ) {
          effectiveCodelistId = `CL_${field.variableName || field.id}`;
          if (!customFieldCodelists.has(effectiveCodelistId)) {
            customFieldCodelists.set(effectiveCodelistId, {
              id: effectiveCodelistId,
              name: `${field.label || field.variableName} (Field Codelist)`,
              options: field.customOptions,
              isStandard: false,
            });
          }
        }

        const odmType = mapDataTypeToOdm(field.dataType);
        // ODM 1.3.2 ItemDef content order: Description, Question,
        // CodeListRef, Alias.
        xml += `      <ItemDef OID="${escapeXml(itemOid)}" Name="${escapeXml(field.variableName)}" DataType="${escapeXml(odmType)}">\n`;
        xml += `        <Description><TranslatedText xml:lang="en">${escapeXml(field.label)}</TranslatedText></Description>\n`;
        xml += `        <Question><TranslatedText xml:lang="en">${escapeXml(field.label)}</TranslatedText></Question>\n`;
        if (effectiveCodelistId) {
          xml += `        <CodeListRef CodeListOID="${escapeXml(effectiveCodelistId)}"/>\n`;
        }
        if (field.cdashMetadata?.acrfAnnotation) {
          xml += `        <Alias Context="SDTM" Name="${escapeXml(field.cdashMetadata.acrfAnnotation)}"/>\n`;
        }
        if (field.id) {
          xml += `        <Alias Context="crf-studio:fieldId" Name="${escapeXml(field.id)}"/>\n`;
        }
        xml += `      </ItemDef>\n`;
      });
    });
  });

  xml += `\n`;

  // CodeLists (Study Codelists + Inline Custom Codelists)
  const allCodelists: import("../types").CodelistDefinition[] = [
    ...studyCodelists,
    ...Array.from(customFieldCodelists.values()).filter(
      (ccl) => !studyCodelists.some((cl) => cl && cl.id === ccl.id)
    ),
  ];

  allCodelists.forEach((cl) => {
    if (!cl || typeof cl !== "object") return;
    const nciAlias = (code: string | undefined, indent: string) =>
      code
        ? `${indent}<Alias Context="${NCI_ALIAS_CONTEXT}" Name="${escapeXml(code)}"/>\n`
        : "";
    xml += `      <CodeList OID="${escapeXml(cl.id)}" Name="${escapeXml(cl.name)}" DataType="text">\n`;
    const options = Array.isArray(cl.options) ? cl.options : [];
    options.forEach((opt) => {
      if (!opt || typeof opt !== "object") return;
      xml += `        <CodeListItem CodedValue="${escapeXml(opt.code)}">\n`;
      xml += `          <Decode><TranslatedText xml:lang="en">${escapeXml(opt.label)}</TranslatedText></Decode>\n`;
      xml += nciAlias(opt.nciCode, "          ");
      xml += `        </CodeListItem>\n`;
    });
    xml += nciAlias(cl.nciCodelistCode, "        ");
    xml += `      </CodeList>\n`;
  });

  const usedXmlIds = new Set<string>();
  if (auditTrail.length > 0) {
    xml += `\n      <crfs:AuditTrail>\n`;
    auditTrail.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      if (entry.id) usedXmlIds.add(entry.id);
      xml += `        <crfs:AuditRecord ID="${escapeXml(entry.id)}">\n`;
      xml += `          <crfs:UserRef UserOID="${escapeXml(entry.changedBy)}"/>\n`;
      if (entry.userRole) {
        xml += `          <crfs:UserRole>${escapeXml(entry.userRole)}</crfs:UserRole>\n`;
      }
      xml += `          <crfs:DateTimeStamp>${escapeXml(entry.timestamp)}</crfs:DateTimeStamp>\n`;
      if (entry.actionType) {
        xml += `          <crfs:ActionType>${escapeXml(entry.actionType)}</crfs:ActionType>\n`;
      }
      if (entry.targetId) {
        xml += `          <crfs:TargetID>${escapeXml(entry.targetId)}</crfs:TargetID>\n`;
      }
      if (entry.formId) {
        xml += `          <crfs:FormOID>${escapeXml(entry.formId)}</crfs:FormOID>\n`;
      }
      if (entry.fieldId) {
        xml += `          <crfs:ItemOID>${escapeXml(entry.fieldId)}</crfs:ItemOID>\n`;
      }
      if (entry.previousValue !== undefined && entry.previousValue !== null) {
        let prevStr: string;
        try {
          prevStr =
            typeof entry.previousValue === "object"
              ? JSON.stringify(entry.previousValue)
              : String(entry.previousValue);
        } catch {
          prevStr = String(entry.previousValue);
        }
        xml += `          <crfs:PreviousValue>${escapeXml(prevStr)}</crfs:PreviousValue>\n`;
      }
      if (entry.newValue !== undefined && entry.newValue !== null) {
        let newStr: string;
        try {
          newStr =
            typeof entry.newValue === "object"
              ? JSON.stringify(entry.newValue)
              : String(entry.newValue);
        } catch {
          newStr = String(entry.newValue);
        }
        xml += `          <crfs:NewValue>${escapeXml(newStr)}</crfs:NewValue>\n`;
      }
      if (entry.reasonForChange) {
        xml += `          <crfs:ReasonForChange>${escapeXml(entry.reasonForChange)}</crfs:ReasonForChange>\n`;
      }
      if (entry.diagnosticId) {
        xml += `          <crfs:DiagnosticID>${escapeXml(entry.diagnosticId)}</crfs:DiagnosticID>\n`;
      }
      if (entry.details !== undefined && entry.details !== null) {
        let detailsStr: string;
        try {
          detailsStr =
            typeof entry.details === "object"
              ? JSON.stringify(entry.details)
              : String(entry.details);
        } catch {
          detailsStr = String(entry.details);
        }
        xml += `          <crfs:Details>${escapeXml(detailsStr)}</crfs:Details>\n`;
      }
      xml += `        </crfs:AuditRecord>\n`;
    });
    xml += `      </crfs:AuditTrail>\n`;
  }

  xml += `    </MetaDataVersion>
  </Study>\n`;

  // Plain ODM 1.3.2 AdminData & ClinicalData from study.simulationState
  const sim = safeStudy.simulationState;
  if (sim && typeof sim === "object") {
    const subjects = discoverSimulationSubjects(safeStudy, sim);
    const parsedCells = parseSimulationFormValues(safeStudy, sim);
    const simAudits: AuditTrailEntry[] = Array.isArray(sim.auditLog)
      ? sim.auditLog
      : [];
    const simSignatures: ElectronicSignature[] = Array.isArray(sim.signatures)
      ? sim.signatures
      : [];
    const simQueries = Array.isArray(sim.queries) ? sim.queries : [];
    const simLockedForms =
      sim.lockedForms && typeof sim.lockedForms === "object"
        ? sim.lockedForms
        : {};
    const simSdvMap =
      sim.sdvMap && typeof sim.sdvMap === "object" ? sim.sdvMap : {};

    const hasClinicalPayload =
      subjects.length > 0 ||
      parsedCells.length > 0 ||
      simAudits.length > 0 ||
      simSignatures.length > 0 ||
      simQueries.length > 0 ||
      Object.keys(simLockedForms).length > 0 ||
      Object.keys(simSdvMap).length > 0;

    if (hasClinicalPayload) {
      const adminUsers = new Map<
        string,
        {
          oid: string;
          displayName: string;
          role: string;
          userType: "Sponsor" | "Investigator" | "Lab" | "Other";
        }
      >();
      const ensureAdminUser = (name: string, role?: string): string => {
        const displayName = (name || "Clinical User").trim() || "Clinical User";
        const cleanRole = (role || "System").trim() || "System";
        const key = `${displayName}|||${cleanRole}`;
        const existing = adminUsers.get(key);
        if (existing) return existing.oid;
        const oid = `USR.${adminUsers.size + 1}`;
        adminUsers.set(key, {
          oid,
          displayName,
          role: cleanRole,
          userType: mapRoleToOdmUserType(cleanRole),
        });
        return oid;
      };

      const sigDefs = new Map<string, string>();
      const ensureSigDef = (meaning: string): string => {
        const cleanMeaning =
          (meaning || "Investigator Approval").trim() ||
          "Investigator Approval";
        const existing = sigDefs.get(cleanMeaning);
        if (existing) return existing;
        const oid = `SIGDEF.${sigDefs.size + 1}`;
        sigDefs.set(cleanMeaning, oid);
        return oid;
      };

      // Pre-register all users and signature definitions before writing <AdminData>
      simAudits.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        ensureAdminUser(entry.changedBy || "System", entry.userRole);
      });
      simSignatures.forEach((sig) => {
        if (!sig || typeof sig !== "object") return;
        ensureAdminUser(sig.signedBy || "Investigator", sig.userRole);
        ensureSigDef(sig.meaning);
      });
      simQueries.forEach((q) => {
        if (!q || typeof q !== "object") return;
        if (q.raisedBy) ensureAdminUser(q.raisedBy, "System");
        if (q.respondedBy) ensureAdminUser(q.respondedBy, "Site Coordinator");
        if (q.resolvedBy) ensureAdminUser(q.resolvedBy, "CRA Monitor");
      });

      const locationOid = "LOC.SITE_001";
      const effectiveDate = timestamp.slice(0, 10);

      // 1. <AdminData> (sequence: User*, Location*, SignatureDef*)
      xml += `  <AdminData StudyOID="${escapeXml(studyOid)}">\n`;
      adminUsers.forEach((u) => {
        xml += `    <User OID="${escapeXml(u.oid)}" UserType="${u.userType}">\n`;
        xml += `      <DisplayName>${escapeXml(u.displayName)}</DisplayName>\n`;
        xml += `      <FullName>${escapeXml(u.displayName)}</FullName>\n`;
        xml += `      <Organization>${escapeXml(u.role)}</Organization>\n`;
        xml += `    </User>\n`;
      });
      xml += `    <Location OID="${locationOid}" Name="Simulated Clinical Site 001" LocationType="Site">\n`;
      xml += `      <MetaDataVersionRef StudyOID="${escapeXml(studyOid)}" MetaDataVersionOID="${escapeXml(metaOid)}" EffectiveDate="${escapeXml(effectiveDate)}"/>\n`;
      xml += `    </Location>\n`;
      sigDefs.forEach((oid, meaning) => {
        xml += `    <SignatureDef OID="${escapeXml(oid)}" Methodology="Electronic">\n`;
        xml += `      <Meaning>${escapeXml(meaning)}</Meaning>\n`;
        xml += `      <LegalReason>Simulated electronic signature reference in CRF Studio (not a validated system)</LegalReason>\n`;
        xml += `    </SignatureDef>\n`;
      });
      xml += `  </AdminData>\n`;

      // Index captured values by `${subjectId}:::${visitId}:::${fieldId}`
      const cellValueMap = new Map<string, string | number | boolean | null>();
      const extraVisitIds = new Set<string>();
      const knownVisitIdSet = new Set(visits.map((v) => v.id));
      parsedCells.forEach((c) => {
        cellValueMap.set(
          `${c.subjectId}:::${c.visitId}:::${c.fieldId}`,
          c.value
        );
        if (!knownVisitIdSet.has(c.visitId)) {
          extraVisitIds.add(c.visitId);
        }
      });

      const visitEntries: Array<{ id: string; oid: string }> = [
        ...visits.map((v, idx) => ({
          id: v.id || `vis_${idx + 1}`,
          oid: v.oid || v.id || `VIS_${idx + 1}`,
        })),
        ...Array.from(extraVisitIds).map((id) => ({ id, oid: id })),
      ];

      // 2. <ClinicalData> (sequence: SubjectData*, AuditRecords*, Signatures*, Annotations*)
      xml += `  <ClinicalData StudyOID="${escapeXml(studyOid)}" MetaDataVersionOID="${escapeXml(metaOid)}">\n`;

      subjects.forEach((subjectId) => {
        xml += `    <SubjectData SubjectKey="${escapeXml(subjectId)}">\n`;
        xml += `      <SiteRef LocationOID="${locationOid}"/>\n`;

        visitEntries.forEach((visitEntry) => {
          let studyEventXml = "";

          forms.forEach((form) => {
            if (!form || typeof form !== "object") return;
            const sections = Array.isArray(form.sections) ? form.sections : [];
            let formDataXml = "";

            sections.forEach((sec) => {
              if (!sec || typeof sec !== "object") return;
              const fields = Array.isArray(sec.fields) ? sec.fields : [];
              let itemGroupXml = "";

              fields.forEach((field) => {
                if (!field || typeof field !== "object") return;
                const mapKey = `${subjectId}:::${visitEntry.id}:::${field.id}`;
                if (!cellValueMap.has(mapKey)) return;
                const val = cellValueMap.get(mapKey);
                const fieldKey = field.id || field.variableName || "field";
                const itemOid =
                  itemOidByFieldId.get(fieldKey) ||
                  `IT.${field.variableName || field.id}`;

                if (val === null || val === "") {
                  itemGroupXml += `            <ItemData ItemOID="${escapeXml(itemOid)}" IsNull="Yes"/>\n`;
                } else {
                  const strVal =
                    typeof val === "object" ? JSON.stringify(val) : String(val);
                  itemGroupXml += `            <ItemData ItemOID="${escapeXml(itemOid)}" Value="${escapeXml(strVal)}"/>\n`;
                }
              });

              if (itemGroupXml) {
                const igOid = `IG.${form.domain || "CRF"}.${sec.id}`;
                formDataXml += `          <ItemGroupData ItemGroupOID="${escapeXml(igOid)}">\n${itemGroupXml}          </ItemGroupData>\n`;
              }
            });

            if (formDataXml) {
              studyEventXml += `        <FormData FormOID="${escapeXml(`FORM.${form.id}`)}">\n${formDataXml}        </FormData>\n`;
            }
          });

          if (studyEventXml) {
            xml += `      <StudyEventData StudyEventOID="${escapeXml(visitEntry.oid)}">\n${studyEventXml}      </StudyEventData>\n`;
          }
        });

        xml += `    </SubjectData>\n`;
      });

      if (simAudits.length > 0) {
        xml += `    <AuditRecords>\n`;
        simAudits.forEach((entry) => {
          if (!entry || typeof entry !== "object") return;
          const audXmlId = allocateXmlNcNameId("AUD", entry.id, usedXmlIds);
          const userOid = ensureAdminUser(
            entry.changedBy || "System",
            entry.userRole
          );
          const isoTs = normalizeXsDateTime(entry.timestamp, timestamp);
          const sourcePayload = `urn:crf-studio:audit:${JSON.stringify({
            id: entry.id,
            subjectId: entry.subjectId,
            formId: entry.formId,
            fieldId: entry.fieldId,
            fieldName: entry.fieldName,
            previousValue:
              entry.previousValue === undefined ? null : entry.previousValue,
            newValue: entry.newValue === undefined ? null : entry.newValue,
            actionType: entry.actionType,
            targetId: entry.targetId,
            targetType: entry.targetType,
          })}`;
          xml += `      <AuditRecord ID="${escapeXml(audXmlId)}" EditPoint="DataManagement">\n`;
          xml += `        <UserRef UserOID="${escapeXml(userOid)}"/>\n`;
          xml += `        <LocationRef LocationOID="${locationOid}"/>\n`;
          xml += `        <DateTimeStamp>${escapeXml(isoTs)}</DateTimeStamp>\n`;
          xml += `        <ReasonForChange>${escapeXml(entry.reasonForChange || "Recorded in EDC simulation")}</ReasonForChange>\n`;
          xml += `        <SourceID>${escapeXml(sourcePayload)}</SourceID>\n`;
          xml += `      </AuditRecord>\n`;
        });
        xml += `    </AuditRecords>\n`;
      }

      if (simSignatures.length > 0) {
        xml += `    <Signatures>\n`;
        simSignatures.forEach((sig) => {
          if (!sig || typeof sig !== "object") return;
          const sigXmlId = allocateXmlNcNameId("SIG", sig.id, usedXmlIds);
          const userOid = ensureAdminUser(
            sig.signedBy || "Investigator",
            sig.userRole
          );
          const sigDefOid = ensureSigDef(sig.meaning);
          const isoTs = normalizeXsDateTime(sig.timestamp, timestamp);
          const manifestPayload = `urn:crf-studio:simulated-signature:${JSON.stringify(
            {
              id: sig.id,
              subjectId: sig.subjectId,
              visitId: sig.visitId,
              formId: sig.formId,
              digest: sig.digest,
              note: "Simulated signature reference token (not a validated system)",
            }
          )}`;
          xml += `      <Signature ID="${escapeXml(sigXmlId)}">\n`;
          xml += `        <UserRef UserOID="${escapeXml(userOid)}"/>\n`;
          xml += `        <LocationRef LocationOID="${locationOid}"/>\n`;
          xml += `        <SignatureRef SignatureOID="${escapeXml(sigDefOid)}"/>\n`;
          xml += `        <DateTimeStamp>${escapeXml(isoTs)}</DateTimeStamp>\n`;
          xml += `        <CryptoBindingManifest>${escapeXml(manifestPayload)}</CryptoBindingManifest>\n`;
          xml += `      </Signature>\n`;
        });
        xml += `    </Signatures>\n`;
      }

      const hasExtraState =
        simQueries.length > 0 ||
        Object.keys(simLockedForms).length > 0 ||
        Object.keys(simSdvMap).length > 0;
      if (hasExtraState) {
        xml += `    <Annotations>\n`;
        let seqNum = 1;
        simQueries.forEach((q) => {
          if (!q || typeof q !== "object") return;
          const annId = allocateXmlNcNameId("ANN", q.id, usedXmlIds);
          const commentPayload = `urn:crf-studio:query:${JSON.stringify(q)}`;
          xml += `      <Annotation SeqNum="${seqNum++}" ID="${escapeXml(annId)}">\n`;
          xml += `        <Comment SponsorOrSite="Sponsor">${escapeXml(commentPayload)}</Comment>\n`;
          xml += `      </Annotation>\n`;
        });
        if (
          Object.keys(simLockedForms).length > 0 ||
          Object.keys(simSdvMap).length > 0
        ) {
          const stateAnnId = allocateXmlNcNameId("ANN", "STATE_1", usedXmlIds);
          const statePayload = `urn:crf-studio:state:${JSON.stringify({
            lockedForms: simLockedForms,
            sdvMap: simSdvMap,
          })}`;
          xml += `      <Annotation SeqNum="${seqNum++}" ID="${escapeXml(stateAnnId)}">\n`;
          xml += `        <Comment SponsorOrSite="Site">${escapeXml(statePayload)}</Comment>\n`;
          xml += `      </Annotation>\n`;
        }
        xml += `    </Annotations>\n`;
      }

      xml += `  </ClinicalData>\n`;
    }
  }

  xml += `</ODM>`;

  return xml;
}

export const serializeStudyToOdmXml = exportStudyToCdiscOdmXml;
