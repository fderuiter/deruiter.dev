// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import fs from "fs";
import path from "path";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemeVaultClient } from "@/components/arcade/MemeVaultClient";
import { A11yProvider } from "@/components/providers/A11yProvider";
import { ToastProvider } from "@/hooks/useToast";
import {
  EASTER_EGG_ACHIEVEMENTS,
  SANDBOX_TERMINAL_HREF,
  getUnlockedAchievements,
} from "@/lib/meme-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/arcade/meme-vault",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/meme-audio", () => ({
  playMemeSound: vi.fn(),
  getMemeSoundDuration: () => 500,
  isSoundAllowed: () => false,
  connectMemeAnalyser: () => null,
  releaseMemeAnalyser: vi.fn(),
}));

// #1652: the Terminal Cowboy and Friday Deploy Survivor hints said "the
// terminal" without saying where it is, and the vault's own ASCII studio
// looked like that terminal but never counted.

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

const TERMINAL_TROPHIES = ["terminal-cowboy", "friday-survivor"] as const;

function renderVault() {
  return render(
    <A11yProvider>
      <ToastProvider>
        <MemeVaultClient />
      </ToastProvider>
    </A11yProvider>
  );
}

describe("terminal trophy hints (#1652)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MockStorage());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("points both terminal trophies at the case-study terminal and the palette", () => {
    for (const id of TERMINAL_TROPHIES) {
      const ach = EASTER_EGG_ACHIEVEMENTS.find((a) => a.id === id);
      expect(ach?.hintLink?.href).toBe(SANDBOX_TERMINAL_HREF);
      expect(ach?.hint).toMatch(/iMednet SDK case study/);
      expect(ach?.hint).toMatch(/Command Palette/);
      expect(ach?.hint).not.toContain("—");
    }
  });

  it("links to a case study that always renders the terminal", () => {
    expect(SANDBOX_TERMINAL_HREF).toBe(
      "/case-studies/imednet-python-sdk#sample-commands"
    );
    const page = fs.readFileSync(
      path.resolve(process.cwd(), "app/case-studies/[slug]/page.tsx"),
      "utf8"
    );
    expect(page).toContain('slug === "imednet-python-sdk"');
    expect(page).toContain('id="sample-commands"');
  });

  it("renders the hint link on each locked terminal trophy card", () => {
    renderVault();
    const links = screen.getAllByRole("link", {
      name: /Open the sample commands terminal/i,
    });
    expect(links).toHaveLength(TERMINAL_TROPHIES.length);
    for (const link of links) {
      expect(link.getAttribute("href")).toBe(SANDBOX_TERMINAL_HREF);
    }
  });

  it("labels the ASCII studio as a gallery that does not award trophies", () => {
    renderVault();
    fireEvent.click(screen.getByRole("button", { name: /cowsay/i }));
    expect(getUnlockedAchievements()).not.toContain("terminal-cowboy");
    expect(
      screen.getByText(/gallery of the terminal's ASCII art/i)
    ).toBeTruthy();
  });
});
