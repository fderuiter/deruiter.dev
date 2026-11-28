import fs from "node:fs";
import path from "node:path";
import type { DiagnosticCheckResult } from "../doctor";
import { shouldSkipWorkspaceDirectory } from "../workspace-config";

/**
 * The most `react-hooks/set-state-in-effect` suppressions allowed across
 * `app/`, `components/`, `hooks/` and `lib/`. It was set to the count on main
 * after the mount-state cleanup (#3478, #3481) and may only go down: lower it
 * when you remove a suppression, never raise it to fit a new one.
 */
export const SET_STATE_IN_EFFECT_CEILING = 44;

const SCANNED_DIRS = ["app", "components", "hooks", "lib"];

function sourceFiles(root: string, dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return shouldSkipWorkspaceDirectory(root, full)
        ? []
        : sourceFiles(root, full);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

/**
 * Counts suppression comments: lines holding `eslint-disable` (any form,
 * including `eslint-disable-next-line` and block comments) that name
 * `react-hooks/set-state-in-effect`. An `eslint-enable` line is not counted.
 *
 * @param root - The workspace root.
 * @returns Each suppression as `file:line`.
 */
export function findSetStateInEffectSuppressions(root: string): string[] {
  return SCANNED_DIRS.flatMap((dir) =>
    sourceFiles(root, path.join(root, dir))
  ).flatMap((file) =>
    fs
      .readFileSync(file, "utf-8")
      .split("\n")
      .flatMap((line, index) =>
        /eslint-disable/.test(line) &&
        line.includes("react-hooks/set-state-in-effect")
          ? [`${path.relative(root, file)}:${index + 1}`]
          : []
      )
  );
}

/**
 * Set-State-in-Effect Suppression Ceiling (AGENTS.md section 4, #3481)
 *
 * Fails when the suppression count rises above
 * {@link SET_STATE_IN_EFFECT_CEILING}, so a new synchronous `setState` in an
 * effect needs a real fix (usually `useSyncExternalStore` or `useIsMounted`)
 * rather than another disable comment.
 *
 * @param root - The workspace root.
 * @param ceiling - The highest allowed count.
 * @returns The check result.
 */
export function checkSetStateInEffectCeiling(
  root: string,
  ceiling = SET_STATE_IN_EFFECT_CEILING
): DiagnosticCheckResult {
  const found = findSetStateInEffectSuppressions(root);
  if (found.length <= ceiling) {
    return {
      id: "set-state-in-effect-ceiling",
      name: "Set-State-in-Effect Suppression Ceiling",
      category: "hydration",
      status: "pass",
      message: `${found.length} react-hooks/set-state-in-effect suppression(s), within the ceiling of ${ceiling}.`,
    };
  }
  return {
    id: "set-state-in-effect-ceiling",
    name: "Set-State-in-Effect Suppression Ceiling",
    category: "hydration",
    status: "fail",
    message: `${found.length} react-hooks/set-state-in-effect suppressions exceed the ceiling of ${ceiling}. Fix the new effect instead of suppressing it.`,
    details: found,
    fixable: false,
  };
}
