// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Navbar } from "@/components/Navbar";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Mock audio provider
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    volume: 0.3,
    muted: true,
    profile: "8-bit",
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setProfile: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
    playNote: vi.fn(),
  }),
}));

// Mock search provider
vi.mock("@/components/providers/SearchProvider", () => ({
  useSearch: () => ({
    isOpen: false,
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
  }),
}));

// Mock persona provider
let mockPersona = "default";
vi.mock("@/components/providers/PersonaProvider", () => ({
  usePersona: () => ({
    persona: mockPersona,
    setPersona: vi.fn((p) => {
      mockPersona = p;
    }),
  }),
}));

// Mock next/navigation
let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe("Mobile Navigation Drawer & Touch Interaction Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/";
    mockPersona = "default";
    document.body.style.overflow = "";

    // Mock IntersectionObserver for JSDOM
    global.IntersectionObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    } as unknown as typeof IntersectionObserver;

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.style.overflow = "";
  });

  it("toggles the mobile navigation drawer when clicking the hamburger trigger", async () => {
    await act(async () => {
      root.render(<Navbar />);
    });

    const hamburgerBtn = container.querySelector(
      'button[aria-controls="mobile-navigation"]'
    ) as HTMLButtonElement;
    expect(hamburgerBtn).toBeTruthy();
    expect(hamburgerBtn.getAttribute("aria-expanded")).toBe("false");

    // Click to open
    await act(async () => {
      hamburgerBtn.click();
    });

    expect(hamburgerBtn.getAttribute("aria-expanded")).toBe("true");
    const drawer = document.getElementById("mobile-navigation");
    expect(drawer).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");

    // Click to close
    await act(async () => {
      hamburgerBtn.click();
    });

    expect(hamburgerBtn.getAttribute("aria-expanded")).toBe("false");
    expect(document.body.style.overflow).toBe("");
  });

  it("uses the canonical Work, Systems, Arcade, About, and Contact destinations", async () => {
    await act(async () => {
      root.render(<Navbar />);
    });

    const mainNavigation = container.querySelector(
      'nav[aria-label="Main Navigation"]'
    );
    expect(mainNavigation?.textContent).toContain("Work");
    expect(mainNavigation?.textContent).toContain("Systems");
    expect(mainNavigation?.textContent).toContain("Arcade");
    expect(mainNavigation?.textContent).toContain("About");
    expect(mainNavigation?.textContent).toContain("Contact");

    const workLink = Array.from(
      mainNavigation?.querySelectorAll("a") ?? []
    ).find((link) => link.textContent?.trim() === "Work");
    expect(workLink?.getAttribute("href")).toBe("/case-studies");
  });

  it("opens a consolidated preferences panel and dismisses it with Escape", async () => {
    await act(async () => {
      root.render(<Navbar />);
    });

    const preferencesButton = container.querySelector(
      'button[aria-label="Open navigation preferences"]'
    ) as HTMLButtonElement;
    expect(preferencesButton).toBeTruthy();

    await act(async () => {
      preferencesButton.click();
    });

    expect(preferencesButton.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("navigation-preferences")).toBeTruthy();

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });

    expect(preferencesButton.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("navigation-preferences")).toBeNull();
  });

  it("closes drawer and unlocks body scroll when clicking route links in mobile menu", async () => {
    await act(async () => {
      root.render(<Navbar />);
    });

    const hamburgerBtn = container.querySelector(
      'button[aria-controls="mobile-navigation"]'
    ) as HTMLButtonElement;
    await act(async () => {
      hamburgerBtn.click();
    });

    expect(document.getElementById("mobile-navigation")).toBeTruthy();

    const scheduleLink = document.querySelector(
      'a[href="/schedule"]'
    ) as HTMLAnchorElement;
    expect(scheduleLink).toBeTruthy();

    await act(async () => {
      scheduleLink.click();
    });

    // Drawer should be dismissed and scroll unlocked
    expect(hamburgerBtn.getAttribute("aria-expanded")).toBe("false");
    expect(document.body.style.overflow).toBe("");
  });

  it("closes drawer when smooth scrolling to hash sections on homepage", async () => {
    // Mock scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    const aboutSection = document.createElement("section");
    aboutSection.id = "about";
    document.body.appendChild(aboutSection);

    await act(async () => {
      root.render(<Navbar />);
    });

    const hamburgerBtn = container.querySelector(
      'button[aria-controls="mobile-navigation"]'
    ) as HTMLButtonElement;
    await act(async () => {
      hamburgerBtn.click();
    });

    const aboutLink = document.querySelector(
      'a[href="/#about"]'
    ) as HTMLAnchorElement;
    expect(aboutLink).toBeTruthy();

    await act(async () => {
      aboutLink.click();
    });

    expect(aboutSection.scrollIntoView).toHaveBeenCalled();
    expect(hamburgerBtn.getAttribute("aria-expanded")).toBe("false");
    expect(document.body.style.overflow).toBe("");

    aboutSection.remove();
  });

  it("dismisses drawer when Escape key is pressed", async () => {
    await act(async () => {
      root.render(<Navbar />);
    });

    const hamburgerBtn = container.querySelector(
      'button[aria-controls="mobile-navigation"]'
    ) as HTMLButtonElement;
    hamburgerBtn.focus();
    await act(async () => {
      hamburgerBtn.click();
    });

    expect(hamburgerBtn.getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      const escapeEvent = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
      });
      document.dispatchEvent(escapeEvent);
    });

    expect(hamburgerBtn.getAttribute("aria-expanded")).toBe("false");
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(hamburgerBtn);
  });

  it("includes the Incident Simulator route in the mobile drawer, matching desktop and footer coverage", async () => {
    mockPersona = "recruiter";
    await act(async () => {
      root.render(<Navbar />);
    });

    const hamburgerBtn = container.querySelector(
      'button[aria-controls="mobile-navigation"]'
    ) as HTMLButtonElement;
    await act(async () => {
      hamburgerBtn.click();
    });

    const drawer = document.getElementById("mobile-navigation");
    const simulatorLink = drawer?.querySelector('a[href="/simulator"]');
    expect(simulatorLink).toBeTruthy();
    expect(simulatorLink?.textContent).toContain("Incident Simulator");
  });

  it("hides the Incident Simulator route in the mobile drawer for the technical persona, matching desktop", async () => {
    mockPersona = "technical";
    await act(async () => {
      root.render(<Navbar />);
    });

    const hamburgerBtn = container.querySelector(
      'button[aria-controls="mobile-navigation"]'
    ) as HTMLButtonElement;
    await act(async () => {
      hamburgerBtn.click();
    });

    const drawer = document.getElementById("mobile-navigation");
    expect(drawer?.querySelector('a[href="/simulator"]')).toBeNull();
  });

  it("sizes the mobile search and hamburger triggers to at least the repository's 48x48 CSS px touch target standard (ADR-0003/ADR-0019)", async () => {
    await act(async () => {
      root.render(<Navbar />);
    });

    const searchBtn = container.querySelector(
      'button[aria-label="Open Command Search"]'
    ) as HTMLButtonElement;
    const hamburgerBtn = container.querySelector(
      'button[aria-controls="mobile-navigation"]'
    ) as HTMLButtonElement;

    // min-w-11/min-h-11 (44px) previously passed here, but the repository's
    // documented touch-target standard is 48px (ADR-0003, ADR-0019); a real
    // rendered-dimension audit measured these two controls at 44x44.
    expect(searchBtn.className).not.toMatch(/\bmin-w-11\b/);
    expect(searchBtn.className).not.toMatch(/\bmin-h-11\b/);
    expect(searchBtn.className).toMatch(/min-w-12/);
    expect(searchBtn.className).toMatch(/min-h-12/);
    expect(hamburgerBtn.className).not.toMatch(/\bmin-w-11\b/);
    expect(hamburgerBtn.className).not.toMatch(/\bmin-h-11\b/);
    expect(hamburgerBtn.className).toMatch(/min-w-12/);
    expect(hamburgerBtn.className).toMatch(/min-h-12/);
  });

  it("dismisses drawer when tapping the backdrop container directly", async () => {
    await act(async () => {
      root.render(<Navbar />);
    });

    const hamburgerBtn = container.querySelector(
      'button[aria-controls="mobile-navigation"]'
    ) as HTMLButtonElement;
    await act(async () => {
      hamburgerBtn.click();
    });

    const drawer = document.getElementById(
      "mobile-navigation"
    ) as HTMLDivElement;
    expect(drawer).toBeTruthy();

    await act(async () => {
      drawer.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(hamburgerBtn.getAttribute("aria-expanded")).toBe("false");
    expect(document.body.style.overflow).toBe("");
  });
});
