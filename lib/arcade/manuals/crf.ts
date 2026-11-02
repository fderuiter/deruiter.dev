import type { FieldManualData } from "./types";

export const CRF_MANUAL: FieldManualData = {
  id: "crf",
  title: "CRF Studio",
  subtitle: "Design, test and export clinical trial data collection forms",
  genre: "Clinical Data Tool",
  badge: "CDISC CDASH / SDTM",
  route: "/crf",
  accentColor: "from-cyan-500/20 via-cyan-500/5 to-transparent",
  badgeBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  objective:
    "A case report form (CRF) is the questionnaire a clinical trial site fills in for each patient visit. CRF Studio lets you build those forms, check them against CDISC standards, try them with test data, and export them in the formats sponsors and regulators use.",
  quickSummary:
    "Pick a sample study from the dropdown in the studio header, click a form in the left panel, and edit it on the canvas. Then open Live EDC to enter test data, or Exports to download the study. Your changes save in this browser.",
  controls: [
    {
      action: "Take the guided tour",
      description:
        "Open the studio's ⋮ menu and choose Spotlight UI Tour for a five-step walkthrough of the panels.",
      key: "⋮ menu",
    },
    {
      action: "Switch sample study",
      description:
        "Use the study dropdown at the top left of the studio. Blank Starter Canvas gives you a small form to start from.",
      key: "Study dropdown",
    },
    {
      action: "Add a field",
      description:
        "Open the Palette tab in the left panel and click a field type. It is added to the open form and selected so you can configure it on the right.",
      key: "Palette",
    },
    {
      action: "Add a standard form",
      description:
        "Click '+ Add form' in the studio header to open the form catalog. It lists the CDASH domains, forms from the example studies, your saved templates and smart blocks, with one search box.",
      key: "+ Add form",
    },
    {
      action: "Switch modes",
      description:
        "Use the mode bar (Design: Canvas, Form Grid, AST Rules; Schedule: Matrix; Verify and ship: Live EDC, aCRF Viewer, Exports), or press 1 to 7.",
      key: "1 to 7",
    },
    {
      action: "Find in the study",
      description:
        "Click Find in the studio header, or press F outside a text box, to search forms, fields and visits by name or variable and jump to them, insert a starter block, or open an export.",
      key: "F",
    },
    {
      action: "Undo and redo",
      description: "Undo or redo the last change to the study.",
      key: "Ctrl/⌘ + Z",
    },
    {
      action: "Test the open form",
      description:
        "Open the Test dock to fill the form in and watch its edit checks and show/hide rules react.",
      key: "Ctrl/⌘ + \\",
    },
  ],
  rules: [
    {
      title: "CDASH and SDTM",
      detail:
        "CDASH is the CDISC standard for how questions are collected. SDTM is the standard for how the data is submitted. Each field carries its SDTM target, which the aCRF Viewer and the annotated exports show.",
      badge: "Glossary",
    },
    {
      title: "Schedule of Assessments (SoA)",
      detail:
        "The Matrix view is the study calendar: rows are forms, columns are visits, and a check means the form is collected at that visit.",
      badge: "Glossary",
    },
    {
      title: "Edit checks",
      detail:
        "Rules that catch bad or missing data at entry time. A Hard Stop blocks saving; an Auto-Query lets the site save but raises a question for them to resolve.",
      badge: "Glossary",
    },
    {
      title: "Live EDC",
      detail:
        "An electronic data capture (EDC) simulation. Switch roles (site coordinator, investigator, monitor, data manager) to see how entry, verification and locking work under 21 CFR Part 11.",
      badge: "Glossary",
    },
  ],
  proTips: [
    "Start with a sample study to see a finished design, then try Blank Starter Canvas to build your own.",
    "Hover a mode in the mode bar for a one-line description of what it does.",
    "The conformance check in the header reads 'Verified' when the study has no CDISC issues; click it to see and fix any it finds.",
    "Nothing leaves your browser: the study is stored locally, and exports are generated on your machine.",
  ],
  lore: {
    title: "Why CRF design matters",
    story:
      "Every number in a clinical trial result starts as an answer on a CRF. A confusing question, a missing range check or an unmapped variable turns into queries for site staff, cleaning work for data managers, and delay before a drug or device can be reviewed. Designing forms against CDISC standards from the start is what makes the downstream SDTM datasets straightforward.",
    realWorldTech: [
      "CDISC CDASH",
      "CDISC SDTM",
      "CDISC ODM-XML",
      "HL7 FHIR Questionnaire",
      "21 CFR Part 11",
    ],
  },
};
