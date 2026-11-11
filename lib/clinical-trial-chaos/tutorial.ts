import type { TutorialScript } from "@/lib/arcade";
import type { PowerUpInventory } from "./types";

/**
 * The signals Clinical Trial Chaos sends its tutorial (#3458): the player
 * cycled the queue, opened a flagged field, validated it, fired a lifeline,
 * and routed and signed a clean dossier.
 */
export const CLINICAL_CHAOS_TUTORIAL_SIGNALS = {
  cycle: "cycle",
  open: "open",
  validate: "validate",
  lifeline: "lifeline",
  submit: "submit",
} as const;

const S = CLINICAL_CHAOS_TUTORIAL_SIGNALS;

/**
 * Fills every lifeline, so the practice shift can fire one without first
 * earning the charge.
 *
 * @param inventory - The lifelines as the shift started them.
 * @returns The same lifelines, each at full charge.
 */
export function chargeTutorialLifelines(
  inventory: PowerUpInventory
): PowerUpInventory {
  const charged = { ...inventory };
  for (const key of Object.keys(charged) as Array<keyof PowerUpInventory>) {
    charged[key] = { ...charged[key], charge: charged[key].maxCharge };
  }
  return charged;
}

/**
 * Clinical Trial Chaos's guided tutorial (#3458). It runs a practice Phase I
 * shift whose clocks stand still: no deadline runs out, no new dossier
 * arrives and nothing it scores is saved. It teaches the loop by doing:
 * cycle the queue, open a flagged field, fix it, fire a lifeline, and route
 * and sign the clean dossier. It skips the first shift's calibration,
 * which teaches the same loop. The keys match the Field Manual.
 */
export const CLINICAL_CHAOS_TUTORIAL: TutorialScript = {
  gameId: "clinical-chaos",
  version: 1,
  minutes: 3,
  steps: [
    {
      id: "welcome",
      chapter: "The shift",
      title: "Clean dossiers, route them, sign",
      body: "Case report forms arrive from the sites with data-entry errors. You fix each flagged field, route the clean dossier to its SDTM domain desk, and sign it. On this practice shift the clocks stand still.",
    },
    {
      id: "cycle",
      chapter: "The queue",
      title: "Look through the queue",
      body: "The queue holds every dossier waiting for you. Move to another one.",
      keys: "← or →",
      touch: "Tap a dossier in the queue",
      target: "queue",
      practice: { signal: S.cycle },
    },
    {
      id: "open",
      chapter: "Validate",
      title: "Open a flagged field",
      body: "Choose a dossier with a flagged field and open the next field to fix.",
      keys: "Enter, or click the flagged field",
      touch: "Tap the flagged field",
      practice: { signal: S.open },
    },
    {
      id: "validate",
      chapter: "Validate",
      title: "Fix it",
      body: "Read the raw entry, work out the data-entry error and pick the corrected value. A wrong pick raises the auditor's suspicion.",
      keys: "The number keys, or click an answer",
      touch: "Tap an answer",
      practice: { signal: S.validate },
    },
    {
      id: "lifeline",
      chapter: "Lifelines",
      title: "Fire a lifeline",
      body: "Lifelines charge as you work, and they are full for this shift. The FDA Coffee Break (Q) sends the auditor away for a while. Auto-Clean (W) fixes every flagged field on the open dossier at once.",
      keys: "Q, W, E or R",
      touch: "A lifeline button",
      target: "lifelines",
      practice: { signal: S.lifeline },
    },
    {
      id: "submit",
      chapter: "Route and sign",
      title: "Route it and sign",
      body: "Send the clean dossier to the desk of its domain. If the signature dialog opens, sign with Enter.",
      keys: "1 to 8, then Enter",
      touch: "Tap a station, then Sign",
      practice: { signal: S.submit },
    },
    {
      id: "auditor",
      chapter: "The real shift",
      title: "Watch the auditor",
      body: "On a real shift every dossier has a deadline, new ones keep arriving, and wrong routes and late forms raise the auditor's suspicion. At full suspicion the shift ends.",
    },
    {
      id: "done",
      chapter: "The real shift",
      title: "Clock in",
      body: "A campaign runs three phases, each opening more domain desks. The Field Manual has the domains and the rules.",
    },
  ],
};
