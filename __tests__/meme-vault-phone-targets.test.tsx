// @vitest-environment jsdom
//
// #3521: Meme Vault on a phone. Below 768px the copy buttons are 44px keys
// that show a word as well as the icon, and no text is set below 12px. The
// rules ride on `max-md:` (any phone) as well as `pointer-coarse:` (any touch
// screen), so a phone that reports a fine pointer still gets them.
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      muted: true,
      bypassActive: false,
      setMuted: vi.fn(),
      playHover: vi.fn(),
    }),
  };
});

vi.mock("@/lib/meme-audio", () => ({
  playMemeSound: vi.fn(),
  unlockMemeAudio: vi.fn(),
  getMemeSoundDuration: () => 400,
  isSoundAllowed: () => true,
  connectMemeAnalyser: () => null,
  releaseMemeAnalyser: vi.fn(),
}));

import { MemeVaultClient } from "@/components/arcade/MemeVaultClient";
import { A11yProvider } from "@/components/providers/A11yProvider";
import { ToastProvider } from "@/hooks/useToast";

class MockStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length() {
    return this.store.size;
  }
}

function renderVault() {
  return render(
    <A11yProvider>
      <ToastProvider>
        <MemeVaultClient />
      </ToastProvider>
    </A11yProvider>
  );
}

const classesOf = (el: Element) =>
  (el.getAttribute("class") ?? "").split(/\s+/);

describe("Meme Vault phone size rules (#3521)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MockStorage());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("makes every copy button a 44px key with a visible word on a phone", () => {
    renderVault();
    const buttons = [
      ...screen.getAllByRole("button", { name: "Copy Quote" }),
      screen.getByRole("button", { name: "Copy ASCII Art" }),
    ];
    expect(buttons.length).toBeGreaterThan(1);
    for (const button of buttons) {
      const classes = classesOf(button);
      for (const rule of ["max-md:min-h-11", "max-md:min-w-11"]) {
        expect(classes).toContain(rule);
      }
      // The word shows on a phone or a touch screen; the name stays full.
      const word = button.querySelector("span[aria-hidden='true']");
      expect(word?.textContent).toBe("Copy");
      expect(classesOf(word!)).toEqual(
        expect.arrayContaining(["max-md:inline", "pointer-coarse:inline"])
      );
    }
  });

  it("raises every text size under 12px to 12px on a phone", () => {
    const { container } = renderVault();
    const small = Array.from(container.querySelectorAll("[class]")).filter(
      (el) => classesOf(el).some((c) => /^text-\[(?:[0-9]|1[01])px\]$/.test(c))
    );
    expect(small.length).toBeGreaterThan(0);
    for (const el of small) {
      expect(classesOf(el)).toContain("max-md:text-xs");
    }
  });
});
