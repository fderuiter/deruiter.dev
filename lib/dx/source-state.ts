import { execFileSync } from "child_process";

/**
 * Committed build products that `npm run build` rewrites in place. They are
 * derived from tracked source, so a rewrite is not a source change and must
 * not make the working tree count as dirty for benchmark evidence (#1377).
 */
export const GENERATED_BUILD_ARTIFACTS: readonly string[] = [
  "public/garmin-engine.js",
  "public/monkey-c-mayhem.js",
];

export interface SourceState {
  revision: string;
  dirty: boolean;
}

/**
 * Reads the checked-out revision and whether tracked or untracked source
 * differs from it, ignoring the generated build artifacts.
 */
export function inspectSourceState(cwd: string = process.cwd()): SourceState {
  const run = (args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
  const revision = run(["rev-parse", "HEAD"]);
  const dirty =
    run([
      "status",
      "--porcelain",
      "--",
      ".",
      ...GENERATED_BUILD_ARTIFACTS.map((file) => `:(exclude)${file}`),
    ]).length > 0;
  return { revision, dirty };
}
