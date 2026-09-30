import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { clientEnvSchema, serverEnvSchema } from "@/lib/env";
import { parseEnvFile } from "@/lib/dx/env-guard";

// The deployment matrix in docs/how-to/release-and-deploy.md is the operator's
// list of what to set in Vercel. It must name every variable lib/env.ts
// declares, and nothing the schema has dropped, or an operator ends up setting
// a dead variable or missing a live one.
const root = process.cwd();
const doc = fs.readFileSync(
  path.join(root, "docs/how-to/release-and-deploy.md"),
  "utf8"
);

const CLASSES = new Set(["Required", "Optional", "Integration", "Platform"]);
const SCOPES = new Set(["Production", "Preview", "Development"]);

// Read by the build or by Vercel itself rather than through lib/env.ts. A new
// entry here is a deliberate decision, which is the point of listing them.
const OUTSIDE_SCHEMA = new Set(["NODE_OPTIONS", "SENTRY_AUTH_TOKEN", "VERCEL"]);

interface MatrixRow {
  name: string;
  cls: string;
  scope: string;
}

function matrixRows(markdown: string): MatrixRow[] {
  const start = markdown.indexOf("## Environment Variables");
  const end = markdown.indexOf("\n## ", start + 1);
  const section = markdown.slice(start, end === -1 ? undefined : end);
  const rows: MatrixRow[] = [];
  for (const line of section.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    const match = cells[1]?.match(/^`([a-zA-Z0-9_]+)`$/);
    if (match) rows.push({ name: match[1], cls: cells[2], scope: cells[3] });
  }
  return rows;
}

describe("deployment environment-variable matrix", () => {
  const rows = matrixRows(doc);
  const documented = rows.map((row) => row.name);
  const schemaKeys = [
    ...Object.keys(serverEnvSchema.shape),
    ...Object.keys(clientEnvSchema.shape),
  ];

  it("has a section to check", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("lists each variable once", () => {
    expect(new Set(documented).size).toBe(documented.length);
  });

  it("documents every variable lib/env.ts declares", () => {
    expect(schemaKeys.filter((key) => !documented.includes(key))).toEqual([]);
  });

  it("documents nothing the schema does not declare, bar the listed exceptions", () => {
    const stale = documented.filter(
      (name) => !schemaKeys.includes(name) && !OUTSIDE_SCHEMA.has(name)
    );
    expect(stale).toEqual([]);
  });

  it("gives every row a known class and Vercel scope", () => {
    for (const row of rows) {
      expect(CLASSES, row.name).toContain(row.cls);
      if (row.scope === "None") continue;
      for (const scope of row.scope.split(",").map((s) => s.trim())) {
        expect(SCOPES, row.name).toContain(scope);
      }
    }
  });

  it("never scopes a platform-provided variable into Vercel by hand", () => {
    const misplaced = rows.filter(
      (row) => row.cls === "Platform" && row.scope !== "None"
    );
    expect(misplaced.map((row) => row.name)).toEqual([]);
  });

  it("marks only the browser-safe variables as NEXT_PUBLIC_", () => {
    const browserVisible = documented
      .filter((name) => name.startsWith("NEXT_PUBLIC_"))
      .sort();
    expect(browserVisible).toEqual(Object.keys(clientEnvSchema.shape).sort());
  });

  it("agrees with .env.example on which variables exist", () => {
    const exampleKeys = Object.keys(
      parseEnvFile(path.join(root, ".env.example"))
    );
    // NODE_ENV and VERCEL_ENV are set by the platform and deliberately absent
    // from .env.example, matching checkEnvironmentVariables in lib/dx/env-guard.ts.
    const expected = schemaKeys.filter(
      (key) => key !== "NODE_ENV" && key !== "VERCEL_ENV"
    );
    expect(expected.filter((key) => !exampleKeys.includes(key))).toEqual([]);
    expect(exampleKeys.filter((key) => !schemaKeys.includes(key))).toEqual([]);
  });
});
