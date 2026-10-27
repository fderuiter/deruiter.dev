/**
 * The standards bill of materials (#2992 step 5): for every standard the
 * profile pins, where CDISC publishes it, the newest version published there,
 * and the checks in this repository that hold the site to the pinned one.
 *
 * The pinned versions come from {@link CLINICAL_STANDARDS_PROFILE}; this file
 * adds what the profile does not say. The newest published versions live in
 * `standards-latest.json`, which only `scripts/standards-watch.ts refresh`
 * writes. A weekly workflow runs it and opens a pull request when anything
 * CDISC or NCI EVS publishes moves, so the gap between pinned and published
 * is always on record. Moving a pin stays a controlled upgrade (ADR 0065).
 */
import latest from "./standards-latest.json";
import {
  CLINICAL_STANDARDS_PROFILE,
  standardCitation,
  type ProfileStandard,
} from "./profile";

/**
 * Where the newest published version of a standard is read from.
 *
 * `cdisc-site`: the standard's public page on cdisc.org, whose version table
 * lists each release as text such as `SDTMIG v3.4`. `labels` are the exact
 * text before ` v`; the highest version under any of them is the newest.
 *
 * `git-tags`: a CDISC repository on GitHub whose release tags are `vX.Y.Z`.
 */
export type StandardFeed =
  | {
      readonly kind: "cdisc-site";
      readonly page: string;
      readonly labels: readonly string[];
    }
  | { readonly kind: "git-tags"; readonly repository: string };

/**
 * What a check is. `cdisc-engine`: CDISC's own rules engine (CORE).
 * `official-schema`: a schema CDISC publishes, vendored and validated
 * against. `local-rules`: rules or tests written here, which CDISC has not
 * reviewed. `terminology`: codes checked against the NCI EVS release.
 */
export type StandardCheckKind =
  "cdisc-engine" | "official-schema" | "local-rules" | "terminology";

/** One check that holds the site to a pinned version. */
export interface StandardCheck {
  readonly kind: StandardCheckKind;
  /** What the check does, in a sentence. */
  readonly description: string;
  /** The repository file that runs or defines it. */
  readonly path: string;
}

/** A standard's entry, before the pinned and published versions are added. */
export interface StandardBomSpec {
  readonly standard: ProfileStandard;
  /** The standard's full name. */
  readonly name: string;
  /** The official page a reader can check. */
  readonly source: string;
  readonly feed: StandardFeed;
  readonly checks: readonly StandardCheck[];
  /**
   * Why the site stays on the pinned version although a newer one is
   * published. Absent: a newer published version is an upgrade to make.
   */
  readonly hold?: string;
}

/**
 * How the pinned version stands against the newest published one.
 * `current`: the same, compared at the precision of the pin (a `2.1` pin is
 * current against a `2.1.11` point release). `upgrade-available`: a newer
 * version is published and nothing holds the pin. `held`: a newer version is
 * published and the entry says why the site stays.
 */
export type StandardStatus = "current" | "upgrade-available" | "held";

/** A standard's entry with its pinned and newest published version. */
export interface StandardBomEntry extends StandardBomSpec {
  readonly pinned: string;
  readonly published: string;
  readonly status: StandardStatus;
}

/** One NCI EVS CDISC terminology package the CT subset is derived from. */
export interface TerminologyBomEntry {
  readonly package: "SDTM" | "ADaM" | "DDF";
  /** The release the site's CT subset is derived from. */
  readonly pinned: string;
  /** The newest release NCI EVS publishes. */
  readonly published: string;
  /** The current release's ODM-XML, whose header names its date. */
  readonly feed: string;
  readonly status: Exclude<StandardStatus, "held">;
}

/** A pinned tool, such as the CDISC rules engine. */
export interface ToolBomEntry {
  readonly id: "cdisc-core";
  readonly name: string;
  readonly source: string;
  readonly pinned: string;
  /** The commit the pinned tag must resolve to. */
  readonly commit: string;
  readonly published: string;
  readonly feed: StandardFeed;
  readonly status: Exclude<StandardStatus, "held">;
}

/** The whole bill of materials. */
export interface StandardsBom {
  readonly standards: readonly StandardBomEntry[];
  readonly terminology: readonly TerminologyBomEntry[];
  readonly tools: readonly ToolBomEntry[];
}

const SITE = "https://www.cdisc.org/standards";
const GITHUB = "https://github.com/cdisc-org";
const CORE_WORKFLOW = ".github/workflows/study-data-core.yml";
const LOCAL_RULES = "lib/study-data/internal/conformance/rules.ts";

const site = (page: string, ...labels: string[]): StandardFeed => ({
  kind: "cdisc-site",
  page: `${SITE}/${page}`,
  labels,
});

