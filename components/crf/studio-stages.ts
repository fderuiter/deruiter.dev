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
 * The studio header's secondary actions, grouped into the four menus approved
 * in #3394. Each item keeps the tooltip of the header control it replaces, so
 * its description says where it goes. Run Pipeline is in no menu: the last stage's
 * next-step button carries it (#3395).
 */
export type StudioMenuId = "edit" | "view" | "check" | "share";

/** One action in a studio header menu. The header maps each id to a handler. */
export type StudioMenuItemId =
  | "undo"
  | "redo"
  | "find"
  | "add-form"
  | "library-upgrades"
  | "baselines"
  | "compare-baseline"
  | "branding"
  | "toggle-theme"
  | "toggle-sidebar"
  | "toggle-inspector"
  | "toggle-terminal"
  | "guide"
  | "tour"
  | "diagnostics"
  | "toggle-test-dock"
  | "simulate"
  | "export-doc"
  | "copy-link";

/** A studio header menu item: its label, tooltip and keyboard shortcut. */
export interface StudioMenuItemSpec {
  readonly id: StudioMenuItemId;
  readonly label: string;
  /** Tooltip and second line of the item: what the action does. */
  readonly description: string;
  /** Shortcut the studio already handles, shown beside the label. */
  readonly shortcut?: string;
  /** The same shortcut for `aria-keyshortcuts`, in its key-name syntax. */
  readonly keyshortcuts?: string;
  /** Draws a separator above the item, between groups of related actions. */
  readonly dividerBefore?: boolean;
}

/** A studio header menu: its trigger label and its items, in order. */
interface StudioMenuSpec {
  readonly id: StudioMenuId;
  readonly label: string;
  readonly items: readonly StudioMenuItemSpec[];
}

/** The four studio header menus, in the order their triggers appear. */
export const STUDIO_HEADER_MENUS: readonly StudioMenuSpec[] = [
  {
    id: "edit",
    label: "Edit",
    items: [
      {
        id: "undo",
        label: "Undo",
        description: "Undo the last change",
        shortcut: "⌘Z",
        keyshortcuts: "Meta+Z Control+Z",
      },
      {
        id: "redo",
        label: "Redo",
        description: "Redo the change you undid",
        shortcut: "⌘⇧Z",
        keyshortcuts: "Meta+Shift+Z Control+Shift+Z",
      },
      {
        id: "find",
        label: "Find in study",
        description: "Find forms, fields, visits and actions",
        shortcut: "F",
        keyshortcuts: "F",
      },
      {
        id: "add-form",
        label: "Add form",
        description:
          "Add a ready-made form or block: CDASH domains, forms from the example studies, your templates and smart blocks",
        dividerBefore: true,
      },
      {
        id: "library-upgrades",
        label: "Library Block Upgrades",
        description:
          "Preview and apply newer library versions to forms built from them",
      },
      {
        id: "baselines",
        label: "Study Baselines",
        description:
          "Save Study Baseline Snapshots and Restore into New Drafts",
        dividerBefore: true,
      },
      {
        id: "compare-baseline",
        label: "Compare Against Baseline",
        description:
          "Compare the current draft against a saved baseline snapshot",
      },
      {
        id: "branding",
        label: "Organization Branding",
        description: "Logo, brand colors and the header used on exports",
        dividerBefore: true,
      },
    ],
  },
  {
    id: "view",
    label: "View",
    items: [
      {
        id: "toggle-theme",
        label: "Studio Theme",
        description: "Switch between Dark Studio and Clinical Light modes",
      },
      {
        id: "toggle-sidebar",
        label: "Forms Navigator",
        description: "Show or hide the left forms navigator (Canvas only)",
        shortcut: "⌘B",
        keyshortcuts: "Meta+B Control+B",
        dividerBefore: true,
      },
      {
        id: "toggle-inspector",
        label: "Property Inspector",
        description: "Show or hide the right property inspector (Canvas only)",
        shortcut: "⌘I",
        keyshortcuts: "Meta+I Control+I",
      },
      {
        id: "toggle-terminal",
        label: "CLI Terminal Drawer",
        description: "Open or close the in-studio terminal",
        shortcut: "⌘J",
        keyshortcuts: "Meta+J Control+J",
      },
      {
        id: "guide",
        label: "Interactive Guide",
        description: "How CRF Studio works",
        dividerBefore: true,
      },
      {
        id: "tour",
        label: "Spotlight UI Tour",
        description: "A walkthrough of the studio's controls",
      },
    ],
  },
  {
    id: "check",
    label: "Check",
    items: [
      {
        id: "diagnostics",
        label: "Conformance Diagnostics",
        description: "Open CDISC Conformance Diagnostics",
      },
      {
        id: "toggle-test-dock",
        label: "Form Test Dock",
        description:
          "Fill the open form with test records and watch the checks",
        shortcut: "⌘\\",
        keyshortcuts: "Meta+\\ Control+\\",
      },
      {
        id: "simulate",
        label: "Simulate Protocol",
        description:
          "Launch Live Conformance Engine Simulation with Active Protocol Pre-Loaded",
        dividerBefore: true,
      },
    ],
  },
  {
    id: "share",
    label: "Share",
    items: [
      {
        id: "export-doc",
        label: "Docx / PDF Books",
        description:
          "Export Word (.docx) Protocol Books & PDF Blank/Annotated CRFs",
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
