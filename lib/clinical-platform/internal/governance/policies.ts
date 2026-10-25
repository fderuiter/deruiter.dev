/**
 * The governance policies (#2638), written as data so the governance page
 * and the tests read the same rules. A rule names the platform export that
 * applies it where code does, and `null` where a person applies it in
 * review; a test confirms each named export exists.
 */
import type { GovernancePolicy } from "../../types";

/** Every governance policy. */
export const GOVERNANCE_POLICIES: readonly GovernancePolicy[] = Object.freeze([
  {
    id: "classification",
    title: "Data classification",
    purpose: "Every value carries a class that sets who may read it.",
    rules: [
      {
        text: "Every column carries one of four classes, from least to most protected: public, internal, confidential and restricted.",
        appliedBy: "WAREHOUSE_SCHEMA",
      },
      {
        text: "A data product takes the highest class of any column it holds.",
        appliedBy: "dataProducts",
      },
      {
        text: "A product whose rows describe study subjects is personal health data, however its columns are classified.",
        appliedBy: "dataProducts",
      },
      {
        text: "Restricted values, such as a randomised arm that blinded staff must not see, are readable only by the roles named for them.",
        appliedBy: null,
      },
      {
        text: "The platform holds synthetic data only. No real subject record is loaded into it.",
        appliedBy: null,
      },
    ],
  },
  {
    id: "retention",
    title: "Retention and archival",
    purpose: "How long each data product is kept, and what sets the period.",
    rules: [
      {
        text: "Every contract states a retention period in whole years and the basis for it.",
        appliedBy: "checkDataProducts",
      },
      {
        text: "Trial records, the subject, monitoring, deviation, randomisation and adjudication records that belong to the trial master file, are kept for at least 25 years after the trial ends, the period Regulation (EU) No 536/2014 sets for archiving the trial master file.",
        appliedBy: null,
      },
      {
        text: "Operational and derived data are kept for 10 years. That period is a sponsor policy choice, not a regulatory minimum.",
        appliedBy: null,
      },
      {
        text: "No policy decision shortens a period that a regulation sets.",
        appliedBy: null,
      },
      {
        text: "A change to a retention period or its basis is released as a new contract version.",
        appliedBy: "checkContractChange",
      },
      {
        text: "Archived data stays read-only for the rest of its retention period, and is deleted only after its owner confirms that no hold applies.",
        appliedBy: null,
      },
    ],
  },
  {
    id: "access",
    title: "Access",
    purpose:
      "Who may read a data product, and how access is granted and ended.",
    rules: [
      {
        text: "Access is granted per data product, for a stated purpose, with the product owner's approval.",
        appliedBy: null,
      },
      {
        text: "A request for confidential, restricted or personal health data needs the steward to check its purpose against the classification before the owner decides.",
        appliedBy: null,
      },
      {
        text: "Access ends when its purpose does, and every grant is reviewed at least once a year.",
        appliedBy: null,
      },
      {
        text: "Self-service SQL runs in the visitor's own in-memory copy of the published tables, with external access switched off and the engine settings locked.",
        appliedBy: "WORKBENCH_ENGINE_SETTINGS",
      },
      {
        text: "Platform pages read data built ahead of time and never query a production database.",
        appliedBy: null,
      },
    ],
  },
  {
    id: "metric-certification",
    title: "Metric certification",
    purpose: "What a metric needs before reports may rely on it.",
    rules: [
      {
        text: "A certified metric has an owner, a steward, a description, a unit and a linked business glossary term.",
        appliedBy: "checkMetricRegistry",
      },
      {
        text: "Its formula reads only gold tables and columns that exist, guards every nullable column it reads, and can reach every dimension it allows.",
        appliedBy: "checkMetricRegistry",
      },
      {
        text: "A certified report uses only certified metrics and carries its owner's sign-off on its current version.",
        appliedBy: "checkReportSpec",
      },
      {
        text: "A released metric contract is never edited. Changing what a certified metric computes needs a new major version.",
        appliedBy: "checkMetricChange",
      },
    ],
  },
  {
    id: "change-control",
    title: "Change control",
    purpose:
      "How a change to a contract or a metric reaches the people who rely on it.",
    rules: [
      {
        text: "Every data contract carries a semantic version.",
        appliedBy: "checkDataProducts",
      },
      {
        text: "A contract change takes at least the version bump its largest difference needs, so a breaking change ships only as a new major version.",
        appliedBy: "checkContractChange",
      },
      {
        text: "Before a breaking change is released, lineage names everything downstream of the changed columns and the roles to tell.",
        appliedBy: "contractChangeImpact",
      },
      {
        text: "A metric's change log ends at its current version, and each entry says what changed.",
        appliedBy: "checkMetricRegistry",
      },
    ],
  },
]);
