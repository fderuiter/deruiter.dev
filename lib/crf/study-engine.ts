/**
 * CRF Studio Unified Clinical Protocol Business Logic Engine
 * Pure, framework-agnostic functional service providing high-assurance protocol mutations,
 * CDASH 2.2 invariants, Schedule of Activities synchronization, AST rule dependency management,
 * and multi-standard exports across both Web Studio and CLI environments.
 */

import {
  StudyProtocol,
  CRFForm,
  CRFSection,
  CRFField,
  StudyVisit,
  EditCheckRule,
  AstCondition,
  ClinicalDataType,
  StudyArm,
  StudyEpoch,
  StudyCohort,
  BiomedicalConcept,
  StudyBaseline,
  StudyBaselineActor,
  StudyProvenance,
  StudyReviewActor,
  StudyReviewEvent,
  StudyReviewTarget,
  StudyReviewThread,
} from "./types";
import {
  saveStudyBaseline,
  listStudyBaselines,
  getStudyBaseline,
  restoreBaselineAsDraft,
  deleteStudyBaseline,
  clearStudyBaselines,
  exportBaselinesBundle,
  importBaselinesBundle,
  incrementStudyVersion,
  computeStudyChecksum,
  STUDY_BASELINES_STORAGE_KEY,
  STUDY_BASELINES_CORRUPT_BACKUP_KEY,
  STUDY_BASELINES_MAX_COUNT,
  type SaveStudyBaselineOptions,
  type SaveStudyBaselineResult,
  type RestoreStudyBaselineOptions,
  type RestoreStudyBaselineResult,
  type BaselinesExportBundle,
} from "./study-baselines";
import {
  validateCdashVariableName,
  generateEngineId,
  generateCdashVariableName,
} from "./precision-date";
import { cloneDeep } from "../utils";
import { lintForm } from "./ast-evaluator";
import {
  instantiateSmartBlock,
  instantiateAtomicField,
} from "./smart-blocks-engine";
import {
  scaffoldCdashDomain,
  CDASH_STANDARD_VARIABLES,
} from "./cdash-domain-templates";
import {
  getStudyPresetsSync,
  getPresetByIdSync,
  getOncologyPresetSync,
} from "./presets/loader";
import { exportStudyToCdiscOdmXml } from "./odm-xml-serializer";
import { exportStudyToFhirQuestionnaire } from "./fhir-questionnaire";
import { exportStudyToSas } from "./export-sas";
import { exportStudyToR } from "./export-r";
import { exportStudyToUsdm } from "./usdm-adapter";
import {
  exportUniversalCrfJson,
  exportUniversalCrfYaml,
  diffUniversalCrfStudies,
} from "./universal-schema";

export interface ValidationIssue {
  form: string;
  field?: string;
  rule: string;
  message: string;
  severity: "error" | "warning";
}

export interface ProtocolValidationResult {
  isCompliant: boolean;
  totalIssues: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  issues: ValidationIssue[];
}

export interface DomainMetadata {
  code: string;
  label: string;
  description: string;
  category: "core" | "device" | "pharma" | "specialty";
  variableCount: number;
  sampleVariables: string[];
}

export interface FieldReferenceLocation {
  type:
    | "rule_target"
    | "rule_trigger"
    | "rule_condition"
    | "rule_formula"
    | "field_calculation"
    | "repeating_column"
    | "cross_visit_rule";
  formId: string;
  formName: string;
  ruleId?: string;
  ruleName?: string;
  fieldId?: string;
  variableName?: string;
  description: string;
}

export interface FieldImpactPreview {
  targetFieldId: string;
  targetVariableName: string;
  formId: string;
  references: FieldReferenceLocation[];
  canSafelyDelete: boolean;
  warningMessage?: string;
}

export interface SectionImpactPreview {
  sectionId: string;
  sectionTitle: string;
  formId: string;
  fields: FieldImpactPreview[];
  totalReferencesCount: number;
  allReferences: FieldReferenceLocation[];
  canSafelyDelete: boolean;
  warningMessage?: string;
}

/**
 * Standard Catalog of all 13 Supported CDASH & Medical Device Domains
 */
export const CDASH_DOMAIN_CATALOG: DomainMetadata[] = [
  {
    code: "DM",
    label: "Demographics & Informed Consent",
    description:
      "Subject baseline characteristics, age, sex, race, ethnicity, and consent date",
    category: "core",
    variableCount: 7,
    sampleVariables: ["ICDAT", "AGE", "SEX", "RACE", "ETHNIC"],
  },
  {
    code: "VS",
    label: "Vital Signs & Anthropometrics",
    description:
      "Blood pressure, pulse, temperature, respiration, height, weight, and BMI",
    category: "core",
    variableCount: 9,
    sampleVariables: [
      "SYSBP",
      "DIABP",
      "PULSE",
      "TEMP",
      "WEIGHT",
      "HEIGHT",
      "BMI",
    ],
  },
  {
    code: "AE",
    label: "Adverse Events (CTCAE v5.0)",
    description:
      "Reported term, severity grade, serious criteria, causality, and outcome",
    category: "core",
    variableCount: 9,
    sampleVariables: ["AETERM", "AESTDTC", "AESEV", "AESER", "AEREL", "AEOUT"],
  },
  {
    code: "CM",
    label: "Concomitant Medications",
    description:
      "Prior and concomitant therapy, indication, dose, route, and duration",
    category: "core",
    variableCount: 8,
    sampleVariables: [
      "CMTRT",
      "CMINDC",
      "CMDOSE",
      "CMDOSU",
      "CMROUTE",
      "CMSTDTC",
    ],
  },
  {
    code: "LB",
    label: "Laboratory Test Results",
    description:
      "Clinical chemistry, hematology, urinalysis, units, and normal ranges",
    category: "core",
    variableCount: 6,
    sampleVariables: ["LBDAT", "LBTEST", "LBORRES", "LBORRESU", "LBNRIND"],
  },
  {
    code: "RECIST",
    label: "Oncology RECIST 1.1 Tumor Tracking",
    description:
      "Target/non-target lesion measurements, sum of diameters, and response assessment",
    category: "specialty",
    variableCount: 8,
    sampleVariables: [
      "TULOC",
      "TUDIAM",
      "TUSLD",
      "TUNONTG",
      "TUNLRES",
      "TUOVRSP",
    ],
  },
  {
    code: "DI",
    label: "Medical Device Identification (UDI)",
    description:
      "Class II/III medical device tracking, brand, model, serial/lot number, and UDI",
    category: "device",
    variableCount: 9,
    sampleVariables: ["DITERM", "DIBRN", "DIMODN", "DISERN", "DIUDI", "DISTAT"],
  },
  {
    code: "DU",
    label: "Medical Device Use & Procedure",
    description:
      "Implant deployment, surgical access site, procedure duration, and success outcome",
    category: "device",
    variableCount: 6,
    sampleVariables: [
      "DUTEST",
      "DUORRES",
      "DUSTDTC",
      "DUENDTC",
      "DULOC",
      "DUDUR",
    ],
  },
  {
    code: "DE",
    label: "Medical Device Incidents & Deficiencies",
    description:
      "Device malfunction, use error, serious health deterioration, and root cause analysis",
    category: "device",
    variableCount: 8,
    sampleVariables: [
      "DETERM",
      "DESTDTC",
      "DEDEFIC",
      "DESEV",
      "DESER",
      "DEREL",
    ],
  },
  {
    code: "DA",
    label: "Drug Accountability & Dispensation",
    description:
      "Investigational product kit tracking, units dispensed, returned, and % compliance",
    category: "pharma",
    variableCount: 8,
    sampleVariables: [
      "DATEST",
      "DASTDTC",
      "DASPNO",
      "DARETNO",
      "DACOMPL",
      "DARECON",
    ],
  },
  {
    code: "EX",
    label: "Investigational Treatment Exposure",
    description:
      "Dose administered, infusion rate, route, modification reasons, and cycle timing",
    category: "pharma",
    variableCount: 8,
    sampleVariables: [
      "EXTRT",
      "EXDOSE",
      "EXDOSU",
      "EXROUTE",
      "EXSTDTC",
      "EXADJ",
    ],
  },
  {
    code: "MH",
    label: "Medical History & Comorbidities",
    description:
      "Prior diagnoses, body system categories, onset date, and ongoing status",
    category: "core",
    variableCount: 5,
    sampleVariables: ["MHTERM", "MHCAT", "MHSTDTC", "MHONGO", "MHENDTC"],
  },
  {
    code: "DS",
    label: "Subject Disposition & Milestones",
    description:
      "Study completion, discontinuation reasons, primary endpoint, and withdrawal date",
    category: "core",
    variableCount: 4,
    sampleVariables: ["DSTERM", "DSDECOD", "DSCAT", "DSSTDTC"],
  },
];

export { generateEngineId, generateCdashVariableName } from "./precision-date";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Pure Functional Protocol Engine
 */
export class StudyProtocolEngine {
  private static readonly defaultReviewActor: StudyReviewActor = {
    name: "Study author",
    role: "Data Manager",
  };

  /** Adds a field comment to its durable local authoring review thread. */
  static addReviewComment(
    study: StudyProtocol,
    fieldId: string,
    body: string,
    author: StudyReviewActor = this.defaultReviewActor,
    at = new Date().toISOString()
  ): { study: StudyProtocol; thread: StudyReviewThread } {
    const comment = body.trim();
    if (!comment) throw new Error("Review comment cannot be empty.");
    const declaredAuthor = { ...author, name: author.name.trim() };
    if (!declaredAuthor.name) throw new Error("Reviewer name is required.");

    const found = study.forms
      .map((form) => this.getField(study, form.id, fieldId))
      .find((candidate) => candidate !== undefined);
    const threads = study.reviewThreads || [];
    const existing = threads.find(
      (thread) => thread.target.fieldId === fieldId
    );
    if (!found && !existing)
      throw new Error(`Field '${fieldId}' was not found.`);

    let target: StudyReviewTarget;
    if (existing) {
      target = existing.target;
    } else {
      if (!found) throw new Error(`Field '${fieldId}' was not found.`);
      target = {
        fieldId: found.field.id,
        formId: found.form.id,
        formName: found.form.name,
        variableName: found.field.variableName,
        label: found.field.label,
      };
    }
    const event: StudyReviewEvent = {
      id: generateEngineId("review_event"),
      type: "comment",
      body: comment,
      author: declaredAuthor,
      at,
    };
    const thread: StudyReviewThread = existing
      ? { ...existing, events: [...existing.events, event] }
      : {
          id: generateEngineId("review_thread"),
          target,
          events: [event],
        };

    return {
      study: {
        ...study,
        reviewThreads: existing
          ? threads.map((item) => (item.id === thread.id ? thread : item))
          : [...threads, thread],
      },
      thread,
    };
  }

  /** Appends a resolve or reopen event without rewriting previous review history. */
  static setReviewThreadStatus(
    study: StudyProtocol,
    threadId: string,
    status: "resolved" | "open",
    author: StudyReviewActor = this.defaultReviewActor,
    at = new Date().toISOString()
  ): StudyProtocol {
    const thread = study.reviewThreads?.find((item) => item.id === threadId);
    if (!thread) return study;
    const nextStatus = status === "resolved" ? "resolved" : "open";
    if (this.getReviewThreadStatus(thread) === nextStatus) return study;
    const declaredAuthor = { ...author, name: author.name.trim() };
    if (!declaredAuthor.name) throw new Error("Reviewer name is required.");

    const event: StudyReviewEvent = {
      id: generateEngineId("review_event"),
      type: nextStatus === "resolved" ? "resolved" : "reopened",
      author: declaredAuthor,
      at,
    };
    return {
      ...study,
      reviewThreads: study.reviewThreads?.map((item) =>
        item.id === threadId
          ? { ...item, events: [...item.events, event] }
          : item
      ),
    };
  }

  /** Returns the thread's latest local authoring state; new threads start open. */
  static getReviewThreadStatus(thread: StudyReviewThread): "open" | "resolved" {
    const latestStatus = [...thread.events]
      .reverse()
      .find((event) => event.type === "resolved" || event.type === "reopened");
    return latestStatus?.type === "resolved" ? "resolved" : "open";
  }

