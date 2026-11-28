import { execFileSync } from "child_process";

/**
 * Committed build products that `npm run build` rewrites in place. Empty now
 * that standalone bundles live under `.next/standalone-engine/`.
 */
export const GENERATED_BUILD_ARTIFACTS: readonly string[] = [];

export interface SourceState {
  revision: string;
  dirty: boolean;
}

/**
 * Reads the checked-out revision and whether tracked or untracked source
 * differs from it, ignoring the generated build artifacts.
 */
export function inspectSourceState(
  cwd: string = process.cwd(),
  excludedArtifacts: readonly string[] = GENERATED_BUILD_ARTIFACTS
): SourceState {
  const run = (args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
  const revision = run(["rev-parse", "HEAD"]);
  const dirty =
    run([
      "status",
      "--porcelain",
      "--",
      ".",
      ...excludedArtifacts.map((file) => `:(exclude)${file}`),
    ]).length > 0;
  return { revision, dirty };
}
