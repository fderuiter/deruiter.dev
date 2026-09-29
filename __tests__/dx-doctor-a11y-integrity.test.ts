import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { checkAccessibilityAuditIntegrity } from "@/lib/dx/doctor";

describe("checkAccessibilityAuditIntegrity", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-a11y-integrity-"));
    fs.mkdirSync(path.join(tempDir, "__tests__", "e2e"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const writeSpec = (content: string) =>
    fs.writeFileSync(
      path.join(tempDir, "__tests__", "e2e", "a11y.spec.ts"),
      content
    );

  const writeReport = (name: string, content: string) => {
    const dir = path.join(
      tempDir,
      "playwright-report",
      "accessibility-results"
    );
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  };

  it("passes on a fresh checkout with no scan reports", () => {
    writeSpec("await new AxeBuilder({ page }).analyze();");
    expect(checkAccessibilityAuditIntegrity(tempDir).status).toBe("pass");
  });

  it("fails when a test suite disables an axe rule", () => {
    writeSpec('builder.disableRules(["color-contrast"]);');
    const result = checkAccessibilityAuditIntegrity(tempDir);
    expect(result.status).toBe("fail");
    expect(result.details?.[0]).toContain("a11y.spec.ts");
  });

  it("fails when a local scan report records violations", () => {
    writeSpec("await new AxeBuilder({ page }).analyze();");
    writeReport(
      "home.json",
      JSON.stringify({ state: "Home", violations: [{}] })
    );
    const result = checkAccessibilityAuditIntegrity(tempDir);
    expect(result.status).toBe("fail");
    expect(result.details?.[0]).toContain("1 WCAG violation");
  });

  it("passes when local scan reports are clean", () => {
    writeSpec("await new AxeBuilder({ page }).analyze();");
    writeReport("home.json", JSON.stringify({ violationsCount: 0 }));
    expect(checkAccessibilityAuditIntegrity(tempDir).status).toBe("pass");
  });

  it("fails on an unreadable scan report", () => {
    writeSpec("await new AxeBuilder({ page }).analyze();");
    writeReport("broken.json", "{");
    expect(checkAccessibilityAuditIntegrity(tempDir).status).toBe("fail");
  });
});
