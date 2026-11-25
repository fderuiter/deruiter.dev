/**
 * Route shell copy and section index for `/clinical/ai-governance` (#3548).
 *
 * Keeps the guidance statuses, synthetic disclaimer and planned section
 * headings in one typed data module so downstream issues (#3549 to #3552) can
 * populate each section without rewriting the shell.
 */

/** External guidance document referenced on the AI governance page. */
export interface AiGovernanceReference {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly summary: string;
}

/** One planned section on `/clinical/ai-governance` and its tracking issue. */
export interface AiGovernanceSection {
  readonly id: string;
  readonly heading: string;
  readonly summary: string;
  readonly plannedIssue: number;
}

/** Static shell copy for `/clinical/ai-governance`. */
export interface AiGovernancePageCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly intro: string;
  readonly banner: string;
  readonly referencesHeading: string;
  readonly referencesIntro: string;
  readonly references: readonly AiGovernanceReference[];
  readonly sections: readonly AiGovernanceSection[];
}

export const AI_GOVERNANCE_PAGE_COPY: AiGovernancePageCopy = {
  eyebrow: "Clinical AI governance",
  title: "AI governance in clinical data work",
  intro:
    "How AI-assisted steps in clinical data workflows can fail, which external documents govern them, and what checks run against synthetic study data on this site.",
  banner:
    "Demonstration only, not regulatory, legal or compliance advice, and not a validated system. All study data and examples on this site are synthetic.",
  referencesHeading: "Guidance and industry references",
  referencesIntro:
    "Status of the primary external documents this page tracks, stated as drafts or industry guides rather than binding regulations.",
  references: [
    {
      id: "fda-ai-guidance",
      title: "FDA AI guidance",
      status: "Draft guidance (January 2025, docket FDA-2024-D-4689)",
      summary:
        "FDA draft guidance on using artificial intelligence to support regulatory decision-making for drug and biological products.",
    },
    {
      id: "eu-gmp-annex-22",
      title: "EU GMP Annex 22",
      status: "2025 consultation draft",
      summary:
        "European Union Good Manufacturing Practice consultation draft covering artificial intelligence in computerized systems.",
    },
    {
      id: "ispe-gamp-ai",
      title: "ISPE GAMP AI guide",
      status: "Industry guide (July 2025)",
      summary:
        "Industry good practice guide applying risk-based computerized system principles to AI-enabled tools.",
    },
  ],
  sections: [
    {
      id: "failure-modes",
      heading: "Section 1: Failure modes and mitigations",
      summary:
        "Catalogue of ways an automated suggestion or model output can fail in clinical data mapping and review, paired with concrete controls.",
      plannedIssue: 3549,
    },
    {
      id: "standards-and-guidance",
      heading: "Section 2: Standards and guidance",
      summary:
        "Risk tiers, human review boundaries and drift rules mapped to the tracked draft guidance and industry guides.",
      plannedIssue: 3550,
    },
    {
      id: "live-validation-evidence",
      heading: "Section 3: Live validation evidence",
      summary:
        "Recorded checks and reproducible outputs from the site's synthetic study-data pipeline.",
      plannedIssue: 3552,
    },
    {
      id: "interactive-walkthroughs",
      heading: "Section 4: Interactive walkthroughs",
      summary:
        "Deterministic vendor-evaluation rubric and step-by-step walkthroughs over synthetic inputs.",
      plannedIssue: 3551,
    },
  ],
};

/**
 * Builds the GitHub issue URL for a planned section on `/clinical/ai-governance`.
 *
 * @param issue - GitHub issue number tracking the section's content.
 * @returns Canonical GitHub issue URL.
 */
export function aiGovernanceIssueUrl(issue: number): string {
  return `https://github.com/fderuiter/deruiter.dev/issues/${issue}`;
}
