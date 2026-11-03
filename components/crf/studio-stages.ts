import type { StudioMode } from "@/lib/crf";

/**
 * The studio's seven modes grouped into the three stages an author works
 * through (#2927 item 12, #2680): design the forms and their logic, schedule
 * them against visits, then verify the build and ship it. The mode bar, the
 * phone mode picker and the number-key shortcuts all read this order.
 */
type StudioStageId = "design" | "schedule" | "verify";

interface StudioStage {
  id: StudioStageId;
  label: string;
  modes: readonly StudioMode[];
}

export const STUDIO_STAGES: readonly StudioStage[] = [
  { id: "design", label: "Design", modes: ["designer", "grid", "rules"] },
  { id: "schedule", label: "Schedule", modes: ["matrix"] },
  { id: "verify", label: "Verify and ship", modes: ["edc", "acrf", "export"] },
];

/** Every mode in stage order; a mode's shortcut is its position plus one. */
export const STUDIO_MODE_ORDER: readonly StudioMode[] = STUDIO_STAGES.flatMap(
  (stage) => stage.modes
);

export const MODE_BY_KEY: Readonly<Record<string, StudioMode>> =
  Object.fromEntries(
    STUDIO_MODE_ORDER.map((mode, index) => [String(index + 1), mode])
  );

export function modeShortcut(mode: StudioMode): string {
  return String(STUDIO_MODE_ORDER.indexOf(mode) + 1);
}

export function stageOfMode(mode: StudioMode): StudioStage {
  return STUDIO_STAGES.find((stage) => stage.modes.includes(mode))!;
}

/**
 * The one step the author should take after this mode: the first mode of
 * the next stage, or, from the last stage, running the study through the
 * pipeline.
 */
type StudioNextStep =
  | { kind: "mode"; mode: StudioMode; label: string }
  | { kind: "pipeline"; label: string };

const NEXT_STEP_LABEL: Readonly<Record<StudioStageId, string>> = {
  design: "Schedule the forms",
  schedule: "Test in Live EDC",
  verify: "Run the pipeline",
};

export function nextStepFor(mode: StudioMode): StudioNextStep {
  const stage = stageOfMode(mode);
  const label = NEXT_STEP_LABEL[stage.id];
  const next = STUDIO_STAGES[STUDIO_STAGES.indexOf(stage) + 1];
  return next
    ? { kind: "mode", mode: next.modes[0], label }
    : { kind: "pipeline", label };
}

/**
 * Secondary studio header actions grouped into four high-leverage application
 * menus (#3394): Edit, View, Check, and Share.
 */
export type StudioMenuId = "edit" | "view" | "check" | "share";

export interface StudioMenuItemSpec {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly shortcut?: string;
  readonly dividerBefore?: boolean;
  readonly isDanger?: boolean;
}

export interface StudioMenuSpec {
  readonly id: StudioMenuId;
  readonly label: string;
  readonly description: string;
  readonly items: readonly StudioMenuItemSpec[];
}

export const STUDIO_HEADER_MENUS: readonly StudioMenuSpec[] = [
  {
    id: "edit",
    label: "Edit",
    description: "Study history, forms, baselines, and organization profile",
    items: [
      {
        id: "undo",
        label: "Undo",
        description: "Revert the last change made in this session",
        shortcut: "⌘Z",
      },
      {
        id: "redo",
        label: "Redo",
        description: "Reapply the change that was undone",
        shortcut: "⌘⇧Z",
      },
      {
        id: "add-form",
        label: "Add Form / CDASH Catalog",
        description:
          "Scaffolds CDASH domains, ready-made forms, or custom blocks",
        dividerBefore: true,
      },
      {
        id: "library-upgrades",
        label: "Library Block Upgrades",
        description:
          "Preview and apply newer library versions for existing forms",
      },
      {
        id: "baselines",
        label: "Study Baselines",
        description: "Save snapshots and restore revisions into new drafts",
        dividerBefore: true,
      },
      {
        id: "branding",
        label: "Organization Branding",
        description: "Logos, brand accent colors, and export header profiles",
      },
    ],
  },
  {
    id: "view",
    label: "View",
    description: "Studio layout, panes, theme, and interactive walkthroughs",
    items: [
      {
        id: "toggle-sidebar",
        label: "Left Forms Navigator",
        description: "Toggle study forms and domain navigator (Canvas mode)",
        shortcut: "⌘B",
      },
      {
        id: "toggle-inspector",
        label: "Right Property Inspector",
        description:
          "Toggle field and form property inspector (Canvas mode)",
        shortcut: "⌘I",
      },
      {
        id: "toggle-test-dock",
        label: "Form Test Dock",
        description:
          "Interactive test dock with synthetic scenario records",
        shortcut: "⌘\\",
        dividerBefore: true,
      },
      {
        id: "toggle-terminal",
        label: "CLI Terminal Drawer",
        description: "Direct readline console for protocol manipulation",
        shortcut: "⌘J",
      },
      {
        id: "toggle-theme",
        label: "Switch Studio Theme",
        description: "Toggle between Dark Studio and Clinical Light modes",
        dividerBefore: true,
      },
      {
        id: "guide",
        label: "Interactive Guide",
        description: "How CRF Studio works and architectural principles",
        dividerBefore: true,
      },
      {
        id: "tour",
        label: "Spotlight UI Tour",
        description: "Interactive walkthrough of studio controls",
      },
    ],
  },
  {
    id: "check",
    label: "Check",
    description: "Validation diagnostics, baseline comparison, and simulation",
    items: [
      {
        id: "diagnostics",
        label: "CDISC Conformance Diagnostics",
        description: "Evaluate 4-tier CDASH rules and AST logic checks",
      },
      {
        id: "compare-baseline",
        label: "Compare Against Baseline",
        description:
          "Review visual and structural diffs against a saved snapshot",
      },
      {
        id: "simulate",
        label: "Simulate in Clinical Chaos",
        description:
          "Launch Live Conformance Engine Simulation with Active Protocol Pre-Loaded",
        dividerBefore: true,
      },
    ],
  },
  {
    id: "share",
    label: "Share",
    description: "Pipeline tabulation, document exports, and view sharing",
    items: [
      {
        id: "pipeline",
        label: "Run Study Data Pipeline",
        description:
          "Open this study in the Study Data Pipeline, which tabulates it into SDTM, ADaM and tables",
      },
      {
        id: "export-doc",
        label: "Docx / PDF Books",
        description: "Export Word protocol books and blank/annotated CRFs",
      },
      {
        id: "copy-link",
        label: "Copy View Link",
        description: "Navigation URL only: does not include study content",
        dividerBefore: true,
      },
    ],
  },
];

