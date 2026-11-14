// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.resolve(process.cwd(), "scripts/study-data-core-views.sh");

/**
 * A stand-in for CORE's core.py. `validate` writes `<-o>.json` and counts
 * its calls per report in calls.json. While a report's call count is below
 * its entry in race.json, the report carries the engine's cache-race error,
 * the way CORE v1.0.0 records it (#3869). `list-rules` prints one rule.
 * An output path listed in fail.json makes validate exit 1.
 */
const FAKE_CORE = String.raw`
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
def load(name, default):
    p = os.path.join(here, name)
    return json.load(open(p)) if os.path.exists(p) else default
args = sys.argv[1:]
if args[0] == "list-rules":
    print(json.dumps([{"id": "R1"}]))
    sys.exit(0)
out = args[args.index("-o") + 1]
key = os.path.basename(os.path.dirname(out)) + "/" + os.path.basename(out)
calls = load("calls.json", {})
calls[key] = calls.get(key, 0) + 1
json.dump(calls, open(os.path.join(here, "calls.json"), "w"))
if key in load("fail.json", []):
    print("engine crashed")
    sys.exit(1)
issues = []
if calls[key] <= load("race.json", {}).get(key, 0):
    issues.append({"error": "OrderedDict mutated during iteration"})
json.dump({"Issue_Details": issues}, open(out + ".json", "w"))
print("ran", key)
`;

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    fs.rmSync(dir, { recursive: true, force: true });
});

function setup(options: { race?: Record<string, number>; fail?: string[] }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "core-views-"));
  dirs.push(root);
  const coreDir = path.join(root, "core");
  fs.mkdirSync(coreDir);
  fs.writeFileSync(path.join(coreDir, "core.py"), FAKE_CORE);
  fs.writeFileSync(
    path.join(coreDir, "race.json"),
    JSON.stringify(options.race ?? {})
  );
  fs.writeFileSync(
    path.join(coreDir, "fail.json"),
    JSON.stringify(options.fail ?? [])
  );

  const inputs = path.join(root, "inputs");
  for (const view of ["default", "lab-retest"]) {
    const sdtm = path.join(inputs, view, "m5/datasets/tabulations/sdtm");
    fs.mkdirSync(sdtm, { recursive: true });
    fs.writeFileSync(path.join(sdtm, "dm.json"), "{}");
    fs.writeFileSync(path.join(sdtm, "define.xml"), "<x/>");
  }
  fs.mkdirSync(path.join(inputs, "default/usdm"), { recursive: true });
  fs.mkdirSync(path.join(inputs, "default/m5/datasets/analysis/adam"), {
    recursive: true,
  });
  const crfInputs = path.join(root, "crf");
  fs.mkdirSync(path.join(crfInputs, "oncology/usdm"), { recursive: true });

  const run = () =>
    spawnSync(
      "bash",
      [
        SCRIPT,
        coreDir,
        "python3",
        inputs,
        path.join(root, "reports"),
        "2",
        crfInputs,
        path.join(root, "crf-reports"),
      ],
      { encoding: "utf8" }
    );
  const calls = () =>
    JSON.parse(
      fs.readFileSync(path.join(coreDir, "calls.json"), "utf8")
    ) as Record<string, number>;
  return { run, calls };
}

// #3869: every CORE run shares one retry, so a cache race in any standard
// cannot reach the recorded-findings comparison.
describe("study-data-core-views.sh cache-race retry", () => {
  it("runs each report once when there is no race", () => {
    const { run, calls } = setup({});
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(calls()).toEqual({
      "default/sdtm": 1,
      "lab-retest/sdtm": 1,
      "default/usdm": 1,
      "default/adam": 1,
      "oncology/usdm": 1,
    });
  });

  it.each(["default/sdtm", "default/usdm", "default/adam", "oncology/usdm"])(
    "reruns %s until the race clears",
    (key) => {
      const { run, calls } = setup({ race: { [key]: 2 } });
      const result = run();
      expect(result.status, result.stderr).toBe(0);
      expect(calls()[key]).toBe(3);
      expect(result.stdout).toContain(
        "hit the engine's cache race (try 2 of 3)"
      );
    }
  );

  it("fails loudly after three races", () => {
    const { run, calls } = setup({ race: { "default/usdm": 3 } });
    const result = run();
    expect(result.status).not.toBe(0);
    expect(calls()["default/usdm"]).toBe(3);
    expect(result.stdout).toContain(
      "CORE hit its cache race on CORE USDM 4.0: default three times (#3869)"
    );
  });

  it("does not retry a CORE crash", () => {
    const { run, calls } = setup({ fail: ["oncology/usdm"] });
    const result = run();
    expect(result.status).not.toBe(0);
    expect(calls()["oncology/usdm"]).toBe(1);
    expect(result.stderr).toContain("engine crashed");
  });
});
