import fs from "node:fs";
import path from "node:path";
import type { DiagnosticCheckResult } from "../doctor";

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];
const AUTH_VALUES = ["public", "clerk_admin", "cron_secret"];

function routeFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return /^route\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/**
 * The top-level arguments of the call whose `(` is at `open`, as source
 * text. Strings, template literals and comments are skipped, so a comma or
 * bracket inside them does not split an argument.
 */
function callArguments(source: string, open: number): string[] | null {
  const args: string[] = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"' || char === "'" || char === "`") {
      for (i += 1; i < source.length && source[i] !== char; i += 1) {
        if (source[i] === "\\") i += 1;
      }
    } else if (source.startsWith("//", i)) {
      i = source.indexOf("\n", i);
      if (i === -1) return null;
    } else if (source.startsWith("/*", i)) {
      i = source.indexOf("*/", i + 2) + 1;
      if (i === 0) return null;
    } else if (char === "(" || char === "{" || char === "[") {
      depth += 1;
    } else if (char === ")" || char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        args.push(source.slice(start, i));
        return args.map((arg) => arg.trim()).filter(Boolean);
      }
    } else if (char === "," && depth === 1) {
      args.push(source.slice(start, i));
      start = i + 1;
    }
  }
  return null;
}

/**
 * Problems with one route file's exported HTTP handlers: each must be
 * `export const METHOD = createApiHandler(handler, { auth: ... })`, with
 * `auth` set to one of the wrapper's strategies in the options argument.
 *
 * @param source - The route file's source.
 * @returns One message per handler that breaks the rule.
 */
export function findApiRouteWrapperViolations(source: string): string[] {
  const problems: string[] = [];
  const methods = HTTP_METHODS.join("|");

  const declared = new RegExp(
    `export\\s+(?:async\\s+)?function\\s+(${methods})\\b`,
    "g"
  );
  for (const match of source.matchAll(declared)) {
    problems.push(`${match[1]} is a plain function, not createApiHandler(...)`);
  }

  const reexported = /export\s*\{([^}]*)\}/g;
  for (const match of source.matchAll(reexported)) {
    for (const name of match[1].split(",")) {
      const exported = name
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (exported && HTTP_METHODS.includes(exported)) {
        problems.push(
          `${exported} is re-exported, so its wrapper can't be checked`
        );
      }
    }
  }

  const constant = new RegExp(`export\\s+const\\s+(${methods})\\s*=\\s*`, "g");
  for (const match of source.matchAll(constant)) {
    const method = match[1];
    const rest = source.slice(match.index + match[0].length);
    if (!rest.startsWith("createApiHandler")) {
      problems.push(`${method} is not created with createApiHandler(...)`);
      continue;
    }
    const open =
      match.index +
      match[0].length +
      source.slice(match.index + match[0].length).indexOf("(");
    const args = callArguments(source, open);
    const options = args && args.length > 1 ? args[args.length - 1] : "";
    const auth = /(?:^|[{,\s])auth\s*:\s*["']([a-z_]+)["']/.exec(options);
    if (!auth) {
      problems.push(`${method} does not declare an auth strategy`);
    } else if (!AUTH_VALUES.includes(auth[1])) {
      problems.push(`${method} declares an unknown auth strategy "${auth[1]}"`);
    }
  }

  return problems;
}

/**
 * API Route Wrapper Check (AGENTS.md section 22, #3473)
 *
 * Every exported handler in `app/api/**\/route.ts` goes through
 * `createApiHandler` from `lib/route-wrapper.ts` and names its `auth`
 * strategy (`public`, `clerk_admin` or `cron_secret`), so rate limits, error
 * shapes and access control cannot be skipped by accident. There is no
 * exemption list: the signature-verified webhooks are wrapped with
 * `auth: "public"` and verify their own signatures inside the handler.
 *
 * @param root - The workspace root.
 * @returns The check result.
 */
export function checkApiRouteWrapper(root: string): DiagnosticCheckResult {
  const files = routeFiles(path.join(root, "app", "api"));
  const details = files.flatMap((file) =>
    findApiRouteWrapperViolations(fs.readFileSync(file, "utf-8")).map(
      (problem) => `${path.relative(root, file)}: ${problem}`
    )
  );

  if (details.length === 0) {
    return {
      id: "api-route-wrapper",
      name: "API Route Wrapper & Auth Policy",
      category: "security",
      status: "pass",
      message: `All ${files.length} app/api route files use createApiHandler with an explicit auth strategy.`,
    };
  }
  return {
    id: "api-route-wrapper",
    name: "API Route Wrapper & Auth Policy",
    category: "security",
    status: "fail",
    message: `${details.length} API handler(s) skip createApiHandler or its auth strategy.`,
    details,
    fixable: false,
  };
}
