#!/usr/bin/env node
/**
 * Production-safe postinstall hook.
 *
 * Runs `prisma generate` and `scripts/oss-credits.ts` during full development
 * and CI installs, and exits 0 cleanly when dev dependencies are omitted
 * (`npm ci --omit=dev`) or when local `prisma` and `tsx` binaries are absent.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * True when npm is omitting devDependencies or required local dev binaries
 * (`prisma`, `tsx`) are not installed.
 *
 * @param {{ env?: Record<string, string | undefined>; root?: string; platform?: NodeJS.Platform }} [options]
 */
export function shouldSkipPostinstall(options = {}) {
  const env = options.env ?? process.env;
  const root = options.root ?? ROOT;
  const platform = options.platform ?? process.platform;

  const omitTokens = String(env.npm_config_omit ?? "")
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (omitTokens.includes("dev") || env.npm_config_production === "true") {
    return true;
  }

  const ext = platform === "win32" ? ".cmd" : "";
  const prismaBin = path.join(root, "node_modules", ".bin", `prisma${ext}`);
  const tsxBin = path.join(root, "node_modules", ".bin", `tsx${ext}`);
  return !fs.existsSync(prismaBin) || !fs.existsSync(tsxBin);
}

export function runPostinstall(root = ROOT) {
  if (shouldSkipPostinstall({ root })) {
    console.log(
      "postinstall: dev dependencies omitted or absent; skipping prisma generate and oss-credits."
    );
    return;
  }

  const ext = process.platform === "win32" ? ".cmd" : "";
  const prismaBin = path.join(root, "node_modules", ".bin", `prisma${ext}`);
  execFileSync(prismaBin, ["generate"], {
    cwd: root,
    stdio: "inherit",
  });
  execFileSync(
    process.execPath,
    ["--import", "tsx", path.join(root, "scripts", "oss-credits.ts")],
    {
      cwd: root,
      stdio: "inherit",
    }
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runPostinstall();
}
