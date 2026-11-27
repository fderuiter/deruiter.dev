/**
 * Portable `.sql.json` notebook bundles and `#sql=...` active-tab permalinks
 * for the SQL workbench. Every query in an exported or imported bundle and
 * every `#sql=...` link is checked through `checkWorkbenchSql`, so malformed
 * payloads, external file reads and write keywords are refused before they
 * enter the notebook.
 */
import type {
  WorkbenchNamedQuery,
  WorkbenchNotebookBundle,
  WorkbenchNotebookBundleTab,
  WorkbenchNotebookParseResult,
  WorkbenchNotebookSerializeResult,
  WorkbenchPermalink,
  WorkbenchPermalinkDecoding,
} from "../../types";
import { checkWorkbenchSql } from "./guard";

/** Format identifier written into portable `.sql.json` notebook bundles. */
export const WORKBENCH_BUNDLE_FORMAT =
  "deruiter.clinical-sql-notebook" as const;

/** Schema version of portable `.sql.json` notebook bundles. */
export const WORKBENCH_BUNDLE_VERSION = 1 as const;

/** Maximum byte size accepted when importing a `.sql.json` notebook bundle. */
export const WORKBENCH_BUNDLE_MAX_BYTES = 2 * 1024 * 1024;

/** Maximum number of open tabs accepted in one `.sql.json` bundle. */
export const WORKBENCH_BUNDLE_MAX_TABS = 50;

/** Longest URL hash read for a `#sql=...` permalink. */
export const WORKBENCH_HASH_MAX_LENGTH = 8000;

const ISO_TIMESTAMP_PREFIX = /^\d{4}-\d{2}-\d{2}T/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyText(value: unknown, maxLen = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return null;
  return trimmed;
}

/**
 * Serializes open notebook tabs and saved named queries into a validated
 * `.sql.json` bundle. Every tab and named query must pass `checkWorkbenchSql`.
 *
 * @param input - Current tabs, active tab identifier and named queries.
 * @returns Formatted JSON text and bundle object, or why export was refused.
 */
export function serializeWorkbenchBundle(input: {
  readonly activeTabId: string;
  readonly tabs: readonly WorkbenchNotebookBundleTab[];
  readonly namedQueries?: readonly WorkbenchNamedQuery[];
  readonly exportedAt?: string;
}): WorkbenchNotebookSerializeResult {
  if (input.tabs.length === 0) {
    return {
      ok: false,
      error: "The notebook needs at least one tab to export.",
    };
  }
  if (input.tabs.length > WORKBENCH_BUNDLE_MAX_TABS) {
    return {
      ok: false,
      error: `A notebook bundle holds at most ${WORKBENCH_BUNDLE_MAX_TABS} tabs.`,
    };
  }
  const seenTabIds = new Set<string>();
  const tabs: WorkbenchNotebookBundleTab[] = [];
  for (const tab of input.tabs) {
    const id = nonEmptyText(tab.id, 120);
    const title = nonEmptyText(tab.title, 120);
    if (!id || !title) {
      return {
        ok: false,
        error: "Every tab in the notebook must have an id and a title.",
      };
    }
    if (seenTabIds.has(id)) {
      return {
        ok: false,
        error: `Duplicate tab id "${id}" in notebook bundle.`,
      };
    }
    seenTabIds.add(id);
    const findings = checkWorkbenchSql(tab.sql);
    if (findings.length > 0) {
      return {
        ok: false,
        error: `Tab "${title}" cannot be exported: ${findings.map((f) => f.message).join(" ")}`,
      };
    }
    tabs.push({
      id,
      title,
      sql: tab.sql,
      selectedQueryId:
        typeof tab.selectedQueryId === "string" ? tab.selectedQueryId : "",
      updatedAt: tab.updatedAt,
    });
  }

  const activeTabId = seenTabIds.has(input.activeTabId)
    ? input.activeTabId
    : tabs[0].id;

  const seenNamedIds = new Set<string>();
  const namedQueries: WorkbenchNamedQuery[] = [];
  for (const query of input.namedQueries ?? []) {
    const id = nonEmptyText(query.id, 120);
    const title = nonEmptyText(query.title, 120);
    if (!id || !title) {
      return {
        ok: false,
        error: "Every saved query in the notebook must have an id and a title.",
      };
    }
    if (seenNamedIds.has(id)) {
      return {
        ok: false,
        error: `Duplicate saved query id "${id}" in notebook bundle.`,
      };
    }
    seenNamedIds.add(id);
    const findings = checkWorkbenchSql(query.sql);
    if (findings.length > 0) {
      return {
        ok: false,
        error: `Saved query "${title}" cannot be exported: ${findings.map((f) => f.message).join(" ")}`,
      };
    }
    namedQueries.push({
      id,
      title,
      sql: query.sql,
      savedAt: query.savedAt,
    });
  }

  const bundle: WorkbenchNotebookBundle = {
    format: WORKBENCH_BUNDLE_FORMAT,
    version: WORKBENCH_BUNDLE_VERSION,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    activeTabId,
    tabs,
    namedQueries,
  };
  return { ok: true, json: `${JSON.stringify(bundle, null, 2)}\n`, bundle };
}

