/**
 * The stewardship model (#2638): the domains that own the platform's data,
 * the four stewardship roles, and who does what in the decisions that
 * change governed data. Owner and steward roles are the ones the product
 * registrations and the metric registry already name; this module groups
 * them into domains, so a role nobody placed in a domain is a finding
 * rather than a silent gap.
 */
import type {
  DataProduct,
  GovernanceDecision,
  GovernanceDomain,
  GovernanceDomainId,
  GovernanceFinding,
  GovernancePolicy,
  MetricDefinition,
  StewardshipRole,
} from "../../types";
import { checkRegulatoryWording, findClinicalClaims } from "../policy";
import { METRIC_REGISTRY } from "../semantic/registry";
import { GOVERNANCE_POLICIES } from "./policies";

/** Every stewardship domain, with the owner and steward roles it holds. */
export const GOVERNANCE_DOMAINS: readonly GovernanceDomain[] = Object.freeze([
  {
    id: "clinical-data",
    name: "Clinical data",
    summary:
      "Data collected from subjects and the standard datasets derived from it for analysis.",
    owners: ["Clinical Data Management Lead", "Biostatistics Lead"],
    stewards: ["Clinical Data Steward", "Clinical Data Standards Steward"],
  },
  {
    id: "clinical-operations",
    name: "Clinical operations",
    summary:
      "How studies are run: sites, enrollment, visits, monitoring, deviations, supplies, vendors, milestones and the trial master file.",
    owners: [
      "Clinical Operations Lead",
      "Clinical Monitoring Lead",
      "Clinical Quality Lead",
      "Clinical Supply Lead",
      "Clinical Outsourcing Lead",
      "Portfolio Management Lead",
      "Trial Master File Lead",
    ],
    stewards: [
      "Clinical Operations Data Steward",
      "Clinical Quality Data Steward",
      "IRT Data Steward",
      "Vendor Data Steward",
      "Portfolio Data Steward",
      "TMF Data Steward",
    ],
  },
  {
    id: "safety",
    name: "Safety",
    summary: "Adverse events and their review, including event adjudication.",
    owners: ["Medical Safety Lead"],
    stewards: ["Safety Data Steward"],
  },
  {
    id: "finance",
    name: "Finance",
    summary: "Study budgets and actual spend.",
    owners: ["Clinical Finance Lead"],
    stewards: ["Finance Data Steward"],
  },
  {
    id: "data-platform",
    name: "Data platform",
    summary:
      "Reference data every domain shares that no business area owns, such as the calendar.",
    owners: ["Data Platform Lead"],
    stewards: ["Platform Data Steward"],
  },
]);

/** The four stewardship roles. */
export const STEWARDSHIP_ROLES: readonly StewardshipRole[] = Object.freeze([
  {
    id: "owner",
    name: "Data owner",
    heldBy:
      "The owner role a product or metric names, for example Clinical Operations Lead.",
    duties: [
      "Is accountable for what the product or metric means and who may use it.",
      "Approves access, certification, breaking changes and retention changes.",
    ],
  },
  {
    id: "steward",
    name: "Data steward",
    heldBy:
      "The steward role a product or metric names, for example Clinical Data Steward.",
    duties: [
      "Keeps definitions, glossary links and contracts accurate.",
      "Watches data quality and works issues to a resolution.",
      "Prepares the impact of a change for the owner to decide on.",
    ],
  },
  {
    id: "custodian",
    name: "Data custodian",
    heldBy: "Data Platform Engineering, for every domain.",
    duties: [
      "Runs the pipelines, storage and backups the products live in.",
      "Grants and removes access once the owner approves it.",
      "Applies retention and archival as the contract states them.",
    ],
  },
  {
    id: "consumer",
    name: "Data consumer",
    heldBy:
      "Anyone who reads a product or metric: a report, a downstream product or an analyst.",
    duties: [
      "Uses data only for the purpose access was granted for.",
      "Reports suspected data quality issues to the steward.",
    ],
  },
]);

/** Who does what in each key decision. */
export const GOVERNANCE_DECISIONS: readonly GovernanceDecision[] =
  Object.freeze([
    {
      id: "new-metric",
      name: "Certify a new metric",
      when: "A metric is added to the registry, or a draft metric is certified for reports to rely on.",
      raci: { owner: "A", steward: "R", custodian: "I", consumer: "C" },
      policy: "metric-certification",
    },
    {
      id: "contract-break",
      name: "Release a breaking contract change",
      when: "A data contract change removes or narrows something consumers rely on, which needs a new major version.",
      raci: { owner: "A", steward: "R", custodian: "R", consumer: "I" },
      policy: "change-control",
    },
    {
      id: "access-request",
      name: "Grant access to a data product",
      when: "Someone asks to read a data product they cannot read yet.",
      raci: { owner: "A", steward: "C", custodian: "R", consumer: "I" },
      policy: "access",
    },
    {
      id: "retention-change",
      name: "Change a retention period",
      when: "A product's retention period or the basis for it changes.",
      raci: { owner: "A", steward: "R", custodian: "C", consumer: "I" },
      policy: "retention",
    },
  ]);

