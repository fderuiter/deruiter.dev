// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CommandPalette } from "@/components/CommandPalette";
import { isModifiedClick } from "@/lib/scroll";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mockPlaySubmit = vi.fn();
const mockPlaySuccess = vi.fn();
vi.mock("@/components/providers/AudioProvider", () => ({
  registerAudioCleanup: vi.fn(() => vi.fn()),
  useAudio: () => ({
    volume: 0.3,
    muted: true,
    profile: "8-bit",
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setProfile: vi.fn(),
    playHover: vi.fn(),
    playSubmit: mockPlaySubmit,
    playSuccess: mockPlaySuccess,
    playNote: vi.fn(),
  }),
}));

let mockSearchOpen = false;
vi.mock("@/components/providers/SearchProvider", () => ({
  useSearch: () => ({
    isOpen: mockSearchOpen,
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
    setIsOpen: vi.fn(),
  }),
}));

vi.mock("@/components/providers/PersonaProvider", () => ({
  usePersona: () => ({ persona: "default", setPersona: vi.fn() }),
}));

let mockPathname = "/";
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn() }),
}));

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query === "(prefers-reduced-motion: reduce)",
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

function addSection(id: string): HTMLElement {
  const section = document.createElement("section");
  section.id = id;
  section.scrollIntoView = vi.fn();
  document.body.appendChild(section);
  return section;
}

/** Dispatches a click and reports whether the default navigation was cancelled. */
function click(element: Element, init: MouseEventInit = {}): boolean {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  });
  element.dispatchEvent(event);
  return event.defaultPrevented;
}

async function flushTimers(ms = 20) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

describe("isModifiedClick", () => {
  const plain = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
  };

  it("treats only an unmodified primary click as in-page", () => {
    expect(isModifiedClick(plain)).toBe(false);
    expect(isModifiedClick({ ...plain, button: 1 })).toBe(true);
    expect(isModifiedClick({ ...plain, metaKey: true })).toBe(true);
    expect(isModifiedClick({ ...plain, ctrlKey: true })).toBe(true);
    expect(isModifiedClick({ ...plain, shiftKey: true })).toBe(true);
    expect(isModifiedClick({ ...plain, altKey: true })).toBe(true);
  });
});

