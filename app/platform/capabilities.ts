/** Evidence that a visitor can open now, or the issue tracking planned work. */
interface CapabilityLink {
  label: string;
  href: string;
  kind: "route" | "issue" | "artifact";
}

interface PlatformCapability {
  id: string;
  name: string;
  summary: string;
  evidence: readonly CapabilityLink[];
}

const issue = (number: number, label: string): CapabilityLink => ({
  label,
  href: `https://github.com/fderuiter/deruiter.dev/issues/${number}`,
  kind: "issue",
});

const route = (href: string, label: string): CapabilityLink => ({
  label,
  href,
  kind: "route",
});

/** Mirrors the capability map in ADR 0066 without linking to unbuilt pages. */
export const PLATFORM_CAPABILITIES: readonly PlatformCapability[] = [
  {
    id: "platform-evolution",
    name: "Platform evolution",
    summary:
      "A route from study execution to portfolio decisions, with one governed delivery plan.",
    evidence: [
      {
        label: "Architecture decision",
        href: "https://github.com/fderuiter/deruiter.dev/blob/main/adr/0066-clinical-data-platform-architecture.md",
        kind: "artifact",
      },
      route("/platform/strategy", "Strategy toolkit"),
    ],
  },
  {
    id: "data-products",
    name: "Data products & semantic models",
    summary:
      "Versioned contracts, conformed marts, one metric definition per business question.",
    evidence: [
      issue(2623, "Warehouse plan"),
      issue(2624, "Semantic layer plan"),
      issue(2626, "Data contracts plan"),
    ],
  },
  {
    id: "cdisc",
    name: "CDISC in solutions",
    summary:
      "Collection, tabulation and analysis connected by study metadata and lineage.",
    evidence: [
      route("/crf", "CRF Studio"),
      route("/protocol-drift", "Protocol Drift"),
      issue(2582, "/study-data pipeline plan"),
    ],
  },
  {
    id: "cloud",
    name: "Cloud architecture with IT & EA",
    summary:
      "An AWS reference design, deployment boundaries and cost decisions for an architecture review.",
    evidence: [issue(2641, "Architecture plan"), issue(2642, "CDK plan")],
  },
  {
    id: "modernization",
    name: "Modernization & interoperability",
    summary:
      "Legacy reconciliation, cutover and standards-based inbound adapters.",
    evidence: [
      issue(2643, "Migration lab plan"),
      issue(2644, "Interoperability plan"),
    ],
  },
  {
    id: "governance",
    name: "Governance, quality & traceability",
    summary:
      "Stewardship, quality rules, column lineage and risk-based validation evidence.",
    evidence: [
      issue(2636, "Quality plan"),
      issue(2637, "Lineage plan"),
      issue(2639, "Validation evidence plan"),
    ],
  },
  {
    id: "reporting",
    name: "Dashboards & operational reporting",
    summary:
      "Study and portfolio measures with drill-down and accessible table equivalents.",
    evidence: [
      issue(2630, "Operations dashboard plan"),
      issue(2632, "Portfolio dashboard plan"),
    ],
  },
  {
    id: "strategy",
    name: "Vendor & investment decisions",
    summary:
      "Weighted evaluation, build versus buy, five-year cost and decision memos.",
    evidence: [
      route("/platform/strategy", "Strategy toolkit"),
      issue(2646, "Vendor oversight plan"),
    ],
  },
  {
    id: "platform-modernization",
    name: "Modernizing analytics platforms",
    summary:
      "A migration lab and case study connect design decisions to an operating model.",
    evidence: [
      issue(2643, "Migration lab plan"),
      issue(2647, "Modernization case study plan"),
    ],
  },
  {
    id: "transformation",
    name: "Transformation leadership",
    summary:
      "Operating model, adoption measures and a modernization case study.",
    evidence: [
      issue(2647, "Operating model plan"),
      issue(2643, "Migration lab plan"),
    ],
  },
  {
    id: "sql-bi",
    name: "SQL, SQL Server & Power BI",
    summary:
      "A query workbench, cross-engine SQL checks and a text-based BI model.",
    evidence: [
      issue(2628, "SQL Server plan"),
      issue(2629, "Power BI plan"),
      issue(2633, "SQL workbench plan"),
    ],
  },
  {
    id: "regulations",
    name: "ICH, GCP, FDA & Part 11 controls",
    summary:
      "Control mappings and evidence that can be inspected without claiming validation.",
    evidence: [
      route("/arcade/clinical-chaos", "Clinical Trial Chaos"),
      issue(2640, "Controls matrix plan"),
    ],
  },
  {
    id: "contexts",
    name: "Drug, device & CRO contexts",
    summary:
      "One synthetic portfolio spanning pharmaceutical, device and outsourced studies.",
    evidence: [
      issue(2622, "Portfolio generator plan"),
      issue(2646, "CRO oversight plan"),
    ],
  },
];

/** The badge follows the evidence actually linked in this release. */
export function capabilityStatus(
  capability: PlatformCapability
): "Live demo" | "In progress" {
  return capability.evidence.some((link) => link.kind === "route")
    ? "Live demo"
    : "In progress";
}
