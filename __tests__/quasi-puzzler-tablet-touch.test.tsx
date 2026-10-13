// @vitest-environment jsdom
import React from "react";
import fs from "node:fs";
import path from "node:path";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QuasiPerfectPuzzler } from "@/components/QuasiPerfectPuzzler/QuasiPerfectPuzzler";
import { CabinetTouchContext } from "@/components/arcade/mobile/CabinetTouchContext";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

const click = (el: HTMLElement) => act(() => void fireEvent.click(el));

/** Renders the game inside the touch cabinet (ADR 0061), or on desktop. */
function renderGame(inCabinet: boolean) {
  return render(
    <CabinetTouchContext.Provider value={inCabinet}>
      <QuasiPerfectPuzzler />
    </CabinetTouchContext.Provider>
  );
}

/** The on-screen control for each keyboard shortcut in handleKeyDown (#2042). */
const SHORTCUT_CONTROLS: Array<{ shortcut: string; name: RegExp }> = [
  { shortcut: "Ctrl/Cmd+Z", name: /^Undo$/ },
  { shortcut: "Ctrl/Cmd+Y", name: /^Redo$/ },
  { shortcut: "R", name: /^Reset$/ },
  { shortcut: "H", name: /Hints/ },
  { shortcut: "C", name: /Generated Lean 4 Text/ },
  { shortcut: "B", name: /Theory Briefing/ },
  { shortcut: "M", name: /^Hacker Mode$/ },
];

describe("Quasi-Puzzler on the touch cabinet (#2042)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("gating", () => {
    it("marks the game as touch-cabinet only inside the touch cabinet", () => {
      const { container, unmount } = renderGame(true);
      const root = container.querySelector("section.qp-root");
      expect(root?.classList.contains("qp-touch")).toBe(true);
      expect(container.querySelector(".qp-touch-board")).not.toBeNull();
      unmount();
    });

    it("keeps a desktop cabinet's markup free of every touch class", () => {
      const { container } = renderGame(false);
      expect(container.querySelector(".qp-touch")).toBeNull();
      expect(container.querySelector(".qp-touch-board")).toBeNull();
      const root = container.querySelector("section.qp-root");
      expect(root?.className).not.toContain("qp-touch");
    });

    it("leaves the Lean inspector a plain drawer on desktop", () => {
      renderGame(false);
      click(screen.getByRole("button", { name: /Generated Lean 4 Text/ }));
      const content = document.getElementById("lean-ide-drawer-content");
      expect(content).not.toBeNull();
      expect(content?.getAttribute("role")).toBeNull();
      expect(content?.getAttribute("aria-modal")).toBeNull();
    });
  });

  describe("on-screen controls for the keyboard shortcuts", () => {
    it.each(SHORTCUT_CONTROLS)(
      "$shortcut has a button on the touch cabinet",
      ({ name }) => {
        renderGame(true);
        const matches = screen
          .getAllByRole("button", { name })
          .filter((el) => !el.closest(".sr-only"));
        expect(matches.length).toBeGreaterThan(0);
      }
    );

    it("keeps the same buttons on desktop, so the reference stays unchanged", () => {
      renderGame(false);
      for (const { name } of SHORTCUT_CONTROLS) {
        expect(screen.getAllByRole("button", { name }).length).toBeGreaterThan(
          0
        );
      }
    });

    it("the Undo button is disabled with no history, as Ctrl+Z does nothing", () => {
      renderGame(true);
      const undo = screen.getByRole("button", { name: /^Undo$/ });
      expect((undo as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe("touch CSS contract (app/arcade/arcade.css)", () => {
    const css = fs.readFileSync(
      path.resolve(process.cwd(), "app/arcade/arcade.css"),
      "utf8"
    );
    const touchBlock = css.slice(css.indexOf(".qp-root.qp-touch {"));

    it("gives every touch-cabinet button a 44px minimum box", () => {
      expect(touchBlock).toMatch(
        /\.qp-root\.qp-touch button \{\s*min-height: 44px;\s*min-width: 44px;/
      );
    });

    it("lifts 9, 10 and 11px text to 12px on the touch cabinet", () => {
      expect(touchBlock).toMatch(/\.qp-root\.qp-touch \.text-\\\[9px\\\]/);
      expect(touchBlock).toMatch(/\.qp-root\.qp-touch \.text-\\\[10px\\\]/);
      expect(touchBlock).toMatch(
        /\.qp-root\.qp-touch \.text-\\\[11px\\\][^{]*\{\s*font-size: 0\.75rem;/
      );
    });

    it("scopes every touch rule to the qp-touch class, never the bare root", () => {
      const rules = touchBlock
        .slice(0, touchBlock.indexOf(".qp-math {"))
        .replace(/\/\*[\s\S]*?\*\//g, "");
      const selectors = rules
        .split("}")
        .map((block) => block.split("{")[0].trim())
        .filter(Boolean)
        .flatMap((list) => list.split(",").map((s) => s.trim()));
      expect(selectors.length).toBeGreaterThan(0);
      for (const selector of selectors) {
        expect(selector.startsWith(".qp-root.qp-touch")).toBe(true);
      }
    });
  });

  describe("Lean inspector on the touch cabinet", () => {
    it("is a dialog that takes focus and closes with Escape", async () => {
      renderGame(true);
      click(screen.getByRole("button", { name: /Generated Lean 4 Text/ }));
      const dialog = await waitFor(() => {
        const el = document.getElementById("lean-ide-drawer-content");
        expect(el?.getAttribute("role")).toBe("dialog");
        return el as HTMLElement;
      });
      expect(dialog.getAttribute("aria-modal")).toBe("true");
      await waitFor(() => {
        expect(dialog.contains(document.activeElement)).toBe(true);
      });

      act(() => {
        fireEvent.keyDown(document.activeElement ?? dialog, {
          key: "Escape",
        });
      });

      await waitFor(() => {
        expect(document.getElementById("lean-ide-drawer-content")).toBeNull();
      });
      const toggle = screen.getByRole("button", {
        name: /Generated Lean 4 Text/,
      });
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
    });
  });
});
