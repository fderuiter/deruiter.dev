/**
 * Lists the Prisma migrations added between two commits and flags the
 * statements that can break the running app (#2537).
 *
 * ADR 0049 applies migrations during the Production build, before the
 * Deployment Check, so a destructive statement reaches the live database
 * before any gate sees the new code. The nightly train (#1168) runs this over
 * `live..candidate` and holds the release when anything is flagged.
 *
 * Read-only: it reads git objects and SQL text, never connects to a database
 * and never runs `prisma migrate`.
 *
 * Usage: `npx tsx scripts/check-migration-safety.ts <from-sha> <to-sha> [--json]`.
 * Exits 1 when a destructive statement is found, and 2 on a usage error or a
 * commit git cannot resolve.
 */
import { execFileSync } from "node:child_process";

export type DestructiveKind =
  | "drop-table"
  | "drop-column"
  | "rename"
  | "set-not-null"
  | "add-required-column"
  | "alter-type";

export interface MigrationFinding {
  file: string;
  line: number;
  kind: DestructiveKind;
  statement: string;
}

export interface MigrationSafetyReport {
  from: string;
  to: string;
  added: string[];
  destructive: MigrationFinding[];
}

interface Statement {
  line: number;
  text: string;
  /** The text with comments and string literals blanked, for matching. */
  code: string;
}

const RULES: { kind: DestructiveKind; pattern: RegExp }[] = [
  { kind: "drop-table", pattern: /\bDROP\s+TABLE\b/i },
  { kind: "drop-column", pattern: /\bDROP\s+COLUMN\b/i },
  // Renaming an index is harmless; renaming a table or column breaks the
  // code that is still serving until the new build is promoted.
  { kind: "rename", pattern: /\bALTER\s+TABLE\b[\s\S]*\bRENAME\b/i },
  { kind: "set-not-null", pattern: /\bSET\s+NOT\s+NULL\b/i },
  {
    kind: "alter-type",
    pattern: /\bALTER\s+COLUMN\s+\S+\s+(?:SET\s+DATA\s+)?TYPE\b/i,
  },
];

/**
 * Splits SQL into statements at top-level semicolons.
 *
 * Semicolons inside quotes, comments and dollar-quoted bodies (`DO $$ ... $$`)
 * do not end a statement. Comments and single-quoted literals are blanked in
 * `code`, so a `RAISE EXCEPTION 'cannot DROP TABLE'` message or a Prisma
 * `-- DropIndex` header never matches a rule.
 */
export function splitStatements(sql: string): Statement[] {
  const statements: Statement[] = [];
  let text = "";
  let code = "";
  let line = 1;
  let start = 0;
  let body: string | null = null;
  let i = 0;

  const flush = () => {
    if (code.trim()) statements.push({ line: start, text: text.trim(), code });
    text = "";
    code = "";
    start = 0;
  };
  const take = (chunk: string, blank: boolean) => {
    if (!start && !blank && chunk.trim()) start = line;
    // Comments before a statement are headers, not part of it.
    if (start) text += chunk;
    code += blank ? chunk.replace(/[^\n]/g, " ") : chunk;
    line += chunk.split("\n").length - 1;
  };

  while (i < sql.length) {
    const rest = sql.slice(i);
    const dollar = /^\$([A-Za-z_]\w*)?\$/.exec(rest);
    let end: number;
    if (rest.startsWith("--")) {
      end = rest.indexOf("\n");
      take(rest.slice(0, end === -1 ? rest.length : end), true);
      i += end === -1 ? rest.length : end;
    } else if (rest.startsWith("/*")) {
      end = rest.indexOf("*/", 2);
      end = end === -1 ? rest.length : end + 2;
      take(rest.slice(0, end), true);
      i += end;
    } else if (rest[0] === "'" || rest[0] === '"') {
      const quote = rest[0];
      end = 1;
      while (end < rest.length) {
        if (rest[end] === quote && rest[end + 1] === quote) end += 2;
        else if (rest[end] === quote) break;
        else end += 1;
      }
      end = Math.min(end + 1, rest.length);
      // Identifiers stay matchable; only string literals are blanked.
      take(rest.slice(0, end), quote === "'");
      i += end;
    } else if (dollar && (!body || dollar[0] === body)) {
      // A PL/pgSQL body is still SQL, so its own literals and comments are
      // blanked as above; only its semicolons stop ending the statement.
      body = body ? null : dollar[0];
      take(dollar[0], false);
      i += dollar[0].length;
    } else if (rest[0] === ";" && !body) {
      take(";", false);
      flush();
      i += 1;
    } else {
      take(rest[0], false);
      i += 1;
    }
  }
  flush();
  return statements;
}