/**
 * The domain an owner or steward role belongs to.
 *
 * @param role - An owner or steward role, as a product or metric names it.
 * @param domains - Domains to look in; defaults to `GOVERNANCE_DOMAINS`.
 * @returns The domain's id.
 * @throws Error when no domain holds the role.
 */
export function stewardshipDomainOf(
  role: string,
  domains: readonly GovernanceDomain[] = GOVERNANCE_DOMAINS
): GovernanceDomainId {
  const found = domains.find(
    (d) => d.owners.includes(role) || d.stewards.includes(role)
  );
  if (found === undefined) {
    throw new Error(`no stewardship domain holds the role ${role}`);
  }
  return found.id;
}

/** What `checkStewardship` checks; every field defaults to the platform's own. */
export interface StewardshipModel {
  readonly products: readonly DataProduct[];
  readonly metrics?: readonly MetricDefinition[];
  readonly domains?: readonly GovernanceDomain[];
  readonly decisions?: readonly GovernanceDecision[];
  readonly policies?: readonly GovernancePolicy[];
}

/**
 * Checks the stewardship model and the policies. Each role belongs to one
 * domain; every product and metric names an owner of some domain and a
 * steward of the same domain; each decision has exactly one accountable
 * role, at least one responsible role and a policy that exists; and each
 * policy has rules, a unique id and no compliance or validation claim.
 *
 * @param model - The products to check, and optionally the rest of the model.
 * @returns Every broken rule; empty when the model is sound.
 */
export function checkStewardship(model: StewardshipModel): GovernanceFinding[] {
  const metrics = model.metrics ?? METRIC_REGISTRY;
  const domains = model.domains ?? GOVERNANCE_DOMAINS;
  const decisions = model.decisions ?? GOVERNANCE_DECISIONS;
  const policies = model.policies ?? GOVERNANCE_POLICIES;
  const findings: GovernanceFinding[] = [];
  const report = (
    rule: GovernanceFinding["rule"],
    subject: string,
    message: string
  ) => findings.push({ rule, subject, message });

  const holder = new Map<string, GovernanceDomainId>();
  for (const domain of domains) {
    for (const role of [...domain.owners, ...domain.stewards]) {
      const other = holder.get(role);
      if (other !== undefined && other !== domain.id) {
        report("domain", role, `${role} is in both ${other} and ${domain.id}`);
      }
      holder.set(role, domain.id);
    }
  }
  const owned = [
    ...model.products.map((p) => ({ kind: "product", ...p })),
    ...metrics.map((m) => ({ kind: "metric", ...m })),
  ];
  for (const item of owned) {
    const domain = domains.find((d) => d.owners.includes(item.owner));
    if (domain === undefined) {
      report(
        "domain",
        item.id,
        `${item.kind} ${item.id} is owned by ${item.owner}, which no domain lists as an owner`
      );
    } else if (!domain.stewards.includes(item.steward)) {
      report(
        "domain",
        item.id,
        `${item.kind} ${item.id} is stewarded by ${item.steward}, which is not a steward of ${domain.id}`
      );
    }
  }

  const policyIds = new Set<string>();
  for (const policy of policies) {
    if (policyIds.has(policy.id)) {
      report("policy", policy.id, `policy ${policy.id} is listed twice`);
    }
    policyIds.add(policy.id);
    if (policy.rules.length === 0) {
      report("policy", policy.id, `policy ${policy.id} has no rules`);
    }
    const text = [
      policy.title,
      policy.purpose,
      ...policy.rules.map((r) => r.text),
    ].join(" ");
    for (const finding of [
      ...checkRegulatoryWording(text),
      ...findClinicalClaims(text),
    ]) {
      report("policy", policy.id, finding.message);
    }
  }

  for (const decision of decisions) {
    const codes = Object.values(decision.raci);
    const accountable = codes.filter((c) => c === "A").length;
    if (accountable !== 1) {
      report(
        "raci",
        decision.id,
        `${decision.id} has ${accountable} accountable roles; it needs exactly one`
      );
    }
    if (!codes.includes("R")) {
      report("raci", decision.id, `${decision.id} has no responsible role`);
    }
    if (!policyIds.has(decision.policy)) {
      report(
        "raci",
        decision.id,
        `${decision.id} applies policy ${decision.policy}, which does not exist`
      );
    }
  }
  return findings;
}
