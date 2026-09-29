/**
 * Pure helpers for the constrained NeuroRecon terminal simulation.
 */

import type { QAMetrics, ScenarioConfig } from "./types";

/** recon-all stage flags the simulator recognises. */
export const NEURO_RECON_STAGE_FLAGS = [
  "-all",
  "-autorecon-all",
  "-autorecon2",
  "-autorecon2-cp",
  "-autorecon2-wm",
  "-autorecon3",
] as const;

/** Modifier flags accepted for syntax only; they do not change the simulation. */
export const NEURO_RECON_MODIFIER_FLAGS = ["-fix-topology"] as const;

/** Commands the simulated terminal models. */
export const NEURO_TERMINAL_COMMANDS = [
  "recon-all [-s <subject>] [stage flag]",
  "freeview -f <mesh>",
  "stats",
  "euler",
  "cp list",
  "dataset [cases|mni152|oasis]",
  "help",
  "clear",
] as const;

/** One-line notice identifying the terminal as a constrained simulation. */
export const NEURO_TERMINAL_SIMULATION_NOTICE =
  "Constrained simulation: only the commands listed by 'help' are modeled. Every recon-all stage runs the same simulated repair check on your current edits.";

/** Result of parsing a recon-all command line. */
export type ReconAllParse =
  | { ok: true; stage: string | null; subject: string | null }
  | { ok: false; error: string };

/** Validate a recon-all command line against the modeled options. */
export function parseReconAllCommand(cmd: string): ReconAllParse {
  const tokens = cmd.trim().toLowerCase().split(/\s+/);
  if (tokens[0] !== "recon-all") {
    return { ok: false, error: `Not a recon-all command: '${cmd}'.` };
  }
  let stage: string | null = null;
  let subject: string | null = null;
  const supported = NEURO_RECON_STAGE_FLAGS.join(", ");
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "-s" || t === "-subject") {
      const name = tokens[i + 1];
      if (!name || name.startsWith("-")) {
        return {
          ok: false,
          error: `recon-all: option ${t} needs a subject name.`,
        };
      }
      subject = name;
      i++;
    } else if ((NEURO_RECON_STAGE_FLAGS as readonly string[]).includes(t)) {
      if (stage) {
        return {
          ok: false,
          error: `recon-all: only one stage flag is modeled (got ${stage} and ${t}).`,
        };
      }
      stage = t;
    } else if ((NEURO_RECON_MODIFIER_FLAGS as readonly string[]).includes(t)) {
      continue;
    } else {
      return {
        ok: false,
        error: `recon-all: option '${t}' is not modeled by this simulator. Supported: -s <subject>, ${supported}, ${NEURO_RECON_MODIFIER_FLAGS.join(", ")} (syntax only).`,
      };
    }
  }
  return { ok: true, stage, subject };
}

/** Diagnostic lines for a scenario, generated from its current QA state. */
export function formatScenarioDiagnostics(
  scenario: Pick<ScenarioConfig, "title" | "targetEuler">,
  metrics: Pick<QAMetrics, "eulerCharacteristic" | "defectCount">
): string {
  return `Estimated Euler χ = ${metrics.eulerCharacteristic}, target = ${scenario.targetEuler}. ${metrics.defectCount} estimated defect units for ${scenario.title}.`;
}
