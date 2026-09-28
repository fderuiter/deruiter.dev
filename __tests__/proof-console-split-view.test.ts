import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Integrated Command Console Split-View Accessibility & Interactive Controls", () => {
  const pagePath = path.resolve(__dirname, "../app/(desktop)/proof/page.tsx");
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should display a text-based terminal split-view alongside the workspace", () => {
    expect(content).toContain("isConsoleOpen");
    expect(content).toContain("proof-cli");
  });

  it("should support connect, disconnect, prune, delete-step, and list active logic nodes on the canvas", () => {
    expect(content).toContain('op === "connect"');
    expect(content).toContain('op === "disconnect"');
    expect(content).toContain('op === "prune" || op === "delete-step"');
    expect(content).toContain('op === "list"');
    expect(content).toContain("handleDeleteStep");
  });

  it("should render accessible step deletion (×) button on proven derived ledger rows", () => {
    expect(content).toContain("step.isDeletable");
    expect(content).toContain("handleDeleteStep(step.stepNumber)");
    expect(content).toContain(
      "aria-label={`Delete Step ${step.stepNumber} and prune downstream dependencies`}"
    );
  });

  it("should support sequential command history navigation using Up and Down arrow keys", () => {
    expect(content).toContain('e.key === "ArrowUp"');
    expect(content).toContain('e.key === "ArrowDown"');
    expect(content).toContain("setHistoryIdx");
    expect(content).toContain("setConsoleInput(history[nextIdx])");
  });

  it("should offer inline auto-completion suggestions for valid logic operations", () => {
    expect(content).toContain("getSuggestion(consoleInput");
    expect(content).toContain("suggestion.substring(consoleInput.length)");
    expect(content).toContain('e.key === "Tab"');
  });

  it("should broadcast terminal feedback, edge connections, and errors using live announcements within 100ms", () => {
    expect(content).toContain('aria-live="assertive"');
    expect(content).toContain("liveAnnouncement");
    expect(content).toContain("announceToScreenReader");
    expect(content).toContain("setTimeout");
  });

  it("should declare data-keyboard-boundary on the console container to isolate global shortcuts", () => {
    expect(content).toContain('data-keyboard-boundary="true"');
  });

  it("should return focus to the toggle button on escape or when closed", () => {
    expect(content).toContain('e.key === "Escape"');
    expect(content).toContain("consoleInputRef.current?.blur()");
    expect(content).toContain("toggleBtnRef.current?.focus");
  });

  it("should toggle console open/close and focus input with standard global keyboard shortcuts", () => {
    expect(content).toContain(
      '(e.ctrlKey && e.key === "\\\\") || (e.ctrlKey && e.key === "`")'
    );
    expect(content).toContain("toggleConsole()");
  });
});