  /** Reports whether a thread's stable target has a deletion event in its history. */
  static isReviewTargetDeleted(thread: StudyReviewThread): boolean {
    return thread.events.some((event) => event.type === "target-deleted");
  }

  /** Counts unresolved local authoring threads on a study. */
  static countOpenReviewThreads(study: StudyProtocol): number {
    return (study.reviewThreads || []).filter(
      (thread) => this.getReviewThreadStatus(thread) === "open"
    ).length;
  }

  private static recordReviewRename(
    study: StudyProtocol,
    previous: Pick<CRFField, "id" | "variableName" | "label">,
    next: Pick<CRFField, "id" | "variableName" | "label">,
    author: StudyReviewActor,
    at: string
  ): StudyProtocol {
    if (
      previous.variableName === next.variableName &&
      previous.label === next.label
    ) {
      return study;
    }
    return {
      ...study,
      reviewThreads: (study.reviewThreads || []).map((thread) => {
        if (thread.target.fieldId !== previous.id) return thread;
        const event: StudyReviewEvent = {
          id: generateEngineId("review_event"),
          type: "target-renamed",
          previousVariableName: previous.variableName,
          nextVariableName: next.variableName,
          previousLabel: previous.label,
          nextLabel: next.label,
          author: author.name.trim()
            ? { ...author, name: author.name.trim() }
            : { ...this.defaultReviewActor },
          at,
        };
        return {
          ...thread,
          target: {
            ...thread.target,
            variableName: next.variableName,
            label: next.label,
          },
          events: [...thread.events, event],
        };
      }),
    };
  }

  /** Records a completed field name or label edit against each existing thread. */
  static recordReviewTargetChange(
    study: StudyProtocol,
    fieldId: string,
    author: StudyReviewActor = this.defaultReviewActor,
    at = new Date().toISOString()
  ): StudyProtocol {
    const thread = study.reviewThreads?.find(
      (item) => item.target.fieldId === fieldId
    );
    if (!thread) return study;

    const found = study.forms
      .map((form) => this.getField(study, form.id, fieldId))
      .find((candidate) => candidate !== undefined);
    if (!found) return study;

    return this.recordReviewRename(
      study,
      {
        id: fieldId,
        variableName: thread.target.variableName,
        label: thread.target.label,
      },
      found.field,
      author,
      at
    );
  }

  private static recordReviewDeletion(
    study: StudyProtocol,
    form: CRFForm,
    field: CRFField,
    author: StudyReviewActor,
    at: string
  ): StudyProtocol {
    return {
      ...study,
      reviewThreads: (study.reviewThreads || []).map((thread) => {
        if (thread.target.fieldId !== field.id) return thread;
        const target: StudyReviewTarget = {
          fieldId: field.id,
          formId: form.id,
          formName: form.name,
          variableName: field.variableName,
          label: field.label,
        };
        const event: StudyReviewEvent = {
          id: generateEngineId("review_event"),
          type: "target-deleted",
          target,
          author: author.name.trim()
            ? { ...author, name: author.name.trim() }
            : { ...this.defaultReviewActor },
          at,
        };
        return {
          ...thread,
          target,
          events: [...thread.events, event],
        };
      }),
    };
  }

  /**
   * Create Initial Blank Study Protocol
   */
  static createInitialStudy(profile?: Partial<StudyProtocol>): StudyProtocol {
    const timestamp = new Date().toISOString();
    return {
      id: profile?.id || generateEngineId("study"),
      protocolNumber: profile?.protocolNumber || "PROTOCOL-001",
      studyName: profile?.studyName || "Clinical Evaluation Protocol",
      phase: profile?.phase || "Phase I",
      sponsor: profile?.sponsor || "Clinical Development Sponsor",
      therapeuticArea: profile?.therapeuticArea || "General Medicine",
      version: profile?.version || "1.0",
      lastModified: timestamp,
      forms: profile?.forms || [],
      visits: profile?.visits || [
        {
          id: "v_screening",
          oid: "SE.SCREENING",
          name: "Screening",
          visitType: "Scheduled",
          targetDay: 0,
          windowBefore: 0,
          windowAfter: 0,
          assignedFormIds: [],
        },
        {
          id: "v_baseline",
          oid: "SE.BASELINE",
          name: "Day 1 Baseline",
          visitType: "Scheduled",
          targetDay: 1,
          windowBefore: 0,
          windowAfter: 1,
          assignedFormIds: [],
        },
      ],
      codelists: profile?.codelists || [],
      branding: profile?.branding,
    };
  }

  /**
   * Find Form by ID or Domain (Case-Insensitive)
   */
  static getForm(
    study: StudyProtocol,
    formIdOrDomain: string
  ): CRFForm | undefined {
    const target = formIdOrDomain.trim().toUpperCase();
    return (
      study.forms.find((f) => f.id === formIdOrDomain) ||
      study.forms.find((f) => f.domain.toUpperCase() === target)
    );
  }

  /**
   * Find Field within Study or Specific Form
   */
  static getField(
    study: StudyProtocol,
    domainOrFormId: string,
    fieldIdOrVar: string
  ):
    | {
        form: CRFForm;
        field: CRFField;
        sectionIndex: number;
        fieldIndex: number;
      }
    | undefined {
    const form = this.getForm(study, domainOrFormId);
    if (!form) return undefined;

    const targetVar = fieldIdOrVar.trim().toUpperCase();
    for (let sIdx = 0; sIdx < form.sections.length; sIdx++) {
      const sec = form.sections[sIdx];
      for (let fIdx = 0; fIdx < sec.fields.length; fIdx++) {
        const fld = sec.fields[fIdx];
        if (
          fld.id === fieldIdOrVar ||
          fld.variableName.toUpperCase() === targetVar
        ) {
          return { form, field: fld, sectionIndex: sIdx, fieldIndex: fIdx };
        }
      }
    }
    return undefined;
  }

  /**
   * Add / Scaffold CDASH Domain Form
   */
  static addForm(
    study: StudyProtocol,
    domain: string,
    customName?: string
  ): { study: StudyProtocol; form: CRFForm } {
    const upperDomain = domain.trim().toUpperCase();
    let newForm: CRFForm;

    try {
      const template = scaffoldCdashDomain(
        upperDomain as Parameters<typeof scaffoldCdashDomain>[0]
      );
      newForm = {
        ...template,
        id: generateEngineId(`form_${upperDomain.toLowerCase()}`),
        name: customName || template.name,
      };
    } catch {
      newForm = {
        id: generateEngineId(`form_${upperDomain.toLowerCase()}`),
        name: customName || `${upperDomain} Custom Form`,
        domain: upperDomain,
        description: `Clinical data form for ${upperDomain}`,
        version: "1.0",
        sections: [
          {
            id: generateEngineId("sec"),
            title: "General Assessment",
            fields: [],
          },
        ],
        rules: [],
      };
    }

    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      forms: [...study.forms, newForm],
    };

