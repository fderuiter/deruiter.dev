import type { FieldManualData } from "./types";
import { standardCitation } from "@/lib/clinical-standards";

export const CLINICAL_CHAOS_MANUAL: FieldManualData = {
  id: "clinical-chaos",
  title: "Clinical Trial Chaos: CDISC Compliance",
  subtitle: "21 CFR Part 11 Compliance & Time Management Arcade",
  genre: "Compliance Arcade",
  badge: "21 CFR Part 11",
  route: "/arcade/clinical-chaos",
  storageKey: "clinical_chaos_highscore",
  accentColor: "from-emerald-500/20 via-emerald-500/5 to-transparent",
  badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  objective:
    "Standardize clinical observations across 8 CDISC SDTM domains (DM, VS, AE, LB, CM, EX, DS, MH), solve multi-choice Controlled Terminology puzzles, deploy combo-charged regulatory lifelines, sign 21 CFR Part 11 electronic records, and achieve a clean FDA BIMO inspection rating.",
  quickSummary:
    "Solve Controlled Terminology discrepancies via multi-choice puzzles, route validated dossier packets to tiered EDC stations with hotkeys [1-8] (four stations in phase 1, six in phase 2 and endless, all eight in phase 3), deploy power-ups [Q, W, E, R], and export authentic CDISC ODM XML / SDTM CSV datasets.",
  controls: [
    {
      action: "Validate Clinical Observation",
      description:
        "Click any unverified observation card to open the Multi-Choice Validation Drawer and select the compliant CDISC standard, MedDRA Preferred Term, or ISO-8601 date.",
      key: "Click Observation / Multi-Choice",
    },
    {
      action: "Route to EDC Domain Desk",
      description:
        "Submit validated dossiers to active EDC stations: [1] Demographics (DM), [2] Vital Signs (VS), [3] Adverse Events (AE), [4] Laboratory (LB), [5] Concomitant Meds (CM), [6] Drug Exposure (EX).",
      key: "Keys [1-8] or Click Station",
    },
    {
      action: "Deploy Regulatory Lifelines",
      description:
        "Deploy combo-charged power-ups: [Q] FDA Coffee Break (freeze auditor), [W] CDISC Auto-Clean (clean active dossier), [E] Site Query Extension (+12s), [R] Fast-Track 21 CFR Pass (instant sign). Auto-Clean and Fast-Track only fire on a dossier with flagged fields, so a clean one keeps their charge.",
      key: "Keys [Q, W, E, R]",
    },
    {
      action: "Pause the Shift",
      description:
        "Press P or the Pause button to stop every clock: subject timers, the auditor, the sponsor and lifeline durations. Press P or Resume to carry on. Opening this manual also holds the shift until you close it.",
      key: "P / Pause Button",
    },
    {
      action: "21 CFR Electronic Signature Lock",
      description:
        "Verify legal signature intent and authenticate with password to permanently lock records and cooldown auditor suspicion.",
      key: "Enter / Confirm Signature",
    },
    {
      action: "Cycle Active Queue & Switch View",
      description:
        "Press the left and right arrows to cycle between conveyor parcels. Toggle between Conveyor Floor, Live SDTM Studio, and Audit Trail Log tabs to export XML/CSV datasets. Tab moves focus between the game's buttons.",
      key: "← → / Tab Switcher",
    },
  ],
  rules: [
    {
      title: "Tiered CDISC SDTM Domains",
      detail:
        "Phase I activates core safety & lab domains (DM, VS, AE, LB). Phase II unlocks Concomitant Medications (CM) and Drug Exposure (EX). Phase III unlocks Disposition (DS) and Medical History (MH).",
      badge: "8 SDTM Domains",
    },
    {
      title: "Campaign Phase Targets",
      detail:
        "Each phase's counter starts at zero and counts that phase's new locks. Lock 5 CRFs to clear Phase 1, 3 more to clear Phase 2 and 4 more to clear Phase 3, 12 in all. Your score carries across all three phases.",
      badge: "5 + 3 + 4 Locks",
    },
    {
      title: "Controlled Terminology & MedDRA Coding",
      detail:
        "Selecting incorrect CT codes or unstandardized units incurs auditor suspicion penalties. Correct answers award bonus points and recharge power-up lifelines.",
      badge: "CDISC CT & MedDRA",
    },
    {
      title: "Fresh Data Every Shift",
      detail:
        "Most flagged vital signs, labs and dates are generated for each subject: a true value with one data-entry error applied (a wrong or unconverted unit, a slipped decimal point, a stray zero, a US-order or impossible date). Read the raw entry and work out the error; memorising last run's answers will not help. AE coding and medication puzzles stay hand-written.",
      badge: "Procedural Queries",
    },
    {
      title: "21 CFR § 11.50 Manifestation of Signatures",
      detail:
        "Electronic records require unambiguous intent ('Intent to Submit', 'Urgent Safety Expedited', etc.). Submitting unverified raw data triggers immediate audit rejection.",
      badge: "21 CFR Part 11",
    },
    {
      title: "FDA Bioresearch Monitoring (BIMO) Scoring",
      detail:
        "At the end of each shift or upon trial termination, receive a formal BIMO inspection report with NAI (No Action Indicated), VAI (Voluntary Action), or OAI (Form 483 Issued) determination.",
      badge: "BIMO Inspection",
    },
    {
      title: "The FDA Inspection Finale",
      detail:
        "When Phase 3 locks, the inspector pulls 4 to 6 CRFs you locked this campaign and asks one question about each: which value you corrected and why, where its signature is, or which station it went to. Each sponsor skeleton you took adds a harder question about that email. For a Phase 3 shortcut, admit it and cite the right regulation to halve its penalty and lower the finding a level; deny it or blame the sponsor and the finding rises a level. A Phase 1 or 2 shortcut was already charged in that phase's report, so the interview only adds to it: nothing if you disclose it, a Minor finding for the wrong regulation or no answer, a Major one if you deny it. Each record question gets 15 seconds and each skeleton 25; More time adds 15 seconds, and Untimed interview turns the timer off. Your answers set the final verdict. Endless mode has no inspection.",
      badge: "Campaign Finale",
    },
  ],
  proTips: [
    "Keep an eye on Serious Adverse Events (⚡ SAE): they have shorter timers and grant +300 bonus points upon compliant signature. Sign an SAE Urgent Safety Expedited, and never use that reason for a routine CRF.",
    "Charge your 'FDA Coffee Break' lifeline by maintaining clean submission streaks; deploy it when auditor suspicion climbs above 70%.",
    `Switch to the Live SDTM Studio tab during shifts to inspect generated observation rows and export authentic CDISC ${standardCitation("ODM")} XML.`,
    "Notice how each CRF is signed and where it goes: the Phase 3 inspector asks about the records you locked, and three wrong answers add a Major finding for an incomplete audit trail.",
    "Toggle the procedural 8-bit synth BGM to hear dynamic tempo scaling as auditor scrutiny intensifies.",
  ],
  lore: {
    title: "Biotech Data Governance & Regulatory Lifecycles",
    story:
      "Bringing a novel therapeutic drug or medical device from Phase I trials through FDA/EMA approval requires processing millions of patient data points under strict federal regulations. CDISC standards (SDTM, ADaM, and ODM) ensure universal semantic interoperability, while FDA 21 CFR Part 11 guarantees that electronic records have the identical legal standing and auditability as traditional paper records.",
    realWorldTech: [
      "CDISC SDTM / ADaM / ODM",
      "FDA 21 CFR Part 11",
      "Electronic Data Capture (EDC)",
      "MedDRA / WHO-Drug",
      "GxP Validation",
    ],
  },
};