describe("in-page anchor navigation in the site chrome", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/";
    mockSearchOpen = false;
    stubReducedMotion(false);
    global.IntersectionObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    } as unknown as typeof IntersectionObserver;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
    document.body.style.overflow = "";
    window.history.replaceState(null, "", "/");
    vi.unstubAllGlobals();
  });

  describe("Navbar", () => {
    // About is a menu in the top bar (#1842); its first entry is the in-page link.
    const openAboutMenu = async (): Promise<Element> => {
      const trigger = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "About"
      ) as HTMLButtonElement;
      await act(async () => {
        trigger.click();
      });
      return container.querySelector('a[href="/#about"]') as Element;
    };

    it("scrolls to the section and focuses it on the homepage", async () => {
      const about = addSection("about");
      await act(async () => {
        root.render(<Navbar />);
      });

      const link = await openAboutMenu();
      let prevented = false;
      await act(async () => {
        prevented = click(link);
      });

      expect(prevented).toBe(true);
      expect(about.scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
      expect(document.activeElement).toBe(about);
    });

    it("jumps without animation when the reader prefers reduced motion", async () => {
      stubReducedMotion(true);
      const about = addSection("about");
      await act(async () => {
        root.render(<Navbar />);
      });
      const link = await openAboutMenu();

      await act(async () => {
        click(link);
      });

      expect(about.scrollIntoView).toHaveBeenCalledWith({
        behavior: "auto",
        block: "start",
      });
    });

    it("leaves a modified click to the browser", async () => {
      const about = addSection("about");
      await act(async () => {
        root.render(<Navbar />);
      });

      const link = await openAboutMenu();
      let prevented = true;
      await act(async () => {
        prevented = click(link, { ctrlKey: true });
      });

      expect(prevented).toBe(false);
      expect(about.scrollIntoView).not.toHaveBeenCalled();
    });

    it("lets the link navigate from another page", async () => {
      mockPathname = "/blog";
      const about = addSection("about");
      await act(async () => {
        root.render(<Navbar />);
      });

      const link = await openAboutMenu();
      let prevented = true;
      await act(async () => {
        prevented = click(link);
      });

      expect(prevented).toBe(false);
      expect(about.scrollIntoView).not.toHaveBeenCalled();
    });

    it("closes the mobile drawer, then scrolls and leaves focus on the section", async () => {
      const about = addSection("about");
      await act(async () => {
        root.render(<Navbar />);
      });

      const trigger = container.querySelector(
        'button[aria-controls="mobile-navigation"]'
      ) as HTMLButtonElement;
      trigger.focus();
      await act(async () => {
        trigger.click();
      });
      await flushTimers(80);

      const drawer = document.getElementById("mobile-navigation") as Element;
      const drawerLink = drawer.querySelector('a[href="/#about"]') as Element;
      expect(drawerLink).toBeTruthy();

      await act(async () => {
        click(drawerLink);
      });
      await flushTimers();

      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(document.body.style.overflow).toBe("");
      expect(about.scrollIntoView).toHaveBeenCalledTimes(1);
      // The drawer's focus trap restores focus to the trigger first; the
      // section must still end up focused.
      expect(document.activeElement).toBe(about);
    });
  });

  describe("Footer", () => {
    it("scrolls to the About section and focuses it on the homepage", async () => {
      const about = addSection("about");
      await act(async () => {
        root.render(<Footer />);
      });

      const link = container.querySelector('a[href="/#about"]') as Element;
      let prevented = false;
      await act(async () => {
        prevented = click(link);
      });

      expect(prevented).toBe(true);
      expect(about.scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
      expect(document.activeElement).toBe(about);
    });

    it("lets the About link navigate from another page", async () => {
      mockPathname = "/blog";
      const about = addSection("about");
      await act(async () => {
        root.render(<Footer />);
      });

      let prevented = true;
      await act(async () => {
        prevented = click(
          container.querySelector('a[href="/#about"]') as Element
        );
      });

      expect(prevented).toBe(false);
      expect(about.scrollIntoView).not.toHaveBeenCalled();
    });

    it("scrolls back to the top instantly under reduced motion", async () => {
      stubReducedMotion(true);
      const scrollTo = vi.fn();
      vi.stubGlobal("scrollTo", scrollTo);
      await act(async () => {
        root.render(<Footer />);
      });

      await act(async () => {
        (
          container.querySelector(
            'button[aria-label="Scroll back to top of page"]'
          ) as HTMLButtonElement
        ).click();
      });

      expect(mockPlaySuccess).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
    });
  });

  describe("CommandPalette", () => {
    async function openPaletteAndPickAbout() {
      mockSearchOpen = true;
      await act(async () => {
        root.render(<CommandPalette />);
      });
      const option = document.getElementById(
        "palette-option-nav-about"
      ) as HTMLElement;
      expect(option).toBeTruthy();
      await act(async () => {
        option.click();
      });
    }

    async function closePalette() {
      mockSearchOpen = false;
      await act(async () => {
        root.render(<CommandPalette />);
      });
      // The modal stays mounted for its exit animation.
      for (let i = 0; i < 100 && document.querySelector("[role=dialog]"); i++) {
        await flushTimers(20);
      }
      expect(document.querySelector("[role=dialog]")).toBeNull();
      await flushTimers();
    }

    it("scrolls to a section on the current page once the palette has closed", async () => {
      const about = addSection("about");
      await openPaletteAndPickAbout();

      expect(mockPlaySubmit).toHaveBeenCalledTimes(1);
      expect(mockPush).not.toHaveBeenCalled();
      // The page behind the palette is still inert, so nothing moves yet.
      expect(about.scrollIntoView).not.toHaveBeenCalled();

      await closePalette();

      expect(about.scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
      expect(document.activeElement).toBe(about);
    });

    it("navigates to the homepage section from another page", async () => {
      window.history.replaceState(null, "", "/blog");
      await openPaletteAndPickAbout();
      await closePalette();

      expect(mockPlaySubmit).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/#about");
    });

    it("navigates when the homepage section is missing", async () => {
      await openPaletteAndPickAbout();

      expect(mockPush).toHaveBeenCalledWith("/#about");
    });

    it("navigates rather than scrolling a same-id element on another page", async () => {
      window.history.replaceState(null, "", "/blog");
      const about = addSection("about");
      await openPaletteAndPickAbout();
      await closePalette();

      expect(mockPush).toHaveBeenCalledWith("/#about");
      expect(about.scrollIntoView).not.toHaveBeenCalled();
    });
  });
});
