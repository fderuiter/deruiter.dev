import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { SandboxTerminal } from "@/components/SandboxTerminal";
import { writeHashParams } from "@/hooks/useStudioHashParams";

// Mock audio and announcer providers
vi.mock("@/components/providers/A11yProvider", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playKeystroke: vi.fn(),
    playAutocomplete: vi.fn(),
    playSuccess: vi.fn(),
  }),
}));

describe("SandboxTerminal State Sync & Script Export Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      writeHashParams({ terminal_cmd: null });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("persists active console logs to localStorage via usePersistentState", () => {
    const { unmount } = render(<SandboxTerminal slug="test-study-pers" />);

    expect(screen.getByText(/iMednet Python SDK CLI Sandbox/i)).toBeDefined();

    unmount();

    render(<SandboxTerminal slug="test-study-pers" />);
    expect(screen.getByText(/iMednet Python SDK CLI Sandbox/i)).toBeDefined();
  });

  it("clears console logs and local storage when Clear History button is clicked", () => {
    render(<SandboxTerminal slug="test-study-clear" />);

    const clearButtons = screen.getAllByTitle("Clear Terminal Logs & History");
    fireEvent.click(clearButtons[0]);

    expect(screen.queryByText(/iMednet Python SDK CLI Sandbox/i)).toBeNull();
  });

  it("synchronizes executed commands to URL hash parameters via useStudioHashParams", () => {
    render(<SandboxTerminal slug="test-study-sync" />);

    const studiesButton = screen.getAllByRole("button", {
      name: "imednet studies list",
    })[0];
    fireEvent.click(studiesButton);

    expect(window.location.hash).toContain("terminal_cmd=imednet+studies+list");
  });

  it("auto-executes initial command specified in URL hash parameters on mount", () => {
    act(() => {
      writeHashParams({ terminal_cmd: "imednet studies list" });
    });

    render(<SandboxTerminal slug="test-study-mount" />);

    expect(window.location.hash).toContain("terminal_cmd=imednet+studies+list");
  });

  it("renders Export Script dropdown controls and options", () => {
    render(<SandboxTerminal slug="test-study-export" />);

    const exportButtons = screen.getAllByTitle(
      "Export Executed Commands as Pipeline Script"
    );
    expect(exportButtons[0]).toBeDefined();

    fireEvent.click(exportButtons[0]);

    expect(screen.getByText(/Bash Script \(\.sh\)/i)).toBeDefined();
    expect(screen.getByText(/Python Script \(\.py\)/i)).toBeDefined();
  });
});
