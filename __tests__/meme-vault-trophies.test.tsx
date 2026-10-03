import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import { MemeVaultClient } from "@/components/arcade/MemeVaultClient";
import { RetroChaosOverlay } from "@/components/RetroChaosOverlay";
import { A11yProvider } from "@/components/providers/A11yProvider";
import { ToastProvider } from "@/hooks/useToast";
import { getUnlockedAchievements, unlockAchievement } from "@/lib/meme-data";

const nav = vi.hoisted(() => ({ pathname: "/arcade/meme-vault" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/meme-audio", () => ({
  playMemeSound: vi.fn(),
  getMemeSoundDuration: () => 500,
  isSoundAllowed: () => false,
  connectMemeAnalyser: () => null,
  releaseMemeAnalyser: vi.fn(),
}));

// Exit animations keep removed nodes mounted; render plain list items so
// toast dismissal is observable synchronously.
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const MotionLi = ({
    children,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    layout: _layout,
    ...rest
  }: React.LiHTMLAttributes<HTMLLIElement> & Record<string, unknown>) => (
    <li {...(rest as React.LiHTMLAttributes<HTMLLIElement>)}>
      {children as React.ReactNode}
    </li>
  );
  return {
    ...actual,
    // motion is a Proxy of tag components; spreading it would drop them.
    motion: new Proxy(actual.motion, {
      get: (target, key, receiver) =>
        key === "li" ? MotionLi : Reflect.get(target, key, receiver),
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    useReducedMotion: () => true,
  };
});

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
        <RetroChaosOverlay />
      </ToastProvider>
    </A11yProvider>
  );
}

function toasts() {
  return within(screen.getByTestId("toast-viewport"));
}

describe("Meme Vault trophies and chaos button (#1328)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MockStorage());
    nav.pathname = "/arcade/meme-vault";
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens chaos mode from the button without awarding the Konami trophy", () => {
    renderVault();
    fireEvent.click(
      screen.getByRole("button", { name: /Launch Retro Chaos Mode/ })
    );

    expect(getUnlockedAchievements()).not.toContain("konami-hero");
    const dialog = screen.getByRole("dialog", {
      name: "Retro Chaos Mode Notification",
    });
    expect(dialog.textContent).toContain("Retro Chaos Mode On");
    expect(dialog.textContent).not.toContain("Konami Sequence Detected");
    // Already on the vault: no link back to the page you are on.
    expect(
      within(dialog).queryByRole("link", { name: /Enter Secret Meme Vault/ })
    ).toBeNull();
    expect(screen.queryByText(/Trophy unlocked/)).toBeNull();
    // #1556: the vault is open to everyone, so the copy must not claim the
    // button unlocked it, and the status chips wrap instead of truncating.
    expect(dialog.textContent).not.toMatch(
      /open for this session|permanently unlocked/
    );
    expect(dialog.textContent).toContain("doesn't change how any page works");
    expect(dialog.querySelector(".truncate")).toBeNull();
  });

  it("keeps the vault link when chaos mode opens on another page", () => {
    nav.pathname = "/";
    render(
      <A11yProvider>
        <RetroChaosOverlay />
      </A11yProvider>
    );
    act(() => {
      window.dispatchEvent(new CustomEvent("trigger_retro_chaos"));
    });
    expect(
      screen.getByRole("link", { name: /Enter Secret Meme Vault/ })
    ).toBeTruthy();
  });

  it("toasts the Soundboard Maestro unlock and dismisses it on its own", () => {
    renderVault();
    fireEvent.click(screen.getAllByRole("button", { name: /^Play / })[0]);

    expect(getUnlockedAchievements()).toContain("soundboard-maestro");
    expect(
      toasts().getByText("Trophy unlocked: Soundboard Maestro")
    ).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(toasts().queryByText(/Trophy unlocked/)).toBeNull();
  });

  it("toasts the Konami trophy when the typed code unlocks it", () => {
    renderVault();
    act(() => {
      unlockAchievement("konami-hero");
    });
    expect(
      toasts().getByText("Trophy unlocked: Konami Code Pioneer")
    ).toBeTruthy();
  });

  it("describes what the typed Konami code actually does (#1556)", () => {
    renderVault();
    act(() => {
      for (const key of [
        "ArrowUp",
        "ArrowUp",
        "ArrowDown",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "ArrowLeft",
        "ArrowRight",
        "b",
        "a",
      ]) {
        window.dispatchEvent(new KeyboardEvent("keydown", { key }));
      }
    });
    const dialog = screen.getByRole("dialog", {
      name: "Retro Chaos Mode Notification",
    });
    expect(dialog.textContent).toContain("Konami Sequence Detected");
    expect(dialog.textContent).toContain("Konami Code Pioneer");
    expect(dialog.textContent).toContain("Meme Vault link");
    expect(dialog.textContent).not.toMatch(
      /open for this session|permanently unlocked/
    );
  });

  it("marks the selected filter and ASCII pills as pressed", () => {
    renderVault();
    const filters = screen.getByRole("group", {
      name: "Filter quotes by category",
    });
    const dev = within(filters).getByRole("button", { name: "dev" });
    expect(
      within(filters)
        .getByRole("button", { name: "all" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    fireEvent.click(dev);
    expect(dev.getAttribute("aria-pressed")).toBe("true");

    const ascii = screen.getByRole("group", { name: "ASCII art" });
    const duck = within(ascii).getByRole("button", { name: "duck" });
    expect(duck.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(duck);
    expect(duck.getAttribute("aria-pressed")).toBe("true");
  });
});
