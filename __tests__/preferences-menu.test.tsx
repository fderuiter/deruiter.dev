// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import axe from "axe-core";
import { AudioProvider } from "@/components/providers/AudioProvider";
import { PersonaProvider } from "@/components/providers/PersonaProvider";
import { A11yProvider } from "@/components/providers/A11yProvider";
import { PreferencesPanel } from "@/components/nav/PreferencesMenu";
import { LiveAnnouncer } from "@/lib/a11y/announcer";
import { PERSONA_ANNOUNCEMENTS, PERSONA_STORAGE_KEY } from "@/lib/persona";
import { safeGetItem, safeGetRawItem, safeStorage } from "@/lib/safe-storage";

class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(index: number) {
    return Object.keys(this.store)[index] ?? null;
  }
}

describe("Preferences panel (#1847)", () => {
  let announcer: LiveAnnouncer;
  let announce: ReturnType<typeof vi.spyOn>;

  const renderPanel = (variant: "popover" | "drawer" = "popover") =>
    render(
      <A11yProvider announcer={announcer}>
        <PersonaProvider>
          <AudioProvider>
            <PreferencesPanel variant={variant} />
          </AudioProvider>
        </PersonaProvider>
      </A11yProvider>
    );

  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: new MockStorage(),
      writable: true,
      configurable: true,
    });
    safeStorage.clear();
    document.documentElement.removeAttribute("data-font-mode");
    announcer = new LiveAnnouncer();
    announce = vi.spyOn(announcer, "announce");
  });

  afterEach(() => {
    cleanup();
    announcer.destroy();
  });

  it("groups every preference under a labelled section", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "Reading mode" })).toBeDefined();
    expect(screen.getByRole("heading", { name: /^Sound/ })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Text" })).toBeDefined();
    expect(screen.getAllByRole("region")).toHaveLength(3);
  });

  it("persists the reading mode and announces it", () => {
    renderPanel();
    fireEvent.click(
      screen.getByRole("button", { name: /Behind the Scenes Mode/ })
    );
    expect(safeGetItem(PERSONA_STORAGE_KEY)).toBe("behind-the-scenes");
    expect(announce).toHaveBeenLastCalledWith(
      PERSONA_ANNOUNCEMENTS["behind-the-scenes"],
      "assertive"
    );
    expect(
      screen
        .getByRole("button", { name: /Behind the Scenes Mode/ })
        .getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("persists the dyslexia font and announces it", () => {
    renderPanel();
    fireEvent.click(
      screen.getByRole("button", { name: "Enable OpenDyslexic font mode" })
    );
    expect(safeGetItem("portfolio-font-mode")).toBe("opendyslexic");
    expect(document.documentElement.getAttribute("data-font-mode")).toBe(
      "opendyslexic"
    );
    expect(announce).toHaveBeenLastCalledWith(
      expect.stringContaining("Dyslexia font mode enabled"),
      "polite"
    );
    expect(
      screen
        .getByRole("button", { name: "Disable OpenDyslexic font mode" })
        .getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("persists mute, volume and the sound profile under their original keys", () => {
    renderPanel();
    // Sound starts muted; the profile buttons are disabled until it is on.
    const unmute = screen.getByRole("button", { name: /Unmute/ });
    fireEvent.click(unmute);
    expect(safeGetRawItem("sound_muted")).toBe("false");
    expect(announce).toHaveBeenLastCalledWith("Sound on.", "polite");

    fireEvent.change(screen.getByLabelText("Volume"), {
      target: { value: "60" },
    });
    expect(safeGetRawItem("sound_volume")).toBe("0.6");

    fireEvent.click(screen.getByRole("button", { name: "90s" }));
    expect(safeGetRawItem("sound_profile")).toBe("90s-retro");
    expect(announce).toHaveBeenLastCalledWith(
      "Sound profile: 90s retro.",
      "polite"
    );

    fireEvent.click(screen.getByRole("button", { name: /^Mute/ }));
    expect(safeGetRawItem("sound_muted")).toBe("true");
    expect(announce).toHaveBeenLastCalledWith("Sound muted.", "polite");
  });

  it.each(["popover", "drawer"] as const)(
    "has no axe violations in the %s variant",
    async (variant) => {
      const { container } = renderPanel(variant);
      const results = await axe.run(container);
      expect(results.violations).toEqual([]);
    }
  );

  it("labels the reading modes in full inside the drawer", () => {
    renderPanel("drawer");
    expect(screen.getByText("BEHIND THE SCENES")).toBeDefined();
    expect(screen.getByText("PROFESSIONAL")).toBeDefined();
  });
});
