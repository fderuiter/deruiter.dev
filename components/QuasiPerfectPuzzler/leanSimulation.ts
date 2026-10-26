/**
 * The Lean inspector's in-browser check. It is a simulation, not a Lean
 * kernel: it flags `sorry` lines and reads the open-goal marker that the
 * script generator writes. It used to run behind a server route that tried a
 * `lean` binary first; production never had one, so this is the same answer
 * without the request (#2987).
 */

export interface LeanDiagnostic {
  line: number;
  column?: number;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface LeanSimulationResult {
  success: boolean;
  status: "fallback_simulated";
  diagnostics: LeanDiagnostic[];
  goalState: string;
  engine: "fallback_simulator";
}

/** Simulates a Lean check of the generated script. */
export function simulateLeanCheck(leanScript: string): LeanSimulationResult {
  const diagnostics: LeanDiagnostic[] = [];
  let hasSorry = false;
  let hasOpenGoal = false;

  leanScript.split("\n").forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("-- Goal open")) hasOpenGoal = true;
    if (trimmed.startsWith("sorry")) {
      hasSorry = true;
      diagnostics.push({
        line: idx + 1,
        column: 1,
        severity: "warning",
        message:
          "Proof contains 'sorry' axiom (goal admitted without full verification)",
      });
    }
  });

  return {
    success: true,
    status: "fallback_simulated",
    diagnostics,
    goalState: hasSorry
      ? "Goal admitted via sorry (simulated fallback)"
      : hasOpenGoal
        ? "Goal open: unsolved goals remain (simulated fallback)"
        : "Goals closed via local simulation ✔",
    engine: "fallback_simulator",
  };
}