/**
 * Parses and validates an imported `.sql.json` notebook bundle. Malformed JSON,
 * unknown versions, missing fields and any SQL rejected by `checkWorkbenchSql`
 * fail closed before modifying the visitor's workspace.
 *
 * @param text - Raw JSON text from an imported `.sql.json` file.
 * @returns The validated bundle, or why it was refused.
 */
export function parseWorkbenchBundle(
  text: string
): WorkbenchNotebookParseResult {
  if (text.length > WORKBENCH_BUNDLE_MAX_BYTES) {
    return {
      ok: false,
      error: "The .sql.json file exceeds the 2 MB notebook bundle limit.",
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: "The .sql.json file is not valid JSON.",
    };
  }
  if (!isRecord(raw)) {
    return {
      ok: false,
      error: "The .sql.json bundle must be a JSON object.",
    };
  }
  if (raw.format !== WORKBENCH_BUNDLE_FORMAT) {
    return {
      ok: false,
      error: `Unrecognized notebook format; expected "${WORKBENCH_BUNDLE_FORMAT}".`,
    };
  }
  if (raw.version !== WORKBENCH_BUNDLE_VERSION) {
    return {
      ok: false,
      error: `Unsupported notebook bundle version (${String(raw.version)}); expected version ${WORKBENCH_BUNDLE_VERSION}.`,
    };
  }
  if (
    typeof raw.exportedAt !== "string" ||
    !ISO_TIMESTAMP_PREFIX.test(raw.exportedAt)
  ) {
    return {
      ok: false,
      error: "The .sql.json bundle is missing a valid exportedAt timestamp.",
    };
  }
  if (!Array.isArray(raw.tabs) || raw.tabs.length === 0) {
    return {
      ok: false,
      error: "The .sql.json bundle must include at least one SQL tab.",
    };
  }
  if (raw.tabs.length > WORKBENCH_BUNDLE_MAX_TABS) {
    return {
      ok: false,
      error: `The .sql.json bundle holds more than ${WORKBENCH_BUNDLE_MAX_TABS} tabs.`,
    };
  }

  const seenTabIds = new Set<string>();
  const tabs: WorkbenchNotebookBundleTab[] = [];
  for (let i = 0; i < raw.tabs.length; i += 1) {
    const item = raw.tabs[i];
    if (!isRecord(item)) {
      return {
        ok: false,
        error: `Tab ${i + 1} in the .sql.json bundle is malformed.`,
      };
    }
    const id = nonEmptyText(item.id, 120);
    const title = nonEmptyText(item.title, 120);
    if (!id || !title || typeof item.sql !== "string") {
      return {
        ok: false,
        error: `Tab ${i + 1} in the .sql.json bundle is missing id, title or sql.`,
      };
    }
    if (seenTabIds.has(id)) {
      return {
        ok: false,
        error: `The .sql.json bundle repeats tab id "${id}".`,
      };
    }
    seenTabIds.add(id);
    const findings = checkWorkbenchSql(item.sql);
    if (findings.length > 0) {
      return {
        ok: false,
        error: `Tab "${title}" was refused: ${findings.map((f) => f.message).join(" ")}`,
      };
    }
    tabs.push({
      id,
      title,
      sql: item.sql,
      selectedQueryId:
        typeof item.selectedQueryId === "string" ? item.selectedQueryId : "",
      updatedAt:
        typeof item.updatedAt === "string" &&
        ISO_TIMESTAMP_PREFIX.test(item.updatedAt)
          ? item.updatedAt
          : raw.exportedAt,
    });
  }

  if (typeof raw.activeTabId !== "string" || !seenTabIds.has(raw.activeTabId)) {
    return {
      ok: false,
      error: "The .sql.json bundle's activeTabId does not match any tab.",
    };
  }

  const rawNamed = raw.namedQueries ?? [];
  if (!Array.isArray(rawNamed)) {
    return {
      ok: false,
      error: "The .sql.json bundle's namedQueries field must be an array.",
    };
  }
  const seenNamedIds = new Set<string>();
  const namedQueries: WorkbenchNamedQuery[] = [];
  for (let i = 0; i < rawNamed.length; i += 1) {
    const item = rawNamed[i];
    if (!isRecord(item)) {
      return {
        ok: false,
        error: `Saved query ${i + 1} in the .sql.json bundle is malformed.`,
      };
    }
    const id = nonEmptyText(item.id, 120);
    const title = nonEmptyText(item.title, 120);
    if (!id || !title || typeof item.sql !== "string") {
      return {
        ok: false,
        error: `Saved query ${i + 1} in the .sql.json bundle is missing id, title or sql.`,
      };
    }
    if (seenNamedIds.has(id)) {
      return {
        ok: false,
        error: `The .sql.json bundle repeats saved query id "${id}".`,
      };
    }
    seenNamedIds.add(id);
    const findings = checkWorkbenchSql(item.sql);
    if (findings.length > 0) {
      return {
        ok: false,
        error: `Saved query "${title}" was refused: ${findings.map((f) => f.message).join(" ")}`,
      };
    }
    namedQueries.push({
      id,
      title,
      sql: item.sql,
      savedAt:
        typeof item.savedAt === "string" &&
        ISO_TIMESTAMP_PREFIX.test(item.savedAt)
          ? item.savedAt
          : raw.exportedAt,
    });
  }

  return {
    ok: true,
    bundle: {
      format: WORKBENCH_BUNDLE_FORMAT,
      version: WORKBENCH_BUNDLE_VERSION,
      exportedAt: raw.exportedAt,
      activeTabId: raw.activeTabId,
      tabs,
      namedQueries,
    },
  };
}

