// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TAVR_DEVICE_USDM,
  TAVR_SAVR_USDM,
  importUsdmStudy,
  serializeStudyWorkspace,
} from "@/lib/study-workspace";
import { usdmContentHash } from "@/lib/clinical-standards";
import { EXIT, runStudyCommand } from "../scripts/study";

/**
 * The study command line runs the same workspace operations as the studio
 * (epic #3071, step 5). Each case runs a command in-process against files in
 * a temporary directory and checks what it wrote, printed and returned.
 */
let dir: string;
const file = (name: string) => path.join(dir, name);
const write = (name: string, value: unknown) => {
  fs.writeFileSync(file(name), JSON.stringify(value));
  return file(name);
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "study-cli-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("study import", () => {
  it("writes the same workspace the studio's import makes", async () => {
    const usdm = write("rct.usdm.json", TAVR_SAVR_USDM);
    const out = file("rct.study.json");
    const result = await runStudyCommand(["import", usdm, "--out", out]);
    expect(result.exitCode).toBe(EXIT.ok);
    const fromStudio = await importUsdmStudy(
      { text: fs.readFileSync(usdm, "utf-8") },
      { fileName: "rct.usdm.json" }
    );
    expect(fromStudio.status).toBe("ok");
    if (fromStudio.status === "ok") {
      expect(fs.readFileSync(out, "utf-8")).toBe(
        serializeStudyWorkspace(fromStudio.workspace)
      );
    }
    expect(fs.readdirSync(dir).sort()).toEqual([
      "rct.study.json",
      "rct.usdm.json",
    ]);
  });

  it("prints one JSON object with the report under --json", async () => {
    const usdm = write("device.usdm.json", TAVR_DEVICE_USDM);
    const result = await runStudyCommand(["import", usdm, "--json"]);
    expect(result.exitCode).toBe(EXIT.ok);
    expect(JSON.parse(result.stdout)).toMatchObject({
      study: "DEV-2026-VALVE",
      revision: { id: "R1", parentId: null },
      report: { counts: { arms: 1, estimands: 1 }, schemaIssues: [] },
      written: null,
    });
  });

  it("writes nothing on a dry run", async () => {
    const usdm = write("device.usdm.json", TAVR_DEVICE_USDM);
    const out = file("device.study.json");
    const result = await runStudyCommand([
      "import",
      usdm,
      "--out",
      out,
      "--dry-run",
    ]);
    expect(result.exitCode).toBe(EXIT.ok);
    expect(fs.existsSync(out)).toBe(false);
  });

  it("asks for a version and design instead of picking the first", async () => {
    const twoDesigns = structuredClone(TAVR_SAVR_USDM);
    const version = (twoDesigns.study.versions ?? [])[0];
    // A second design whose ids, and the references between them, are new.
    const original = JSON.stringify((version.studyDesigns ?? [])[0]);
    const ids = new Set(
      [...original.matchAll(/"id":\s*"([^"]+)"/g)].map((match) => match[1])
    );
    const second = JSON.parse(
      original.replace(/"([^"]+)"/g, (quoted, value: string) =>
        ids.has(value) ? `"${value}_2"` : quoted
      )
    );
    second.id = "design_second";
    version.studyDesigns = [...(version.studyDesigns ?? []), second];
    const usdm = write("two.usdm.json", twoDesigns);

    const ambiguous = await runStudyCommand(["import", usdm]);
    expect(ambiguous.exitCode).toBe(EXIT.badInput);
    expect(ambiguous.stderr).toMatch(/design_main\|design_second/);

    const chosen = await runStudyCommand([
      "import",
      usdm,
      "--version",
      version.id,
      "--design",
      "design_second",
      "--json",
    ]);
    expect(chosen.exitCode).toBe(EXIT.ok);
    expect(JSON.parse(chosen.stdout).selection).toEqual({
      studyVersionId: version.id,
      studyDesignId: "design_second",
    });
  });

  it("refuses a missing file with exit 2 and no example study", async () => {
    const result = await runStudyCommand([
      "import",
      file("missing.json"),
      "--json",
    ]);
    expect(result.exitCode).toBe(EXIT.badInput);
    expect(JSON.parse(result.stdout)).toEqual({
      error: `no such file: ${file("missing.json")}`,
    });
    expect(result.stderr).toMatch(/no such file/);
  });

  it("refuses a file that is not USDM v4", async () => {
    const result = await runStudyCommand([
      "import",
      write("other.json", { usdmVersion: "3.0.0", study: {} }),
    ]);
    expect(result.exitCode).toBe(EXIT.badInput);
  });
});

