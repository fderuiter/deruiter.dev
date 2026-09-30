import { describe, it, expect } from "vitest";
import {
  createInitialScoreState,
  createInitialAuditorState,
  createInitialPowerUpInventory,
  fixObservation,
  validateObservationChoice,
  isSubjectFullyCompliant,
  calculateSubmissionPoints,
  tickSubjectTimers,
  tickAuditor,
  tickPowerUps,
  chargePowerUps,
  scrambleStations,
  verify21CFRSubmission,
  formatAuditTimestamp,
  generateSDTMDataset,
  exportToCDISCODMXML,
  exportToSDTMCSV,
  generateBIMOReport,
} from "../lib/clinical-trial-chaos/engine";

import {
  SEEDED_SCENARIOS,
  INITIAL_STATIONS,
  getStationsForPhase,
  generateClinicalSubject,
  generateClinicalSubjectFromProtocol,
  AMENDMENT_PRESETS,
} from "../lib/clinical-trial-chaos/scenarios";
import { StudyProtocol } from "../lib/crf/types";
import * as soundEffects from "../lib/clinical-trial-chaos/sound-effects";
import {
  ClinicalSubject,
  StationConfig,
  CDISCDomain,
} from "../lib/clinical-trial-chaos/types";

describe("Clinical Trial Chaos Engine - Unit Tests", () => {
  it("initializes score state with zeroed values and multiplier 1", () => {
    const score = createInitialScoreState();
    expect(score.score).toBe(0);
    expect(score.multiplier).toBe(1);
    expect(score.combo).toBe(0);
    expect(score.subjectsSubmitted).toBe(0);
  });

  it("initializes auditor state with 0% suspicion in patrolling mode", () => {
    const auditor = createInitialAuditorState();
    expect(auditor.suspicion).toBe(0);
    expect(auditor.behavior).toBe("patrolling");
    expect(auditor.total483Citations).toBe(0);
  });

  it("initializes power-up inventory with all 4 lifelines", () => {
    const inventory = createInitialPowerUpInventory();
    expect(inventory["fda-coffee-break"]).toBeDefined();
    expect(inventory["auto-clean"]).toBeDefined();
    expect(inventory["query-extension"]).toBeDefined();
    expect(inventory["fast-sign"]).toBeDefined();
    expect(inventory["fda-coffee-break"].hotkey).toBe("Q");
  });

  it("formats audit timestamps with brackets", () => {
    const date = new Date(2026, 7, 14, 14, 2, 1);
    const formatted = formatAuditTimestamp(date);
    expect(formatted).toBe("[14:02:01]");
  });

  it("validates multi-choice observation selections correctly", () => {
    const subject = SEEDED_SCENARIOS[0];
    const rawObs = subject.observations[0]; // Height: 180 m -> 180 cm

    // Test correct choice
    const correctRes = validateObservationChoice(rawObs, "180 cm");
    expect(correctRes.isValid).toBe(true);
    expect(correctRes.observation.isResolved).toBe(true);
    expect(correctRes.observation.currentValue).toBe("180 cm");
    expect(correctRes.scoreDelta).toBe(75);
    expect(correctRes.suspicionDelta).toBe(-3);

    // Test incorrect choice
    const incorrectRes = validateObservationChoice(rawObs, "1800 mm");
    expect(incorrectRes.isValid).toBe(false);
    expect(incorrectRes.observation.isResolved).toBe(false);
    expect(incorrectRes.scoreDelta).toBe(-25);
    expect(incorrectRes.suspicionDelta).toBe(8);
  });

  it("fixes an observation using fallback fixObservation", () => {
    const subject = SEEDED_SCENARIOS[0];
    const rawObs = subject.observations[0];
    const { observation: fixedObs, isValid } = fixObservation(rawObs);
    expect(isValid).toBe(true);
    expect(fixedObs.isResolved).toBe(true);
    expect(fixedObs.currentValue).toBe("180 cm");
  });

  it("checks full subject compliance only when all observations are resolved", () => {
    const subjectWithErrors = structuredClone(SEEDED_SCENARIOS[0]);
    expect(isSubjectFullyCompliant(subjectWithErrors)).toBe(false);

    subjectWithErrors.observations.forEach((obs) => {
      obs.isResolved = true;
      obs.currentValue = obs.correctedValue ?? obs.rawValue;
    });

    expect(isSubjectFullyCompliant(subjectWithErrors)).toBe(true);
  });

  it("calculates submission points factoring in observations, speed bonus, SAE and multiplier", () => {
    const subject = structuredClone(SEEDED_SCENARIOS[0]);
    subject.timeRemaining = 20;
    subject.maxTime = 40;

    const points = calculateSubmissionPoints(subject, 2, true);
    // Base 200 + 2*60 + (20/40)*120 (=60) + 0 + 150 = 530 * 2 = 1060
    expect(points).toBe(1060);
  });

  it("charges and ticks power-up meters", () => {
    let inventory = createInitialPowerUpInventory();
    expect(inventory["fda-coffee-break"].charge).toBe(0);

    inventory = chargePowerUps(inventory, 2);
    expect(inventory["fda-coffee-break"].charge).toBe(2);

    inventory["fda-coffee-break"].activeSecondsRemaining = 5;
    inventory = tickPowerUps(inventory, 2);
    expect(inventory["fda-coffee-break"].activeSecondsRemaining).toBe(3);
  });

  it("advances subject timers and detects expired subjects", () => {
    const subjects = [
      { ...SEEDED_SCENARIOS[0], timeRemaining: 1.5 },
      { ...SEEDED_SCENARIOS[1], timeRemaining: 10.0 },
    ];

    const { updatedSubjects, expiredSubjects } = tickSubjectTimers(
      subjects,
      2.0
    );
    expect(expiredSubjects).toHaveLength(1);
    expect(expiredSubjects[0].subjectLabel).toBe("SUBJ-1001");
    expect(updatedSubjects).toHaveLength(1);
    expect(updatedSubjects[0].subjectLabel).toBe("SUBJ-1002");
    expect(updatedSubjects[0].timeRemaining).toBeCloseTo(8.0);
  });

  it("moves Auditor patrol and increases suspicion when backlog is high", () => {
    let auditor = createInitialAuditorState();
    auditor.suspicion = 10;

    auditor = tickAuditor(auditor, 1.0, 6);
    expect(auditor.x).toBeGreaterThan(0.1);
    expect(auditor.suspicion).toBeCloseTo(11.1);
  });

  it("pauses auditor patrol when behavior is coffee_break", () => {
    const auditor = createInitialAuditorState();
    auditor.behavior = "coffee_break";
    auditor.isPaused = true;
    auditor.x = 0.5;

    const updated = tickAuditor(auditor, 2.0, 10);
    expect(updated.x).toBe(0.5);
    expect(updated.behavior).toBe("coffee_break");
  });

  it("returns tiered stations for Phase 1 vs Phase 2", () => {
    const phase1Stations = getStationsForPhase(1);
    expect(phase1Stations).toHaveLength(4);
    expect(phase1Stations.map((s) => s.id)).toEqual(["DM", "VS", "AE", "LB"]);

    const phase2Stations = getStationsForPhase(2);
    expect(phase2Stations.length).toBeGreaterThanOrEqual(6);
    expect(phase2Stations.some((s) => s.id === "CM")).toBe(true);
    expect(phase2Stations.some((s) => s.id === "EX")).toBe(true);
  });

  it("scrambles station positions circularly", () => {
    const originalStations: StationConfig[] = JSON.parse(
      JSON.stringify(INITIAL_STATIONS)
    );
    const scrambled = scrambleStations(originalStations);

    expect(scrambled[0].positionIndex).toBe(originalStations[1].positionIndex);
    expect(scrambled[3].positionIndex).toBe(originalStations[0].positionIndex);
  });

  it("verifies compliant 21 CFR Part 11 signature submission and cools suspicion", () => {
    const compliantSubject: ClinicalSubject = {
      ...SEEDED_SCENARIOS[0],
      observations: [
        {
          id: "obs-1",
          field: "Height",
          rawValue: "180 cm",
          currentValue: "180 cm",
          destination: "DM",
          isResolved: true,
        },
      ],
    };

    const result = verify21CFRSubmission(
      compliantSubject,
      "Intent to Submit",
      "DM"
    );
    expect(result.success).toBe(true);
    expect(result.level).toBe("COMPLIANT");
    expect(result.suspicionDelta).toBe(-5);
  });

  it("generates compliant SDTM dataset rows from clinical subjects", () => {
    const subjects = [
      {
        ...SEEDED_SCENARIOS[0],
        observations: [
          {
            id: "obs-1",
            field: "Height",
            rawValue: "180 cm",
            currentValue: "180 cm",
            destination: "DM" as const,
            ctCode: "HEIGHT",
            isResolved: true,
          },
          {
            id: "obs-2",
            field: "Systolic BP",
            rawValue: "120 mmHg",
            currentValue: "120 mmHg",
            destination: "VS" as const,
            ctCode: "SYSBP",
            isResolved: true,
          },
        ],
      },
    ];

    const rows = generateSDTMDataset(subjects);
    expect(rows).toHaveLength(2);
    expect(rows[0].DOMAIN).toBe("DM");
    expect(rows[0].TESTCD).toBe("HEIGHT");
    expect(rows[0].STRESC).toBe("180 cm");
    expect(rows[0].STRESN).toBe(180);
    expect(rows[0].STATUS).toBe("COMPLIANT");

    expect(rows[1].DOMAIN).toBe("VS");
    expect(rows[1].TESTCD).toBe("SYSBP");
    expect(rows[1].STRESN).toBe(120);
  });

  it("exports valid CDISC ODM 1.3 XML document", () => {
    const subjects = [SEEDED_SCENARIOS[0]];
    const rows = generateSDTMDataset(subjects);

    const xml = exportToCDISCODMXML(subjects, rows);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3"');
    expect(xml).toContain("STUDY.CT-CHAOS-2026");
    expect(xml).toContain(subjects[0].subjectLabel);
  });

  it("filters domain observations using exact subject identifier equality (excluding subject 10 and 11 when exporting subject 1)", () => {
    const subj1: ClinicalSubject = {
      id: "subj-1",
      subjectLabel: "1",
      studySite: "Site 014 (Boston General)",
      observations: [
        {
          id: "obs-1",
          field: "Height",
          rawValue: "180",
          currentValue: "180 cm",
          destination: "DM",
          isResolved: true,
        },
      ],
      status: "submitted",
      timeRemaining: 30,
      maxTime: 30,
      createdAt: Date.now(),
    };

    const subj10: ClinicalSubject = {
      id: "subj-10",
      subjectLabel: "10",
      studySite: "Site 014 (Boston General)",
      observations: [
        {
          id: "obs-10",
          field: "Height",
          rawValue: "175",
          currentValue: "175 cm (from subj 10)",
          destination: "DM",
          isResolved: true,
        },
      ],
      status: "submitted",
      timeRemaining: 30,
      maxTime: 30,
      createdAt: Date.now(),
    };

    const subj11: ClinicalSubject = {
      id: "subj-11",
      subjectLabel: "11",
      studySite: "Site 014 (Boston General)",
      observations: [
        {
          id: "obs-11",
          field: "Height",
          rawValue: "165",
          currentValue: "165 cm (from subj 11)",
          destination: "DM",
          isResolved: true,
        },
      ],
      status: "submitted",
      timeRemaining: 30,
      maxTime: 30,
      createdAt: Date.now(),
    };

    const allRows = generateSDTMDataset([subj1, subj10, subj11]);

    // Export ONLY subject 1
    const xml1 = exportToCDISCODMXML([subj1], allRows);

    expect(xml1).toContain('<SubjectData SubjectKey="1">');
    expect(xml1).toContain("180 cm");
    // Ensure data from subject 10 and 11 is NOT present in subject 1's export
    expect(xml1).not.toContain("175 cm (from subj 10)");
    expect(xml1).not.toContain("165 cm (from subj 11)");
  });

  it("escapes all reserved XML characters in exported attributes for clinical trial chaos XML", () => {
    const specialSubj: ClinicalSubject = {
      id: 'subj_&1<2>"3"',
      subjectLabel: 'SUBJ_&1<2>"3"',
      studySite: "Site 014 (Boston & Cambridge)",
      observations: [
        {
          id: "obs_1",
          field: "Glucose & HbA1c",
          rawValue: "100",
          currentValue: "100 mg/dL <normal>",
          destination: "LB" as CDISCDomain,
          ctCode: 'GLUC&HBA1C<1>"2"',
          isResolved: true,
        },
      ],
      status: "submitted",
      timeRemaining: 30,
      maxTime: 30,
      createdAt: Date.now(),
    };

    const rows = generateSDTMDataset([specialSubj]);
    const xml = exportToCDISCODMXML([specialSubj], rows);

    expect(xml).toContain('SubjectKey="SUBJ_&amp;1&lt;2&gt;&quot;3&quot;"');
    expect(xml).toContain('FormOID="FRM.LB"');
    expect(xml).toContain('ItemGroupOID="IG.LB"');
    expect(xml).toContain(
      'ItemOID="IT.LB.GLUC&amp;HBA1C&lt;1&gt;&quot;2&quot;"'
    );
    expect(xml).toContain('Value="100 mg/dL &lt;normal&gt;"');
  });

  it("exports valid SDTM CSV text", () => {
    const subjects = [SEEDED_SCENARIOS[0]];
    const rows = generateSDTMDataset(subjects);
    const csv = exportToSDTMCSV(rows);

    expect(csv).toContain(
      "STUDYID,DOMAIN,USUBJID,SEQ,TESTCD,TEST,ORRES,STRESC,STRESN,STRESU,VISIT,DY,SIGNDATE,STATUS"
    );
    expect(csv).toContain("CT-CHAOS-2026");
    expect(csv).toContain("DM");
  });

  it("generates BIMO inspection report with VAI and OAI verdicts based on violations", () => {
    // VAI verdict
    const vaiScore = {
      ...createInitialScoreState(),
      subjectsSubmitted: 10,
      cleanSubmissions: 7,
      auditViolations: 2,
    };
    const vaiAuditor = { ...createInitialAuditorState(), total483Citations: 1 };
    const vaiReport = generateBIMOReport(vaiScore, vaiAuditor, []);
    expect(vaiReport.verdict).toContain("VAI (Voluntary Action Indicated)");

    // OAI verdict
    const oaiScore = {
      ...createInitialScoreState(),
      subjectsSubmitted: 5,
      cleanSubmissions: 1,
      auditViolations: 8,
    };
    const oaiAuditor = { ...createInitialAuditorState(), total483Citations: 4 };
    const oaiReport = generateBIMOReport(oaiScore, oaiAuditor, []);
    expect(oaiReport.verdict).toContain("OAI (Official Action Indicated");

    const zeroSubmissionsReport = generateBIMOReport(
      createInitialScoreState(),
      createInitialAuditorState(),
      []
    );
    expect(zeroSubmissionsReport.cleanRate).toBe(100);
  });

  it("handles verify21CFRSubmission with non-compliant subjects or invalid domain", () => {
    const dirtySubject = structuredClone(SEEDED_SCENARIOS[0]);
    const dirtyRes = verify21CFRSubmission(
      dirtySubject,
      "Intent to Submit",
      "DM"
    );
    expect(dirtyRes.success).toBe(false);
    expect(dirtyRes.suspicionDelta).toBeGreaterThan(0);

    const wrongDomainRes = verify21CFRSubmission(
      dirtySubject,
      "Intent to Submit",
      "LB"
    );
    expect(wrongDomainRes.success).toBe(false);
  });

  it("generates clinical subjects across diverse domains, error probabilities, and SAE modes", () => {
    expect(AMENDMENT_PRESETS.length).toBe(4);

    // Standard subject
    const subj1 = generateClinicalSubject(0.0, false, 2001, ["DM", "VS"]);
    expect(subj1.subjectLabel).toBe("SUBJ-2001");
    expect(subj1.observations.every((o) => o.isResolved)).toBe(true);

    // Corrupted subject
    const subj2 = generateClinicalSubject(1.0, false, 2002, [
      "DM",
      "VS",
      "AE",
      "LB",
    ]);
    expect(subj2.subjectLabel).toBe("SUBJ-2002");
    expect(subj2.observations.some((o) => !o.isResolved)).toBe(true);

    // Force SAE subject
    const saeSubj = generateClinicalSubject(0.5, true, 2003, ["DM", "AE"]);
    expect(saeSubj.isSAE).toBe(true);
    expect(saeSubj.maxTime).toBe(22);
  });

  it("validates AMENDMENT_PRESETS protocol amendments", () => {
    expect(AMENDMENT_PRESETS).toHaveLength(4);
    expect(AMENDMENT_PRESETS.map((a) => a.id)).toEqual([
      "amd-001",
      "amd-002",
      "amd-003",
      "amd-004",
    ]);

    AMENDMENT_PRESETS.forEach((amd) => {
      expect(amd.id).toBeTruthy();
      expect(amd.version).toBeTruthy();
      expect(amd.title).toBeTruthy();
      expect(amd.description).toBeTruthy();
      expect(amd.durationSeconds).toBeGreaterThan(0);
      expect(amd.timeRemaining).toEqual(amd.durationSeconds);
      expect(amd.active).toBe(false);
    });
  });

  it("handles getStationsForPhase mode and phase branching", () => {
    // Endless mode returns 6 stations regardless of phase
    expect(getStationsForPhase(1, "endless")).toHaveLength(6);
    expect(getStationsForPhase(2, "endless")).toHaveLength(6);

    // Campaign mode phase 1 returns 4 stations
    expect(getStationsForPhase(1, "campaign")).toHaveLength(4);
    // Phase 2 returns 6 stations
    expect(getStationsForPhase(2, "campaign")).toHaveLength(6);
    // Phase 3 opens all eight, adding DS and MH as stations 7 and 8 (#1326)
    expect(
      getStationsForPhase(3, "campaign").map((station) => station.id)
    ).toEqual(["DM", "VS", "AE", "LB", "CM", "EX", "DS", "MH"]);
  });

  it("handles generateClinicalSubject domain filtering and forceSAE fallback", () => {
    // Domain filtering where eligible templates < 2 triggers fallback to full MOCK_OBSERVATION_TEMPLATES
    const singleDomainSubj = generateClinicalSubject(0.5, false, 3000, []);
    expect(singleDomainSubj.observations.length).toBeGreaterThanOrEqual(2);

    // Force SAE guarantees at least one AE observation
    const saeSubj = generateClinicalSubject(0.5, true, 3001, ["DM", "VS"]);
    expect(saeSubj.isSAE).toBe(true);
    expect(saeSubj.observations.some((o) => o.destination === "AE")).toBe(true);
  });

  it("generates clinical subject from protocol definition - empty protocol fallback", () => {
    const emptyProtocol: StudyProtocol = {
      id: "proto-empty",
      protocolNumber: "PROT-000",
      studyName: "Empty Study",
      sponsor: "Acme Pharma",
      version: "1.0",
      lastModified: "2026-09-24",
      visits: [],
      codelists: [],
      title: "Empty Protocol",
      phase: "Phase I",
      therapeuticArea: "Oncology",
      forms: [],
    };

    const subj = generateClinicalSubjectFromProtocol(
      emptyProtocol,
      0.5,
      false,
      4000
    );
    expect(subj.subjectLabel).toBe("SUBJ-4000");
    expect(subj.observations.length).toBeGreaterThan(0);
  });

  it("generates clinical subject from protocol definition - empty section fields fallback", () => {
    const emptyFieldsProtocol: StudyProtocol = {
      id: "proto-empty-fields",
      protocolNumber: "PROT-001",
      studyName: "Empty Fields Study",
      sponsor: "Acme Pharma",
      version: "1.0",
      lastModified: "2026-09-24",
      visits: [],
      codelists: [],
      title: "Empty Fields Protocol",
      phase: "Phase II",
      therapeuticArea: "Cardiology",
      forms: [
        {
          id: "f1",
          name: "Form 1",
          domain: "DM",
          description: "Demographics Form",
          version: "1.0",
          rules: [],
          sections: [
            {
              id: "s1",
              title: "Section 1",
              fields: [],
            },
          ],
        },
      ],
    };

    const subj = generateClinicalSubjectFromProtocol(
      emptyFieldsProtocol,
      0.5,
      false,
      4001
    );
    expect(subj.subjectLabel).toBe("SUBJ-4001");
    expect(subj.observations.length).toBeGreaterThan(0);
  });

  it("generates clinical subject from protocol definition - custom options, units, and default values", () => {
    const fullProtocol: StudyProtocol = {
      id: "proto-full",
      protocolNumber: "PROT-002",
      studyName: "Full Study",
      sponsor: "Acme Pharma",
      version: "1.0",
      lastModified: "2026-09-24",
      visits: [],
      codelists: [],
      title: "Full Protocol",
      phase: "Phase III",
      therapeuticArea: "Neurology",
      forms: [
        {
          id: "f-dm",
          name: "Demographics",
          domain: "DM",
          description: "DM Form",
          version: "1.0",
          sections: [
            {
              id: "s-dm",
              title: "Demographics Section",
              fields: [
                {
                  id: "fld-sex",
                  variableName: "SEX",
                  label: "Sex at Birth",
                  dataType: "single_select",
                  columnSpan: 6,
                  required: true,
                  customOptions: [
                    { label: "Male", code: "M", order: 1 },
                    { label: "Female", code: "F", order: 2 },
                  ],
                },
                {
                  id: "fld-height",
                  variableName: "HEIGHT",
                  label: "Height",
                  dataType: "number",
                  columnSpan: 6,
                  required: true,
                  unit: "cm",
                  defaultValue: 175,
                },
              ],
            },
          ],
          rules: [
            {
              id: "rule-sex",
              name: "Sex Rule",
              description: "Sex must be Male or Female",
              triggerFieldIds: ["fld-sex"],
              actionType: "raise_query",
              targetFieldId: "fld-sex",
              logicalOperator: "AND",
              conditions: [
                {
                  fieldId: "SEX",
                  operator: "eq",
                  value: "Male",
                },
              ],
            },
          ],
        },
        {
          id: "f-vs",
          name: "Vital Signs",
          domain: "vs", // lower case domain testing uppercase conversion
          description: "VS Form",
          version: "1.0",
          rules: [],
          sections: [
            {
              id: "s-vs",
              title: "Vital Signs Section",
              fields: [
                {
                  id: "fld-temp",
                  variableName: "TEMP",
                  label: "Body Temp",
                  dataType: "number",
                  columnSpan: 6,
                  required: true,
                  unit: "°C",
                },
              ],
            },
          ],
        },
      ],
      rules: [
        {
          id: "rule-temp",
          name: "Temp Protocol Rule",
          description: "Temp must be 37 °C",
          triggerFieldIds: ["fld-temp"],
          actionType: "raise_query",
          targetFieldId: "fld-temp",
          logicalOperator: "AND",
          conditions: [
            {
              fieldId: "TEMP",
              operator: "eq",
              value: "37.0 °C",
            },
          ],
        },
      ],
    };

    // Test errorProbability = 0 (clean compliant subject)
    const cleanSubj = generateClinicalSubjectFromProtocol(
      fullProtocol,
      0,
      false,
      5000
    );
    expect(cleanSubj.subjectLabel).toBe("SUBJ-5000");
    expect(cleanSubj.isSAE).toBe(false);
    expect(cleanSubj.maxTime).toBe(36);
    expect(cleanSubj.observations).toHaveLength(2);

    const sexObs = cleanSubj.observations.find((o) => o.ctCode === "SEX");
    expect(sexObs).toBeDefined();
    expect(sexObs?.destination).toBe("DM");
    expect(sexObs?.rawValue).toBe("Male");
    expect(sexObs?.isResolved).toBe(true);

    const tempObs = cleanSubj.observations.find((o) => o.ctCode === "TEMP");
    expect(tempObs).toBeDefined();
    expect(tempObs?.destination).toBe("VS");
    expect(tempObs?.rawValue).toBe("37.0 °C");
    expect(tempObs?.isResolved).toBe(true);

    // Test errorProbability = 1 (corrupted subject) with forceSAE = true
    const corruptedSubj = generateClinicalSubjectFromProtocol(
      fullProtocol,
      1,
      true,
      5001
    );
    expect(corruptedSubj.subjectLabel).toBe("SUBJ-5001");
    expect(corruptedSubj.isSAE).toBe(true);
    expect(corruptedSubj.maxTime).toBe(22);
    expect(corruptedSubj.observations.some((o) => !o.isResolved)).toBe(true);
  });

  it("generates clinical subject from protocol with fallback options and rules", () => {
    const protocolWithCodeOptions: StudyProtocol = {
      id: "proto-codes",
      protocolNumber: "PROT-003",
      studyName: "Code Options Study",
      sponsor: "Acme Pharma",
      version: "1.0",
      lastModified: "2026-09-24",
      visits: [],
      codelists: [],
      title: "Code Options Protocol",
      phase: "Phase I",
      therapeuticArea: "Oncology",
      forms: [
        {
          id: "f-code",
          name: "Code Form",
          domain: "",
          description: "Code Form",
          version: "1.0",
          sections: [
            {
              id: "s-code",
              title: "Code Section",
              fields: [
                {
                  id: "fld-code-only",
                  variableName: "ETHNIC",
                  label: "Ethnicity",
                  dataType: "single_select",
                  columnSpan: 6,
                  required: true,
                  customOptions: [
                    { code: "HISPANIC", label: "Hispanic", order: 1 },
                  ],
                },
              ],
            },
          ],
          rules: [
            {
              id: "r-ethnic",
              name: "Ethnic Rule",
              description: "Ethnic rule",
              logicalOperator: "AND",
              triggerFieldIds: ["fld-code-only"],
              actionType: "raise_query",
              targetFieldId: "fld-code-only",
              conditions: [
                {
                  fieldId: "ETHNIC",
                  operator: "eq",
                  value: "HISPANIC",
                },
              ],
            },
          ],
        },
      ],
    };

    const subj = generateClinicalSubjectFromProtocol(
      protocolWithCodeOptions,
      1,
      false,
      6000
    );
    expect(subj.observations).toHaveLength(1);
    expect(subj.observations[0].destination).toBe("DM"); // Empty domain falls back to DM
    expect(subj.observations[0].correctedValue).toBe("HISPANIC");
    expect(subj.observations[0].rawValue).toBe("Invalid Code");
  });

  it("exercises sound-effects module safely with synthetic audio calls", () => {
    // In JSDOM / headless, window.AudioContext may be absent or mocked
    expect(() => soundEffects.playValidationSound()).not.toThrow();
    expect(() => soundEffects.playChoiceIncorrectSound()).not.toThrow();
    expect(() => soundEffects.playSignatureVerifiedSound()).not.toThrow();
    expect(() => soundEffects.playAuditErrorBuzz()).not.toThrow();
    expect(() => soundEffects.playAmendmentSirenSound()).not.toThrow();
    expect(() => soundEffects.playForm483AlarmSound()).not.toThrow();
    expect(() => soundEffects.playPowerUpSound()).not.toThrow();
    expect(() => soundEffects.playPneumaticChuteSound()).not.toThrow();
    expect(() => soundEffects.startProceduralBGM(200)).not.toThrow();
    expect(() => soundEffects.updateBGMTempo(50)).not.toThrow();
    expect(() => soundEffects.stopProceduralBGM()).not.toThrow();
  });
});