/** Every standard the profile pins, in the profile's order. */
export const STANDARDS_BOM_SPECS: readonly StandardBomSpec[] = [
  {
    standard: "USDM",
    name: "Unified Study Definitions Model",
    source: `${GITHUB}/DDF-RA`,
    feed: { kind: "git-tags", repository: `${GITHUB}/DDF-RA` },
    checks: [
      {
        kind: "cdisc-engine",
        description:
          "CDISC CORE runs its USDM rules over the DEMO-301 study and every CRF Studio preset's USDM export.",
        path: CORE_WORKFLOW,
      },
      {
        kind: "official-schema",
        description:
          "CRF Studio's USDM export validates against the pinned USDM API schema.",
        path: "__tests__/crf/usdm-v4-schema.test.ts",
      },
    ],
  },
  {
    standard: "CDASHIG",
    name: "CDASH Implementation Guide",
    source: `${SITE}/foundational/cdash`,
    feed: site("foundational/cdash", "CDASHIG"),
    checks: [
      {
        kind: "local-rules",
        description:
          "CRF Studio's CDASH domain templates are tested for variable names, core designations and data types.",
        path: "__tests__/crf/cdash-domain-templates.test.ts",
      },
    ],
  },
  {
    standard: "SDTM",
    name: "Study Data Tabulation Model",
    source: `${SITE}/foundational/sdtm`,
    feed: site("foundational/sdtm", "SDTM"),
    checks: [
      {
        kind: "cdisc-engine",
        description:
          "CDISC CORE's SDTMIG rules cover the model variables the datasets use.",
        path: CORE_WORKFLOW,
      },
    ],
    hold: `${standardCitation("SDTMIG")}, the newest SDTMIG, is built on ${standardCitation("SDTM")}. CDISC lists the newer SDTM with the Tobacco Implementation Guide.`,
  },
  {
    standard: "SDTMIG",
    name: "SDTM Implementation Guide",
    source: `${SITE}/foundational/sdtmig`,
    feed: site("foundational/sdtmig", "SDTMIG"),
    checks: [
      {
        kind: "cdisc-engine",
        description:
          "CDISC CORE runs its SDTMIG rules over the default study and all 16 issue scenarios.",
        path: CORE_WORKFLOW,
      },
      {
        kind: "local-rules",
        description:
          "The in-browser conformance gate runs the site's own SD rules, each naming its CORE twin where one exists.",
        path: LOCAL_RULES,
      },
    ],
  },
  {
    standard: "ADaM",
    name: "Analysis Data Model",
    source: `${SITE}/foundational/adam`,
    feed: site("foundational/adam", "ADaM"),
    checks: [
      {
        kind: "local-rules",
        description:
          "ADSL and the BDS datasets are tested for their required variables and derivations.",
        path: "__tests__/study-data-adam-core.test.ts",
      },
    ],
  },
  {
    standard: "ADaMIG",
    name: "ADaM Implementation Guide",
    source: `${SITE}/foundational/adam`,
    feed: site("foundational/adam", "ADaMIG"),
    checks: [
      {
        kind: "local-rules",
        description:
          "The in-browser conformance gate runs the site's own AD rules. CDISC CORE publishes no ADaMIG rules yet.",
        path: LOCAL_RULES,
      },
    ],
  },
  {
    standard: "SDTM-CR",
    name: "SDTM and SDTMIG Conformance Rules",
    source: `${SITE}/foundational/sdtmig`,
    feed: site("foundational/sdtmig", "SDTM and SDTMIG Conformance Rules"),
    checks: [
      {
        kind: "cdisc-engine",
        description:
          "CDISC CORE implements the published conformance rules; the crosswalk maps each local SD rule to the CORE rules that catch the same defect.",
        path: "scripts/study-data-core-crosswalk.json",
      },
    ],
  },
  {
    standard: "OCCDS",
    name: "ADaM Structure for Occurrence Data",
    source: `${SITE}/foundational/adam`,
    feed: site(
      "foundational/adam",
      "ADaM Structure for Occurrence Data (OCCDS)",
      "ADaM Structure for Occurrence Data Implementation Guide"
    ),
    checks: [
      {
        kind: "local-rules",
        description: "ADAE is tested for its occurrence-data structure.",
        path: "__tests__/study-data-adam-events.test.ts",
      },
    ],
  },
  {
    standard: "ADaM-CR",
    name: "ADaM Conformance Rules",
    source: `${SITE}/foundational/adam`,
    feed: site("foundational/adam", "ADaM Conformance Rules"),
    checks: [
      {
        kind: "local-rules",
        description:
          "The site's AD rules restate the ADaM conformance checks it applies. CDISC CORE publishes no ADaM rules yet.",
        path: LOCAL_RULES,
      },
    ],
  },
  {
    standard: "Define-XML",
    name: "Define-XML",
    source: `${SITE}/data-exchange/define-xml`,
    feed: site("data-exchange/define-xml", "Define-XML"),
    checks: [
      {
        kind: "official-schema",
        description:
          "Every Define-XML the pipeline writes validates against the pinned Define-XML schema.",
        path: "__tests__/study-data-define.test.ts",
      },
    ],
  },
  {
    standard: "Dataset-JSON",
    name: "Dataset-JSON",
    source: `${SITE}/data-exchange/dataset-json`,
    feed: site("data-exchange/dataset-json", "Dataset-JSON"),
    checks: [
      {
        kind: "official-schema",
        description:
          "Every exported dataset validates against the pinned Dataset-JSON schema.",
        path: "__tests__/study-data-export.test.ts",
      },
    ],
  },
  {
    standard: "ARS",
    name: "Analysis Results Standard",
    source: `${GITHUB}/analysis-results-standard`,
    feed: {
      kind: "git-tags",
      repository: `${GITHUB}/analysis-results-standard`,
    },
    checks: [
      {
        kind: "official-schema",
        description:
          "The reporting event validates against the pinned ARS model for every seed and scenario tested.",
        path: "__tests__/study-data-ars-schema.test.ts",
      },
    ],
  },
  {
    standard: "ODM",
    name: "Operational Data Model",
    source: `${SITE}/data-exchange/odm`,
    feed: site("data-exchange/odm", "ODM"),
    checks: [
      {
        kind: "official-schema",
        description:
          "CRF Studio's ODM export validates against the pinned ODM schema for every preset.",
        path: "__tests__/crf/odm-xml-schema.test.ts",
      },
    ],
    hold: `${standardCitation("Define-XML")} extends ${standardCitation("ODM")}, so CRF Studio exports the ODM version the site's Define-XML and most EDC imports use.`,
  },
];