describe("options that take a value (#3618)", () => {
  /** Runs a command with the temporary directory as the working directory. */
  async function runIn(argv: string[]) {
    const previous = process.cwd();
    process.chdir(dir);
    try {
      return await runStudyCommand(argv);
    } finally {
      process.chdir(previous);
    }
  }

  it("refuses --out followed by another flag instead of writing a file named after it", async () => {
    const usdm = write("device.usdm.json", TAVR_DEVICE_USDM);
    const result = await runIn(["import", usdm, "--out", "--json"]);
    expect(result.exitCode).toBe(EXIT.badInput);
    expect(JSON.parse(result.stdout)).toEqual({
      error: "--out needs a value",
    });
    expect(fs.readdirSync(dir)).toEqual(["device.usdm.json"]);
  });

  it("refuses the reported --out --json --dry-run order with the JSON error", async () => {
    const usdm = write("device.usdm.json", TAVR_DEVICE_USDM);
    const result = await runIn([
      "import",
      usdm,
      "--out",
      "--json",
      "--dry-run",
    ]);
    expect(result.exitCode).toBe(EXIT.badInput);
    expect(JSON.parse(result.stdout)).toEqual({
      error: "--out needs a value",
    });
    expect(result.stderr).toBe("study: --out needs a value\n");
  });

  it.each(["--out", "--version", "--design"])(
    "refuses %s as the last argument",
    async (flag) => {
      const usdm = write("device.usdm.json", TAVR_DEVICE_USDM);
      const result = await runIn(["import", usdm, flag]);
      expect(result.exitCode).toBe(EXIT.badInput);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(`study: ${flag} needs a value\n`);
      expect(fs.readdirSync(dir)).toEqual(["device.usdm.json"]);
    }
  );

  it.each(["--version", "--design"])(
    "refuses %s followed by another flag",
    async (flag) => {
      const usdm = write("device.usdm.json", TAVR_DEVICE_USDM);
      const result = await runIn(["import", usdm, flag, "--dry-run"]);
      expect(result.exitCode).toBe(EXIT.badInput);
      expect(result.stderr).toBe(`study: ${flag} needs a value\n`);
    }
  );

  it("refuses export --out with no value and writes nothing", async () => {
    const usdm = write("device.usdm.json", TAVR_DEVICE_USDM);
    const ws = file("device.study.json");
    expect((await runIn(["import", usdm, "--out", ws])).exitCode).toBe(EXIT.ok);
    const result = await runIn(["export", ws, "--out"]);
    expect(result.exitCode).toBe(EXIT.badInput);
    expect(fs.readdirSync(dir).sort()).toEqual([
      "device.study.json",
      "device.usdm.json",
    ]);
  });

  it("still accepts a value given after the flag, with --json anywhere", async () => {
    const usdm = write("device.usdm.json", TAVR_DEVICE_USDM);
    const out = file("device.study.json");
    const result = await runIn(["import", "--json", usdm, "--out", out]);
    expect(result.exitCode).toBe(EXIT.ok);
    expect(JSON.parse(result.stdout).written).toBe(out);
    expect(fs.existsSync(out)).toBe(true);
  });
});

describe("study info and export", () => {
  async function workspace(): Promise<string> {
    const out = file("rct.study.json");
    await runStudyCommand([
      "import",
      write("rct.usdm.json", TAVR_SAVR_USDM),
      "--out",
      out,
    ]);
    return out;
  }

  it("reports the revision, selection and counts of a saved workspace", async () => {
    const result = await runStudyCommand(["info", await workspace(), "--json"]);
    expect(result.exitCode).toBe(EXIT.ok);
    expect(JSON.parse(result.stdout)).toMatchObject({
      study: "DEV-2026-VALVE-RCT",
      revision: { id: "R1" },
      counts: { arms: 2, endpoints: 7 },
    });
  });

  it("refuses a file that is not a workspace", async () => {
    const result = await runStudyCommand([
      "info",
      write("plain.json", TAVR_SAVR_USDM),
    ]);
    expect(result.exitCode).toBe(EXIT.badInput);
    expect(result.stderr).toMatch(/not a study workspace/);
  });

  it.each(["info", "export"])(
    "%s refuses a hash-valid workspace with a malformed study, without crashing (#3619)",
    async (command) => {
      const saved = JSON.parse(fs.readFileSync(await workspace(), "utf-8"));
      saved.usdm = {};
      saved.revision.sha256 = usdmContentHash(saved.usdm);
      const result = await runStudyCommand([
        command,
        write("malformed.study.json", saved),
        "--out",
        file("out.usdm.json"),
      ]);
      expect(result.exitCode).toBe(EXIT.badInput);
      expect(result.stderr).toMatch(
        /not a study workspace \(not-a-workspace\)/
      );
      expect(fs.existsSync(file("out.usdm.json"))).toBe(false);
    }
  );

  it("exports the working USDM document unchanged", async () => {
    const out = file("exported.usdm.json");
    const result = await runStudyCommand([
      "export",
      await workspace(),
      "--out",
      out,
    ]);
    expect(result.exitCode).toBe(EXIT.ok);
    expect(JSON.parse(fs.readFileSync(out, "utf-8"))).toEqual(TAVR_SAVR_USDM);
  });
});

describe("help", () => {
  it("lists the commands and exit codes", async () => {
    const result = await runStudyCommand([]);
    expect(result.exitCode).toBe(EXIT.ok);
    expect(result.stdout).toMatch(/import <usdm\.json\|->/);
    expect(result.stdout).toMatch(/3 revision conflict/);
  });

  it("names an unknown command", async () => {
    const result = await runStudyCommand(["frobnicate"]);
    expect(result.exitCode).toBe(EXIT.badInput);
    expect(result.stderr).toMatch(/unknown command: frobnicate/);
  });
});
