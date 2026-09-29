import { describe, it, expect } from "vitest";
import {
  NEURO_TOOL_HOTKEYS,
  SCENARIOS,
  resolveNeuroHotkey,
  formatNeuroToolKey,
} from "@/lib/neuro";

const ev = (key: string, target: HTMLElement, extra = {}) => ({
  key,
  target,
  ...extra,
});

describe("neuro hotkeys single source of truth", () => {
  it("Case 01 instructs the Erase hotkey, not Paint's", () => {
    const text = SCENARIOS.dura_inclusion.lore.remediationProtocol;
    expect(text).toContain("Voxel Erase (E key)");
    expect(text).not.toContain("B key");
  });

  it("every scenario key reference matches the tool table", () => {
    for (const sc of Object.values(SCENARIOS)) {
      const text = sc.lore.remediationProtocol;
      for (const m of text.matchAll(
        /(Voxel Paint|Voxel Erase|Control Point) \((\w) key\)/g
      )) {
        const h = Object.values(NEURO_TOOL_HOTKEYS).find(
          (x) => x.name === m[1]
        );
        expect(m[2]).toBe(h?.letter);
      }
    }
    expect(formatNeuroToolKey("paint")).toBe("Voxel Paint (B key)");
  });

  it("R and Space run recon even when a workspace control has focus", () => {
    const div = document.createElement("div");
    div.setAttribute("data-keyboard-boundary", "true");
    const slider = document.createElement("div");
    div.appendChild(slider);
    expect(resolveNeuroHotkey(ev("r", slider))).toEqual({ type: "run" });
    expect(resolveNeuroHotkey(ev(" ", slider))).toEqual({ type: "run" });
    expect(resolveNeuroHotkey(ev("e", slider))).toEqual({
      type: "tool",
      tool: "erase",
    });
  });

  it("ignores text inputs, dialogs, modifier chords, and Space on buttons", () => {
    const input = document.createElement("input");
    const dlg = document.createElement("div");
    dlg.setAttribute("role", "dialog");
    const inner = document.createElement("span");
    dlg.appendChild(inner);
    const btn = document.createElement("button");
    expect(resolveNeuroHotkey(ev("r", input))).toBeNull();
    expect(resolveNeuroHotkey(ev("r", inner))).toBeNull();
    expect(resolveNeuroHotkey(ev("r", btn, { metaKey: true }))).toBeNull();
    expect(resolveNeuroHotkey(ev(" ", btn))).toBeNull();
    expect(resolveNeuroHotkey(ev("r", btn))).toEqual({ type: "run" });
  });
});