/**
 * Reports whether an `ALTER TABLE ... ADD COLUMN` adds a NOT NULL column with
 * no default, which fails on any table that already has rows.
 */
function addsRequiredColumn(code: string): boolean {
  if (!/\bALTER\s+TABLE\b/i.test(code)) return false;
  return code
    .split(/\bADD\s+(?:COLUMN\s+)?/i)
    .slice(1)
    .some(
      (clause) =>
        !/^\s*(?:CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK)\b/i.test(clause) &&
        /\bNOT\s+NULL\b/i.test(clause) &&
        !/\bDEFAULT\b/i.test(clause)
    );
}

/**
 * Finds the destructive statements in one migration's SQL.
 *
 * @param file - The migration path, carried into each finding.
 * @param sql - The migration's SQL text.
 * @returns One finding per destructive statement, by its first matching rule.
 */
export function findDestructiveStatements(
  file: string,
  sql: string
): MigrationFinding[] {
  const findings: MigrationFinding[] = [];
  for (const { line, text, code } of splitStatements(sql)) {
    const rule = RULES.find(({ pattern }) => pattern.test(code));
    const kind =
      rule?.kind ?? (addsRequiredColumn(code) ? "add-required-column" : null);
    if (kind) findings.push({ file, line, kind, statement: text });
  }
  return findings;
}

function git(args: string[]): string {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Checks every migration added between two commits.
 *
 * @param from - The commit that is live.
 * @param to - The release candidate.
 * @param read - Reads a file at a commit; defaults to `git show`.
 * @param list - Lists the added migration files; defaults to `git diff`.
 * @returns The added migrations and their destructive statements.
 */
export function checkMigrationSafety(
  from: string,
  to: string,
  read: (sha: string, file: string) => string = (sha, file) =>
    git(["show", `${sha}:${file}`]),
  list: (from: string, to: string) => string[] = (a, b) =>
    git([
      "diff",
      "--name-only",
      "--diff-filter=A",
      a,
      b,
      "--",
      "prisma/migrations/*/migration.sql",
    ])
      .split("\n")
      .filter(Boolean)
): MigrationSafetyReport {
  const added = list(from, to).sort();
  const destructive = added.flatMap((file) =>
    findDestructiveStatements(file, read(to, file))
  );
  return { from, to, added, destructive };
}

/**
 * Renders a report for a person reading the train's log or hold issue.
 *
 * @param report - The result of {@link checkMigrationSafety}.
 * @returns A plain-text summary, one line per finding.
 */
export function formatReport(report: MigrationSafetyReport): string {
  const range = `${report.from.slice(0, 8)}..${report.to.slice(0, 8)}`;
  if (report.added.length === 0) return `No migrations added in ${range}.`;
  const lines = [
    `${report.added.length} migration(s) added in ${range}:`,
    ...report.added.map((file) => `  ${file}`),
  ];
  if (report.destructive.length === 0) {
    lines.push("All are additive.");
    return lines.join("\n");
  }
  lines.push(
    `${report.destructive.length} destructive statement(s); release manually after review:`,
    ...report.destructive.map(
      ({ file, line, kind, statement }) =>
        `  ${file}:${line} ${kind}: ${statement.replace(/\s+/g, " ").slice(0, 160)}`
    )
  );
  return lines.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const [from, to] = args.filter((arg) => !arg.startsWith("--"));
  if (!from || !to) {
    console.error(
      "Usage: npx tsx scripts/check-migration-safety.ts <from-sha> <to-sha> [--json]"
    );
    process.exitCode = 2;
    return;
  }
  let report: MigrationSafetyReport;
  try {
    report = checkMigrationSafety(from, to);
  } catch (error) {
    // An unknown or unfetched commit is a usage error, not a destructive
    // finding: exit 1 must only ever mean "hold for review".
    const stderr = (error as { stderr?: string }).stderr?.trim();
    console.error(stderr || (error as Error).message);
    process.exitCode = 2;
    return;
  }
  console.log(
    args.includes("--json")
      ? JSON.stringify(report, null, 2)
      : formatReport(report)
  );
  if (report.destructive.length > 0) process.exitCode = 1;
}

if (typeof process.env.VITEST === "undefined") main();
