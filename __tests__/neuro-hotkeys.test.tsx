// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NeuroFieldManual } from "@/components/neuro/NeuroFieldManual";
import {
  NEURO_TOOL_HOTKEYS,
  SCENARIOS,
  TOOL_MODES,
  resolveNeuroHotkey,
  formatNeuroToolKey,
} from "@/lib/neuro";

const ev = (key: string, target: HTMLElement, extra = {}) => ({
  key,
  target,
  ...extra,
});

describe("neuro hotkeys single source of truth", () => {
  afterEach(() => cleanup());

  it("keeps TOOL_MODES and NEURO_TOOL_HOTKEYS in 1:1 parity including roi_select", () => {
    expect([...TOOL_MODES]).toEqual(Object.keys(NEURO_TOOL_HOTKEYS));
    expect(TOOL_MODES).toContain("roi_select");
    expect(NEURO_TOOL_HOTKEYS.roi_select).toEqual({
      tool: "roi_select",
      digit: "5",
      letter: "G",
      name: "ROI Region Grow",
    });
    expect(formatNeuroToolKey("roi_select")).toBe("ROI Region Grow (G key)");
  });

  it("renders 5 / G for 3D Region-Growing ROI Seed in the Field Manual shortcuts tab", () => {
    render(<NeuroFieldManual isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Keyboard Shortcuts" }));
    expect(screen.getByText("3D Region-Growing ROI Seed")).not.toBeNull();
    expect(screen.getByText("5 / G")).not.toBeNull();
  });

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
    expect(resolveNeuroHotkey(ev("5", slider))).toEqual({
      type: "tool",
      tool: "roi_select",
    });
    expect(resolveNeuroHotkey(ev("g", slider))).toEqual({
      type: "tool",
      tool: "roi_select",
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
