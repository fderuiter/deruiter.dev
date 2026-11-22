"use client";

import { useId } from "react";
import {
  DISPLAY_PERSONAS,
  DISPLAY_SEGMENTS,
  resolvePresentation,
  type DisplayPersona,
  type DisplayProfile,
  type DisplaySegment,
} from "@/lib/randomization";

const PERSONA_LABELS: Record<DisplayPersona, string> = {
  Biostatistician: "Biostatistician",
  TrialManager: "Trial manager",
  ComplianceOfficer: "Compliance officer",
};

const SEGMENT_LABELS: Record<DisplaySegment, string> = {
  Sponsor: "Sponsor",
  Academic: "Academic",
  CRO: "CRO",
};

const REASON_COPY = {
  "biostatistician-view":
    "Treatment values are shown, as an unblinded statistician would see them.",
  "academic-unmasked": "Treatment values are shown. You chose to unmask them.",
  "academic-masked":
    "Treatment values are masked. Academic studies can choose to unmask them.",
  "segment-masked":
    "Treatment values are masked. Sponsor and CRO views keep them masked.",
} as const;

/** Props for {@link DisclosureControls}. */
interface DisclosureControlsProps {
  readonly profile: DisplayProfile;
  readonly onChange: (profile: DisplayProfile) => void;
}

/**
 * Persona, organization and unmasking choices for the randomization work
 * area. They change only what this browser displays and grant no access.
 */
export function DisclosureControls({
  profile,
  onChange,
}: DisclosureControlsProps) {
  const baseId = useId();
  const presentation = resolvePresentation(profile);
  const personaId = `${baseId}-persona`;
  const segmentId = `${baseId}-segment`;
  const unblindId = `${baseId}-unblind`;
  const noteId = `${baseId}-note`;

  return (
    <fieldset
      className="min-w-0 rounded-lg border border-zinc-800 bg-[#13151a] p-4 text-[#f4f4f6]"
      aria-describedby={noteId}
      data-testid="randomization-disclosure-controls"
    >
      <legend className="px-1 font-mono text-xs uppercase tracking-wide text-[#94a3b8]">
        Display view
      </legend>
      <div className="grid min-w-0 gap-3 @container @sm:grid-cols-2">
        <label
          className="flex min-w-0 flex-col gap-1 text-sm"
          htmlFor={personaId}
        >
          <span>Persona</span>
          <select
            id={personaId}
            className="min-h-11 rounded-md border border-zinc-800 bg-[#0d0e11] px-3 text-base"
            value={presentation.profile.persona}
            onChange={(event) =>
              onChange({
                ...presentation.profile,
                persona: event.target.value as DisplayPersona,
              })
            }
          >
            {DISPLAY_PERSONAS.map((persona) => (
              <option key={persona} value={persona}>
                {PERSONA_LABELS[persona]}
              </option>
            ))}
          </select>
        </label>
        <label
          className="flex min-w-0 flex-col gap-1 text-sm"
          htmlFor={segmentId}
        >
          <span>Organization</span>
          <select
            id={segmentId}
            className="min-h-11 rounded-md border border-zinc-800 bg-[#0d0e11] px-3 text-base"
            value={presentation.profile.segment}
            onChange={(event) =>
              onChange({
                ...presentation.profile,
                segment: event.target.value as DisplaySegment,
                unblindRequested: false,
              })
            }
          >
            {DISPLAY_SEGMENTS.map((segment) => (
              <option key={segment} value={segment}>
                {SEGMENT_LABELS[segment]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {presentation.canToggleUnblind ? (
        <label
          className="mt-3 flex min-h-11 items-center gap-2 text-sm"
          htmlFor={unblindId}
        >
          <input
            id={unblindId}
            type="checkbox"
            className="size-4 accent-[#f59e0b]"
            checked={presentation.profile.unblindRequested}
            onChange={(event) =>
              onChange({
                ...presentation.profile,
                unblindRequested: event.target.checked,
              })
            }
          />
          <span>Show treatment values</span>
        </label>
      ) : null}
      <p
        id={noteId}
        className="mt-3 text-sm text-[#94a3b8]"
        aria-live="polite"
        data-testid="randomization-disclosure-status"
      >
        {REASON_COPY[presentation.reason]} This is a display preference in your
        browser, not access control. A full JSON file, the seed and settings, or
        a generated script can rebuild every assignment.
      </p>
    </fieldset>
  );
}
