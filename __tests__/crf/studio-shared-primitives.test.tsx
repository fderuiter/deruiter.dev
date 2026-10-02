// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { CRFStudioContainer } from "@/components/crf/CRFStudioContainer";

/**
 * Issue #1589: CRF Studio derives its deep-link startup state from
 * useStudioHashParams and binds its shortcuts through useHotkeys. These tests
 * pin the behaviour the raw hash parsing and the raw window keydown listener
 * had, so the migration is a pure refactor.
 */

function setHash(hash: string) {
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${hash ? `#${hash}` : ""}`
  );
}

function modeTab(label: string): HTMLElement {
  const nav = screen.getByRole("tablist", { name: "Studio Mode Navigation" });
  const tab = Array.from(
    nav.querySelectorAll<HTMLElement>('[role="tab"]')
  ).find((el) => el.textContent?.includes(label));
  if (!tab) throw new Error(`No mode tab ${label}`);
  return tab;
}

function studioRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>("[data-studio-theme]");
  if (!root) throw new Error("Studio root not rendered");
  return root;
}

function testDockToggle(): HTMLElement {
  const button = document.querySelector<HTMLElement>(
    'button[title^="Toggle Form Test Dock"]'
  );
  if (!button) throw new Error("Test dock toggle not rendered");
  return button;
}

function press(
  target: Window | Element,
  key: string,
  modifiers: Partial<
    Pick<KeyboardEventInit, "ctrlKey" | "metaKey" | "altKey" | "shiftKey">
  > = {}
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

beforeEach(() => {
  setHash("");
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  setHash("");
  localStorage.clear();
});

describe("CRF Studio startup state from useStudioHashParams (#1589)", () => {
  it("restores mode and theme from a deep link", () => {
    // Grid is accepted on startup even though the Back/Forward sync ignores it.
    setHash("mode=grid&theme=light");
    render(<CRFStudioContainer />);

    expect(modeTab("Active Form Grid").getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(studioRoot().getAttribute("data-studio-theme")).toBe("light");
  });

  it("restores the sidebar tab from a deep link", () => {
    setHash("tab=forms");
    render(<CRFStudioContainer />);

    expect(
      document
        .getElementById("study-spine-tab-forms")
        ?.getAttribute("aria-selected")
    ).toBe("true");
  });

  it("falls back to the defaults for unknown hash values", () => {
    setHash("mode=bogus&tab=nowhere&theme=neon");
    render(<CRFStudioContainer />);

    expect(modeTab("Form Designer").getAttribute("aria-selected")).toBe("true");
    expect(
      document
        .getElementById("study-spine-tab-spine")
        ?.getAttribute("aria-selected")
    ).toBe("true");
    expect(studioRoot().getAttribute("data-studio-theme")).toBe("dark");
  });

  it("prefers the hash theme over the cached theme, and the cache over the default", () => {
    localStorage.setItem("crf_studio_theme", "light");
    setHash("theme=dark");
    const first = render(<CRFStudioContainer />);
    expect(studioRoot().getAttribute("data-studio-theme")).toBe("dark");
    first.unmount();

    setHash("");
    render(<CRFStudioContainer />);
    expect(studioRoot().getAttribute("data-studio-theme")).toBe("light");
  });
});

describe("CRF Studio shortcuts on useHotkeys (#1589)", () => {
  it("switches modes on plain digits but not with Ctrl, Meta or Alt held", () => {
    render(<CRFStudioContainer />);

    press(window, "3", { altKey: true });
    press(window, "3", { ctrlKey: true });
    press(window, "3", { metaKey: true });
    expect(modeTab("Form Designer").getAttribute("aria-selected")).toBe("true");

    press(window, "3");
    expect(modeTab("Visit Matrix (SoA)").getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  it("toggles the test dock on every Ctrl/Meta combination with \\, and only then", () => {
    render(<CRFStudioContainer />);
    const pressed = () => testDockToggle().getAttribute("aria-pressed");
    expect(pressed()).toBe("false");

    press(window, "\\");
    expect(pressed()).toBe("false");

    const combos: Array<Parameters<typeof press>[2]> = [
      { ctrlKey: true },
      { metaKey: true },
      { ctrlKey: true, metaKey: true },
      { ctrlKey: true, altKey: true },
      { metaKey: true, altKey: true },
      { ctrlKey: true, metaKey: true, altKey: true },
    ];
    let open = false;
    for (const modifiers of combos) {
      const event = press(window, "\\", modifiers);
      open = !open;
      expect(event.defaultPrevented).toBe(true);
      expect(pressed()).toBe(String(open));
    }
  });

  it("closes the test dock on Escape even from a focused input inside the studio", () => {
    render(<CRFStudioContainer />);
    press(window, "\\", { ctrlKey: true });
    expect(testDockToggle().getAttribute("aria-pressed")).toBe("true");

    const input = document.createElement("input");
    studioRoot().appendChild(input);
    input.focus();
    const event = press(input, "Escape", { altKey: true });
    // Escape never called preventDefault in the raw listener either.
    expect(event.defaultPrevented).toBe(false);
    expect(testDockToggle().getAttribute("aria-pressed")).toBe("false");
  });

  it("opens the slash palette on / and calls preventDefault", () => {
    render(<CRFStudioContainer />);
    expect(document.getElementById("slash-palette-title")).toBeNull();
    const event = press(window, "/");
    expect(event.defaultPrevented).toBe(true);
    expect(document.getElementById("slash-palette-title")).not.toBeNull();
  });

  it("claims Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z outside the studio", () => {
    render(<CRFStudioContainer />);
    expect(press(window, "z", { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(
      press(window, "Z", { metaKey: true, shiftKey: true }).defaultPrevented
    ).toBe(true);
    expect(press(window, "z").defaultPrevented).toBe(false);
  });

  it("keeps studio shortcuts out of its own keyboard boundary, as before", () => {
    render(<CRFStudioContainer />);
    const button = document.createElement("button");
    studioRoot().appendChild(button);
    button.focus();

    press(button, "3");
    expect(modeTab("Form Designer").getAttribute("aria-selected")).toBe("true");
    expect(press(button, "\\", { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(testDockToggle().getAttribute("aria-pressed")).toBe("false");
  });

  it("stops listening after unmount", () => {
    const view = render(<CRFStudioContainer />);
    view.unmount();
    expect(press(window, "/").defaultPrevented).toBe(false);
  });
});
