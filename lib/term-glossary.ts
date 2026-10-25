export interface TermDefinition {
  key: string;
  canonical: string;
  simplified: string;
  definition: string;
  aliases?: string[];
  /**
   * Whether `compileTerms` wraps the term where it appears in prose. Defaults
   * to `true`. Business glossary terms such as "Enrollment" or "Query" are
   * ordinary words elsewhere on the site, so they set it to `false` and are
   * shown only where a page lists them.
   */
  autoLink?: boolean;
  /**
   * The guideline or standard the definition follows, cited by reference
   * rather than quoted, or absent for an operational term no standard defines.
   */
  source?: string;
}

export const CANONICAL_GLOSSARY: TermDefinition[] = [
  {
    key: "gxp-term",
    canonical: "GxP",
    simplified: "industry-standard",
    definition:
      "Good Practice standards (such as GCP or GLP) governing clinical trial design, conduct, and data integrity.",
    aliases: ["Good Practice"],
  },
  {
    key: "ecrf-term",
    canonical: "eCRF",
    simplified: "digital case report form",
    definition:
      "electronic Case Report Form. A digital questionnaire used to collect clinical trial data from research sites.",
    aliases: ["eCRFs"],
  },
  {
    key: "sdv-term",
    canonical: "Source Document Verification (SDV)",
    simplified: "record verification",
    definition:
      "Source Document Verification. The process of cross-referencing case report forms against original medical records to ensure accuracy.",
    aliases: ["Source Document Verification", "SDV"],
  },
  {
    key: "cdisc-term",
    canonical: "CDISC",
    simplified: "clinical data standard",
    definition:
      "Clinical Data Interchange Standards Consortium. The international standard organization setting data formats for medical research and FDA submissions.",
    aliases: ["CDISC Controlled Terminology"],
  },
  {
    key: "sdtm-term",
    canonical: "SDTM",
    simplified: "standard clinical data model",
    definition:
      "Study Data Tabulation Model. The FDA-mandated standard structure for tabulating clinical trial data.",
  },
  {
    key: "odm-term",
    canonical: "CDISC Operational Data Model (ODM)",
    simplified: "standard data exchange format",
    definition:
      "Operational Data Model. An XML-based vendor-neutral standard for exchanging clinical trial metadata and data.",
    aliases: ["CDISC ODM", "ODM"],
  },
  {
    key: "21-cfr-part-11-term",
    canonical: "21 CFR Part 11",
    simplified: "electronic record compliance",
    definition:
      "FDA regulation governing electronic records, electronic signatures, and audit trails in clinical research.",
    aliases: ["Part 11"],
  },
  {
    key: "21-cfr-812-term",
    canonical: "21 CFR 812",
    simplified: "investigational device regulation",
    definition:
      "FDA regulation governing Investigational Device Exemptions (IDE) and device accountability in clinical trials.",
  },
  {
    key: "edc-term",
    canonical: "Electronic Data Capture (EDC)",
    simplified: "electronic data system",
    definition:
      "Electronic Data Capture. Software used to collect and manage clinical trial data digitally.",
    aliases: ["Electronic Data Capture", "EDC"],
  },
  {
    key: "freesurfer-term",
    canonical: "FreeSurfer",
    simplified: "brain imaging software",
    definition:
      "An open-source neuroimaging software suite for processing and analyzing brain MRI images.",
  },
  {
    key: "redcap-term",
    canonical: "REDCap",
    simplified: "secure research database",
    definition:
      "Research Electronic Data Capture. A secure web application for building and managing online surveys and research databases.",
  },
  {
    key: "hipaa-term",
    canonical: "HIPAA",
    simplified: "patient privacy rules",
    definition:
      "Health Insurance Portability and Accountability Act. Federal law protecting sensitive patient health information.",
  },
  {
    key: "irb-term",
    canonical: "IRB",
    simplified: "ethics review board",
    definition:
      "Institutional Review Board. An administrative body established to protect the rights and welfare of human research subjects.",
  },
  {
    key: "sae-term",
    canonical: "SAE",
    simplified: "serious adverse event",
    definition:
      "Serious Adverse Event. An untoward medical occurrence in a clinical study subject resulting in death, hospitalization, or disability.",
  },
  {
    key: "dmp-term",
    canonical: "DMP",
    simplified: "data management plan",
    definition:
      "Data Management Plan. A formal document outlining how research data will be handled during and after a study.",
  },
  {
    key: "mri-term",
    canonical: "3T MRI",
    simplified: "brain scan imaging",
    definition:
      "High-field magnetic resonance imaging operating at 3 Tesla magnetic field strength.",
  },
  {
    key: "epic-term",
    canonical: "Epic Super User",
    simplified: "hospital database specialist",
    definition:
      "A clinical specialist trained to troubleshoot, optimize, and train staff on Epic electronic health record (EHR) software.",
    aliases: ["Epic SlicerDicer", "Epic for Research"],
  },
  {
    key: "zod-term",
    canonical: "Zod",
    simplified: "schema validation tool",
    definition:
      "A TypeScript-first schema declaration and validation library with static type inference.",
  },
  {
    key: "ast-term",
    canonical: "Abstract Syntax Tree (AST)",
    simplified: "code structure tree",
    definition:
      "Abstract Syntax Tree. A hierarchical tree representation of the syntactic structure of source code or logical expressions.",
    aliases: ["AST"],
  },
  {
    key: "phi-term",
    canonical: "Patient Health Information (PHI)",
    simplified: "protected health records",
    definition:
      "Patient Health Information. Sensitive health data protected under federal privacy standards.",
    aliases: ["Patient Health Information", "PHI"],
  },
  {
    key: "tls-term",
    canonical: "TLS 1.3",
    simplified: "secure internet encryption",
    definition:
      "Transport Layer Security. An encrypted communication protocol protecting data transfers across internet networks.",
    aliases: ["TLS"],
  },
  {
    key: "pydantic-term",
    canonical: "Pydantic",
    simplified: "data validation library",
    definition:
      "A Python data validation and settings management library using type annotations.",
    aliases: ["Pydantic v2"],
  },
  {
    key: "json-schema-term",
    canonical: "JSON Schema",
    simplified: "data structure blueprint",
    definition:
      "A vocabulary and standard for annotating, structuring, and validating JSON data documents.",
    aliases: ["JSON Schema Draft-07"],
  },
  {
    key: "dag-term",
    canonical: "Directed Acyclic Graph (DAG)",
    simplified: "ordered task network",
    definition:
      "Directed Acyclic Graph. A directed structural graph with no closed loops, used to order computational workflows.",
    aliases: ["Directed Acyclic Graph", "DAG"],
  },
  {
    key: "openapi-term",
    canonical: "OpenAPI",
    simplified: "API specification standard",
    definition:
      "A standard specification language for defining, describing, and documenting RESTful web APIs.",
    aliases: ["OpenAPI v3"],
  },
  {
    key: "sax-term",
    canonical: "SAX parser",
    simplified: "stream XML reader",
    definition:
      "Simple API for XML. A sequential stream-based parsing method for reading large XML files without high memory usage.",
    aliases: ["SAX", "sax-js"],
  },
  {
    key: "zustand-term",
    canonical: "Zustand",
    simplified: "application state manager",
    definition:
      "A lightweight, fast state management library for managing shared application state in React.",
  },
  {
    key: "cdash-term",
    canonical: "CDASH",
    simplified: "clinical data collection standard",
    definition:
      "Clinical Data Acquisition Standards Harmonization. CDISC standard defining basic data collection fields in clinical study forms.",
    aliases: ["CDISC CDASH", "CDASH 2.2"],
  },
  {
    key: "acrf-term",
    canonical: "Annotated CRF (aCRF)",
    simplified: "annotated case report form",
    definition:
      "Annotated Case Report Form. A blank clinical form mapping individual data entry fields directly to CDISC SDTM submission variables.",
    aliases: ["Annotated CRF", "aCRF", "aCRFs"],
  },
  {
    key: "web-worker-term",
    canonical: "Web Worker",
    simplified: "background browser worker",
    definition:
      "A background browser thread executing scripts independently of the main UI thread to prevent interface freezing.",
    aliases: ["Web Workers"],
  },
  {
    key: "roc-auc-term",
    canonical: "ROC-AUC",
    simplified: "model classification score",
    definition:
      "Receiver Operating Characteristic Area Under Curve. A performance metric measuring classification discrimination across diagnostic thresholds.",
    aliases: ["ROC-AUC", "AUC-ROC", "Area Under the Curve"],
  },
  {
    key: "pr-auc-term",
    canonical: "PR-AUC",
    simplified: "precision-recall accuracy score",
    definition:
      "Precision-Recall Area Under Curve. A classification metric evaluating positive prediction accuracy on imbalanced clinical datasets.",
    aliases: ["PR-AUC", "Precision-Recall AUC"],
  },
  {
    key: "adversarial-validation-term",
    canonical: "Adversarial Validation",
    simplified: "data shift detector",
    definition:
      "A machine learning technique that trains a binary classifier to distinguish training from test data to detect feature distribution drift.",
    aliases: ["Adversarial Validation"],
  },
  {
    key: "shap-term",
    canonical: "SHAP",
    simplified: "model explanation metric",
    definition:
      "SHapley Additive exPlanations. A game-theoretic approach to explain individual predictions by computing feature contributions.",
    aliases: ["SHAP values", "Shapley Additive exPlanations"],
  },
  {
    key: "epa-term",
    canonical: "Expected Points Added (EPA)",
    simplified: "expected play value",
    definition:
      "Expected Points Added. A sports analytics metric quantifying the net value of an individual play relative to baseline historical expectation.",
    aliases: ["Expected Points Added", "EPA"],
  },
  {
    key: "monte-carlo-term",
    canonical: "Monte Carlo Simulation",
    simplified: "probability simulation",
    definition:
      "A computational algorithm that relies on repeated random sampling to compute numerical probability distributions and risk outcomes.",
    aliases: ["Monte Carlo", "Monte Carlo Simulation"],
  },
  {
    key: "rag-term",
    canonical: "Retrieval-Augmented Generation (RAG)",
    simplified: "search-enhanced AI",
    definition:
      "Retrieval-Augmented Generation. An architecture that retrieves external reference documents into an LLM context window to ground responses.",
    aliases: ["RAG", "Retrieval-Augmented Generation"],
  },
  {
    key: "prompt-drift-term",
    canonical: "Prompt Drift",
    simplified: "AI prompt degradation",
    definition:
      "Gradual degradation in LLM prompt effectiveness or output format adherence resulting from upstream model version updates.",
    aliases: ["Prompt Drift"],
  },
  {
    key: "semver-term",
    canonical: "Semantic Versioning (SemVer)",
    simplified: "software version rules",
    definition:
      "A formal software versioning convention using MAJOR.MINOR.PATCH to signal breaking changes, features, and fixes.",
    aliases: ["Semantic Versioning", "SemVer"],
  },
  // Business glossary of the Clinical Data Platform (#2638). Every governed
  // metric links one of these terms or an earlier one. They are everyday
  // words outside a trial, so none is wrapped automatically in prose.
  {
    key: "screening-term",
    canonical: "Screening",
    simplified: "eligibility check",
    definition:
      "The period after a person consents to take part in a study and before enrollment, in which the site checks them against the protocol's eligibility criteria.",
    aliases: ["Screened", "Subjects screened"],
    autoLink: false,
    source: "CDISC Glossary",
  },
  {
    key: "screen-failure-term",
    canonical: "Screen failure",
    simplified: "did not qualify",
    definition:
      "A subject who consented and entered screening but was not enrolled, usually because they did not meet the eligibility criteria.",
    aliases: ["Screen failures", "Screen-failed"],
    autoLink: false,
    source: "CDISC Glossary",
  },
  {
    key: "enrollment-term",
    canonical: "Enrollment",
    simplified: "joining a study",
    definition:
      "The point at which an eligible subject is entered into a study after screening. A subject counts as enrolled from that date, whether they later complete the study or leave it early.",
    aliases: ["Enrolment", "Enrolled", "Subjects enrolled"],
    autoLink: false,
    source: "CDISC Glossary",
  },
  {
    key: "enrollment-period-term",
    canonical: "Enrollment period",
    simplified: "time to recruit",
    definition:
      "The time from the first subject's enrollment in a study to the last subject's: first subject in (FSI) to last subject in (LSI).",
    aliases: ["Recruitment period", "FSI to LSI", "FPI to LPI"],
    autoLink: false,
  },
  {
    key: "randomisation-term",
    canonical: "Randomisation",
    simplified: "random treatment assignment",
    definition:
      "Assigning subjects to treatment groups by chance, so that the groups differ at the start only by chance. In a randomised study, randomised subjects are the enrolled subjects who were assigned a treatment.",
    aliases: ["Randomization", "Randomised", "Randomized"],
    autoLink: false,
    source: "ICH E9",
  },
  {
    key: "early-termination-term",
    canonical: "Early termination",
    simplified: "left the study early",
    definition:
      "A subject's departure from a study before completing it, for example by withdrawing consent or being lost to follow-up. Each one is reported with its reason in the account of subject disposition.",
    aliases: ["Discontinuation", "Discontinued", "Early withdrawal"],
    autoLink: false,
    source: "ICH E3",
  },
  {
    key: "site-activation-term",
    canonical: "Site activation",
    simplified: "site ready to enroll",
    definition:
      "The point at which a study site is cleared to start enrolling, once its approvals, contract, training and supplies are in place.",
    aliases: ["Activated site", "Site green light"],
    autoLink: false,
  },
  {
    key: "visit-window-term",
    canonical: "Visit window",
    simplified: "allowed visit dates",
    definition:
      "The range of days around a scheduled visit date in which the protocol allows the visit to take place. A visit performed outside it is out of window.",
    aliases: ["Out-of-window visit", "Protocol window"],
    autoLink: false,
  },
  {
    key: "missed-visit-term",
    canonical: "Missed visit",
    simplified: "visit not done",
    definition:
      "A scheduled visit that did not take place before its visit window closed.",
    aliases: ["Missed visits"],
    autoLink: false,
  },
  {
    key: "data-query-term",
    canonical: "Data query",
    simplified: "data question to a site",
    definition:
      "A question raised on a data value, by an edit check or a reviewer, asking the site to confirm or correct it. A query stays open until the site answers and is closed once the answer is reviewed and accepted.",
    aliases: ["Query", "Queries", "Data clarification"],
    autoLink: false,
    source: "CDISC Glossary",
  },
  {
    key: "monitoring-visit-term",
    canonical: "Monitoring visit",
    simplified: "sponsor site check",
    definition:
      "A visit by the sponsor's monitor to a study site to oversee how the trial is run and check its data against the source records. Each visit ends in a monitoring visit report.",
    aliases: ["Interim monitoring visit", "IMV", "Monitoring visit report"],
    autoLink: false,
    source: "ICH E6(R3)",
  },
  {
    key: "protocol-deviation-term",
    canonical: "Protocol deviation",
    simplified: "departure from the protocol",
    definition:
      "Any departure from the study design or procedures that the protocol sets out.",
    aliases: ["Deviation", "Deviations", "Non-important deviation"],
    autoLink: false,
    source: "ICH E3 Questions and Answers (R1)",
  },
  {
    key: "important-deviation-term",
    canonical: "Important protocol deviation",
    simplified: "serious departure from the protocol",
    definition:
      "A protocol deviation that might significantly affect the completeness, accuracy or reliability of key study data, or a subject's rights, safety or well-being.",
    aliases: ["Important deviation", "IPD"],
    autoLink: false,
    source: "ICH E3 Questions and Answers (R1)",
  },
  {
    key: "database-lock-term",
    canonical: "Database lock (DBL)",
    simplified: "data frozen for analysis",
    definition:
      "The point at which a study's database is closed to changes, so that the final analysis runs on fixed data. The time from the last subject's last visit (LSLV) to database lock is a standard data management cycle time.",
    aliases: ["Database lock", "DBL", "LSLV to DBL"],
    autoLink: false,
    source: "CDISC Glossary",
  },
  {
    key: "teae-term",
    canonical: "Treatment-emergent adverse event (TEAE)",
    simplified: "side effect during treatment",
    definition:
      "An adverse event that starts during treatment, or that was present before treatment and worsens during it.",
    aliases: ["Treatment-emergent adverse event", "TEAE"],
    autoLink: false,
    source: "ICH E9",
  },
  {
    key: "budget-burn-term",
    canonical: "Budget burn",
    simplified: "spend against budget",
    definition:
      "Actual spend to date as a share of the budget for the same period. Above 100% means spend is running ahead of budget.",
    aliases: ["Burn rate", "Budget burn vs plan"],
    autoLink: false,
  },
];

export function getGlossaryKeyMap(
  glossary: TermDefinition[] = CANONICAL_GLOSSARY
): Map<string, TermDefinition> {
  const map = new Map<string, TermDefinition>();
  for (const entry of glossary) {
    map.set(entry.key, entry);
  }
  return map;
}

/**
 * The phrases `compileTerms` wraps, longest first: every term's canonical
 * name and aliases, except terms with `autoLink` set to `false`.
 */
export function getSortedTermEntries(
  glossary: TermDefinition[] = CANONICAL_GLOSSARY
): Array<{ phrase: string; entry: TermDefinition }> {
  const list: Array<{ phrase: string; entry: TermDefinition }> = [];

  for (const entry of glossary) {
    if (entry.autoLink === false) continue;
    list.push({ phrase: entry.canonical, entry });
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        list.push({ phrase: alias, entry });
      }
    }
  }

  list.sort((a, b) => b.phrase.length - a.phrase.length);
  return list;
}
