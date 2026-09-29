import { describe, expect, it } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

describe("jscpd Clone Detection Guardrails", () => {
  it("passes cleanly on current repo codebase with zero unbaselined clones", () => {
    let stdout = "";
    try {
      stdout = execSync("npx jscpd", {
        cwd: path.resolve(__dirname, ".."),
        encoding: "utf8",
        env: { ...process.env },
      });
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; status?: number };
      stdout = (execErr.stdout || "") + "\n" + (execErr.stderr || "");
      throw new Error(`jscpd failed when it should pass: ${stdout}`);
    }
    expect(stdout).toContain("Found 0 clones");
  }, 40000);

  it("detects new unbaselined clones added outside an existing ignore block", () => {
    const tmpDir = path.resolve(__dirname, "../tmp-clone-test");
    fs.mkdirSync(tmpDir, { recursive: true });

    const fileA = path.join(tmpDir, "fileA.ts");
    const fileB = path.join(tmpDir, "fileB.ts");

    try {
      fs.writeFileSync(
        fileA,
        `/* jscpd:ignore-start */
export function legacyBaselinedBlockA() {
  const itemA = "first string value to increase token count";
  const itemB = "second string value to increase token count";
  const sumVal = itemA.length + itemB.length;
  return sumVal;
}
/* jscpd:ignore-end */

export function newUnbaselinedCloneA() {
  const newStrA = "another new string value for clone testing";
  const newStrB = "another new string value for clone testing 2";
  const newStrC = "another new string value for clone testing 3";
  const total = newStrA.length + newStrB.length + newStrC.length;
  if (total > 20) {
    console.log("New clone block A", total, newStrA, newStrB);
  }
  return total;
}
`
      );

      fs.writeFileSync(
        fileB,
        `/* jscpd:ignore-start */
export function legacyBaselinedBlockB() {
  const itemA = "first string value to increase token count";
  const itemB = "second string value to increase token count";
  const sumVal = itemA.length + itemB.length;
  return sumVal;
}
/* jscpd:ignore-end */

export function newUnbaselinedCloneB() {
  const newStrA = "another new string value for clone testing";
  const newStrB = "another new string value for clone testing 2";
  const newStrC = "another new string value for clone testing 3";
  const total = newStrA.length + newStrB.length + newStrC.length;
  if (total > 20) {
    console.log("New clone block A", total, newStrA, newStrB);
  }
  return total;
}
`
      );

      let failed = false;
      let output = "";
      try {
        output = execSync(`npx jscpd "${tmpDir}"`, {
          cwd: path.resolve(__dirname, ".."),
          encoding: "utf8",
          env: { ...process.env },
        });
      } catch (err: unknown) {
        failed = true;
        const execErr = err as { stdout?: string; stderr?: string };
        output = (execErr.stdout || "") + "\n" + (execErr.stderr || "");
      }

      expect(failed).toBe(true);
      expect(output).toContain("Found 1 clones");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 30000);
});
