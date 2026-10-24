/**
 * Contract evolution rules. A consumer written against one version of a
 * contract keeps working on any later version with the same major number,
 * so every change is graded by whether it can break such a consumer.
 */
import type {
  ContractChangeLevel,
  ContractColumn,
  ContractDifference,
  ContractObject,
  DataContract,
  DataContractFinding,
} from "../../../types";
import { compareVersions, semver } from "../../semantic/check";
import { CLASSIFICATION_ORDER } from "./derive";

const RANK: Readonly<Record<ContractChangeLevel, number>> = {
  none: 0,
  patch: 1,
  minor: 2,
  major: 3,
};

function columnDifferences(
  object: string,
  a: ContractColumn,
  b: ContractColumn
): ContractDifference[] {
  const out: ContractDifference[] = [];
  const at = `${object}.${a.name}`;
  const major = (message: string) => out.push({ level: "major", message });
  const minor = (message: string) => out.push({ level: "minor", message });
  if (a.type !== b.type)
    major(`${at} changes type from ${a.type} to ${b.type}`);
  if (!a.nullable && b.nullable) major(`${at} may now be null`);
  if (a.nullable && !b.nullable) minor(`${at} is now required`);
  for (const key of ["maxLength", "precision", "scale"] as const) {
    const from = a[key];
    const to = b[key];
    if (from === to) continue;
    // `null` means no limit, so it is the widest value.
    if (to !== null && (from === null || to < from)) {
      major(`${at} narrows ${key} from ${from ?? "no limit"} to ${to}`);
    } else {
      minor(`${at} widens ${key} from ${from} to ${to ?? "no limit"}`);
    }
  }
  if (a.pattern !== b.pattern) {
    if (b.pattern === null) minor(`${at} drops its pattern`);
    else major(`${at} now must match ${b.pattern}`);
  }
  const from = CLASSIFICATION_ORDER.indexOf(a.classification);
  const to = CLASSIFICATION_ORDER.indexOf(b.classification);
  if (to > from) {
    major(
      `${at} is reclassified from ${a.classification} to ${b.classification}, which some consumers may no longer read`
    );
  } else if (to < from) {
    minor(
      `${at} is reclassified from ${a.classification} to ${b.classification}`
    );
  }
  if (a.description !== b.description) {
    out.push({ level: "patch", message: `${at} has a new description` });
  }
  return out;
}

function objectDifferences(
  a: ContractObject,
  b: ContractObject
): ContractDifference[] {
  const out: ContractDifference[] = [];
  const next = new Map(b.columns.map((c) => [c.name, c]));
  const previous = new Set(a.columns.map((c) => c.name));
  for (const column of a.columns) {
    const later = next.get(column.name);
    if (later === undefined) {
      out.push({
        level: "major",
        message: `${a.name}.${column.name} is removed`,
      });
    } else {
      out.push(...columnDifferences(a.name, column, later));
    }
  }
  for (const column of b.columns) {
    if (!previous.has(column.name)) {
      out.push({
        level: "minor",
        message: `${a.name}.${column.name} is added`,
      });
    }
  }
  if (a.primaryKey.join() !== b.primaryKey.join()) {
    out.push({
      level: "major",
      message: `${a.name} changes its primary key from (${a.primaryKey.join(", ")}) to (${b.primaryKey.join(", ")})`,
    });
  }
  if (a.physicalName !== b.physicalName) {
    out.push({
      level: "major",
      message: `${a.name} moves from ${a.physicalName} to ${b.physicalName}`,
    });
  }
  const kept = a.columns.map((c) => c.name).filter((n) => next.has(n));
  const order = b.columns.map((c) => c.name).filter((n) => previous.has(n));
  if (kept.join() !== order.join()) {
    out.push({ level: "patch", message: `${a.name} reorders its columns` });
  }
  if (a.description !== b.description || a.grain !== b.grain) {
    out.push({
      level: "patch",
      message: `${a.name} has a new description or grain text`,
    });
  }
  return out;
}

/**
 * Every difference between two versions of a contract, each graded by the
 * version bump it needs. Breaking (major): a removed table, dataset or
 * column; a changed type; a column that may now be null; a narrower length,
 * precision, scale or a new pattern; a changed primary key or physical
 * name; a stricter classification; and a weaker service level or a shorter
 * retention. Additive (minor): an added table, dataset or column; a column
 * that is now required; a wider limit; a looser classification; a stronger
 * service level or a longer retention. Anything else that changes, such as
 * a description or the order of columns, is a patch.
 *
 * @param previous - The earlier contract.
 * @param next - The later contract.
 * @returns The differences, in contract order; empty when the two are the same.
 */
