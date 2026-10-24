import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  ALLOWLIST_FILE,
  CORE_TARGETS,
  EXPORT_NOTES_FILE,
  GATE_FINDINGS_FILE,
  coreIssues,
  exportCoreInputs,
  gateCounts,
  parseAllowlist,
  reconcile,
  reconcileFolder,
  renderReconciliation,
  substituteCtVersion,
  type AllowlistEntry,
} from "../scripts/study-data-core";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "study-data-core-"));

afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

const entry = (overrides: Partial<AllowlistEntry> = {}): AllowlistEntry => ({
  target: "sdtm",
  coreId: "CORE-000001",
  dataset: "DM",
  category: "by-design",
  reason: "Intended.",
  ...overrides,
});

const report = (rows: Record<string, unknown>[]) => ({ Issue_Summary: rows });

describe("CDISC CORE reconciliation (#2603)", () => {
  it("validates the checked-in allowlist and tracks every defect by issue", () => {
    const entries = parseAllowlist(JSON.parse(read(ALLOWLIST_FILE)));
    expect(entries.length).toBeGreaterThan(0);
    for (const value of entries.filter((item) => item.category === "defect")) {
      expect(value.issue, `${value.coreId} ${value.dataset}`).toBeGreaterThan(
        0
      );
    }
  });

  it.each([
    [{ entries: "no" }, /no entries array/],
    [{ entries: [entry({ target: "send" as "sdtm" })] }, /unknown target/],
    [{ entries: [entry({ coreId: "SD-001" })] }, /no CORE rule id/],
    [{ entries: [entry({ dataset: "" })] }, /names no dataset/],
    [{ entries: [entry({ category: "fine" as "defect" })] }, /no known/],
    [{ entries: [entry({ category: "defect" })] }, /no tracking issue/],
    [{ entries: [entry({ reason: " " })] }, /gives no reason/],
    [{ entries: [entry(), entry()] }, /repeats sdtm CORE-000001 DM/],
  ])("rejects a malformed allowlist %#", (json, message) => {
    expect(() => parseAllowlist(json)).toThrow(message);
  });

  it("reads CORE's summary rows for datasets and USDM entities", () => {
    expect(
      coreIssues(
        "usdm",
        report([
          {
            core_id: "CORE-000419",
            entity: "Encounter",
            issues: 14,
            message: "m",
          },
        ])
      )
    ).toEqual([
      {
        target: "usdm",
        coreId: "CORE-000419",
        dataset: "Encounter",
        issues: 14,
        message: "m",
      },
    ]);
    expect(() => coreIssues("sdtm", {})).toThrow(/no Issue_Summary/);
  });

  it("fails an unexplained finding and a stale entry, and ignores targets that did not run", () => {
    const issues = coreIssues(
      "sdtm",
      report([
        { core_id: "CORE-000001", dataset: "DM", issues: 2, message: "known" },
        { core_id: "CORE-000002", dataset: "AE", issues: 1, message: "new" },
      ])
    );
    const allowlist = [
      entry(),
      entry({ coreId: "CORE-000003", dataset: "TS" }),
      entry({ target: "adam", coreId: "CORE-000004", dataset: "ADSL" }),
    ];
    const result = reconcile(issues, allowlist, ["sdtm"]);
    expect(result.explained.map(({ issue }) => issue.coreId)).toEqual([
      "CORE-000001",
    ]);
    expect(result.unexplained.map((issue) => issue.coreId)).toEqual([
      "CORE-000002",
    ]);
    expect(result.stale.map((value) => value.coreId)).toEqual(["CORE-000003"]);
  });

  it("renders the failures, the CT substitution and the per-dataset comparison", () => {
    const issues = coreIssues(
      "sdtm",
      report([
        { core_id: "CORE-000001", dataset: "DM", issues: 2, message: "a|b" },
        { core_id: "CORE-000002", dataset: "AE", issues: 1, message: "new" },
      ])
    );
    const result = reconcile(
      issues,
      [entry({ category: "defect", issue: 42 }), entry({ dataset: "TS" })],
      ["sdtm"]
    );
    const markdown = renderReconciliation({
      notes: { declaredCt: "2026-09-25", validatedCt: "2026-03-27" },
      engine: "CDISC CORE v0",
      skipped: [{ target: "adam", reason: "No rules." }],
      issues,
      result,
      gate: gateCounts({
        findings: [
          { dataset: "AE", ruleId: "SD-033" },
          { dataset: "AE", ruleId: "SD-033" },
        ],
      }),
    });
    expect(markdown).toContain(
      "**1 unexplained CORE finding(s) and 1 stale allowlist entry.**"
    );
    expect(markdown).toContain(
      "validated against 2026-03-27, the newest release in CORE's cache; the pipeline declares 2026-09-25"
    );
    expect(markdown).toContain("- Not run for adam: No rules.");
    expect(markdown).toContain("| sdtm | CORE-000002 | AE | 1 | new |");
    expect(markdown).toContain("- sdtm CORE-000001 TS");
    expect(markdown).toContain("| AE | CORE-000002 (1) | SD-033 (2) |");
    expect(markdown).toContain("| DM | CORE-000001 (2) | none |");
    expect(markdown).toContain("| defect (#42) |");
  });

  it("says plainly when everything is explained", () => {
    const issues = coreIssues(
      "sdtm",
      report([
        { core_id: "CORE-000001", dataset: "DM", issues: 1, message: "m" },
      ])
    );
    const markdown = renderReconciliation({
      notes: { declaredCt: "2026-03-27", validatedCt: "2026-03-27" },
      engine: "CDISC CORE v0",
      skipped: [],
      issues,
      result: reconcile(issues, [entry()], ["sdtm"]),
      gate: new Map(),
    });
    expect(markdown).toContain(
      "Every CORE finding is explained (1 rule and dataset pairs)."
    );
    expect(markdown).toContain("- Controlled terminology: 2026-03-27");
    expect(markdown).not.toContain("## Unexplained findings");
  });

  it("substitutes a cached CT release and rejects one that is not a date", () => {
    expect(
      substituteCtVersion(
        'Version="2026-09-25" OID="STD.CT.SDTM.2026-09-25"',
        "2026-09-25",
        "2026-03-27"
      )
    ).toBe('Version="2026-03-27" OID="STD.CT.SDTM.2026-03-27"');
    expect(() => substituteCtVersion("", "2026-09-25", "latest")).toThrow(
      /YYYY-MM-DD/
    );
  });

  it("exports the SDTM and ADaM Dataset-JSON, both Define-XML files, the USDM fixture and the gate's findings", async () => {
    const out = path.join(scratch, "export");
    const written = await exportCoreInputs(out, { ctVersion: "2026-03-27" });
    for (const target of CORE_TARGETS) {
      if (target.define) expect(written).toContain(target.define);
      expect(
        written.some((file) => file.startsWith(`${target.dataDir}/`))
      ).toBe(true);
    }
    expect(written).toContain("m5/datasets/tabulations/sdtm/dm.json");
    expect(written).toContain("m5/datasets/analysis/adam/adsl.json");
    expect(written.some((file) => file.endsWith(".xpt"))).toBe(false);
    const define = fs.readFileSync(
      path.join(out, "m5/datasets/tabulations/sdtm/define.xml"),
      "utf8"
    );
    expect(define).toContain('Version="2026-03-27"');
    expect(define).not.toContain("2026-09-25");
    expect(
      JSON.parse(fs.readFileSync(path.join(out, EXPORT_NOTES_FILE), "utf8"))
    ).toMatchObject({ declaredCt: "2026-09-25", validatedCt: "2026-03-27" });
    const gate = JSON.parse(
      fs.readFileSync(path.join(out, GATE_FINDINGS_FILE), "utf8")
    );
    expect(Array.isArray(gate.findings)).toBe(true);
  });

  it("reconciles a folder of reports and needs a report or skip note per target", () => {
    const input = path.join(scratch, "export");
    const reports = path.join(scratch, "reports");
    fs.mkdirSync(reports, { recursive: true });
    const allowlist = path.join(scratch, "allowlist.json");
    fs.writeFileSync(allowlist, JSON.stringify({ entries: [entry()] }));
    fs.writeFileSync(
      path.join(reports, "sdtm.json"),
      JSON.stringify(
        report([
          { core_id: "CORE-000001", dataset: "DM", issues: 1, message: "m" },
        ])
      )
    );
    expect(() => reconcileFolder(input, reports, allowlist, "x")).toThrow(
      /No CORE report or skip note for adam/
    );
    fs.writeFileSync(path.join(reports, "adam.skipped"), "No rules.\n");
    fs.writeFileSync(
      path.join(reports, "usdm.json"),
      JSON.stringify(report([]))
    );
    const { markdown, failed } = reconcileFolder(
      input,
      reports,
      allowlist,
      "CDISC CORE test"
    );
    expect(failed).toBe(false);
    expect(markdown).toContain("- Engine: CDISC CORE test");
    expect(markdown).toContain("- Not run for adam: No rules.");
  });
});