/** The CDISC rules engine the CORE workflow pins. */
export const CDISC_CORE_PIN = Object.freeze({
  tag: "v0.17.1",
  commit: "2a90a3872a7e3b07c15abe84744026c94a7a04b0",
});

const EVS = "https://evs.nci.nih.gov/ftp1/CDISC";
const TERMINOLOGY_PACKAGES = ["SDTM", "ADaM", "DDF"] as const;

/**
 * Compares two dotted versions numerically, ignoring a leading `v`.
 *
 * @param a - A version such as `3.4` or `v0.17.1`.
 * @param b - Another version, or an ISO date such as `2026-09-25`.
 * @returns Negative, zero or positive, as for `Array.prototype.sort`.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v
      .replace(/^v/, "")
      .split(/[.-]/)
      .map((p) => Number.parseInt(p, 10) || 0);
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Whether a pin is behind the newest published version, compared at the
 * precision of the pin, so a `2.1` pin is current against `2.1.11`.
 *
 * @param pinned - The pinned version.
 * @param published - The newest published version.
 * @returns True when a newer version is published.
 */
export function isBehind(pinned: string, published: string): boolean {
  const depth = pinned.replace(/^v/, "").split(/[.-]/).length;
  const truncated = published
    .replace(/^v/, "")
    .split(/[.-]/)
    .slice(0, depth)
    .join(".");
  return compareVersions(pinned, truncated) < 0;
}

/** The newest published versions, as `standards-latest.json` holds them. */
export interface PublishedVersions {
  readonly standards: Readonly<Record<string, string>>;
  readonly terminology: Readonly<Record<string, string>>;
  readonly tools: Readonly<Record<string, string>>;
}

const PUBLISHED: PublishedVersions = latest;

/**
 * The bill of materials: every pinned standard, terminology package and tool
 * with the newest version published and how the pin stands against it.
 *
 * @param published - The newest published versions; defaults to the
 *   committed `standards-latest.json`.
 * @returns The entries, in the profile's order.
 */
export function standardsBillOfMaterials(
  published: PublishedVersions = PUBLISHED
): StandardsBom {
  const standards = STANDARDS_BOM_SPECS.map((spec): StandardBomEntry => {
    const pinned = CLINICAL_STANDARDS_PROFILE[spec.standard];
    const newest = published.standards[spec.standard] ?? pinned;
    const behind = isBehind(pinned, newest);
    return {
      ...spec,
      pinned,
      published: newest,
      status: !behind ? "current" : spec.hold ? "held" : "upgrade-available",
    };
  });
  const pinnedCt = CLINICAL_STANDARDS_PROFILE.CT.packageDate;
  const terminology = TERMINOLOGY_PACKAGES.map((pkg): TerminologyBomEntry => {
    const newest = published.terminology[pkg] ?? pinnedCt;
    return {
      package: pkg,
      pinned: pinnedCt,
      published: newest,
      feed: `${EVS}/${pkg}/${encodeURIComponent(`${pkg} Terminology.odm.xml`)}`,
      status: isBehind(pinnedCt, newest) ? "upgrade-available" : "current",
    };
  });
  const corePublished = published.tools["cdisc-core"] ?? CDISC_CORE_PIN.tag;
  const tools: ToolBomEntry[] = [
    {
      id: "cdisc-core",
      name: "CDISC Open Rules Engine (CORE)",
      source: `${GITHUB}/cdisc-rules-engine`,
      pinned: CDISC_CORE_PIN.tag,
      commit: CDISC_CORE_PIN.commit,
      published: corePublished,
      feed: { kind: "git-tags", repository: `${GITHUB}/cdisc-rules-engine` },
      status: isBehind(CDISC_CORE_PIN.tag, corePublished)
        ? "upgrade-available"
        : "current",
    },
  ];
  return { standards, terminology, tools };
}
