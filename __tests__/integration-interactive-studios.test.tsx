// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  parseFormula,
  generateTruthTable,
  evaluateProofStatus,
  canConnect,
  exportProofToLean4,
  exportProofToMarkdown,
  exportProofToMermaid,
} from "@/lib/proof-utils";
import type { Edge } from "@/lib/proof-utils";
import {
  evaluateFormula,
  lintFormula,
  evaluateRule,
  calculateBMI,
  calculateMostellerBSA,
} from "@/lib/crf/ast-evaluator";
import type {
  CRFForm,
  CRFField,
  EditCheckRule,
  StudyProtocol,
} from "@/lib/crf/types";
import { exportStudyToCdiscOdmXml } from "@/lib/crf/odm-xml-serializer";
import { exportStudyToSas } from "@/lib/crf/export-sas";
import { SCENARIOS } from "@/lib/neuro/scenarios";
import {
  generateSyntheticVolume,
  getIndex,
} from "@/lib/neuro/volume-generator";
import { evaluateQAMetrics } from "@/lib/neuro/qa-engine";
import type { VoxelEdit } from "@/lib/neuro/types";

describe("Interactive Studios Domain Integration Suite", () => {
  describe("1. Proof Canvas & Formal Logic Studio Integration", () => {
    it("constructs and validates a full Modus Ponens deductive proof DAG", () => {
      const p1Ast = parseFormula("P");
      const p2Ast = parseFormula("P -> Q");
      const conclusionAst = parseFormula("Q");

      expect(p1Ast).not.toBeNull();
      expect(p2Ast).not.toBeNull();
      expect(conclusionAst).not.toBeNull();

      const edges: Edge[] = [];

      // Test connection validity from premise A ("P") to intermediate C ("Q")
      const connA = canConnect("A", "C", edges, "modus-ponens");
      expect(connA.allowed).toBe(true);

      const connB = canConnect("B", "C", edges, "modus-ponens");
      expect(connB.allowed).toBe(true);

      // Build full edge DAG
      const fullEdges: Edge[] = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
        { source: "D", target: "E" },
      ];

      // Evaluate proof DAG status
      const status = evaluateProofStatus(fullEdges, "modus-ponens");
      expect(status.isC_Proven).toBe(true);
      expect(status.isE_Proven).toBe(true);

      // Truth table generation
      const ttResult = generateTruthTable(
        [
          { label: "P1", ast: p1Ast! },
          { label: "P2", ast: p2Ast! },
        ],
        { label: "Goal", ast: conclusionAst! }
      );
      expect(ttResult.variables).toContain("P");
      expect(ttResult.variables).toContain("Q");
      expect(ttResult.truthTable.length).toBe(4);

      // Multi-format export integration using theorem ID and edges
      const lean4Output = exportProofToLean4("modus-ponens");
      expect(lean4Output).toContain("theorem");
      expect(lean4Output).toContain("modus_ponens");

      const markdownOutput = exportProofToMarkdown(fullEdges, "modus-ponens");
      expect(markdownOutput).toContain(
        "# Proof Workspace Export: Modus Ponens"
      );

      const mermaidOutput = exportProofToMermaid(fullEdges, "modus-ponens");
      expect(mermaidOutput).toContain("graph LR");
      expect(mermaidOutput).toContain("Node_A");
    });
  });

  describe("2. Clinical CRF Builder & AST Validation Studio Integration", () => {
    it("builds clinical form, evaluates AST calculated rules, and generates CDISC exports", () => {
      const weightField: CRFField = {
        id: "VS_WEIGHT",
        variableName: "WEIGHT",
        label: "Weight (kg)",
        dataType: "number",
        required: true,
        columnSpan: 6,
      };

      const heightField: CRFField = {
        id: "VS_HEIGHT",
        variableName: "HEIGHT",
        label: "Height (cm)",
        dataType: "number",
        required: true,
        columnSpan: 6,
      };

      const bmiField: CRFField = {
        id: "VS_BMI",
        variableName: "BMI",
        label: "Body Mass Index",
        dataType: "calculated",
        calculationFormula: "WEIGHT / ((HEIGHT / 100) ^ 2)",
        required: false,
        columnSpan: 6,
      };

      const sexField: CRFField = {
        id: "DM_SEX",
        variableName: "SEX",
        label: "Sex",
        dataType: "single_select",
        required: true,
        columnSpan: 6,
        customOptions: [
          { code: "F", label: "Female", order: 1 },
          { code: "M", label: "Male", order: 2 },
        ],
      };

      const pregField: CRFField = {
        id: "LB_PREG",
        variableName: "PREGTEST",
        label: "Pregnancy Test Result",
        dataType: "single_select",
        required: false,
        columnSpan: 6,
      };

      const form: CRFForm = {
        id: "form-screening",
        name: "Screening & Baseline Visit",
        domain: "DM",
        description: "Demographics and vital signs baseline",
        version: "1.0",
        sections: [
          {
            id: "sec-1",
            title: "Vital Signs & Demographics",
            fields: [weightField, heightField, bmiField, sexField, pregField],
          },
        ],
        rules: [],
      };

      // 1. AST formula evaluation & helper math
      const fieldValues = { WEIGHT: 70, HEIGHT: 175 };
      const allFields = form.sections[0].fields;
      const bmiResult = evaluateFormula(
        bmiField.calculationFormula!,
        fieldValues,
        allFields
      );
      expect(bmiResult).toBeCloseTo(22.86, 1);
      expect(calculateBMI(70, 175)).toBeCloseTo(22.86, 1);
      expect(calculateMostellerBSA(175, 70)).toBeGreaterThan(1.8);

      // 2. Formula linting
      const lint = lintFormula(bmiField.calculationFormula!, allFields);
      expect(lint.isValid).toBe(true);
      expect(lint.diagnostics.length).toBe(0);

      // 3. Edit Check Rule evaluation
      const pregnancyRule: EditCheckRule = {
        id: "rule-preg-req",
        name: "Require Pregnancy Test for Females",
        description: "Enforce pregnancy test field when subject is Female",
        triggerFieldIds: ["DM_SEX"],
        targetFieldId: "LB_PREG",
        actionType: "require_field",
        logicalOperator: "AND",
        conditions: [
          {
            fieldId: "DM_SEX",
            operator: "eq",
            value: "F",
          },
        ],
      };

      const ruleFemaleTriggered = evaluateRule(
        pregnancyRule,
        { DM_SEX: "F" },
        allFields
      );
      expect(ruleFemaleTriggered).toBe(true);

      const ruleMaleNotTriggered = evaluateRule(
        pregnancyRule,
        { DM_SEX: "M" },
        allFields
      );
      expect(ruleMaleNotTriggered).toBe(false);

      // 4. CDISC ODM-XML Generation
      const study: StudyProtocol = {
        id: "proto-001",
        protocolNumber: "PROTO-2026-001",
        studyName: "Phase II Multi-center Trial",
        phase: "Phase II",
        sponsor: "Acme Therapeutics",
        therapeuticArea: "Oncology",
        version: "1.0",
        lastModified: "2026-08-16T12:00:00Z",
        forms: [form],
        visits: [
          {
            id: "v1",
            oid: "SE.SCREENING",
            name: "Screening",
            visitType: "Scheduled",
            targetDay: 0,
            windowBefore: 3,
            windowAfter: 3,
            assignedFormIds: [form.id],
          },
        ],
        codelists: [],
      };

      const odmXml = exportStudyToCdiscOdmXml(study);
      expect(odmXml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(odmXml).toContain('ODMVersion="1.3.2"');
      expect(odmXml).toContain("IT.WEIGHT");

      // 5. SAS Code Generation
      const sasCode = exportStudyToSas(study);
      expect(sasCode).toContain("CDISC CDASH");
      expect(sasCode).toContain("DATA raw_dm");
    });
  });

  describe("3. NeuroRecon 3D Studio & QA Engine Integration", () => {
    it("initializes defect scenarios and computes morphometric QA metrics", () => {
      const scenario = SCENARIOS.dura_inclusion;
      expect(scenario).toBeDefined();
      expect(scenario.initialDefects).toBeGreaterThan(0);

      const volume = generateSyntheticVolume(scenario.id);
      expect(volume).toBeDefined();
      expect(volume.dimensions.width).toBeGreaterThan(0);
      expect(volume.dimensions.height).toBeGreaterThan(0);
      expect(volume.dimensions.depth).toBeGreaterThan(0);

      // Initial QA evaluation before edits
      const initialMetrics = evaluateQAMetrics(scenario, volume, [], []);
      expect(initialMetrics.eulerCharacteristic).toBe(2);
      expect(initialMetrics.defectCount).toBe(scenario.initialDefects);
      expect(initialMetrics.accuracyScore).toBe(0);

      // Simulate correcting voxel edits inside defect region
      const { min, max } = volume.defectRegion;
      const edits: VoxelEdit[] = [];
      for (let z = min.z; z <= max.z; z++) {
        for (let y = min.y; y <= max.y; y++) {
          for (let x = min.x; x <= max.x; x++) {
            const index = getIndex(x, y, z);
            if (
              volume.labels[index] === 5 &&
              volume.initialBrainmask[index] === 1
            ) {
              edits.push({
                layer: "brainmask",
                x,
                y,
                z,
                originalValue: 1,
                newValue: 0,
              });
            }
          }
        }
      }

      const resolvedMetrics = evaluateQAMetrics(scenario, volume, [], edits);
      expect(resolvedMetrics.defectCount).toBe(0);
      expect(resolvedMetrics.accuracyScore).toBe(100);
      expect(resolvedMetrics.isResolved).toBe(true);
    });
  });
});
