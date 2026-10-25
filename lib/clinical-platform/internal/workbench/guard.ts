/**
 * The SQL workbench's read-only boundary (#2633), in two layers. The engine
 * settings close every way out of the database: once the warehouse is
 * loaded, DuckDB refuses file, network and extension access and locks its
 * configuration. The statement check runs before a query reaches the
 * engine. It refuses anything but one query, so writes inside the database
 * are refused too, and it turns what the settings would refuse into a
 * readable message. The database is the visitor's own in-memory copy, so a
 * write that got past the check would change nothing anyone else sees, and
 * a reload would discard it.
 */
import type { WorkbenchSqlFinding } from "../../types";

/**
 * DuckDB settings applied after the warehouse is loaded, in order. Locking
 * the configuration last means no later statement can turn access back on.
 */
export const WORKBENCH_ENGINE_SETTINGS: readonly string[] = [
  "SET enable_external_access = false",
  "SET autoinstall_known_extensions = false",
  "SET autoload_known_extensions = false",
  "SET lock_configuration = true",
];

/** Words a read-only statement may start with. */
const QUERY_STARTS = new Set([
  "select",
  "with",
  "explain",
  "describe",
  "summarize",
  "show",
  "from",
  "values",
  "table",
]);

/** Words that change data, the schema, the session or the engine. */
const FORBIDDEN = new Set([
  "alter",
  "attach",
  "begin",
  "call",
  "checkpoint",
  "commit",
  "copy",
  "create",
  "deallocate",
  "delete",
  "detach",
  "drop",
  "execute",
  "export",
  "grant",
  "import",
  "insert",
  "install",
  "load",
  "merge",
  "pragma",
  "prepare",
  "reset",
  "revoke",
  "rollback",
  "set",
  "truncate",
  "update",
  "use",
  "vacuum",
]);

/** Table functions that read files, URLs or arbitrary SQL text. */
const EXTERNAL = new Set([
  "delta_scan",
  "glob",
  "iceberg_scan",
  "parquet_file_metadata",
  "parquet_kv_metadata",
  "parquet_metadata",
  "parquet_scan",
  "parquet_schema",
  "query",
  "sniff_csv",
]);

interface Token {
  readonly kind: "word" | "string" | "identifier" | "symbol";
  readonly text: string;
}

/** Splits SQL into tokens, dropping comments; `null` when something is left open. */
function tokenize(sql: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const closeQuoted = (quote: string): number | null => {
    for (let j = i + 1; j < sql.length; j += 1) {
      if (sql[j] !== quote) continue;
      if (sql[j + 1] === quote) j += 1;
      else return j + 1;
    }
    return null;
  };
  while (i < sql.length) {
    const c = sql[i];
    if (/\s/.test(c)) {
      i += 1;
    } else if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end + 1;
    } else if (sql.startsWith("/*", i)) {
      const end = sql.indexOf("*/", i + 2);
      if (end === -1) return null;
      i = end + 2;
    } else if (c === "'" || c === '"') {
      const end = closeQuoted(c);
      if (end === null) return null;
      tokens.push({
        kind: c === "'" ? "string" : "identifier",
        text: sql.slice(i, end),
      });
      i = end;
    } else if (c === "$" && /^\$\w*\$/.test(sql.slice(i))) {
      const tag = /^\$\w*\$/.exec(sql.slice(i))?.[0] ?? "$$";
      const end = sql.indexOf(tag, i + tag.length);
      if (end === -1) return null;
      tokens.push({ kind: "string", text: sql.slice(i, end + tag.length) });
      i = end + tag.length;
    } else if (/[A-Za-z_]/.test(c)) {
      const word = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(sql.slice(i))?.[0] ?? c;
      tokens.push({ kind: "word", text: word.toLowerCase() });
      i += word.length;
    } else {
      tokens.push({ kind: "symbol", text: c });
      i += 1;
    }
  }
  return tokens;
}

/**
 * Checks that SQL typed into the workbench is one read-only query. It
 * catches what the engine settings would refuse anyway, earlier and in
 * plain words; it is not the boundary itself.
 *
 * @param sql - The text as typed.
 * @returns What stops the text from running; empty when it may run.
 */
export function checkWorkbenchSql(sql: string): WorkbenchSqlFinding[] {
  const tokens = tokenize(sql);
  if (tokens === null) {
    return [
      {
        rule: "unterminated",
        message:
          "A string, quoted name or comment is never closed. Close it and run again.",
      },
    ];
  }
  const statements: Token[][] = [[]];
  for (const token of tokens) {
    if (token.kind === "symbol" && token.text === ";") statements.push([]);
    else statements[statements.length - 1].push(token);
  }
  const nonEmpty = statements.filter((s) => s.length > 0);
  if (nonEmpty.length === 0) {
    return [{ rule: "empty", message: "There is no query to run." }];
  }
  const findings: WorkbenchSqlFinding[] = [];
  if (nonEmpty.length > 1) {
    findings.push({
      rule: "multiple-statements",
      message: `Run one statement at a time; this has ${nonEmpty.length}.`,
    });
  }
  const [statement] = nonEmpty;
  const first = statement.find((t) => t.kind !== "symbol" || t.text !== "(");
  if (first?.kind !== "word" || !QUERY_STARTS.has(first.text)) {
    findings.push({
      rule: "not-a-query",
      message:
        "The workbench runs queries only: start with SELECT, WITH, FROM, VALUES, EXPLAIN, DESCRIBE, SUMMARIZE or SHOW.",
    });
  }
  const seen = new Set<string>();
  const words = nonEmpty.flat();
  words.forEach((token, at) => {
    if (token.kind === "string") {
      const before = words[at - 1];
      if (
        before?.kind === "word" &&
        (before.text === "from" || before.text === "join")
      ) {
        findings.push({
          rule: "external-read",
          message: `${token.text} reads a file or URL. The workbench reads only the warehouse tables.`,
        });
      }
      return;
    }
    if (token.kind !== "word" || seen.has(token.text)) return;
    const next = words[at + 1];
    if (FORBIDDEN.has(token.text)) {
      seen.add(token.text);
      findings.push({
        rule: "forbidden-keyword",
        message: `${token.text.toUpperCase()} changes data, the schema or the engine. The warehouse is read-only.`,
      });
    } else if (
      next?.kind === "symbol" &&
      next.text === "(" &&
      (EXTERNAL.has(token.text) || token.text.startsWith("read_"))
    ) {
      seen.add(token.text);
      findings.push({
        rule: "external-read",
        message: `${token.text} reads files, URLs or SQL text. The workbench reads only the warehouse tables.`,
      });
    }
  });
  return findings;
}
