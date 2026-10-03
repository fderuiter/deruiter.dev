// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

vi.mock("@/components/providers/SearchProvider", () => ({
  useSearch: () => ({
    isOpen: false,
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
  }),
}));

let mockPersona: "behind-the-scenes" | "professional" = "professional";
vi.mock("@/components/providers/PersonaProvider", () => ({
  usePersona: () => ({
    persona: mockPersona,
    setPersona: vi.fn((p) => {
      mockPersona = p;
    }),
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// The "Systems" studio destinations that must stay synchronized across every
// discovery surface per ticket #577 ("Synchronize destination names and
// route coverage across header, mobile drawer, footer, search, and metadata
// discovery contracts").
const SYSTEMS_ROUTES = ["/crf", "/proof", "/neuro", "/stack", "/simulator"];

describe("Navbar mobile drawer & Footer Systems route parity", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPersona = "professional";
    document.body.style.overflow = "";

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

  it("shows the same Systems routes in the mobile drawer and the footer for the Professional persona", async () => {
    await act(async () => {
      root.render(
        <>
          <Navbar />
          <Footer />
        </>
      );
    });

    const hamburgerBtn = container.querySelector(
      'button[aria-controls="mobile-navigation"]'
    ) as HTMLButtonElement;
    await act(async () => {
      hamburgerBtn.click();
    });

    const drawer = document.getElementById("mobile-navigation");
    const footer = container.querySelector("footer");

    for (const route of SYSTEMS_ROUTES) {
      const drawerRoute = ["/crf", "/proof", "/neuro", "/patrol"].includes(
        route
      )
        ? `/m${route}`
        : route;
      expect(
        drawer?.querySelector(`a[href="${drawerRoute}"]`),
        `expected mobile drawer to link to ${drawerRoute}`
      ).toBeTruthy();
      expect(
        footer?.querySelector(`a[href="${route}"]`),
        `expected footer to link to ${route}`
      ).toBeTruthy();
    }
  });

  it("hides the Behind-the-Scenes-gated Incident Simulator route consistently in both the drawer and the footer", async () => {
    mockPersona = "behind-the-scenes";

    await act(async () => {
      root.render(
        <>
          <Navbar />
          <Footer />
        </>
      );
    });

    const hamburgerBtn = container.querySelector(
      'button[aria-controls="mobile-navigation"]'
    ) as HTMLButtonElement;
    await act(async () => {
      hamburgerBtn.click();
    });

    const drawer = document.getElementById("mobile-navigation");
    const footer = container.querySelector("footer");

    expect(drawer?.querySelector('a[href="/simulator"]')).toBeNull();
    expect(footer?.querySelector('a[href="/simulator"]')).toBeNull();
  });

  it("does not brand the Meme Vault as secret in the footer, since it's linked on every page (#593)", async () => {
    await act(async () => {
      root.render(<Footer />);
    });

    const link = container.querySelector('a[href="/arcade/meme-vault"]');
    expect(link).toBeTruthy();
    expect(link?.textContent).not.toContain("Secret");
  });
});
