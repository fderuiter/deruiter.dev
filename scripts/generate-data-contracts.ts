/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SEED,
  DEFAULT_SUBJECT_COUNT,
  DEMO_301_STUDY,
  runPipeline,
  type PipelineRun,
} from "../lib/study-data";
import {
  ODCS_API_VERSION,
  STUDY_DATA_PRODUCT_ID,
  SYNTHETIC_DATA_NOTICE,
  checkContractChange,
  dataContracts,
  dataProducts,
  toOdcsYaml,
  type DataContract,
  type DataProduct,
} from "../lib/clinical-platform";

/**
 * Writes the files generated from the Clinical Data Platform's data
 * products (#2626): one Open Data Contract Standard YAML file per product,
 * the data contract catalog page, and the lock file that records every
 * released contract. `__tests__/clinical-platform-contracts.test.ts`
 * regenerates each one and fails when the checked-in copy differs, so run
 * this after changing the warehouse schema, the Study Data Pipeline's
 * dataset metadata or a product registration, and commit the result.
 * Writing the lock file refuses a release that breaks the versioning rules,
 * such as a removed or retyped column without a major version bump.
 */

/** Folder of the ODCS golden files, relative to the workspace root. */
export const ODCS_GOLDEN_DIR = "__tests__/fixtures/clinical-platform/odcs";

/** Released data contracts, relative to the workspace root. */
export const CONTRACT_LOCK_FILE =
  "__tests__/fixtures/clinical-platform/data-contracts.lock.json";

/** Data contract catalog page, relative to the workspace root. */
export const CONTRACT_REFERENCE_PAGE =
  "docs/reference/clinical-platform-data-contracts.md";

/** The pipeline run whose metadata the study data contract is read from. */
export function referenceRun(): PipelineRun {
  return runPipeline(DEMO_301_STUDY, {
    seed: DEFAULT_SEED,
    nSubjects: DEFAULT_SUBJECT_COUNT,
  });
}

/** ODCS golden file of a product, relative to the workspace root. */
export function odcsFile(productId: string): string {
  return `${ODCS_GOLDEN_DIR}/${productId}.odcs.yaml`;
}

const cell = (text: string) => text.replaceAll("|", "\\|");

function hours(n: number): string {
  if (n % 24 !== 0) return `${n} hours`;
  return n === 24 ? "1 day" : `${n / 24} days`;
}

const percent = (share: number) => `${Number((share * 100).toFixed(2))}%`;

function referencePage(
  products: readonly DataProduct[],
  contracts: readonly DataContract[]
): string {
  const byId = new Map(contracts.map((c) => [c.productId, c]));
  const out: string[] = [
    "# Clinical Data Platform data contracts",
    "",
    "<!-- Generated from the data product registry by scripts/generate-data-contracts.ts. Do not edit by hand. -->",
    "",
    SYNTHETIC_DATA_NOTICE,
    "",
    "Every silver and gold table of the Clinical Data Platform",
    "([ADR 0066](../../adr/0066-clinical-data-platform-architecture.md)) and",
    "the Study Data Pipeline's SDTM and ADaM output is a data product with an",
    "owner, a steward and a versioned data contract. A contract lists each",
    "column's type, nullability, classification and limits, the primary key,",
    "the service levels and the retention period. Columns, keys and",
    "classifications are read from the",
    "[star schema](clinical-platform-star-schema.md) and the pipeline's",
    "metadata; ownership, service levels and retention are recorded once per",
    "product. Each contract is also published as an",
    `[Open Data Contract Standard](https://bitol-io.github.io/open-data-contract-standard/) ${ODCS_API_VERSION}`,
    `file in \`${ODCS_GOLDEN_DIR}/\`, validated against the`,
    "standard's JSON schema. Regenerate this page, the ODCS files and the",
    "contract lock with `npx tsx scripts/generate-data-contracts.ts`; a unit",
    "test fails when they drift.",
    "",
    "A unit test checks every generated dataset against its contract: schema conformance",
    "(columns, types, lengths, patterns and the primary key), then",
    "completeness of required values, freshness of the latest load and",
    "publication of every table. A removed or retyped column, a column that",
    "may now be null, a narrower limit, a stricter classification or a weaker",
    "service level is breaking and needs a major version bump; an added",
    "column or a stronger promise needs at least a minor one.",
    "",
    "Classification runs public, internal, confidential, restricted. A",
    "product holds personal health data when its rows describe study",
    "subjects. The data is synthetic; the labels are the ones the real data",
    "would carry.",
    "",
    "## Products",
    "",
    "| Product | Id | Domain | Owner | Steward | Classification | Personal health data | Freshness | Availability | Retention | Version |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const p of products) {
    const c = byId.get(p.id);
    if (c === undefined) throw new Error(`${p.id} has no contract`);
    out.push(
      `| ${cell(p.name)} | \`${p.id}\` | ${cell(p.domain)} | ${p.owner} | ${p.steward} | ${p.classification} | ${p.personalHealthData ? "Yes" : "No"} | ${hours(c.sla.freshnessHours)} | ${percent(c.sla.availability)} | ${c.retention.years} years | ${c.version} |`
    );
  }
  out.push(
    "",
    "## Retention",
    "",
    "| Period | Basis | Products |",
    "| --- | --- | --- |"
  );
  const periods = new Map<string, DataContract[]>();
  for (const c of contracts) {
    const key = `${c.retention.years}\u0000${c.retention.basis}`;
    periods.set(key, [...(periods.get(key) ?? []), c]);
  }
  for (const group of periods.values()) {
    const { years, basis } = group[0].retention;
    out.push(`| ${years} years | ${cell(basis)} | ${group.length} |`);
  }
  out.push("", "## Lineage and consumers", "");
  out.push("| Product | Upstream | Consumers |", "| --- | --- | --- |");
  for (const p of products) {
    const upstream = p.upstream.map((u) => `\`${u}\``).join(", ") || "None";
    const consumers =
      p.consumers.map((c) => `\`${c.id}\``).join(", ") || "None recorded";
    out.push(`| \`${p.id}\` | ${upstream} | ${consumers} |`);
  }
  const study = byId.get(STUDY_DATA_PRODUCT_ID);
  if (study !== undefined) {
    out.push(
      "",
      `## Study data datasets (\`${study.productId}\`)`,
      "",
      "| Dataset | Description | Structure | Key | Variables |",
      "| --- | --- | --- | --- | --- |",
      ...study.objects.map(
        (o) =>
          `| ${o.name} | ${cell(o.description)} | ${cell(o.grain)} | ${o.primaryKey.join(", ")} | ${o.columns.length} |`
      )
    );
  }
  return `${out.join("\n")}\n`;
}

