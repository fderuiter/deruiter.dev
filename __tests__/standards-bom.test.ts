// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CDISC_CORE_PIN,
  CLINICAL_STANDARDS_PROFILE,
  STANDARDS_BOM_SPECS,
  compareVersions,
  isBehind,
  standardsBillOfMaterials,
} from "@/lib/clinical-standards";
import {
  diffLatest,
  evsReleaseDate,
  latestReleaseTag,
  serializeLatest,
  siteVersion,
  summarize,
  textNodes,
  validateLatest,
  type LatestVersions,
} from "../scripts/standards-watch";

const ROOT = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");
const LATEST_FILE = "lib/clinical-standards/standards-latest.json";
const committed = JSON.parse(read(LATEST_FILE)) as LatestVersions;

describe("standards bill of materials (#2992 step 5)", () => {
  it("covers every standard the profile pins, once, in the profile's order", () => {
    const profileStandards = Object.keys(CLINICAL_STANDARDS_PROFILE).filter(
      (key) => key !== "CT"
    );
    expect(STANDARDS_BOM_SPECS.map((s) => s.standard)).toEqual(
      profileStandards
    );
  });

  it("takes every pinned version from the profile", () => {
    for (const entry of standardsBillOfMaterials().standards) {
      expect(entry.pinned).toBe(CLINICAL_STANDARDS_PROFILE[entry.standard]);
    }
    for (const pkg of standardsBillOfMaterials().terminology) {
      expect(pkg.pinned).toBe(CLINICAL_STANDARDS_PROFILE.CT.packageDate);
    }
  });

  it("pins the same CDISC CORE the workflow runs and the findings record", () => {
    const workflow = read(".github/workflows/study-data-core.yml");
    expect(workflow).toContain(`CORE_TAG: ${CDISC_CORE_PIN.tag}`);
    expect(workflow).toContain(`CORE_COMMIT: ${CDISC_CORE_PIN.commit}`);
    const findings = JSON.parse(
      read("lib/study-data/internal/core/recorded-findings.json")
    );
    expect(findings.lock).toMatchObject({
      tag: CDISC_CORE_PIN.tag,
      commit: CDISC_CORE_PIN.commit,
    });
  });

  it("names a check for every standard, and every check's file exists", () => {
    for (const spec of STANDARDS_BOM_SPECS) {
      expect(spec.checks.length, spec.standard).toBeGreaterThan(0);
      for (const check of spec.checks) {
        expect(fs.existsSync(path.join(ROOT, check.path)), check.path).toBe(
          true
        );
      }
    }
  });

  it("links only to CDISC and NCI EVS sources", () => {
    const bom = standardsBillOfMaterials();
    const urls = [
      ...bom.standards.flatMap((s) => [
        s.source,
        s.feed.kind === "cdisc-site" ? s.feed.page : s.feed.repository,
      ]),
      ...bom.terminology.map((t) => t.feed),
      ...bom.tools.flatMap((t) => [
        t.source,
        t.feed.kind === "git-tags" ? t.feed.repository : t.feed.page,
      ]),
    ];
    for (const url of urls) {
      expect(url).toMatch(
        /^https:\/\/(www\.cdisc\.org\/standards\/|github\.com\/cdisc-org\/|evs\.nci\.nih\.gov\/ftp1\/CDISC\/)/
      );
    }
  });

  it("keeps the committed published versions valid and canonical", () => {
    expect(validateLatest(committed)).toEqual([]);
    expect(read(LATEST_FILE)).toBe(serializeLatest(committed));
  });

  it("never records a published version older than the pin", () => {
    const bom = standardsBillOfMaterials();
    for (const entry of [...bom.standards, ...bom.terminology, ...bom.tools]) {
      expect(
        compareVersions(entry.published, entry.pinned),
        `${entry.pinned} -> ${entry.published}`
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it("calls a pin held only when it says why", () => {
    for (const entry of standardsBillOfMaterials().standards) {
      if (entry.status === "held") expect(entry.hold).toBeTruthy();
      if (entry.status === "upgrade-available") expect(entry.hold).toBeFalsy();
    }
  });
});

describe("version comparison", () => {
  it("compares numerically, not as text", () => {
    expect(compareVersions("2.1.11", "2.1.9")).toBeGreaterThan(0);
    expect(compareVersions("v0.17.1", "v1.0.0")).toBeLessThan(0);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("2026-09-25", "2026-12-19")).toBeLessThan(0);
  });

  it("judges a pin at its own precision", () => {
    expect(isBehind("2.1", "2.1.11")).toBe(false);
    expect(isBehind("1.0", "1.0.0")).toBe(false);
    expect(isBehind("2.2", "2.3")).toBe(true);
    expect(isBehind("1.3.2", "2.0")).toBe(true);
    expect(isBehind("v0.17.1", "v1.0.0")).toBe(true);
    expect(isBehind("2026-09-25", "2026-12-19")).toBe(true);
  });

  it("derives each status from the published versions it is given", () => {
    const pinnedEverywhere = {
      standards: Object.fromEntries(
        STANDARDS_BOM_SPECS.map((s) => [
          s.standard,
          CLINICAL_STANDARDS_PROFILE[s.standard],
        ])
      ),
      terminology: {
        SDTM: "2026-12-19",
        ADaM: "2026-09-25",
        DDF: "2026-09-25",
      },
      tools: { "cdisc-core": CDISC_CORE_PIN.tag },
    };
    const bom = standardsBillOfMaterials({
      ...pinnedEverywhere,
      standards: { ...pinnedEverywhere.standards, ODM: "2.0", CDASHIG: "9.9" },
    });
    const status = (id: string) =>
      bom.standards.find((s) => s.standard === id)?.status;
    expect(status("ODM")).toBe("held");
    expect(status("CDASHIG")).toBe("upgrade-available");
    expect(status("SDTMIG")).toBe("current");
    expect(bom.terminology.map((t) => t.status)).toEqual([
      "upgrade-available",
      "current",
      "current",
    ]);
    expect(bom.tools[0].status).toBe("current");
  });
});

describe("standards watch parsers", () => {
  // Hand-written, in the shape of a cdisc.org version table.
  const page = `
    <html><head><style>.v{color:red}</style><script>var x = "SDTMIG v9.9";</script></head>
    <body><table>
      <tr><td><a href="/x">SDTMIG v3.4</a></td><td>29 November 2021</td></tr>
      <tr><td><a href="/y">SDTMIG v3.10</a></td><td>1 January 2030</td></tr>
      <tr><td>SDTMIG for Medical Devices v1.1</td></tr>
      <tr><td>SDTM and SDTMIG Conformance Rules&nbsp;v2.0</td></tr>
      <tr><td>Related: SDTMIG v4.0 draft</td></tr>
    </table></body></html>`;

  it("reads text nodes without scripts or styles", () => {
    const nodes = textNodes(page);
    expect(nodes).toContain("SDTMIG v3.4");
    expect(nodes).toContain("SDTM and SDTMIG Conformance Rules v2.0");
    expect(nodes.join(" ")).not.toContain("9.9");
  });

  it("takes the highest version listed under a label, and nothing else", () => {
    expect(siteVersion(page, ["SDTMIG"])).toBe("3.10");
    expect(siteVersion(page, ["SDTM and SDTMIG Conformance Rules"])).toBe(
      "2.0"
    );
    expect(siteVersion(page, ["SDTMIG for Medical Devices"])).toBe("1.1");
    expect(siteVersion(page, ["ADaMIG"])).toBeUndefined();
  });

  it("takes the highest vX.Y.Z release tag", () => {
    const refs = [
      "aaa\trefs/tags/v0.17.1",
      "bbb\trefs/tags/v1.0.0",
      "ccc\trefs/tags/v.0.9.1",
      "ddd\trefs/tags/v0.14.0-pr",
      "eee\trefs/tags/v0.9.0",
      "",
    ].join("\n");
    expect(latestReleaseTag(refs)).toBe("1.0.0");
    expect(latestReleaseTag("aaa\trefs/tags/Hackathon\n")).toBeUndefined();
  });

  it("reads the release date an EVS ODM-XML declares", () => {
    const head = `<?xml version="1.0"?><ODM FileOID="CDISC_CT.SDTM.2026-09-25" SourceSystemVersion="2026-09-25" ODMVersion="1.3.2">`;
    expect(evsReleaseDate(head)).toBe("2026-09-25");
    expect(evsReleaseDate("<ODM>")).toBeUndefined();
  });

  it("rejects a file that is missing, adds or garbles an entry", () => {
    const broken: LatestVersions = {
      ...committed,
      standards: { ...committed.standards, SDTMIG: "latest", SENDIG: "3.1" },
      tools: {},
    };
    expect(validateLatest(broken)).toEqual([
      'standards.SDTMIG = "latest" is not valid',
      "standards.SENDIG is not in the bill of materials",
      "tools.cdisc-core is missing",
    ]);
  });

  it("reports what moved and the pins left behind", () => {
    const next = {
      ...committed,
      terminology: { ...committed.terminology, SDTM: "2026-12-19" },
    };
    const changes = diffLatest(committed, next);
    expect(changes).toEqual([
      {
        key: "terminology.SDTM",
        from: committed.terminology.SDTM,
        to: "2026-12-19",
      },
    ]);
    const text = summarize(changes, ["ODM: page returned 503"], next);
    expect(text).toContain(
      `| terminology.SDTM | ${committed.terminology.SDTM} | 2026-12-19 |`
    );
    expect(text).toContain("- ODM: page returned 503");
    expect(text).toContain("SDTM CT 2026-09-25 (published 2026-12-19)");
    expect(summarize([], [], committed)).toContain("Nothing CDISC or NCI EVS");
  });
});

describe("standards watch workflow", () => {
  const workflow = read(".github/workflows/standards-watch.yml");

  it("runs weekly and on demand, never on a pull request or push", () => {
    expect(workflow).toMatch(/schedule:\s*\n\s*- cron: "41 7 \* \* 1"/);
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s{2}(pull_request|push):/m);
    expect(workflow).toMatch(/timeout-minutes: \d+/);
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
  });

  it("uses no secret but its own token, so no CDISC Library key", () => {
    expect(workflow).not.toContain("CDISC_LIBRARY_API_KEY");
    expect(workflow.match(/secrets\./g) ?? []).toEqual([]);
  });

  it("refreshes, records on a pull request, and dispatches CI there", () => {
    expect(workflow).toContain("scripts/standards-watch.ts refresh");
    expect(workflow).toMatch(
      /scripts\/open-bot-pr\.sh chore\/standards-watch- [^]*lib\/clinical-standards\/standards-latest\.json/
    );
  });

  it("opens the pull request and dispatches CI through the shared script", () => {
    const script = read("scripts/open-bot-pr.sh");
    expect(script).toContain('branch="$prefix$hash"');
    expect(script).toContain("gh pr create --base main");
    expect(script).toContain('gh workflow run ci.yml --ref "$branch"');
    expect(script).toContain("gh issue create");
  });
});
