// @vitest-environment node
/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

describe("Package Manager Configuration Invariants", () => {
  const root = process.cwd();

  it("package.json defines packageManager with npm and valid engine specifications", () => {
    const packageJsonPath = path.join(root, "package.json");
    expect(fs.existsSync(packageJsonPath)).toBe(true);

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    expect(packageJson.packageManager).toBeDefined();
    expect(packageJson.packageManager).toMatch(/^npm@\d+\.\d+\.\d+/);
    expect(packageJson.engines?.npm).toBeDefined();
    expect(packageJson.engines?.node).toBeDefined();
  });

  describe("scripts/enforce-npm.js execution", () => {
    let originalEnv: NodeJS.ProcessEnv;
    let exitMock: ReturnType<typeof vi.spyOn>;
    let consoleErrorMock: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      originalEnv = { ...process.env };
      exitMock = vi.spyOn(process, "exit").mockImplementation((code) => {
        throw new Error(`Process exited with code ${code}`);
      });
      consoleErrorMock = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
    });

    afterEach(() => {
      process.env = originalEnv;
      exitMock.mockRestore();
      consoleErrorMock.mockRestore();
    });

    it("allows execution when npm_config_user_agent starts with npm/", () => {
      process.env.npm_config_user_agent =
        "npm/10.9.2 node/v20.18.0 darwin arm64";
      delete require.cache[require.resolve("../scripts/enforce-npm.js")];

      expect(() => {
        require("../scripts/enforce-npm.js");
      }).not.toThrow();
    });

    it("blocks execution when npm_config_user_agent indicates bun", () => {
      process.env.npm_config_user_agent = "bun/1.3.14 npm/? node/v20.18.0";
      delete require.cache[require.resolve("../scripts/enforce-npm.js")];

      expect(() => {
        require("../scripts/enforce-npm.js");
      }).toThrow("Process exited with code 1");

      expect(consoleErrorMock).toHaveBeenCalled();
    });

    it("blocks execution when npm_config_user_agent indicates yarn or pnpm", () => {
      process.env.npm_config_user_agent = "yarn/1.22.19 npm/? node/v20.18.0";
      delete require.cache[require.resolve("../scripts/enforce-npm.js")];

      expect(() => {
        require("../scripts/enforce-npm.js");
      }).toThrow("Process exited with code 1");

      process.env.npm_config_user_agent = "pnpm/9.0.0 npm/? node/v20.18.0";
      delete require.cache[require.resolve("../scripts/enforce-npm.js")];

      expect(() => {
        require("../scripts/enforce-npm.js");
      }).toThrow("Process exited with code 1");
    });
    it("warns but does not block an install on native Windows (#939)", () => {
      process.env.npm_config_user_agent = "npm/10.9.2 node/v22.0.0 win32 x64";
      const platform = vi
        .spyOn(process, "platform", "get")
        .mockReturnValue("win32");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      delete require.cache[require.resolve("../scripts/enforce-npm.js")];
      try {
        expect(() => {
          require("../scripts/enforce-npm.js");
        }).not.toThrow();
        expect(warn.mock.calls.flat().join(" ")).toContain("WSL 2");
      } finally {
        platform.mockRestore();
        warn.mockRestore();
      }
    });
  });
});