/** Every generated file except the lock, and its expected contents, by relative path. */
export function contractArtifacts(
  run: PipelineRun = referenceRun()
): Record<string, string> {
  const products = dataProducts(run);
  const contracts = dataContracts(run);
  const files: Record<string, string> = {};
  products.forEach((product, i) => {
    files[odcsFile(product.id)] = toOdcsYaml(product, contracts[i]);
  });
  files[CONTRACT_REFERENCE_PAGE] = referencePage(products, contracts);
  return files;
}

/** The contract lock file: every data contract release ever recorded. */
export interface ContractLockFile {
  readonly notice: string;
  readonly releases: readonly DataContract[];
}

/** JSON with object keys sorted, so a release reads the same however it was built. */
function sortedJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortedJson(v)])
    );
  }
  return value;
}

/** Text of a lock file, as written to disk. */
export function contractLockText(lock: ContractLockFile): string {
  return `${JSON.stringify(sortedJson(lock), null, 2)}\n`;
}

/**
 * Adds the current contracts to the recorded releases. A release already
 * recorded must be unchanged; a new one must pass `checkContractChange`
 * against the latest recorded release of its product. Releases are never
 * removed.
 *
 * @param recorded - Releases in the existing lock file.
 * @param contracts - The contracts in force.
 * @returns The releases to write, sorted by product id, then in recorded order.
 * @throws Error naming every release that breaks the versioning rules.
 */
export function nextContractReleases(
  recorded: readonly DataContract[],
  contracts: readonly DataContract[]
): DataContract[] {
  const releases = [...recorded];
  const problems: string[] = [];
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(sortedJson(a)) === JSON.stringify(sortedJson(b));
  for (const contract of contracts) {
    const history = releases.filter((r) => r.productId === contract.productId);
    const existing = history.find((r) => r.version === contract.version);
    if (existing !== undefined) {
      if (!same(existing, contract)) {
        problems.push(
          `${contract.productId} ${contract.version} changed after it was released; give the change a new version`
        );
      }
      continue;
    }
    const latest = history.at(-1);
    if (latest !== undefined) {
      problems.push(
        ...checkContractChange(latest, contract).map(
          (f) => `${f.productId}: ${f.message}`
        )
      );
    }
    releases.push(contract);
  }
  if (problems.length > 0) {
    throw new Error(
      `Data contract releases break the versioning rules:\n${problems.join("\n")}`
    );
  }
  return releases.sort((a, b) =>
    a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0
  );
}

/** The recorded releases in a lock file on disk, or none when it does not exist. */
export function readContractLock(workspaceRoot: string): DataContract[] {
  const file = path.join(workspaceRoot, CONTRACT_LOCK_FILE);
  if (!fs.existsSync(file)) return [];
  return (JSON.parse(fs.readFileSync(file, "utf8")) as ContractLockFile)
    .releases as DataContract[];
}

/** Writes every generated file and the lock under the workspace root. */
export function writeContractArtifacts(workspaceRoot: string): string[] {
  const run = referenceRun();
  const lock: ContractLockFile = {
    notice: `Released data contracts, appended by scripts/generate-data-contracts.ts; never edit or remove a release. ${SYNTHETIC_DATA_NOTICE}`,
    releases: nextContractReleases(
      readContractLock(workspaceRoot),
      dataContracts(run)
    ),
  };
  const files = {
    ...contractArtifacts(run),
    [CONTRACT_LOCK_FILE]: contractLockText(lock),
  };
  return Object.entries(files).map(([relative, contents]) => {
    const file = path.join(workspaceRoot, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents, "utf8");
    return relative;
  });
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  for (const file of writeContractArtifacts(process.cwd())) {
    console.log(`Generated ${file}`);
  }
}