/**
 * Encodes an active tab's SQL (and optional title) as a URL hash permalink
 * without a leading `#`, after checking `checkWorkbenchSql`.
 *
 * @param permalink - SQL text and optional tab title.
 * @returns Encoded hash string such as `sql=SELECT...&title=...`.
 * @throws Error when the SQL fails `checkWorkbenchSql`.
 */
export function encodeWorkbenchPermalink(
  permalink: WorkbenchPermalink
): string {
  const findings = checkWorkbenchSql(permalink.sql);
  if (findings.length > 0) {
    throw new Error(findings.map((f) => f.message).join(" "));
  }
  const params = new URLSearchParams();
  params.set("sql", permalink.sql);
  const title = permalink.title?.trim();
  if (title) params.set("title", title.slice(0, 120));
  return params.toString();
}

/**
 * Decodes and validates a `#sql=...` URL hash permalink, with or without the
 * leading `#`. Returns `null` only via caller check on empty hashes; any
 * malformed parameter or SQL refused by `checkWorkbenchSql` returns an error.
 *
 * @param hash - Raw URL hash string.
 * @returns Validated SQL permalink or visitor-facing error message.
 */
export function decodeWorkbenchPermalink(
  hash: string
): WorkbenchPermalinkDecoding {
  const text = hash.startsWith("#") ? hash.slice(1) : hash;
  if (text.length > WORKBENCH_HASH_MAX_LENGTH) {
    return {
      ok: false,
      error: `The #sql link is longer than ${WORKBENCH_HASH_MAX_LENGTH} characters, so the workbench did not read it.`,
    };
  }
  const params = new URLSearchParams(text);
  for (const [key] of params) {
    if (key !== "sql" && key !== "title") {
      return {
        ok: false,
        error: `The #sql link has an unknown parameter: ${key}.`,
      };
    }
  }
  const sqlValues = params.getAll("sql");
  if (sqlValues.length !== 1) {
    return {
      ok: false,
      error: "The link must provide a single sql parameter (#sql=...).",
    };
  }
  const titleValues = params.getAll("title");
  if (titleValues.length > 1) {
    return {
      ok: false,
      error: "The #sql link names more than one title.",
    };
  }
  const sql = sqlValues[0];
  const findings = checkWorkbenchSql(sql);
  if (findings.length > 0) {
    return {
      ok: false,
      error: `The #sql link was refused: ${findings.map((f) => f.message).join(" ")}`,
    };
  }
  const title = titleValues[0]?.trim()
    ? titleValues[0].trim().slice(0, 120)
    : null;
  return {
    ok: true,
    permalink: { sql, title },
  };
}