export function contractDifferences(
  previous: DataContract,
  next: DataContract
): ContractDifference[] {
  const out: ContractDifference[] = [];
  const later = new Map(next.objects.map((o) => [o.name, o]));
  const earlier = new Set(previous.objects.map((o) => o.name));
  for (const object of previous.objects) {
    const match = later.get(object.name);
    if (match === undefined) {
      out.push({ level: "major", message: `${object.name} is removed` });
    } else {
      out.push(...objectDifferences(object, match));
    }
  }
  for (const object of next.objects) {
    if (!earlier.has(object.name)) {
      out.push({ level: "minor", message: `${object.name} is added` });
    }
  }
  const a = previous.sla;
  const b = next.sla;
  // A larger freshness target is a weaker promise; larger shares are stronger.
  const promises = [
    [
      "freshness target",
      -Math.sign(b.freshnessHours - a.freshnessHours),
      `${a.freshnessHours} to ${b.freshnessHours} hours`,
    ],
    [
      "completeness target",
      Math.sign(b.completeness - a.completeness),
      `${a.completeness} to ${b.completeness}`,
    ],
    [
      "availability target",
      Math.sign(b.availability - a.availability),
      `${a.availability} to ${b.availability}`,
    ],
    [
      "retention",
      Math.sign(next.retention.years - previous.retention.years),
      `${previous.retention.years} to ${next.retention.years} years`,
    ],
  ] as const;
  for (const [name, direction, change] of promises) {
    if (direction < 0)
      out.push({
        level: "major",
        message: `the ${name} weakens from ${change}`,
      });
    if (direction > 0)
      out.push({
        level: "minor",
        message: `the ${name} strengthens from ${change}`,
      });
  }
  if (
    previous.retention.basis !== next.retention.basis ||
    previous.retention.regulatory !== next.retention.regulatory
  ) {
    out.push({ level: "patch", message: "the retention basis changes" });
  }
  return out;
}

/**
 * The version bump a contract change needs: the largest of its differences.
 *
 * @param previous - The earlier contract.
 * @param next - The later contract.
 * @returns `none` when nothing changed.
 */
export function contractChangeLevel(
  previous: DataContract,
  next: DataContract
): ContractChangeLevel {
  return contractDifferences(previous, next).reduce<ContractChangeLevel>(
    (top, d) => (RANK[d.level] > RANK[top] ? d.level : top),
    "none"
  );
}

/**
 * Checks one version of a contract against the one before it: the version
 * may not go backwards, may not stay the same over a change, and must take
 * at least the bump the change needs, so a breaking change without a major
 * bump fails.
 *
 * @param previous - The earlier release.
 * @param next - The release that follows it.
 * @returns Every broken versioning rule, each naming what changed.
 */
export function checkContractChange(
  previous: DataContract,
  next: DataContract
): DataContractFinding[] {
  const findings: DataContractFinding[] = [];
  const report = (message: string) =>
    findings.push({
      rule: "version",
      productId: next.productId,
      object: null,
      message,
    });
  if (previous.productId !== next.productId) {
    report(
      `compares ${next.productId} with a release of ${previous.productId}`
    );
    return findings;
  }
  const from = semver(previous.version);
  const to = semver(next.version);
  if (from === null || to === null) {
    report(`${from === null ? previous.version : next.version} is not x.y.z`);
    return findings;
  }
  const differences = contractDifferences(previous, next);
  const level = contractChangeLevel(previous, next);
  const order = compareVersions(to, from);
  const why = (wanted: ContractChangeLevel) =>
    differences
      .filter((d) => d.level === wanted)
      .map((d) => d.message)
      .join("; ");
  if (order < 0) {
    report(`version ${next.version} is lower than ${previous.version}`);
  } else if (order === 0) {
    if (level !== "none") {
      report(
        `version ${next.version} changed without a new version number: ${why(level)}`
      );
    }
  } else if (level === "major" && to[0] <= from[0]) {
    report(
      `a breaking change needs a major version bump (${previous.version} to ${next.version}): ${why("major")}`
    );
  } else if (level === "minor" && to[0] === from[0] && to[1] <= from[1]) {
    report(
      `an additive change needs at least a minor version bump (${previous.version} to ${next.version}): ${why("minor")}`
    );
  }
  return findings;
}
