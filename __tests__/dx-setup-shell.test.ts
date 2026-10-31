// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { satisfiesVersionRange } from "@/lib/dx/preflight";

const ROOT = process.cwd();
const SCRIPTS = [
  "scripts/setup.sh",
  "scripts/setup-clerk-wizard.sh",
  "scripts/lib/wizard-ui.sh",
  "scripts/lib/setup-checks.sh",
];

function toBashPath(targetPath: string): string {
  if (process.platform === "win32") {
    const match = targetPath.match(/^([a-zA-Z]):[\\/](.*)$/);
    if (match) {
      const drive = match[1].toLowerCase();
      const rest = match[2].replace(/\\/g, "/");
      return `/mnt/${drive}/${rest}`;
    }
  }
  return targetPath;
}

function bash(snippet: string): string {
  return execFileSync(
    "bash",
    ["-c", `. scripts/lib/setup-checks.sh; ${snippet}`],
    { cwd: ROOT, encoding: "utf-8" }
  ).trim();
}

const hasShellcheck =
  spawnSync("shellcheck", ["--version"], { stdio: "ignore" }).status === 0;

describe("setup shell entrypoint (#982, #985)", { timeout: 60000 }, () => {
  it.each(SCRIPTS)("%s parses with bash -n", (script) => {
    expect(() =>
      execFileSync("bash", ["-n", script], { cwd: ROOT, stdio: "pipe" })
    ).not.toThrow();
  });

  it.skipIf(!hasShellcheck).each(SCRIPTS)("%s passes ShellCheck", (script) => {
    const result = spawnSync("shellcheck", ["-x", "-S", "warning", script], {
      cwd: ROOT,
      encoding: "utf-8",
    });
    expect(result.stdout).toBe("");
  });

  it.skipIf(process.platform === "win32")(
    "keeps the entrypoints executable",
    () => {
      for (const script of [
        "scripts/setup.sh",
        "scripts/setup-clerk-wizard.sh",
      ]) {
        expect(fs.statSync(path.join(ROOT, script)).mode & 0o111).not.toBe(0);
      }
    }
  );

  it("evaluates version ranges exactly like satisfiesVersionRange", () => {
    const cases: [string, string][] = [
      ["v24.1.0", ">=22.0.0 <25.0.0"],
      ["v25.0.0", ">=22.0.0 <25.0.0"],
      ["v22.0.0", ">=22.0.0 <25.0.0"],
      ["21.9.9", ">=22.0.0 <25.0.0"],
      ["10.9.2", ">=10.0.0"],
      ["9.8.1", ">=10.0.0"],
      ["20.1.0", "=18 || >=20"],
      ["19.0.0", "=18 || >=20"],
      ["18.0.0", "=18 || >=20"],
      ["18.2.0", "^18"],
      ["19.0.0", "^18"],
      ["0.2.5", "^0.2.3"],
      ["0.3.0", "^0.2.3"],
      ["0.0.4", "^0.0.3"],
      ["1.2.9", "~1.2.3"],
      ["1.3.0", "~1.2.3"],
      ["1.9.0", "~1"],
      ["22.22.0", "22.x"],
      ["23.0.0", "22.x"],
      ["22.1.0", "=22"],
      ["22.9.0", ">22"],
      ["23.0.0", ">22"],
      ["22.9.0", "<=22"],
      ["23.0.0", "<=22"],
      ["5.0.0", "*"],
      ["22.4.1-rc.1", ">22.4.0"],
      ["1.2.3", "<=1.2.3"],
      ["1.2.4", "<=1.2.3"],
    ];
    for (const [version, range] of cases) {
      const shell =
        bash(
          `setup_satisfies_range '${version}' '${range}' && echo yes || echo no`
        ) === "yes";
      expect([version, range, shell]).toEqual([
        version,
        range,
        satisfiesVersionRange(version, range),
      ]);
    }
  });

  it("reads engines and packageManager from package.json without Node", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf-8")
    );
    expect(bash("setup_read_engine node package.json")).toBe(pkg.engines.node);
    expect(bash("setup_read_engine npm package.json")).toBe(pkg.engines.npm);
    expect(bash("setup_read_package_manager package.json")).toBe(
      pkg.packageManager
    );
  });

  it("recommends the newest LTS major the engines range allows", () => {
    expect(bash("setup_recommended_node_major '>=22.0.0 <25.0.0'")).toBe("24");
    expect(bash("setup_recommended_node_major '>=18.0.0 <21.0.0'")).toBe("20");
  });

  it("prints copyable remediation for each supported platform without running it", () => {
    expect(bash("setup_remedy_node macos other 24")).toContain(
      "brew install node@24"
    );
    expect(bash("setup_remedy_node linux debian 24")).toContain(
      "deb.nodesource.com/setup_24.x"
    );
    expect(bash("setup_remedy_node wsl debian 24")).toContain("apt-get");
    expect(bash("setup_remedy_node windows other 24")).toContain(
      "wsl --install"
    );
    expect(bash("setup_remedy_git linux fedora")).toBe(
      "sudo dnf install -y git"
    );
  });

  it("escapes JSON strings", () => {
    expect(bash(`setup_json_escape 'say "hi" \\ there'`)).toBe(
      'say \\"hi\\" \\\\ there'
    );
  });

  it("detects husky status via setup_detect_husky_status (#3616)", () => {
    const scratch = fs.mkdtempSync(
      path.join(os.tmpdir(), "setup-detect-husky-")
    );
    try {
      spawnSync("git", ["init", "-q", scratch]);
      fs.mkdirSync(path.join(scratch, ".husky"), { recursive: true });
      fs.writeFileSync(
        path.join(scratch, ".husky", "pre-commit"),
        "#!/bin/sh\nexit 0\n"
      );
      expect(bash(`setup_detect_husky_status '${scratch}'`)).toBe(
        "uninitialized"
      );

      spawnSync("git", ["-C", scratch, "config", "core.hooksPath", ".husky/_"]);
      fs.mkdirSync(path.join(scratch, ".husky", "_"), { recursive: true });
      fs.writeFileSync(path.join(scratch, ".husky", "_", "h"), "#!/bin/sh\n");
      fs.writeFileSync(
        path.join(scratch, ".husky", "_", "pre-commit"),
        "#!/bin/sh\n"
      );
      expect(bash(`setup_detect_husky_status '${scratch}'`)).toBe("active");

      spawnSync("git", [
        "-C",
        scratch,
        "config",
        "core.hooksPath",
        "/custom/hooks",
      ]);
      expect(bash(`setup_detect_husky_status '${scratch}'`)).toBe("custom");

      expect(bash(`HUSKY=0 setup_detect_husky_status '${scratch}'`)).toBe(
        "disabled"
      );
      expect(bash(`HUSKY=false setup_detect_husky_status '${scratch}'`)).toBe(
        "disabled"
      );
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  });

  describe("in a fresh workspace", () => {
    let dir: string;

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-setup-shell-"));
      fs.mkdirSync(path.join(dir, "scripts", "lib"), { recursive: true });
      for (const script of [
        "scripts/setup.sh",
        "scripts/lib/wizard-ui.sh",
        "scripts/lib/setup-checks.sh",
      ]) {
        fs.copyFileSync(path.join(ROOT, script), path.join(dir, script));
      }
      fs.copyFileSync(
        path.join(ROOT, "package.json"),
        path.join(dir, "package.json")
      );
    });

    afterEach(() => {
      try {
        fs.rmSync(dir, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 100,
        });
      } catch {
        // Ignore busy file locks on Windows cleanup
      }
    });

    const runSetup = (...args: string[]) =>
      spawnSync(
        "bash",
        [toBashPath(path.join(dir, "scripts", "setup.sh")), ...args],
        {
          cwd: os.tmpdir(),
          encoding: "utf-8",
          env: { ...process.env, CI: "" },
        }
      );

    it("prints help and exits 0", () => {
      const result = runSetup("--help");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("--non-interactive");
      expect(result.stdout).toContain("--resume");
    });

    it("resolves the repository root from its own location and installs nothing in a dry run", () => {
      const result = runSetup("--dry-run", "--json", "--non-interactive");
      expect(result.status).toBe(0);
      const summary = JSON.parse(result.stdout);
      expect(summary.success).toBe(true);
      expect(
        summary.data.stages.map((stage: { id: string; status: string }) => [
          stage.id,
          stage.status,
        ])
      ).toEqual([
        ["platform", "completed"],
        ["toolchain", "completed"],
        ["dependencies", "skipped"],
      ]);
      expect(fs.existsSync(path.join(dir, "node_modules"))).toBe(false);
      expect(result.stderr).toContain("Dry run: would run npm ci.");
    });

    it("fails the toolchain stage with remediation when Node is outside engines", () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(dir, "package.json"), "utf-8")
      );
      pkg.engines.node = ">=99.0.0";
      fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg));
      const result = runSetup("--json", "--non-interactive");
      expect(result.status).toBe(1);
      const summary = JSON.parse(result.stdout);
      expect(summary.data.stages.at(-1)).toMatchObject({
        id: "toolchain",
        status: "failed",
      });
      expect(result.stderr).toContain("fnm install");
    });

    it("repairs a missing Prisma client in an existing install", () => {
      const bin = path.join(dir, "node_modules", ".bin");
      fs.mkdirSync(bin, { recursive: true });
      fs.writeFileSync(path.join(dir, "package-lock.json"), "{}");
      fs.writeFileSync(
        path.join(dir, "node_modules", ".package-lock.json"),
        "{}"
      );
      const future = new Date(Date.now() + 5000);
      fs.utimesSync(
        path.join(dir, "node_modules", ".package-lock.json"),
        future,
        future
      );
      fs.writeFileSync(path.join(bin, "tsx"), "#!/bin/sh\nexit 0\n", {
        mode: 0o755,
      });
      const fakeBin = path.join(dir, "fake-bin");
      fs.mkdirSync(fakeBin);
      fs.writeFileSync(
        path.join(fakeBin, "npx"),
        "#!/bin/sh\nmkdir -p app/generated/prisma\ntouch app/generated/prisma/client.ts\n",
        { mode: 0o755 }
      );
      if (process.platform === "win32") {
        spawnSync("bash", [
          "-c",
          `chmod +x '${toBashPath(path.join(bin, "tsx"))}' '${toBashPath(path.join(fakeBin, "npx"))}'`,
        ]);
      }
      fs.writeFileSync(path.join(dir, "tsconfig.tsbuildinfo"), "stale");
      const result = spawnSync(
        "bash",
        [
          "-c",
          `export PATH="${toBashPath(fakeBin)}:$PATH"; "${toBashPath(path.join(dir, "scripts/setup.sh"))}" --non-interactive`,
        ],
        {
          cwd: dir,
          encoding: "utf-8",
          env: {
            ...process.env,
            CI: "",
          },
        }
      );
      expect(result.status).toBe(0);
      expect(
        fs.existsSync(path.join(dir, "app/generated/prisma/client.ts"))
      ).toBe(true);
      expect(fs.existsSync(path.join(dir, "tsconfig.tsbuildinfo"))).toBe(false);
    });

    it.skipIf(process.platform === "win32")(
      "never runs npm ci through a symlinked node_modules",
      () => {
        const shared = fs.mkdtempSync(path.join(os.tmpdir(), "dx-shared-nm-"));
        fs.writeFileSync(path.join(shared, "keep.txt"), "shared install");
        fs.symlinkSync(shared, path.join(dir, "node_modules"));
        const result = runSetup("--json", "--non-interactive");
        expect(fs.readFileSync(path.join(shared, "keep.txt"), "utf-8")).toBe(
          "shared install"
        );
        const summary = JSON.parse(result.stdout);
        expect(summary.data.stages[2]).toMatchObject({
          id: "dependencies",
          status: "failed",
        });
        expect(summary.data.stages[2].detail).toContain("symlink");
        expect(result.status).toBe(1);
        fs.rmSync(shared, { recursive: true, force: true });
      }
    );

    it("repairs uninitialized Husky hooks when dependencies are reused (#3616)", () => {
      const bin = path.join(dir, "node_modules", ".bin");
      fs.mkdirSync(bin, { recursive: true });
      fs.writeFileSync(path.join(dir, "package-lock.json"), "{}");
      fs.writeFileSync(
        path.join(dir, "node_modules", ".package-lock.json"),
        "{}"
      );
      const future = new Date(Date.now() + 5000);
      fs.utimesSync(
        path.join(dir, "node_modules", ".package-lock.json"),
        future,
        future
      );
      fs.writeFileSync(path.join(bin, "tsx"), "#!/bin/sh\nexit 0\n", {
        mode: 0o755,
      });
      fs.mkdirSync(path.join(dir, "app", "generated", "prisma"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(dir, "app", "generated", "prisma", "client.ts"),
        "// client"
      );

      spawnSync("git", ["init", "-q", dir]);
      fs.mkdirSync(path.join(dir, ".husky"), { recursive: true });
      fs.writeFileSync(
        path.join(dir, ".husky", "pre-commit"),
        "#!/bin/sh\nexit 0\n"
      );

      fs.writeFileSync(
        path.join(bin, "husky"),
        "#!/bin/sh\ngit config core.hooksPath .husky/_\nmkdir -p .husky/_\ntouch .husky/_/h .husky/_/pre-commit\n",
        { mode: 0o755 }
      );

      const result = spawnSync(
        "bash",
        [toBashPath(path.join(dir, "scripts/setup.sh")), "--non-interactive"],
        {
          cwd: dir,
          encoding: "utf-8",
          env: { ...process.env, CI: "" },
        }
      );
      expect(result.status).toBe(0);
      expect(fs.existsSync(path.join(dir, ".husky", "_", "h"))).toBe(true);
      const hooksPath = spawnSync(
        "git",
        ["-C", dir, "config", "--get", "core.hooksPath"],
        { encoding: "utf-8" }
      ).stdout.trim();
      expect(hooksPath).toBe(".husky/_");
    });

    it("respects HUSKY=0 and custom hooksPath in setup (#3616)", () => {
      const bin = path.join(dir, "node_modules", ".bin");
      fs.mkdirSync(bin, { recursive: true });
      fs.writeFileSync(path.join(dir, "package-lock.json"), "{}");
      fs.writeFileSync(
        path.join(dir, "node_modules", ".package-lock.json"),
        "{}"
      );
      const future = new Date(Date.now() + 5000);
      fs.utimesSync(
        path.join(dir, "node_modules", ".package-lock.json"),
        future,
        future
      );
      fs.writeFileSync(path.join(bin, "tsx"), "#!/bin/sh\nexit 0\n", {
        mode: 0o755,
      });
      fs.mkdirSync(path.join(dir, "app", "generated", "prisma"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(dir, "app", "generated", "prisma", "client.ts"),
        "// client"
      );

      spawnSync("git", ["init", "-q", dir]);
      fs.mkdirSync(path.join(dir, ".husky"), { recursive: true });
      fs.writeFileSync(
        path.join(dir, ".husky", "pre-commit"),
        "#!/bin/sh\nexit 0\n"
      );
      spawnSync("git", [
        "-C",
        dir,
        "config",
        "core.hooksPath",
        "/custom/hooks",
      ]);

      // Mock husky that would fail if called
      fs.writeFileSync(
        path.join(bin, "husky"),
        "#!/bin/sh\necho 'ERROR: husky called'\nexit 1\n",
        { mode: 0o755 }
      );

      const result = spawnSync(
        "bash",
        [toBashPath(path.join(dir, "scripts/setup.sh")), "--non-interactive"],
        {
          cwd: dir,
          encoding: "utf-8",
          env: { ...process.env, CI: "" },
        }
      );
      expect(result.status).toBe(0);
      const hooksPath = spawnSync(
        "git",
        ["-C", dir, "config", "--get", "core.hooksPath"],
        { encoding: "utf-8" }
      ).stdout.trim();
      expect(hooksPath).toBe("/custom/hooks");
    });
  });
});