describe("study-data-core.yml (#2603)", () => {
  const workflow = read(".github/workflows/study-data-core.yml");

  it("pins CORE to a tag and the commit it must resolve to", () => {
    expect(workflow).toMatch(/CORE_TAG: v\d+\.\d+\.\d+/);
    expect(workflow).toMatch(/CORE_COMMIT: [0-9a-f]{40}/);
    expect(workflow).toContain('if [ "$actual" != "$CORE_COMMIT" ]; then');
    expect(workflow).toContain("-c scripts/study-data-core-constraints.txt");
  });

  it("runs on study data changes and weekly, bounded, and outside ci.yml", () => {
    expect(workflow).toContain('- "lib/study-data/**"');
    expect(workflow).toMatch(/schedule:\n\s+- cron:/);
    expect(workflow).toMatch(/timeout-minutes: \d+/);
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(read(".github/workflows/ci.yml")).not.toContain("study-data-core");
  });

  it("reconciles, publishes the summary and uploads the reports", () => {
    expect(workflow).toContain(
      "npx --no-install tsx scripts/study-data-core.ts reconcile"
    );
    expect(workflow).toContain('>> "$GITHUB_STEP_SUMMARY"');
    expect(workflow).toContain("name: study-data-core-reports");
  });

  it("freezes every Python package it installs", () => {
    const constraints = read("scripts/study-data-core-constraints.txt")
      .split("\n")
      .filter((line) => line.trim() !== "" && !line.startsWith("#"));
    expect(constraints.length).toBeGreaterThan(0);
    for (const line of constraints) expect(line).toMatch(/^[\w.-]+==[\w.]+$/);
  });
});
