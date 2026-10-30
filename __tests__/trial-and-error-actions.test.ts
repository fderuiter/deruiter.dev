import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { controlsFromActions, findActionConflicts } from "@/lib/arcade";
import {
  handKeyIntent,
  type HandInputContext,
  type HandKeyInput,
} from "@/lib/trial-and-error";
import {
  TRIAL_AND_ERROR_ACTIONS,
  TRIAL_AND_ERROR_CONTROLS,
  actionNameForHandIntent,
  resolveHandKeyIntent,
} from "@/components/trial-and-error/actions";
import { TUTORIAL_SEEN_KEY } from "@/components/trial-and-error/Tutorial";
import { CODEX_KEY } from "@/components/trial-and-error/useCodex";

const BASE_KEY: HandKeyInput = {
  key: "",
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  onCard: true,
};

const BASE_CONTEXT: HandInputContext = {
  index: 2,
  count: 5,
  sealArmed: false,
  locked: false,
  blank: false,
  faceDown: false,
};

describe("Trial & Error action map (#3443)", () => {
  it("generates all 14 PlayCabinet controls from TRIAL_AND_ERROR_ACTIONS with zero conflicts", () => {
    const controls = controlsFromActions(TRIAL_AND_ERROR_ACTIONS);
    expect(controls).toEqual(TRIAL_AND_ERROR_CONTROLS);
    expect(controls).toHaveLength(14);
    expect(controls.map((c) => c.key)).toEqual([
      "← →",
      "Home",
      "End",
      "Alt + ←",
      "Alt + →",
      "Space",
      "Enter",
      "Esc",
      "A",
      "D",
      "I",
      "R",
      "S",
      "?",
    ]);
    expect(findActionConflicts(TRIAL_AND_ERROR_ACTIONS)).toEqual([]);
  });

  it("wires TrialAndErrorClient to controlsFromActions(TRIAL_AND_ERROR_ACTIONS)", () => {
    const clientSource = fs.readFileSync(
      path.join(process.cwd(), "components/arcade/TrialAndErrorClient.tsx"),
      "utf8"
    );
    expect(clientSource).toContain(
      "controls={controlsFromActions(TRIAL_AND_ERROR_ACTIONS)}"
    );
  });

  it("wraps handKeyIntent identically across every existing key binding", () => {
    const cases: Array<{
      input: Partial<HandKeyInput>;
      context?: Partial<HandInputContext>;
      expectedAction: string;
    }> = [
      { input: { key: "ArrowLeft" }, expectedAction: "focus-prev" },
      { input: { key: "ArrowRight" }, expectedAction: "focus-next" },
      { input: { key: "Home" }, expectedAction: "focus-first" },
      { input: { key: "End" }, expectedAction: "focus-last" },
      {
        input: { key: "ArrowLeft", altKey: true },
        expectedAction: "move-left",
      },
      {
        input: { key: "ArrowRight", altKey: true },
        expectedAction: "move-right",
      },
      { input: { key: " " }, expectedAction: "toggle-select" },
      { input: { key: "Enter" }, expectedAction: "play-hand" },
      {
        input: { key: "Enter" },
        context: { sealArmed: true },
        expectedAction: "apply-seal",
      },
      {
        input: { key: " " },
        context: { sealArmed: true },
        expectedAction: "apply-seal",
      },
      {
        input: { key: "Escape" },
        context: { sealArmed: true },
        expectedAction: "put-seal-back",
      },
      {
        input: { key: "a" },
        context: { blank: true },
        expectedAction: "focus-allocate",
      },
      { input: { key: "d" }, expectedAction: "discard" },
      { input: { key: "i" }, expectedAction: "inspect" },
      { input: { key: "r" }, expectedAction: "recompile" },
      {
        input: { key: "s" },
        context: { faceDown: true },
        expectedAction: "structural-qc",
      },
      { input: { key: "?" }, expectedAction: "read-card" },
    ];

    for (const { input, context, expectedAction } of cases) {
      const fullInput = { ...BASE_KEY, ...input };
      const fullContext = { ...BASE_CONTEXT, ...context };
      const wrapped = resolveHandKeyIntent(fullInput, fullContext);
      const raw = handKeyIntent(fullInput, fullContext);
      expect(wrapped).toEqual(raw);
      expect(wrapped).not.toBeNull();
      expect(actionNameForHandIntent(wrapped!, fullInput)).toBe(expectedAction);
    }
  });

  it("leaves Trial & Error save keys unchanged", () => {
    expect(TUTORIAL_SEEN_KEY).toBe("te:tutorial-seen");
    expect(CODEX_KEY).toBe("te:codex");
    const runSaveSource = fs.readFileSync(
      path.join(process.cwd(), "components/trial-and-error/useRunSave.ts"),
      "utf8"
    );
    expect(runSaveSource).toContain('const SAVE_KEY_PREFIX = "te:run-save:";');
  });
});