    return { study: updatedStudy, form: newForm };
  }

  /**
   * Preview Form Removal Impact on Visit & Arm Schedule
   */
  static previewFormRemoval(
    study: StudyProtocol,
    formIdOrDomain: string
  ): { affectedVisits: StudyVisit[]; affectedArms: StudyArm[] } {
    const targetForm = this.getForm(study, formIdOrDomain);
    if (!targetForm) {
      return { affectedVisits: [], affectedArms: [] };
    }

    const visits = study.visits || [];
    const affectedVisits = visits.filter((v) => {
      const inAssigned = v.assignedFormIds?.includes(targetForm.id) ?? false;
      const inFormIds = v.formIds?.includes(targetForm.id) ?? false;
      const inArmAssignments = v.armFormAssignments
        ? Object.values(v.armFormAssignments).some((ids) =>
            ids?.includes(targetForm.id)
          )
        : false;
      return inAssigned || inFormIds || inArmAssignments;
    });

    const affectedArmIds = new Set<string>();
    for (const v of affectedVisits) {
      if (v.armFormAssignments) {
        for (const [armId, ids] of Object.entries(v.armFormAssignments)) {
          if (ids?.includes(targetForm.id)) {
            affectedArmIds.add(armId);
          }
        }
      }
    }

    const existingArms = study.arms || [];
    const affectedArms: StudyArm[] = [];
    for (const armId of affectedArmIds) {
      const foundArm = existingArms.find((a) => a.id === armId);
      if (foundArm) {
        affectedArms.push(foundArm);
      } else {
        affectedArms.push({
          id: armId,
          name: armId,
          type: "Experimental",
        });
      }
    }

    return { affectedVisits, affectedArms };
  }

  /**
   * Remove Form & Automatically Prune Visit and Arm Assignments
   */
  static removeForm(
    study: StudyProtocol,
    formIdOrDomain: string
  ): {
    study: StudyProtocol;
    removedForm?: CRFForm;
    affectedVisits?: StudyVisit[];
    affectedArms?: StudyArm[];
    undo?: (currentStudy: StudyProtocol) => StudyProtocol;
  } {
    const targetForm = this.getForm(study, formIdOrDomain);
    if (!targetForm) {
      return { study };
    }

    const { affectedVisits, affectedArms } = this.previewFormRemoval(
      study,
      targetForm.id
    );

    const originalIndex = (study.forms || []).findIndex(
      (f) => f.id === targetForm.id
    );

    // Snapshot original visit assignments for undo restoration
    const originalAssignments = (study.visits || []).map((v) => ({
      visitId: v.id,
      assigned: v.assignedFormIds?.includes(targetForm.id) ?? false,
      inFormIds: v.formIds?.includes(targetForm.id) ?? false,
      armAssignments: v.armFormAssignments
        ? Object.entries(v.armFormAssignments)
            .filter(([, ids]) => ids?.includes(targetForm.id))
            .map(([armId]) => armId)
        : [],
    }));

    // Clean up visit assignments atomically
    const updatedVisits = (study.visits || []).map((v) => {
      const nextAssigned = (v.assignedFormIds || []).filter(
        (id) => id !== targetForm.id
      );
      const nextFormIds = v.formIds
        ? v.formIds.filter((id) => id !== targetForm.id)
        : undefined;
      let nextArmAssignments: Record<string, string[]> | undefined;
      if (v.armFormAssignments) {
        nextArmAssignments = {};
        for (const [armId, ids] of Object.entries(v.armFormAssignments)) {
          nextArmAssignments[armId] = ids.filter((id) => id !== targetForm.id);
        }
      }

      return {
        ...v,
        assignedFormIds: nextAssigned,
        ...(nextFormIds ? { formIds: nextFormIds } : {}),
        ...(nextArmAssignments
          ? { armFormAssignments: nextArmAssignments }
          : {}),
      };
    });

    const updatedForms = (study.forms || []).filter(
      (f) => f.id !== targetForm.id
    );

    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      forms: updatedForms,
      visits: updatedVisits,
    };

    const undo = (currentStudy: StudyProtocol): StudyProtocol => {
      return StudyProtocolEngine.restoreForm(
        currentStudy,
        targetForm,
        originalAssignments,
        originalIndex
      );
    };

    return {
      study: updatedStudy,
      removedForm: targetForm,
      affectedVisits,
      affectedArms,
      undo,
    };
  }

  /**
   * Restore Form and its Associated Visit / Arm Assignments
   */
  static restoreForm(
    study: StudyProtocol,
    form: CRFForm,
    originalAssignments?:
      | Array<{
          visitId: string;
          assigned?: boolean;
          inFormIds?: boolean;
          armAssignments?: string[];
        }>
      | StudyVisit[],
    originalIndex?: number
  ): StudyProtocol {
    const currentForms = study.forms || [];
    const exists = currentForms.some((f) => f.id === form.id);
    let forms = currentForms;
    if (!exists) {
      if (
        originalIndex !== undefined &&
        originalIndex >= 0 &&
        originalIndex <= currentForms.length
      ) {
        forms = [...currentForms];
        forms.splice(originalIndex, 0, form);
      } else {
        forms = [...currentForms, form];
      }
    }

    let visits = study.visits || [];

    if (Array.isArray(originalAssignments)) {
      visits = visits.map((v) => {
        const record = originalAssignments.find((r) =>
          "visitId" in r
            ? r.visitId === v.id
            : "id" in r
              ? r.id === v.id
              : false
        );
        if (!record) return v;

        const nextAssigned = [...(v.assignedFormIds || [])];
        let nextFormIds = v.formIds ? [...v.formIds] : undefined;
        let nextArmAssignments = v.armFormAssignments
          ? { ...v.armFormAssignments }
          : undefined;

        if ("assigned" in record) {
          if (record.assigned && !nextAssigned.includes(form.id)) {
            nextAssigned.push(form.id);
          }
          if (record.inFormIds) {
            nextFormIds = nextFormIds || [];
            if (!nextFormIds.includes(form.id)) {
              nextFormIds.push(form.id);
            }
          }
          if (record.armAssignments && record.armAssignments.length > 0) {
            nextArmAssignments = nextArmAssignments || {};
            for (const armId of record.armAssignments) {
              const currentList = nextArmAssignments[armId] || [];
              if (!currentList.includes(form.id)) {
                nextArmAssignments[armId] = [...currentList, form.id];
              }
            }
          }
        } else if ("assignedFormIds" in record) {
          if (
            record.assignedFormIds?.includes(form.id) &&
            !nextAssigned.includes(form.id)
          ) {
            nextAssigned.push(form.id);
          }
          if (record.formIds?.includes(form.id)) {
            nextFormIds = nextFormIds || [];
            if (!nextFormIds.includes(form.id)) {
              nextFormIds.push(form.id);
            }
          }
          if (record.armFormAssignments) {
            nextArmAssignments = nextArmAssignments || {};
            for (const [armId, ids] of Object.entries(
              record.armFormAssignments
            )) {
              if (ids.includes(form.id)) {
                const currentList = nextArmAssignments[armId] || [];
                if (!currentList.includes(form.id)) {
                  nextArmAssignments[armId] = [...currentList, form.id];
                }
              }
            }
          }
        }

        return {
          ...v,
          assignedFormIds: nextAssigned,
          ...(nextFormIds ? { formIds: nextFormIds } : {}),
          ...(nextArmAssignments
            ? { armFormAssignments: nextArmAssignments }
            : {}),
        };
      });
    }

    return {
      ...study,
      lastModified: new Date().toISOString(),
      forms,
      visits,
    };
  }

  /**
   * Duplicate Form with Fresh Identities, Deep Cloning, and Internal Rule Remapping
   */
  static duplicateForm(
    study: StudyProtocol,
    formIdOrDomain: string,
    options?: {
      customName?: string;
      newDomain?: string;
      renameVariables?: boolean;
    }
  ): { study: StudyProtocol; duplicatedForm?: CRFForm; error?: string } {
    const originalForm = this.getForm(study, formIdOrDomain);
    if (!originalForm) {
      return {
        study,
        error: `Form '${formIdOrDomain}' not found in protocol.`,
      };
    }

    // Deep-clone original form so values in copies do not alias the source
    const cloned: CRFForm = cloneDeep(originalForm);

    // Allocate distinct unique form ID
    cloned.id = generateEngineId(
      `form_${(cloned.domain || "crf").toLowerCase()}`
    );
    cloned.name = options?.customName || `${originalForm.name} (Copy)`;
    if (options?.newDomain) {
      cloned.domain = options.newDomain.toUpperCase();
    }

    // Default renameVariables to true unless explicitly disabled
    const shouldRenameVariables = options?.renameVariables !== false;

    // Maps for remapping IDs and variable names
    const fieldIdMap = new Map<string, string>();
    const varNameMap = new Map<string, string>();
    const sectionIdMap = new Map<string, string>();

    // Collect all existing variable names in original form and same-domain study forms
    const existingVars = new Set<string>();
    for (const sec of originalForm.sections) {
      for (const fld of sec.fields) {
        existingVars.add(fld.variableName.toUpperCase());
        if (fld.repeatingColumns) {
          for (const rc of fld.repeatingColumns) {
            existingVars.add(rc.variableName.toUpperCase());
          }
        }
      }
    }
    const targetDomain = cloned.domain.toUpperCase();
    for (const f of study.forms) {
      if (f.domain.toUpperCase() === targetDomain) {
        for (const sec of f.sections) {
          for (const fld of sec.fields) {
            existingVars.add(fld.variableName.toUpperCase());
            if (fld.repeatingColumns) {
              for (const rc of fld.repeatingColumns) {
                existingVars.add(rc.variableName.toUpperCase());
              }
            }
          }
        }
      }
    }

    // Remap sections, fields, repeating columns
    cloned.sections = cloned.sections.map((sec) => {
      const newSecId = generateEngineId("sec");
      sectionIdMap.set(sec.id, newSecId);

      const newFields = sec.fields.map((fld) => {
        const newFldId = generateEngineId("fld");
        fieldIdMap.set(fld.id, newFldId);
        fieldIdMap.set(fld.variableName, newFldId);

        let newVar = fld.variableName;
        if (shouldRenameVariables) {
          newVar = generateCdashVariableName(fld.variableName, existingVars);
          existingVars.add(newVar);
          varNameMap.set(fld.variableName, newVar);
        }

        let repeatingColumns: CRFField[] | undefined;
        if (fld.repeatingColumns) {
          repeatingColumns = fld.repeatingColumns.map((rc) => {
            const newRcId = generateEngineId("fld");
            fieldIdMap.set(rc.id, newRcId);
            fieldIdMap.set(rc.variableName, newRcId);
            let newRcVar = rc.variableName;
            if (shouldRenameVariables) {
              newRcVar = generateCdashVariableName(
                rc.variableName,
                existingVars
              );
              existingVars.add(newRcVar);
              varNameMap.set(rc.variableName, newRcVar);
            }
            return {
              ...rc,
              id: newRcId,
              variableName: newRcVar,
            };
          });
        }

        return {
          ...fld,
          id: newFldId,
          variableName: newVar,
          ...(repeatingColumns ? { repeatingColumns } : {}),
        };
      });

      return {
        ...sec,
        id: newSecId,
        fields: newFields,
      };
    });

    // Build combined substitution map: field IDs first, then variable names (so variable names map to new variables)
    const formulaSubMap = new Map<string, string>();
    for (const [k, v] of fieldIdMap) {
      formulaSubMap.set(k.toUpperCase(), v);
    }
    for (const [k, v] of varNameMap) {
      formulaSubMap.set(k.toUpperCase(), v);
    }

    // Helper for single-pass multi-token formula substitution (prevents cascade)
    const remapFormulaString = (formula: string): string => {
      if (!formula || formulaSubMap.size === 0) return formula;
      const sortedKeys = Array.from(formulaSubMap.keys()).sort(
        (a, b) => b.length - a.length
      );
      const pattern = new RegExp(
        sortedKeys
          .map((k) => `\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)
          .join("|"),
        "gi"
      );
      return formula.replace(
        pattern,
        (matched) => formulaSubMap.get(matched.toUpperCase()) || matched
      );
    };

    // Remap internal rules and conditions
    cloned.rules = cloned.rules.map((rule) => {
      const newRuleId = generateEngineId("rule");
      const remappedTarget =
        fieldIdMap.get(rule.targetFieldId) || rule.targetFieldId;
      const remappedTriggers = rule.triggerFieldIds.map(
        (id) => fieldIdMap.get(id) || id
      );

      const remappedConditions = (rule.conditions || []).map((cond) => ({
        ...cond,
        fieldId: fieldIdMap.get(cond.fieldId) || cond.fieldId,
        compareFieldId: cond.compareFieldId
          ? fieldIdMap.get(cond.compareFieldId) || cond.compareFieldId
          : undefined,
      }));

      const remappedGroups = rule.conditionGroups?.map((grp) => ({
        ...grp,
        id: generateEngineId("condgrp"),
        conditions: grp.conditions.map((cond) => ({
          ...cond,
          fieldId: fieldIdMap.get(cond.fieldId) || cond.fieldId,
          compareFieldId: cond.compareFieldId
            ? fieldIdMap.get(cond.compareFieldId) || cond.compareFieldId
            : undefined,
        })),
      }));

      const remappedFormula = rule.formulaExpression
        ? remapFormulaString(rule.formulaExpression)
        : undefined;

      return {
        ...rule,
        id: newRuleId,
        targetFieldId: remappedTarget,
        triggerFieldIds: remappedTriggers,
        conditions: remappedConditions,
        ...(remappedGroups ? { conditionGroups: remappedGroups } : {}),
        ...(remappedFormula !== undefined
          ? { formulaExpression: remappedFormula }
          : {}),
      };
    });

    // Remap field calculation formulas if variable names changed
    if (varNameMap.size > 0) {
      for (const sec of cloned.sections) {
        for (const fld of sec.fields) {
          if (fld.calculationFormula) {
            fld.calculationFormula = remapFormulaString(fld.calculationFormula);
          }
        }
      }
    }

    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      forms: [...study.forms, cloned],
    };

    return { study: updatedStudy, duplicatedForm: cloned };
  }

  /**
   * Duplicate Clinical Field with Unique Identity and Nonconflicting CDASH Variable Name
   */
  static duplicateField(
    study: StudyProtocol,
    domainOrFormId: string,
    fieldIdOrVar: string,
    targetSectionId?: string
  ): {
    study: StudyProtocol;
    duplicatedField?: CRFField;
    form?: CRFForm;
    error?: string;
  } {
    const found = this.getField(study, domainOrFormId, fieldIdOrVar);
    if (!found) {
      return {
        study,
        error: `Field '${fieldIdOrVar}' not found in form '${domainOrFormId}'.`,
      };
    }

    const {
      form,
      field: originalField,
      sectionIndex: origSecIdx,
      fieldIndex: origFldIdx,
    } = found;

    // Collect all existing variable names in this form and same-domain study forms
    const existingVars = new Set<string>();
    const targetDomain = form.domain.toUpperCase();
    for (const f of study.forms) {
      if (f.id === form.id || f.domain.toUpperCase() === targetDomain) {
        for (const sec of f.sections) {
          for (const fld of sec.fields) {
            existingVars.add(fld.variableName.toUpperCase());
            if (fld.repeatingColumns) {
              for (const rc of fld.repeatingColumns) {
                existingVars.add(rc.variableName.toUpperCase());
              }
            }
          }
        }
      }
    }

    const newVariableName = generateCdashVariableName(
      originalField.variableName,
      existingVars
    );
    existingVars.add(newVariableName);

    // Deep-clone original field so copy does not alias source
    const duplicatedField: CRFField = cloneDeep(originalField);
    duplicatedField.id = generateEngineId("fld");
    duplicatedField.variableName = newVariableName;
    duplicatedField.label = `${originalField.label} (Copy)`;

    // Allocate fresh IDs and nonconflicting variable names for repeating columns
    if (
      duplicatedField.repeatingColumns &&
      duplicatedField.repeatingColumns.length > 0
    ) {
      duplicatedField.repeatingColumns = duplicatedField.repeatingColumns.map(
        (rc) => {
          const newRcVar = generateCdashVariableName(
            rc.variableName,
            existingVars
          );
          existingVars.add(newRcVar);
          return {
            ...rc,
            id: generateEngineId("fld"),
            variableName: newRcVar,
          };
        }
      );
    }

    // Determine target section
    let targetSecIndex = origSecIdx;
    if (targetSectionId) {
      const foundIdx = form.sections.findIndex((s) => s.id === targetSectionId);
      if (foundIdx !== -1) {
        targetSecIndex = foundIdx;
      }
    }

    const updatedSections = form.sections.map((sec, sIdx) => {
      if (sIdx !== targetSecIndex) return sec;
      const fields = [...sec.fields];
      const insertIdx = sIdx === origSecIdx ? origFldIdx + 1 : fields.length;
      fields.splice(insertIdx, 0, duplicatedField);
      return { ...sec, fields };
    });

    const updatedForm: CRFForm = {
      ...form,
      sections: updatedSections,
    };

    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      forms: study.forms.map((f) => (f.id === form.id ? updatedForm : f)),
    };

    return { study: updatedStudy, duplicatedField, form: updatedForm };
  }

  /**
   * Add Section to Form
   */
  static addSection(
    study: StudyProtocol,
    domainOrFormId: string,
    titleOrSection: string | Partial<CRFSection>
  ): {
    study: StudyProtocol;
    section?: CRFSection;
    form?: CRFForm;
    error?: string;
  } {
    const form = this.getForm(study, domainOrFormId);
    if (!form) {
      return {
        study,
        error: `Form '${domainOrFormId}' not found in protocol.`,
      };
    }

    const newSection: CRFSection = {
      id:
        typeof titleOrSection === "object" && titleOrSection.id
          ? titleOrSection.id
          : generateEngineId("sec"),
      title:
        typeof titleOrSection === "string"
          ? titleOrSection
          : titleOrSection.title || "New Section",
      fields:
        typeof titleOrSection === "object" && titleOrSection.fields
          ? titleOrSection.fields
          : [],
    };

    const updatedForm: CRFForm = {
      ...form,
      sections: [...form.sections, newSection],
    };

    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      forms: study.forms.map((f) => (f.id === form.id ? updatedForm : f)),
    };

    return { study: updatedStudy, section: newSection, form: updatedForm };
  }

  /**
   * Insert Clinical Field into Specified Section and Position
   */
  static insertField(
    study: StudyProtocol,
    domainOrFormId: string,
    fieldData: Partial<CRFField> & {
      variableName: string;
      dataType: ClinicalDataType;
    },
    options?: {
      sectionId?: string;
      sectionIndex?: number;
      targetIndex?: number;
    }
  ): {
    study: StudyProtocol;
    field?: CRFField;
    form?: CRFForm;
    error?: string;
  } {
    const form = this.getForm(study, domainOrFormId);
    if (!form) {
      return {
        study,
        error: `Form '${domainOrFormId}' not found in protocol.`,
      };
    }

    let targetForm = form;
    if (targetForm.sections.length === 0) {
      const defaultSection: CRFSection = {
        id: generateEngineId("sec"),
        title: "General Assessment",
        fields: [],
      };
      targetForm = { ...form, sections: [defaultSection] };
    }

    const upperVar = fieldData.variableName.trim().toUpperCase();

    // Check variable duplicate in form (including repeating columns)
    const exists = targetForm.sections.some((s) =>
      s.fields.some((f) => {
        if (f.variableName.toUpperCase() === upperVar) return true;
        return f.repeatingColumns?.some(
          (rc) => rc.variableName.toUpperCase() === upperVar
        );
      })
    );
    if (exists) {
      return {
        study,
        error: `Variable '${upperVar}' already exists in form '${targetForm.domain}'.`,
      };
    }

    if (fieldData.repeatingColumns && fieldData.repeatingColumns.length > 0) {
      for (const rc of fieldData.repeatingColumns) {
        const rcVar = rc.variableName.trim().toUpperCase();
        if (rcVar === upperVar) {
          return {
            study,
            error: `Repeating column variable '${rcVar}' conflicts with parent variable '${upperVar}'.`,
          };
        }
        const rcExists = targetForm.sections.some((s) =>
          s.fields.some((f) => {
            if (f.variableName.toUpperCase() === rcVar) return true;
            return f.repeatingColumns?.some(
              (c) => c.variableName.toUpperCase() === rcVar
            );
          })
        );
        if (rcExists) {
          return {
            study,
            error: `Repeating column variable '${rcVar}' already exists in form '${targetForm.domain}'.`,
          };
        }
      }
    }

    // Attempt CDASH variable metadata lookup
    const domainVars = CDASH_STANDARD_VARIABLES[targetForm.domain];
    const cdashMeta = domainVars?.find((v) => v.sdtmVariable === upperVar);

    const newField: CRFField = {
      id: fieldData.id || generateEngineId(`fld_${upperVar.toLowerCase()}`),
      variableName: upperVar,
      label: fieldData.label || cdashMeta?.cdashLabel || upperVar,
      description: fieldData.description,
      dataType: fieldData.dataType,
      columnSpan: fieldData.columnSpan || 6,
      required:
        fieldData.required ??
        (cdashMeta?.core === "R" || cdashMeta?.core === "HR"),
      unit: fieldData.unit,
      unitOptions: fieldData.unitOptions,
      minValue: fieldData.minValue,
      maxValue: fieldData.maxValue,
      defaultValue: fieldData.defaultValue,
      codelistId: fieldData.codelistId,
      customOptions: fieldData.customOptions,
      calculationFormula: fieldData.calculationFormula,
      cdashMetadata: cdashMeta,
      allowPartial: fieldData.allowPartial,
      preventFutureDate: fieldData.preventFutureDate,
      allowNullFlavor: fieldData.allowNullFlavor,
      requirementTier:
        fieldData.requirementTier ||
        (fieldData.required ? "hard_stop" : "optional"),
      requiresSdv: fieldData.requiresSdv,
      isBlinded: fieldData.isBlinded,
      nullFlavorValue: fieldData.nullFlavorValue,
      repeatingColumns: fieldData.repeatingColumns,
    };

    // Determine target section
    let targetSecIdx = 0;
    if (options?.sectionId) {
      const foundIdx = targetForm.sections.findIndex(
        (s) => s.id === options.sectionId
      );
      if (foundIdx !== -1) {
        targetSecIdx = foundIdx;
      } else if (options?.sectionIndex !== undefined) {
        targetSecIdx = Math.max(
          0,
          Math.min(options.sectionIndex, targetForm.sections.length - 1)
        );
      }
    } else if (options?.sectionIndex !== undefined) {
      targetSecIdx = Math.max(
        0,
        Math.min(options.sectionIndex, targetForm.sections.length - 1)
      );
    }

    const targetSec = targetForm.sections[targetSecIdx];
    const maxTargetIdx = targetSec.fields.length;
    const insertIdx =
      options?.targetIndex !== undefined
        ? Math.max(0, Math.min(options.targetIndex, maxTargetIdx))
        : maxTargetIdx;

    const updatedSections = targetForm.sections.map((sec, idx) => {
      if (idx === targetSecIdx) {
        const newFields = [...sec.fields];
        newFields.splice(insertIdx, 0, newField);
        return { ...sec, fields: newFields };
      }
      return sec;
    });

    const updatedForm: CRFForm = { ...targetForm, sections: updatedSections };
    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      forms: study.forms.map((f) => (f.id === targetForm.id ? updatedForm : f)),
    };

    return { study: updatedStudy, field: newField, form: updatedForm };
  }

  /**
   * Add Clinical Field to Form (Appends or Inserts at Target Index)
   */
  static addField(
    study: StudyProtocol,
    domainOrFormId: string,
    fieldData: Partial<CRFField> & {
      variableName: string;
      dataType: ClinicalDataType;
    },
    sectionIndexOrOptions:
      | number
      | { sectionId?: string; sectionIndex?: number; targetIndex?: number } = 0
  ): {
    study: StudyProtocol;
    field?: CRFField;
    form?: CRFForm;
    error?: string;
  } {
    const options =
      typeof sectionIndexOrOptions === "number"
        ? { sectionIndex: sectionIndexOrOptions }
        : sectionIndexOrOptions;
    return this.insertField(study, domainOrFormId, fieldData, options);
  }

  /**
   * Inserts a Clinical Smart Block into the specified form with collision-resistant
   * IDs, CDASH non-conflicting variable names, and remapped rule conditions/formulas.
   */
  static insertSmartBlock(
    study: StudyProtocol,
    domainOrFormId: string,
    smartBlockId: string,
    options?: {
      targetSectionId?: string;
      targetIndex?: number;
      asNewSection?: boolean;
    }
  ): {
    study: StudyProtocol;
    insertedSection?: CRFSection;
    insertedFields: CRFField[];
    insertedRules: EditCheckRule[];
    error?: string;
    undo: () => StudyProtocol;
  } {
    const originalStudy = study;
    const form = this.getForm(study, domainOrFormId);
    if (!form) {
      return {
        study,
        insertedFields: [],
        insertedRules: [],
        error: `Form '${domainOrFormId}' not found in protocol.`,
        undo: () => originalStudy,
      };
    }

    // Collect all existing variable names across the form
    const existingVars = new Set<string>();
    form.sections.forEach((s) => {
      s.fields.forEach((f) => {
        existingVars.add(f.variableName.toUpperCase());
        f.repeatingColumns?.forEach((rc) =>
          existingVars.add(rc.variableName.toUpperCase())
        );
      });
    });

    const { section, rules } = instantiateSmartBlock(smartBlockId, {
      existingVariableNames: existingVars,
    });

    const updatedForm = { ...form };
    const asNewSection =
      options?.asNewSection ?? options?.targetSectionId === undefined;

    if (asNewSection) {
      const targetSecIdx =
        options?.targetIndex !== undefined
          ? options.targetIndex
          : updatedForm.sections.length;
      const nextSections = [...updatedForm.sections];
      nextSections.splice(targetSecIdx, 0, section);
      updatedForm.sections = nextSections;
    } else {
      const targetSecIdx = updatedForm.sections.findIndex(
        (s) => s.id === options?.targetSectionId
      );
      if (targetSecIdx === -1) {
        updatedForm.sections = [...updatedForm.sections, section];
      } else {
        const targetSec = updatedForm.sections[targetSecIdx];
        const nextFields = [...targetSec.fields];
        const insertIdx =
          options?.targetIndex !== undefined
            ? options.targetIndex
            : nextFields.length;
        nextFields.splice(insertIdx, 0, ...section.fields);
        const updatedSec = { ...targetSec, fields: nextFields };
        const nextSections = [...updatedForm.sections];
        nextSections[targetSecIdx] = updatedSec;
        updatedForm.sections = nextSections;
      }
    }

    // Add remapped rules to form
    updatedForm.rules = [...(updatedForm.rules || []), ...rules];

    const updatedForms = study.forms.map((f) =>
      f.id === form.id || f.domain.toUpperCase() === form.domain.toUpperCase()
        ? updatedForm
        : f
    );

    const updatedStudy = {
      ...study,
      forms: updatedForms,
      updatedAt: new Date().toISOString(),
    };

    return {
      study: updatedStudy,
      insertedSection: asNewSection ? section : undefined,
      insertedFields: section.fields,
      insertedRules: rules,
      undo: () => originalStudy,
    };
  }

  /**
   * Inserts an atomic field from a slash command into the specified form/section
   */
  static insertAtomicSlashField(
    study: StudyProtocol,
    domainOrFormId: string,
    commandId: string,
    options?: {
      targetSectionId?: string;
      targetIndex?: number;
    }
  ): {
    study: StudyProtocol;
    insertedField?: CRFField;
    error?: string;
    undo: () => StudyProtocol;
  } {
    const originalStudy = study;
    const form = this.getForm(study, domainOrFormId);
    if (!form) {
      return {
        study,
        error: `Form '${domainOrFormId}' not found in protocol.`,
        undo: () => originalStudy,
      };
    }

    const existingVars = new Set<string>();
    form.sections.forEach((s) => {
      s.fields.forEach((f) => {
        existingVars.add(f.variableName.toUpperCase());
        f.repeatingColumns?.forEach((rc) =>
          existingVars.add(rc.variableName.toUpperCase())
        );
      });
    });

    const field = instantiateAtomicField(commandId, {
      existingVariableNames: existingVars,
    });

    const result = this.insertField(study, domainOrFormId, field, {
      sectionId: options?.targetSectionId,
      targetIndex: options?.targetIndex,
    });

    if (result.error || !result.field) {
      return {
        study,
        error: result.error || "Failed to insert atomic field.",
        undo: () => originalStudy,
      };
    }

    return {
      study: result.study,
      insertedField: result.field,
      undo: () => originalStudy,
    };
  }

  /**
   * Update Existing Clinical Field in Form
   */
  static updateField(
    study: StudyProtocol,
    domainOrFormId: string,
    fieldIdOrVar: string,
    updates: Partial<CRFField>
  ): {
    study: StudyProtocol;
    field?: CRFField;
    form?: CRFForm;
    error?: string;
  } {
    const found = this.getField(study, domainOrFormId, fieldIdOrVar);
    if (!found) {
      return {
        study,
        error: `Field '${fieldIdOrVar}' not found in form '${domainOrFormId}'.`,
      };
    }

    const { form, field: currentField } = found;
    const updatedField: CRFField = {
      ...currentField,
      ...updates,
      variableName: updates.variableName
        ? updates.variableName.trim().toUpperCase()
        : currentField.variableName,
    };

    const updatedSections = form.sections.map((sec) => ({
      ...sec,
      fields: sec.fields.map((f) =>
        f.id === currentField.id ? updatedField : f
      ),
    }));

    const updatedForm: CRFForm = {
      ...form,
      sections: updatedSections,
    };

    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      forms: study.forms.map((f) => (f.id === form.id ? updatedForm : f)),
    };

    return { study: updatedStudy, field: updatedField, form: updatedForm };
  }

  /**
   * Move Field to Target Section within Form
   */
  static moveFieldToSection(
    study: StudyProtocol,
    domainOrFormId: string,
    fieldIdOrVar: string,
    targetSectionIdOrTitle: string
  ): {
    study: StudyProtocol;
    field?: CRFField;
    form?: CRFForm;
    error?: string;
  } {
    const found = this.getField(study, domainOrFormId, fieldIdOrVar);
    if (!found) {
      return {
        study,
        error: `Field '${fieldIdOrVar}' not found in form '${domainOrFormId}'.`,
      };
    }

    const { form, field, sectionIndex } = found;
    const targetSec = form.sections.find(
      (s) =>
        s.id === targetSectionIdOrTitle ||
        s.title.trim().toLowerCase() ===
          targetSectionIdOrTitle.trim().toLowerCase()
    );

    if (!targetSec) {
      return {
        study,
        error: `Target section '${targetSectionIdOrTitle}' not found in form '${form.name}'.`,
      };
    }

    if (targetSec.id === form.sections[sectionIndex].id) {
      return { study, field, form };
    }

    const updatedSections = form.sections.map((sec) => {
      const filteredFields = sec.fields.filter((f) => f.id !== field.id);
      if (sec.id === targetSec.id) {
        return { ...sec, fields: [...filteredFields, field] };
      }
      return { ...sec, fields: filteredFields };
    });

    const updatedForm: CRFForm = {
      ...form,
      sections: updatedSections,
    };

    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      forms: study.forms.map((f) => (f.id === form.id ? updatedForm : f)),
    };

    return { study: updatedStudy, field, form: updatedForm };
  }

  /**
   * Find All References to a Field Across Rules, Conditions, Formulas, Calculations, and Grids (#542)
   */
  static findFieldReferences(
    study: StudyProtocol,
    fieldIdOrVar: string,
    formId?: string
  ): FieldReferenceLocation[] {
    const rawTarget = fieldIdOrVar.trim();
    if (!rawTarget) return [];

    const targetUpper = rawTarget.toUpperCase();
    const targetLower = rawTarget.toLowerCase();

    // Resolve target field to determine both exact id and variableName if possible
    let resolvedId = rawTarget;
    let resolvedVar = rawTarget;

    const formsToScan = study.forms || [];
    for (const f of formsToScan) {
      for (const s of f.sections) {
        for (const fld of s.fields) {
          if (
            fld.id.toLowerCase() === targetLower ||
            fld.variableName.toUpperCase() === targetUpper
          ) {
            resolvedId = fld.id;
            resolvedVar = fld.variableName;
            break;
          }
          if (fld.repeatingColumns) {
            for (const rc of fld.repeatingColumns) {
              if (
                rc.id.toLowerCase() === targetLower ||
                rc.variableName.toUpperCase() === targetUpper
              ) {
                resolvedId = rc.id;
                resolvedVar = rc.variableName;
                break;
              }
            }
          }
        }
      }
    }

    const idRegex = new RegExp(`\\b${escapeRegex(resolvedId)}\\b`, "i");
    const varRegex = new RegExp(`\\b${escapeRegex(resolvedVar)}\\b`, "i");

    const matchesTarget = (val?: string | null): boolean => {
      if (!val) return false;
      const u = val.toUpperCase();
      const l = val.toLowerCase();
      return (
        l === resolvedId.toLowerCase() ||
        u === resolvedVar.toUpperCase() ||
        l === targetLower ||
        u === targetUpper
      );
    };

    const references: FieldReferenceLocation[] = [];
    const seen = new Set<string>();

    const addRef = (ref: FieldReferenceLocation) => {
      const key = `${ref.formId}:${ref.type}:${ref.ruleId || ""}:${ref.fieldId || ""}:${ref.description}`;
      if (!seen.has(key)) {
        seen.add(key);
        references.push(ref);
      }
    };

    for (const form of formsToScan) {
      if (
        formId &&
        form.id !== formId &&
        !form.rules?.some((r) => r.conditions?.some((c) => c.crossVisitId))
      ) {
        // Optimization: if specific formId requested and no cross-visit, prioritize focused scanning
      }

      // 1. Scan form rules
      const rules = form.rules || [];
      for (const rule of rules) {
        // Target field check
        if (matchesTarget(rule.targetFieldId)) {
          addRef({
            type: "rule_target",
            formId: form.id,
            formName: form.name,
            ruleId: rule.id,
            ruleName: rule.name,
            description: `Rule '${rule.name}' targets this field as its action target.`,
          });
        }

        // Trigger fields check
        if (rule.triggerFieldIds?.some((id) => matchesTarget(id))) {
          addRef({
            type: "rule_trigger",
            formId: form.id,
            formName: form.name,
            ruleId: rule.id,
            ruleName: rule.name,
            description: `Rule '${rule.name}' lists this field as an evaluation trigger.`,
          });
        }

        // Conditions check
        const checkCond = (cond: AstCondition) => {
          const isCrossVisit = Boolean(cond.crossVisitId);
          if (matchesTarget(cond.fieldId)) {
            addRef({
              type: isCrossVisit ? "cross_visit_rule" : "rule_condition",
              formId: form.id,
              formName: form.name,
              ruleId: rule.id,
              ruleName: rule.name,
              description: isCrossVisit
                ? `Cross-visit rule '${rule.name}' evaluates this field at visit '${cond.crossVisitId}'.`
                : `Rule '${rule.name}' evaluates this field in condition '${cond.fieldId} ${cond.operator}'.`,
            });
          }
          if (cond.compareFieldId && matchesTarget(cond.compareFieldId)) {
            addRef({
              type: isCrossVisit ? "cross_visit_rule" : "rule_condition",
              formId: form.id,
              formName: form.name,
              ruleId: rule.id,
              ruleName: rule.name,
              description: isCrossVisit
                ? `Cross-visit rule '${rule.name}' compares against this field at visit '${cond.crossVisitId}'.`
                : `Rule '${rule.name}' compares against this field in condition.`,
            });
          }
        };

        if (rule.conditions) {
          rule.conditions.forEach(checkCond);
        }

        if (rule.conditionGroups) {
          for (const grp of rule.conditionGroups) {
            grp.conditions.forEach(checkCond);
          }
        }

        // Rule formula expression check
        if (rule.formulaExpression) {
          if (
            idRegex.test(rule.formulaExpression) ||
            varRegex.test(rule.formulaExpression)
          ) {
            addRef({
              type: "rule_formula",
              formId: form.id,
              formName: form.name,
              ruleId: rule.id,
              ruleName: rule.name,
              description: `Rule '${rule.name}' derives values using this variable in formula '${rule.formulaExpression}'.`,
            });
          }
        }
      }

      // 2. Scan other fields' calculation formulas and repeating columns
      for (const sec of form.sections) {
        for (const fld of sec.fields) {
          if (fld.id !== resolvedId) {
            if (fld.calculationFormula) {
              if (
                idRegex.test(fld.calculationFormula) ||
                varRegex.test(fld.calculationFormula)
              ) {
                addRef({
                  type: "field_calculation",
                  formId: form.id,
                  formName: form.name,
                  fieldId: fld.id,
                  variableName: fld.variableName,
                  description: `Field '${fld.label}' (${fld.variableName}) uses this variable in calculation formula '${fld.calculationFormula}'.`,
                });
              }
            }
          }

          if (fld.repeatingColumns) {
            for (const rc of fld.repeatingColumns) {
              if (rc.id !== resolvedId && rc.calculationFormula) {
                if (
                  idRegex.test(rc.calculationFormula) ||
                  varRegex.test(rc.calculationFormula)
                ) {
                  addRef({
                    type: "field_calculation",
                    formId: form.id,
                    formName: form.name,
                    fieldId: rc.id,
                    variableName: rc.variableName,
                    description: `Repeating column '${rc.label}' (${rc.variableName}) in grid '${fld.label}' uses this variable in calculation formula.`,
                  });
                }
              }
              if (matchesTarget(rc.id) || matchesTarget(rc.variableName)) {
                if (fld.id !== resolvedId) {
                  addRef({
                    type: "repeating_column",
                    formId: form.id,
                    formName: form.name,
                    fieldId: fld.id,
                    variableName: fld.variableName,
                    description: `This field is a column inside repeating grid '${fld.label}' (${fld.variableName}).`,
                  });
                }
              }
            }
          }
        }
      }
    }

    return references;
  }

  /**
   * Preview Blast Radius Before Deleting a Field (#542)
   */
  static previewFieldRemoval(
    study: StudyProtocol,
    domainOrFormId: string,
    fieldIdOrVar: string
  ): FieldImpactPreview {
    const found = this.getField(study, domainOrFormId, fieldIdOrVar);
    const form = this.getForm(study, domainOrFormId);
    const formId = form?.id || domainOrFormId;

    if (!found) {
      return {
        targetFieldId: fieldIdOrVar,
        targetVariableName: fieldIdOrVar,
        formId,
        references: [],
        canSafelyDelete: true,
      };
    }

    const { field } = found;
    const references = this.findFieldReferences(study, field.id, formId);
    const canSafelyDelete = references.length === 0;

    let warningMessage: string | undefined;
    if (!canSafelyDelete) {
      const ruleRefs = references.filter(
        (r) => r.type.startsWith("rule") || r.type === "cross_visit_rule"
      );
      const calcRefs = references.filter((r) => r.type === "field_calculation");
      const parts: string[] = [];
      if (ruleRefs.length > 0)
        parts.push(`${ruleRefs.length} rule reference(s)`);
      if (calcRefs.length > 0)
        parts.push(`${calcRefs.length} calculation formula(s)`);
      warningMessage = `Field '${field.variableName}' is actively referenced by ${parts.join(" and ") || "other elements"}. Deleting it will cascade and prune dependent rules.`;
    }

    return {
      targetFieldId: field.id,
      targetVariableName: field.variableName,
      formId,
      references,
      canSafelyDelete,
      warningMessage,
    };
  }

  /**
   * Preview Blast Radius Before Deleting a Section (#542)
   */
  static previewSectionRemoval(
    study: StudyProtocol,
    domainOrFormId: string,
    sectionId: string
  ): SectionImpactPreview {
    const form = this.getForm(study, domainOrFormId);
    const formId = form?.id || domainOrFormId;
    const section = form?.sections.find((s) => s.id === sectionId);

    if (!form || !section) {
      return {
        sectionId,
        sectionTitle: sectionId,
        formId,
        fields: [],
        totalReferencesCount: 0,
        allReferences: [],
        canSafelyDelete: true,
      };
    }

    const fields: FieldImpactPreview[] = [];
    const allRefs: FieldReferenceLocation[] = [];
    const seen = new Set<string>();

    for (const fld of section.fields) {
      const preview = this.previewFieldRemoval(study, form.id, fld.id);
      fields.push(preview);
      for (const r of preview.references) {
        const key = `${r.formId}:${r.type}:${r.ruleId || ""}:${r.fieldId || ""}:${r.description}`;
        if (!seen.has(key)) {
          seen.add(key);
          allRefs.push(r);
        }
      }
    }

    const totalReferencesCount = allRefs.length;
    const canSafelyDelete = totalReferencesCount === 0;
    const warningMessage = !canSafelyDelete
      ? `Section '${section.title}' contains ${section.fields.length} field(s) with ${totalReferencesCount} active reference(s) in rules and calculations.`
      : undefined;

    return {
      sectionId: section.id,
      sectionTitle: section.title,
      formId,
      fields,
      totalReferencesCount,
      allReferences: allRefs,
      canSafelyDelete,
      warningMessage,
    };
  }

  /**
   * Rename Field Everywhere: Atomically updates variable name and all AST rules, conditions, and formulas (#542)
   */
  static renameFieldEverywhere(
    study: StudyProtocol,
    domainOrFormId: string,
    fieldIdOrVar: string,
    newVariableName: string,
    newLabel?: string,
    reviewAuthor: StudyReviewActor = this.defaultReviewActor,
    reviewAt = new Date().toISOString()
  ): {
    study: StudyProtocol;
    updatedField?: CRFField;
    affectedReferencesCount: number;
    error?: string;
  } {
    const found = this.getField(study, domainOrFormId, fieldIdOrVar);
    if (!found) {
      return {
        study,
        affectedReferencesCount: 0,
        error: `Field '${fieldIdOrVar}' not found in form '${domainOrFormId}'.`,
      };
    }

    const { form, field: targetField } = found;
    const upperNewVar = newVariableName.trim().toUpperCase();

    if (!upperNewVar) {
      return {
        study,
        affectedReferencesCount: 0,
        error: "Variable name cannot be empty.",
      };
    }

    const validation = validateCdashVariableName(upperNewVar);
    if (!validation.isValid) {
      return {
        study,
        affectedReferencesCount: 0,
        error:
          validation.error || `Invalid CDASH variable name '${upperNewVar}'.`,
      };
    }

    // Check collision in this form
    const isConflict = form.sections.some((s) =>
      s.fields.some((f) => {
        if (
          f.id !== targetField.id &&
          f.variableName.toUpperCase() === upperNewVar
        ) {
          return true;
        }
        return f.repeatingColumns?.some(
          (rc) =>
            rc.id !== targetField.id &&
            rc.variableName.toUpperCase() === upperNewVar
        );
      })
    );

    if (isConflict) {
      return {
        study,
        affectedReferencesCount: 0,
        error: `Variable name '${upperNewVar}' already exists in form '${form.name}'.`,
      };
    }

    const oldVar = targetField.variableName.toUpperCase();
    const oldId = targetField.id;

    // Build replacement regex for word boundary
    const oldVarRegex = new RegExp(`\\b${escapeRegex(oldVar)}\\b`, "g");
    const oldIdRegex = new RegExp(`\\b${escapeRegex(oldId)}\\b`, "g");

    const replaceInFormula = (
      formula?: string
    ): { next?: string; changed: boolean } => {
      if (!formula) return { next: formula, changed: false };
      let next = formula.replace(oldVarRegex, upperNewVar);
      next = next.replace(oldIdRegex, upperNewVar);
      return { next, changed: next !== formula };
    };

    let affectedReferencesCount = 0;
    let finalUpdatedField: CRFField | undefined;

    const updatedForms = study.forms.map((f) => {
      // 1. Update fields in sections
      const updatedSections = f.sections.map((sec) => ({
        ...sec,
        fields: sec.fields.map((fld) => {
          let updatedFld = fld;
          if (fld.id === oldId) {
            updatedFld = {
              ...fld,
              variableName: upperNewVar,
              ...(newLabel !== undefined ? { label: newLabel } : {}),
            };
            finalUpdatedField = updatedFld;
          } else if (fld.calculationFormula) {
            const { next, changed } = replaceInFormula(fld.calculationFormula);
            if (changed) {
              affectedReferencesCount++;
              updatedFld = { ...fld, calculationFormula: next };
            }
          }

          if (updatedFld.repeatingColumns) {
            const updatedRc = updatedFld.repeatingColumns.map((rc) => {
              if (rc.id === oldId) {
                return {
                  ...rc,
                  variableName: upperNewVar,
                  ...(newLabel !== undefined ? { label: newLabel } : {}),
                };
              }
              if (rc.calculationFormula) {
                const { next, changed } = replaceInFormula(
                  rc.calculationFormula
                );
                if (changed) {
                  affectedReferencesCount++;
                  return { ...rc, calculationFormula: next };
                }
              }
              return rc;
            });
            updatedFld = { ...updatedFld, repeatingColumns: updatedRc };
          }

          return updatedFld;
        }),
      }));

      // 2. Update rules
      const updatedRules = (f.rules || []).map((rule) => {
        let ruleModified = false;

        let nextTarget = rule.targetFieldId;
        if (rule.targetFieldId === oldVar) {
          nextTarget = upperNewVar;
          ruleModified = true;
        }

        const nextTriggers = (rule.triggerFieldIds || []).map((tid) => {
          if (tid === oldVar) {
            ruleModified = true;
            return upperNewVar;
          }
          return tid;
        });

        const updateCondition = (cond: AstCondition): AstCondition => {
          let cMod = false;
          let fieldId = cond.fieldId;
          let compareFieldId = cond.compareFieldId;

          if (cond.fieldId === oldVar) {
            fieldId = upperNewVar;
            cMod = true;
          }
          if (cond.compareFieldId === oldVar) {
            compareFieldId = upperNewVar;
            cMod = true;
          }
          if (cMod) ruleModified = true;
          return {
            ...cond,
            fieldId,
            ...(compareFieldId !== undefined ? { compareFieldId } : {}),
          };
        };

        const nextConditions = (rule.conditions || []).map(updateCondition);

        const nextConditionGroups = rule.conditionGroups?.map((grp) => ({
          ...grp,
          conditions: grp.conditions.map(updateCondition),
        }));

        let nextFormula = rule.formulaExpression;
        if (rule.formulaExpression) {
          const { next, changed } = replaceInFormula(rule.formulaExpression);
          if (changed) {
            nextFormula = next;
            ruleModified = true;
          }
        }

        if (ruleModified) {
          affectedReferencesCount++;
        }

        return {
          ...rule,
          targetFieldId: nextTarget,
          triggerFieldIds: nextTriggers,
          conditions: nextConditions,
          ...(nextConditionGroups
            ? { conditionGroups: nextConditionGroups }
            : {}),
          ...(nextFormula !== undefined
            ? { formulaExpression: nextFormula }
            : {}),
        };
      });

      return {
        ...f,
        sections: updatedSections,
        rules: updatedRules,
      };
    });

    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      forms: updatedForms,
    };

    return {
      study: finalUpdatedField
        ? this.recordReviewRename(
            updatedStudy,
            targetField,
            finalUpdatedField,
            reviewAuthor,
            reviewAt
          )
        : updatedStudy,
      updatedField: finalUpdatedField,
      affectedReferencesCount,
    };
  }

  /**
   * Remove Field with Cascade: Prunes referencing rules/conditions with 1-operation undo (#542)
   */
  static removeFieldWithCascade(
    study: StudyProtocol,
    domainOrFormId: string,
    fieldIdOrVar: string,
    options?: {
      purgeReferencingRules?: boolean;
    },
    reviewAuthor: StudyReviewActor = this.defaultReviewActor,
    reviewAt = new Date().toISOString()
  ): {
    study: StudyProtocol;
    removedField?: CRFField;
    removedFromSectionId?: string;
    removedAtIndex?: number;
    affectedReferences: FieldReferenceLocation[];
    undo?: (currentStudy: StudyProtocol) => StudyProtocol;
    error?: string;
  } {
    const found = this.getField(study, domainOrFormId, fieldIdOrVar);
    if (!found) {
      return {
        study,
        affectedReferences: [],
        error: `Field '${fieldIdOrVar}' not found in form '${domainOrFormId}'.`,
      };
    }

    const { form, field, sectionIndex, fieldIndex } = found;
    const targetSection = form.sections[sectionIndex];
    const targetSectionId = targetSection.id;

    // Collect references before removal
    const affectedReferences = this.findFieldReferences(
      study,
      field.id,
      form.id
    );
    const shouldPurgeRules = options?.purgeReferencingRules !== false;

    // Snapshot original rules and form for undo
    const originalRules: EditCheckRule[] = JSON.parse(
      JSON.stringify(form.rules || [])
    );
    const targetFieldId = field.id;
    const targetVar = field.variableName.toUpperCase();

    const matchesThis = (idOrVar?: string | null) => {
      if (!idOrVar) return false;
      return (
        idOrVar.toLowerCase() === targetFieldId.toLowerCase() ||
        idOrVar.toUpperCase() === targetVar
      );
    };

    // Remove field from section
    const updatedSections = form.sections.map((sec, sIdx) => {
      if (sIdx !== sectionIndex) return sec;
      return {
        ...sec,
        fields: sec.fields.filter((f) => f.id !== targetFieldId),
      };
    });

    // Prune rules if shouldPurgeRules
    let updatedRules = form.rules || [];
    if (shouldPurgeRules) {
      updatedRules = updatedRules
        .filter((r) => !matchesThis(r.targetFieldId))
        .map((r) => {
          const nextTriggers = (r.triggerFieldIds || []).filter(
            (id) => !matchesThis(id)
          );
          const nextConditions = (r.conditions || []).filter(
            (c) => !matchesThis(c.fieldId) && !matchesThis(c.compareFieldId)
          );
          const nextGroups = r.conditionGroups
            ?.map((g) => ({
              ...g,
              conditions: g.conditions.filter(
                (c) => !matchesThis(c.fieldId) && !matchesThis(c.compareFieldId)
              ),
            }))
            .filter((g) => g.conditions.length > 0);

          return {
            ...r,
            triggerFieldIds: nextTriggers,
            conditions: nextConditions,
            ...(nextGroups !== undefined
              ? { conditionGroups: nextGroups }
              : {}),
          };
        })
        .filter((r) => {
          const hasTriggers = r.triggerFieldIds && r.triggerFieldIds.length > 0;
          const hasConds =
            (r.conditions && r.conditions.length > 0) ||
            (r.conditionGroups && r.conditionGroups.length > 0);
          return hasTriggers || hasConds;
        });
    }

    const updatedForm: CRFForm = {
      ...form,
      sections: updatedSections,
      rules: updatedRules,
    };

    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      forms: study.forms.map((f) => (f.id === form.id ? updatedForm : f)),
    };

    const undo = (currentStudy: StudyProtocol): StudyProtocol => {
      return StudyProtocolEngine.restoreField(
        currentStudy,
        form.id,
        field,
        targetSectionId,
        fieldIndex,
        originalRules
      );
    };

    return {
      study: this.recordReviewDeletion(
        updatedStudy,
        form,
        field,
        reviewAuthor,
        reviewAt
      ),
      removedField: field,
      removedFromSectionId: targetSectionId,
      removedAtIndex: fieldIndex,
      affectedReferences,
      undo,
    };
  }

  /**
   * Restore Field and Associated Rules to Specified Section and Position (#542)
   */
  static restoreField(
    study: StudyProtocol,
    formId: string,
    field: CRFField,
    sectionId?: string,
    fieldIndex?: number,
    restoredRules?: EditCheckRule[]
  ): StudyProtocol {
    const form = this.getForm(study, formId);
    if (!form) return study;

    let targetSecIdx = 0;
    if (sectionId) {
      const foundIdx = form.sections.findIndex((s) => s.id === sectionId);
      if (foundIdx !== -1) targetSecIdx = foundIdx;
    }

    const targetSec = form.sections[targetSecIdx];
    if (!targetSec) return study;

    // Check if field already present
    const alreadyExists = form.sections.some((s) =>
      s.fields.some((f) => f.id === field.id)
    );
    if (alreadyExists) return study;

    const updatedSections = form.sections.map((sec, idx) => {
      if (idx !== targetSecIdx) return sec;
      const nextFields = [...sec.fields];
      const insIdx =
        fieldIndex !== undefined &&
        fieldIndex >= 0 &&
        fieldIndex <= nextFields.length
          ? fieldIndex
          : nextFields.length;
      nextFields.splice(insIdx, 0, field);
      return { ...sec, fields: nextFields };
    });

    let updatedRules = form.rules;
    if (restoredRules && restoredRules.length > 0) {
      const ruleMap = new Map<string, EditCheckRule>();
      form.rules.forEach((r) => ruleMap.set(r.id, r));
      restoredRules.forEach((r) => ruleMap.set(r.id, r));
      updatedRules = Array.from(ruleMap.values());
    }

    const updatedForm: CRFForm = {
      ...form,
      sections: updatedSections,
      rules: updatedRules,
    };

    return {
      ...study,
      lastModified: new Date().toISOString(),
      forms: study.forms.map((f) => (f.id === form.id ? updatedForm : f)),
    };
  }

  /**
   * Remove Containing Section with Cascade: Removes section, all contained fields, and cleans up referencing rules (#542)
   */
  static removeSectionWithCascade(
    study: StudyProtocol,
    domainOrFormId: string,
    sectionId: string,
    options?: {
      purgeReferencingRules?: boolean;
    },
    reviewAuthor: StudyReviewActor = this.defaultReviewActor,
    reviewAt = new Date().toISOString()
  ): {
    study: StudyProtocol;
    removedSection?: CRFSection;
    removedAtIndex?: number;
    removedFields: CRFField[];
    affectedReferences: FieldReferenceLocation[];
    undo?: (currentStudy: StudyProtocol) => StudyProtocol;
    error?: string;
  } {
    const form = this.getForm(study, domainOrFormId);
    if (!form) {
      return {
        study,
        removedFields: [],
        affectedReferences: [],
        error: `Form '${domainOrFormId}' not found in protocol.`,
      };
    }

    const secIdx = form.sections.findIndex((s) => s.id === sectionId);
    if (secIdx === -1) {
      return {
        study,
        removedFields: [],
        affectedReferences: [],
        error: `Section '${sectionId}' not found in form '${form.name}'.`,
      };
    }

    if (form.sections.length <= 1) {
      return {
        study,
        removedFields: [],
        affectedReferences: [],
        error: `Cannot remove the only remaining section in form '${form.name}'.`,
      };
    }

    const targetSection = form.sections[secIdx];
    const removedFields = [...targetSection.fields];
    const preview = this.previewSectionRemoval(study, form.id, sectionId);
    const affectedReferences = preview.allReferences;

    const originalRules: EditCheckRule[] = JSON.parse(
      JSON.stringify(form.rules || [])
    );
    const shouldPurgeRules = options?.purgeReferencingRules !== false;

    // Filter out section
    const updatedSections = form.sections.filter((s) => s.id !== sectionId);

    // If shouldPurgeRules, prune all rules referencing any field in the section
    let updatedRules = form.rules || [];
    if (shouldPurgeRules) {
      const removedIds = new Set(removedFields.map((f) => f.id.toLowerCase()));
      const removedVars = new Set(
        removedFields.map((f) => f.variableName.toUpperCase())
      );

      const isRemoved = (val?: string | null) => {
        if (!val) return false;
        return (
          removedIds.has(val.toLowerCase()) ||
          removedVars.has(val.toUpperCase())
        );
      };

      updatedRules = updatedRules
        .filter((r) => !isRemoved(r.targetFieldId))
        .map((r) => {
          const nextTriggers = (r.triggerFieldIds || []).filter(
            (id) => !isRemoved(id)
          );
          const nextConditions = (r.conditions || []).filter(
            (c) => !isRemoved(c.fieldId) && !isRemoved(c.compareFieldId)
          );
          const nextGroups = r.conditionGroups
            ?.map((g) => ({
              ...g,
              conditions: g.conditions.filter(
                (c) => !isRemoved(c.fieldId) && !isRemoved(c.compareFieldId)
              ),
            }))
            .filter((g) => g.conditions.length > 0);

          return {
            ...r,
            triggerFieldIds: nextTriggers,
            conditions: nextConditions,
            ...(nextGroups !== undefined
              ? { conditionGroups: nextGroups }
              : {}),
          };
        })
        .filter((r) => {
          const hasTriggers = r.triggerFieldIds && r.triggerFieldIds.length > 0;
          const hasConds =
            (r.conditions && r.conditions.length > 0) ||
            (r.conditionGroups && r.conditionGroups.length > 0);
          return hasTriggers || hasConds;
        });
    }

    const updatedForm: CRFForm = {
      ...form,
      sections: updatedSections,
      rules: updatedRules,
    };

    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      forms: study.forms.map((f) => (f.id === form.id ? updatedForm : f)),
    };

    const undo = (currentStudy: StudyProtocol): StudyProtocol => {
      return StudyProtocolEngine.restoreSection(
        currentStudy,
        form.id,
        targetSection,
        secIdx,
        originalRules
      );
    };

    return {
      study: removedFields.reduce(
        (nextStudy, field) =>
          this.recordReviewDeletion(
            nextStudy,
            form,
            field,
            reviewAuthor,
            reviewAt
          ),
        updatedStudy
      ),
      removedSection: targetSection,
      removedAtIndex: secIdx,
      removedFields,
      affectedReferences,
      undo,
    };
  }

  /**
   * Restore Section and Associated Fields / Rules (#542)
   */
  static restoreSection(
    study: StudyProtocol,
    formId: string,
    section: CRFSection,
    sectionIndex?: number,
    restoredRules?: EditCheckRule[]
  ): StudyProtocol {
    const form = this.getForm(study, formId);
    if (!form) return study;

    const exists = form.sections.some((s) => s.id === section.id);
    let nextSections = form.sections;
    if (!exists) {
      nextSections = [...form.sections];
      const insIdx =
        sectionIndex !== undefined &&
        sectionIndex >= 0 &&
        sectionIndex <= nextSections.length
          ? sectionIndex
          : nextSections.length;
      nextSections.splice(insIdx, 0, section);
    }

    let updatedRules = form.rules;
    if (restoredRules && restoredRules.length > 0) {
      const ruleMap = new Map<string, EditCheckRule>();
      form.rules.forEach((r) => ruleMap.set(r.id, r));
      restoredRules.forEach((r) => ruleMap.set(r.id, r));
      updatedRules = Array.from(ruleMap.values());
    }

    const updatedForm: CRFForm = {
      ...form,
      sections: nextSections,
      rules: updatedRules,
    };

    return {
      ...study,
      lastModified: new Date().toISOString(),
      forms: study.forms.map((f) => (f.id === form.id ? updatedForm : f)),
    };
  }

  /**
   * Remove Field from Form & Prune AST Rules (Backwards-compatible wrapper over removeFieldWithCascade)
   */
  static removeField(
    study: StudyProtocol,
    domainOrFormId: string,
    fieldIdOrVar: string,
    options?: { purgeReferencingRules?: boolean },
    reviewAuthor: StudyReviewActor = this.defaultReviewActor,
    reviewAt = new Date().toISOString()
  ): {
    study: StudyProtocol;
    removedField?: CRFField;
    form?: CRFForm;
    affectedReferences?: FieldReferenceLocation[];
    undo?: (currentStudy: StudyProtocol) => StudyProtocol;
    error?: string;
  } {
    const res = this.removeFieldWithCascade(
      study,
      domainOrFormId,
      fieldIdOrVar,
      options,
      reviewAuthor,
      reviewAt
    );
    if (res.error || !res.removedField) {
      return { study, error: res.error };
    }
    const updatedForm = this.getForm(res.study, domainOrFormId);
    return {
      study: res.study,
      removedField: res.removedField,
      form: updatedForm,
      affectedReferences: res.affectedReferences,
      undo: res.undo,
    };
  }

  /**
   * Add Longitudinal Study Visit to SoA Matrix
   */
  static addVisit(
    study: StudyProtocol,
    visitData: Partial<StudyVisit> & { name: string; targetDay: number }
  ): { study: StudyProtocol; visit: StudyVisit } {
    const oidSuffix = visitData.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12);

    const newVisit: StudyVisit = {
      id: visitData.id || generateEngineId("visit"),
      oid: visitData.oid || `SE.${oidSuffix || "VISIT"}`,
      name: visitData.name,
      visitType: visitData.visitType || "Scheduled",
      targetDay: visitData.targetDay,
      windowBefore: visitData.windowBefore || 0,
      windowAfter: visitData.windowAfter || 0,
      assignedFormIds: visitData.assignedFormIds || [],
      isRepeating: visitData.isRepeating,
    };

    const updatedVisits = [...study.visits, newVisit].sort(
      (a, b) => a.targetDay - b.targetDay
    );

    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      visits: updatedVisits,
    };

    return { study: updatedStudy, visit: newVisit };
  }

  /**
   * Remove Study Visit from SoA Matrix
   */
  static removeVisit(
    study: StudyProtocol,
    visitIdOrName: string
  ): { study: StudyProtocol; removedVisit?: StudyVisit } {
    const target = visitIdOrName.trim().toLowerCase();
    const visit = study.visits.find(
      (v) => v.id === visitIdOrName || v.name.toLowerCase() === target
    );

    if (!visit) {
      return { study };
    }

    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      visits: study.visits.filter((v) => v.id !== visit.id),
    };

    return { study: updatedStudy, removedVisit: visit };
  }

  /**
   * Assign Forms to a Study Visit (Additive)
   */
  static assignVisitForms(
    study: StudyProtocol,
    visitIdOrName: string,
    formIdsOrDomains: string[]
  ): { study: StudyProtocol; visit?: StudyVisit; error?: string } {
    const target = visitIdOrName.trim().toLowerCase();
    const visit = study.visits.find(
      (v) => v.id === visitIdOrName || v.name.toLowerCase() === target
    );

    if (!visit) {
      return {
        study,
        error: `Visit '${visitIdOrName}' not found in protocol.`,
      };
    }

    const resolvedFormIds: string[] = [];
    for (const token of formIdsOrDomains) {
      const f = this.getForm(study, token);
      if (f && !resolvedFormIds.includes(f.id)) {
        resolvedFormIds.push(f.id);
      }
    }

    const mergedFormIds = Array.from(
      new Set([...visit.assignedFormIds, ...resolvedFormIds])
    );
    const updatedVisit: StudyVisit = {
      ...visit,
      assignedFormIds: mergedFormIds,
    };

    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      visits: study.visits.map((v) => (v.id === visit.id ? updatedVisit : v)),
    };

    return { study: updatedStudy, visit: updatedVisit };
  }

  /**
   * Assign Forms to a Study Visit specifically for a designated Study Arm
   */
  static assignArmVisitForms(
    study: StudyProtocol,
    visitIdOrName: string,
    armId: string,
    formIdsOrDomains: string[]
  ): { study: StudyProtocol; visit?: StudyVisit; error?: string } {
    const target = visitIdOrName.trim().toLowerCase();
    const visit = study.visits.find(
      (v) => v.id === visitIdOrName || v.name.toLowerCase() === target
    );

    if (!visit) {
      return {
        study,
        error: `Visit '${visitIdOrName}' not found in protocol.`,
      };
    }

    const resolvedFormIds: string[] = [];
    for (const token of formIdsOrDomains) {
      const f = this.getForm(study, token);
      if (f && !resolvedFormIds.includes(f.id)) {
        resolvedFormIds.push(f.id);
      }
    }

    const armAssignments = { ...(visit.armFormAssignments || {}) };
    armAssignments[armId] = resolvedFormIds;

    const armIds = Array.from(new Set([...(visit.armIds || []), armId]));
    const updatedVisit: StudyVisit = {
      ...visit,
      armIds,
      armFormAssignments: armAssignments,
    };

    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      visits: study.visits.map((v) => (v.id === visit.id ? updatedVisit : v)),
    };

    return { study: updatedStudy, visit: updatedVisit };
  }

  /**
   * Add Study Arm to Protocol Graph
   */
  static addArm(
    study: StudyProtocol,
    arm: StudyArm
  ): { study: StudyProtocol; arm: StudyArm } {
    const existingArms = study.arms || [];
    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      arms: [...existingArms.filter((a) => a.id !== arm.id), arm],
    };
    return { study: updatedStudy, arm };
  }

  /**
   * Remove Study Arm from Protocol Graph
   */
  static removeArm(
    study: StudyProtocol,
    armId: string
  ): { study: StudyProtocol; removedArm?: StudyArm } {
    const existingArms = study.arms || [];
    const removedArm = existingArms.find((a) => a.id === armId);
    if (!removedArm) return { study };
    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      arms: existingArms.filter((a) => a.id !== armId),
    };
    return { study: updatedStudy, removedArm };
  }

  /**
   * Add Study Epoch to Protocol Graph
   */
  static addEpoch(
    study: StudyProtocol,
    epoch: StudyEpoch
  ): { study: StudyProtocol; epoch: StudyEpoch } {
    const existingEpochs = study.epochs || [];
    const updatedEpochs = [
      ...existingEpochs.filter((e) => e.id !== epoch.id),
      epoch,
    ].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      epochs: updatedEpochs,
    };
    return { study: updatedStudy, epoch };
  }

  /**
   * Remove Study Epoch from Protocol Graph
   */
  static removeEpoch(
    study: StudyProtocol,
    epochId: string
  ): { study: StudyProtocol; removedEpoch?: StudyEpoch } {
    const existingEpochs = study.epochs || [];
    const removedEpoch = existingEpochs.find((e) => e.id === epochId);
    if (!removedEpoch) return { study };
    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      epochs: existingEpochs.filter((e) => e.id !== epochId),
    };
    return { study: updatedStudy, removedEpoch };
  }

  /**
   * Add Study Cohort to Protocol Graph
   */
  static addCohort(
    study: StudyProtocol,
    cohort: StudyCohort
  ): { study: StudyProtocol; cohort: StudyCohort } {
    const existingCohorts = study.cohorts || [];
    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      cohorts: [...existingCohorts.filter((c) => c.id !== cohort.id), cohort],
    };
    return { study: updatedStudy, cohort };
  }

  /**
   * Remove Study Cohort from Protocol Graph
   */
  static removeCohort(
    study: StudyProtocol,
    cohortId: string
  ): { study: StudyProtocol; removedCohort?: StudyCohort } {
    const existingCohorts = study.cohorts || [];
    const removedCohort = existingCohorts.find((c) => c.id === cohortId);
    if (!removedCohort) return { study };
    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      cohorts: existingCohorts.filter((c) => c.id !== cohortId),
    };
    return { study: updatedStudy, removedCohort };
  }

  /**
   * Add Biomedical Concept to Protocol Graph
   */
  static addBiomedicalConcept(
    study: StudyProtocol,
    concept: BiomedicalConcept
  ): { study: StudyProtocol; concept: BiomedicalConcept } {
    const existingConcepts = study.biomedicalConcepts || [];
    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      biomedicalConcepts: [
        ...existingConcepts.filter((c) => c.id !== concept.id),
        concept,
      ],
    };
    return { study: updatedStudy, concept };
  }

  /**
   * Constructs an arm-aware visit matrix reflecting form assignments across study arms and epochs
   */
  static getArmAwareVisitMatrix(study: StudyProtocol) {
    const arms = study.arms || [];
    const epochs = study.epochs || [];
    const epochMap = new Map(epochs.map((e) => [e.id, e.name]));

    if (arms.length === 0) {
      return [
        {
          armId: undefined,
          armName: "Default Protocol Schedule",
          visits: study.visits.map((v) => ({
            visitId: v.id,
            visitName: v.name,
            targetDay: v.targetDay,
            epochId: v.epochId,
            epochName: v.epochId ? epochMap.get(v.epochId) : undefined,
            assignedFormIds: v.assignedFormIds,
          })),
        },
      ];
    }

    return arms.map((arm) => {
      const armVisits = study.visits.map((v) => {
        const armSpecificForms =
          v.armFormAssignments?.[arm.id] || v.assignedFormIds;
        return {
          visitId: v.id,
          visitName: v.name,
          targetDay: v.targetDay,
          epochId: v.epochId,
          epochName: v.epochId ? epochMap.get(v.epochId) : undefined,
          assignedFormIds: armSpecificForms,
        };
      });

      return {
        armId: arm.id,
        armName: arm.name,
        visits: armVisits,
      };
    });
  }

  /**
   * Add Dynamic AST Edit Check / Calculation Rule to Form
   */
  static addRule(
    study: StudyProtocol,
    domainOrFormId: string,
    ruleData: {
      name: string;
      targetFieldIdOrVar: string;
      actionType: EditCheckRule["actionType"];
      formulaExpression?: string;
      queryMessage?: string;
      querySeverity?: "info" | "warning" | "error";
      triggerFieldIdsOrVars?: string[];
    }
  ): {
    study: StudyProtocol;
    rule?: EditCheckRule;
    form?: CRFForm;
    error?: string;
  } {
    const form = this.getForm(study, domainOrFormId);
    if (!form) {
      return { study, error: `Form '${domainOrFormId}' not found.` };
    }

    const targetFieldFound = this.getField(
      study,
      form.id,
      ruleData.targetFieldIdOrVar
    );
    const targetFieldId = targetFieldFound
      ? targetFieldFound.field.id
      : ruleData.targetFieldIdOrVar;

    const triggerIds: string[] = [];
    if (ruleData.triggerFieldIdsOrVars) {
      for (const t of ruleData.triggerFieldIdsOrVars) {
        const found = this.getField(study, form.id, t);
        if (found) triggerIds.push(found.field.id);
      }
    }

    const newRule: EditCheckRule = {
      id: generateEngineId("rule"),
      name: ruleData.name,
      description:
        ruleData.queryMessage ||
        `Edit check rule for ${ruleData.targetFieldIdOrVar}`,
      actionType: ruleData.actionType,
      targetFieldId,
      triggerFieldIds: triggerIds.length > 0 ? triggerIds : [targetFieldId],
      logicalOperator: "AND",
      conditions: [],
      querySeverity: ruleData.querySeverity || "warning",
      queryMessage: ruleData.queryMessage,
      formulaExpression: ruleData.formulaExpression,
    };

    const updatedForm: CRFForm = {
      ...form,
      rules: [...form.rules, newRule],
    };

    const updatedStudy: StudyProtocol = {
      ...study,
      lastModified: new Date().toISOString(),
      forms: study.forms.map((f) => (f.id === form.id ? updatedForm : f)),
    };

    return { study: updatedStudy, rule: newRule, form: updatedForm };
  }

  /**
   * List Available Presets
   */
  static listPresets() {
    return getStudyPresetsSync().map((p) => ({
      id: p.id,
      name: p.name,
      therapeuticArea: p.therapeuticArea || p.study.therapeuticArea,
      phase: p.study.phase,
      formsCount: p.study.forms.length,
      visitsCount: p.study.visits.length,
      protocolNumber: p.study.protocolNumber,
    }));
  }

  /**
   * Load Preset by ID
   */
  static loadPreset(presetId: string): {
    study: StudyProtocol;
    presetInfo: { id: string; name: string };
  } {
    const preset = getPresetByIdSync(presetId);
    if (preset) {
      const info = getStudyPresetsSync().find((p) => p.id === presetId)!;
      return {
        study: cloneDeep(preset),
        presetInfo: { id: info.id, name: info.name },
      };
    }
    const defaultStudy = getOncologyPresetSync();
    return {
      study: cloneDeep(defaultStudy),
      presetInfo: {
        id: "oncology_recist",
        name: "Phase III Immuno-Oncology (RECIST 1.1)",
      },
    };
  }

  /**
   * List Supported CDASH Domains
   */
  static listDomains(): DomainMetadata[] {
    return CDASH_DOMAIN_CATALOG;
  }

  /**
   * 4-Tier Regulatory & Logic Conformance Validation
   */
  static validateProtocol(study: StudyProtocol): ProtocolValidationResult {
    const issues: ValidationIssue[] = [];

    // Tier 1: Variable Name Length & Core CDASH Rules
    for (const form of study.forms) {
      for (const sec of form.sections) {
        for (const fld of sec.fields) {
          if (fld.variableName.length > 8) {
            issues.push({
              form: form.domain,
              field: fld.variableName,
              rule: "CDASH-VAR-LEN",
              message: `Variable '${fld.variableName}' exceeds CDISC 8-character limit (${fld.variableName.length} chars)`,
              severity: "error",
            });
          }
        }
      }

      // Tier 2: AST Formula & Edit Check Syntax Linting
      const formErrors = lintForm(form);
      for (const err of formErrors) {
        issues.push({
          form: form.domain,
          rule: "AST-LINT",
          message: err.message,
          severity: "warning",
        });
      }
    }

    // Tier 3: Schedule of Activities (SoA) Matrix Consistency
    const formIdsInStudy = new Set(study.forms.map((f) => f.id));
    const assignedFormIds = new Set(
      study.visits.flatMap((v) => v.assignedFormIds)
    );

    for (const form of study.forms) {
      if (!form.isLogForm && !assignedFormIds.has(form.id)) {
        issues.push({
          form: form.domain,
          rule: "SOA-ORPHAN",
          message: `Form '${form.name}' (${form.domain}) is not assigned to any visit in the Visit Matrix`,
          severity: "warning",
        });
      }
    }

    for (const visit of study.visits) {
      for (const fId of visit.assignedFormIds) {
        if (!formIdsInStudy.has(fId)) {
          issues.push({
            form: "SOA",
            rule: "SOA-MISSING-FORM",
            message: `Visit '${visit.name}' references non-existent form ID '${fId}'`,
            severity: "error",
          });
        }
      }
    }

    const errors = issues.filter((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning");

    return {
      isCompliant: errors.length === 0,
      totalIssues: issues.length,
      errors,
      warnings,
      issues,
    };
  }

  /**
   * Semantic Diff between Two Protocols
   */
  static diffProtocols(studyA: StudyProtocol, studyB: StudyProtocol) {
    return diffUniversalCrfStudies(studyA, studyB);
  }

  /**
   * Multi-Format Regulatory Export Compilation
   */
  static exportProtocol(
    study: StudyProtocol,
    format: "json" | "yaml" | "odm" | "fhir" | "sas" | "r" | "usdm"
  ): {
    success: boolean;
    output: string;
    format: string;
    sizeBytes: number;
    error?: string;
  } {
    try {
      let output = "";
      switch (format) {
        case "json":
          output = exportUniversalCrfJson(study);
          break;
        case "yaml":
          output = exportUniversalCrfYaml(study);
          break;
        case "odm":
          output = exportStudyToCdiscOdmXml(study);
          break;
        case "fhir":
          output = JSON.stringify(
            exportStudyToFhirQuestionnaire(study),
            null,
            2
          );
          break;
        case "sas":
          output = exportStudyToSas(study);
          break;
        case "r":
          output = exportStudyToR(study);
          break;
        case "usdm":
          output = exportStudyToUsdm(study);
          break;
        default:
          return {
            success: false,
            output: "",
            format,
            sizeBytes: 0,
            error: `Unsupported format '${format}'`,
          };
      }
      return { success: true, output, format, sizeBytes: output.length };
    } catch (err) {
      return {
        success: false,
        output: "",
        format,
        sizeBytes: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Study Baselines & Restoration Engine (#672)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Persists an immutable, version-tagged baseline snapshot of the study.
   */
  static saveBaseline(
    study: StudyProtocol,
    options: SaveStudyBaselineOptions,
    storage?: Storage
  ): SaveStudyBaselineResult {
    return saveStudyBaseline(study, options, storage);
  }

  /**
   * Lists all persisted study baselines in reverse chronological order.
   */
  static listBaselines(storage?: Storage): StudyBaseline[] {
    return listStudyBaselines(storage);
  }

  /**
   * Retrieves a single persisted study baseline by its unique ID or exact version tag.
   */
  static getBaseline(
    baselineIdOrTag: string,
    storage?: Storage
  ): StudyBaseline | null {
    return getStudyBaseline(baselineIdOrTag, storage);
  }

  /**
   * Restores an immutable baseline snapshot into a fresh working draft with provenance.
   */
  static restoreBaselineAsDraft(
    baselineOrId: StudyBaseline | string,
    options?: RestoreStudyBaselineOptions,
    storage?: Storage
  ): RestoreStudyBaselineResult {
    return restoreBaselineAsDraft(baselineOrId, options, storage);
  }

  /**
   * Removes a specific baseline from storage by ID.
   */
  static deleteBaseline(baselineId: string, storage?: Storage): boolean {
    return deleteStudyBaseline(baselineId, storage);
  }
}

export {
  saveStudyBaseline,
  listStudyBaselines,
  getStudyBaseline,
  restoreBaselineAsDraft,
  deleteStudyBaseline,
  clearStudyBaselines,
  exportBaselinesBundle,
  importBaselinesBundle,
  incrementStudyVersion,
  computeStudyChecksum,
  STUDY_BASELINES_STORAGE_KEY,
  STUDY_BASELINES_CORRUPT_BACKUP_KEY,
  STUDY_BASELINES_MAX_COUNT,
  type SaveStudyBaselineOptions,
  type SaveStudyBaselineResult,
  type RestoreStudyBaselineOptions,
  type RestoreStudyBaselineResult,
  type BaselinesExportBundle,
  type StudyBaseline,
  type StudyBaselineActor,
  type StudyProvenance,
};
