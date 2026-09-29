import { describe, it, expect } from "vitest";
import { scanText, scanFile, shouldScanFile } from "../lib/security-scan";

describe("Static Regex Guards - scanText", () => {
  it("detects database connection string pattern with credentials", () => {
    const text = [
      "We connected using postgresql",
      "://admin:superSecretPass123@db.example.net:5432/production",
    ].join("");
    const matches = scanText(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].detectorId).toBe("database-url-credentialed");
    expect(matches[0].line).toBe(1);
  });

  it("detects database connection string pattern without credentials", () => {
    const text =
      "Connecting to postgresql://db.fixture.internal:5432/my_local_db";
    const matches = scanText(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].detectorId).toBe("database-url-bare");
    expect(matches[0].line).toBe(1);
  });

  it("detects generic secret and password patterns with high entropy", () => {
    const text = `
      const config = {
        api_key: "abc123xyz456foo199",
        someOtherField: "normal value"
      };
    `;
    const matches = scanText(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].detectorId).toBe("generic-assigned-secret");
    expect(matches[0].line).toBe(3);
  });

  it("detects AWS Access Keys", () => {
    const key = ["AKIA", "ABCDEFGHIJKLMNOP"].join("");
    const text = `Set environment variable AWS_ACCESS_KEY_ID = ${key}`;
    const matches = scanText(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].detectorId).toBe("aws-access-key");
    expect(matches[0].line).toBe(1);
  });

  it("detects GitHub Access Tokens", () => {
    const token = ["ghp_", "ABCDEFGHIJKLMNOPQRSTUVWXYZ01234"].join("");
    const text = `Check out using token: ${token}`;
    const matches = scanText(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].detectorId).toBe("github-token");
    expect(matches[0].line).toBe(1);
  });

  it("detects Private Keys", () => {
    const text = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0G...
-----END RSA PRIVATE KEY-----
    `;
    const matches = scanText(text, "some/other/file.ts");
    expect(matches).toHaveLength(1);
    expect(matches[0].detectorId).toBe("private-key-pem");
    expect(matches[0].line).toBe(2);
  });

  it("does not trigger on safe text and code", () => {
    const text = `
      import dotenv from "dotenv";
      const connectionString = process.env.DATABASE_URL;
      const api_key = "short"; // Too short to match high entropy regex limit of 16
      console.log("Welcome to the Portfolio App");
    `;
    const matches = scanText(text);
    expect(matches).toHaveLength(0);
  });

  it("detects generic secret patterns in template literals (backticks)", () => {
    const text = "const api_key = `superSecretToken12345`;";
    const matches = scanText(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].detectorId).toBe("generic-assigned-secret");
    expect(matches[0].line).toBe(1);
  });

  it("allows the AWS-published example key (well-known, not a real credential)", () => {
    const text =
      "Set environment variable AWS_ACCESS_KEY_ID = AKIAIOSFODNN7EXAMPLE";
    const matches = scanText(text);
    expect(matches).toHaveLength(0);
  });

  it("handles scanFile on non-existent or empty files gracefully", () => {
    const matchesNonExistent = scanFile("this-file-does-not-exist.txt");
    expect(matchesNonExistent).toEqual([]);
  });

  describe("Pre-Commit Git Guard - shouldScanFile", () => {
    it("returns false for ignored extensions", () => {
      expect(shouldScanFile("image.png")).toBe(false);
      expect(shouldScanFile("icon.ico")).toBe(false);
      expect(shouldScanFile("video.mp4")).toBe(false);
    });

    it("returns false for ignored file names", () => {
      expect(shouldScanFile("package-lock.json")).toBe(false);
      expect(shouldScanFile("bun.lock")).toBe(false);
    });

    it("returns false for ignored directories", () => {
      expect(shouldScanFile("node_modules/lodash/index.js")).toBe(false);
      expect(shouldScanFile("foo/node_modules/bar.js")).toBe(false);
      expect(shouldScanFile(".next/server/page.js")).toBe(false);
      expect(shouldScanFile("__tests__/validation.test.ts")).toBe(false);
    });

    it("returns false for dotenv files", () => {
      expect(shouldScanFile(".env.example")).toBe(false);
      expect(shouldScanFile(".env.local")).toBe(false);
    });

    it("returns true for regular source files", () => {
      expect(shouldScanFile("lib/auth.ts")).toBe(true);
      expect(shouldScanFile("app/dashboard/page.tsx")).toBe(true);
      expect(shouldScanFile("scripts/seed.js")).toBe(true);
    });
  });
});
