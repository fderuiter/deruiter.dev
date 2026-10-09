// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  PersonaProvider,
  usePersona,
} from "@/components/providers/PersonaProvider";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Timeline } from "@/components/Timeline";
import { InteractiveHighlights } from "@/components/InteractiveHighlights";
import { A11yProvider } from "@/components/providers/A11yProvider";
import { safeGetItem, safeStorage } from "@/lib/safe-storage";
import { LiveAnnouncer } from "@/lib/a11y/announcer";
import {
  LEGACY_DEEP_DIVE_PERSONA_VALUE,
  LEGACY_SUMMARY_PERSONA_VALUE,
  PERSONA_ANNOUNCEMENTS,
  PERSONA_STORAGE_KEY,
  normalizePersona,
  type PersonaType,
} from "@/lib/persona";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      volume: 0.5,
      muted: false,
      profile: "8-bit",
      playHover: vi.fn(),
      playSubmit: vi.fn(),
      playSuccess: vi.fn(),
      playError: vi.fn(),
      playAutocomplete: vi.fn(),
    }),
  };
});

vi.mock("@/components/providers/SearchProvider", () => ({
  useSearch: () => ({
    isOpen: false,
    setIsOpen: vi.fn(),
    openSearch: vi.fn(),
    closeSearch: vi.fn(),
  }),
}));

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

describe("Global Persona Perspective Toggle Suite", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    global.IntersectionObserver = class {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    mockStorage.clear();
  });

  it("propagates selected persona state with default as 'professional'", async () => {
    let currentPersona: string | null = null;
    const TestComponent = () => {
      const { persona } = usePersona();
      currentPersona = persona;
      return <div>Persona: {persona}</div>;
    };

    await act(async () => {
      root.render(
        <PersonaProvider>
          <TestComponent />
        </PersonaProvider>
      );
    });

    expect(currentPersona).toBe("professional");
    expect(container.textContent).toContain("Persona: professional");
  });

  it("updates persona context state on transition", async () => {
    let changePersona: ((p: PersonaType) => void) | undefined;
    const TestComponent = () => {
      const { persona, setPersona } = usePersona();
      changePersona = setPersona;
      return <div>Persona: {persona}</div>;
    };

    await act(async () => {
      root.render(
        <PersonaProvider>
          <TestComponent />
        </PersonaProvider>
      );
    });

    expect(container.textContent).toContain("Persona: professional");

    await act(async () => {
      if (changePersona) {
        changePersona("behind-the-scenes");
      }
    });

    expect(container.textContent).toContain("Persona: behind-the-scenes");
  });

  it("shows the interactive highlights teaser in both reading modes", async () => {
    const TestWrapper = ({
      initialPersona,
    }: {
      initialPersona: PersonaType;
    }) => {
      const { setPersona } = usePersona();
      React.useEffect(() => {
        setPersona(initialPersona);
      }, [initialPersona, setPersona]);

      return <InteractiveHighlights />;
    };

    await act(async () => {
      root.render(
        <PersonaProvider>
          <TestWrapper initialPersona="professional" />
        </PersonaProvider>
      );
    });

    expect(container.textContent).toContain("Yes, there are games.");
    expect(container.textContent).toContain("Visit the Arcade");

    await act(async () => {
      root.render(
        <PersonaProvider>
          <TestWrapper initialPersona="behind-the-scenes" />
        </PersonaProvider>
      );
    });

    expect(container.textContent).toContain("Yes, there are games.");
    expect(container.textContent).toContain("Visit the Arcade");
  });

  it("keeps the footer Arcade column in both reading modes", async () => {
    const TestWrapper = ({
      initialPersona,
    }: {
      initialPersona: PersonaType;
    }) => {
      const { setPersona } = usePersona();
      React.useEffect(() => {
        setPersona(initialPersona);
      }, [initialPersona, setPersona]);

      return <Footer />;
    };

    // 1. Professional mode
    await act(async () => {
      root.render(
        <PersonaProvider>
          <TestWrapper initialPersona="professional" />
        </PersonaProvider>
      );
    });

    expect(container.textContent).toContain("Arcade");
    expect(container.textContent).toContain("Arcade Hub");
    expect(container.textContent).toContain("Incident Simulator");

    // 2. Behind the Scenes mode: the Arcade column stays; only the
    // Incident Simulator link is still gated, matching the navbar.
    await act(async () => {
      root.render(
        <PersonaProvider>
          <TestWrapper initialPersona="behind-the-scenes" />
        </PersonaProvider>
      );
    });

    expect(container.textContent).toContain("Arcade");
    expect(container.textContent).toContain("Arcade Hub");
    expect(container.textContent).toContain("Meme Vault");
    expect(container.textContent).not.toContain("Incident Simulator");
    expect(container.textContent).toContain("Proof Workspace");
  });

  it("keeps the Arcade navigation discoverable in both personas", async () => {
    const TestWrapper = ({
      initialPersona,
    }: {
      initialPersona: PersonaType;
    }) => {
      const { setPersona } = usePersona();
      React.useEffect(() => {
        setPersona(initialPersona);
      }, [initialPersona, setPersona]);

      return <Navbar />;
    };

    // 1. Professional mode
    await act(async () => {
      root.render(
        <PersonaProvider>
          <TestWrapper initialPersona="professional" />
        </PersonaProvider>
      );
    });

    expect(container.textContent).toContain("Arcade");

    // Behind the Scenes readers retain access to the same top-level navigation.
    await act(async () => {
      root.render(
        <PersonaProvider>
          <TestWrapper initialPersona="behind-the-scenes" />
        </PersonaProvider>
      );
    });

    expect(container.textContent).toContain("Arcade");
  });

  it("syncs career timeline active display mode and automatically resets overrides on transition", async () => {
    let currentPersona:
      | {
          persona: PersonaType;
          setPersona: (p: PersonaType) => void;
        }
      | undefined;
    const TestWrapper = () => {
      const { persona, setPersona } = usePersona();
      currentPersona = { persona, setPersona };
      return <Timeline />;
    };

    await act(async () => {
      root.render(
        <PersonaProvider>
          <TestWrapper />
        </PersonaProvider>
      );
    });

    // The Professional default selects the Professional Summary.
    const pressedLabel = () =>
      container.querySelector(
        '[aria-label="Timeline Reading Perspective"] [aria-pressed="true"]'
      )?.textContent;
    expect(pressedLabel()).toBe("PROFESSIONAL SUMMARY");

    // Switch global persona to technical
    await act(async () => {
      currentPersona?.setPersona("behind-the-scenes");
    });

    expect(pressedLabel()).toBe("BEHIND THE SCENES REALITY");
  });
  describe("legacy stored values (ADR 0047 rename)", () => {
    const renderProbe = async () => {
      let current = "";
      const Probe = () => {
        const { persona } = usePersona();
        current = persona;
        return <div>Persona: {persona}</div>;
      };
      await act(async () => {
        root.render(
          <PersonaProvider>
            <Probe />
          </PersonaProvider>
        );
      });
      return () => current;
    };

    it.each([
      ["bare", LEGACY_SUMMARY_PERSONA_VALUE, "professional"],
      ["bare", LEGACY_DEEP_DIVE_PERSONA_VALUE, "behind-the-scenes"],
      ["JSON", JSON.stringify(LEGACY_SUMMARY_PERSONA_VALUE), "professional"],
      [
        "JSON",
        JSON.stringify(LEGACY_DEEP_DIVE_PERSONA_VALUE),
        "behind-the-scenes",
      ],
    ])(
      "keeps the visitor's mode for a %s legacy value %s",
      async (_kind, raw, expected) => {
        safeStorage.clear();
        mockStorage.setItem(PERSONA_STORAGE_KEY, raw);

        const read = await renderProbe();

        expect(read()).toBe(expected);
        // The legacy spelling is rewritten under the same key.
        expect(safeGetItem<unknown>(PERSONA_STORAGE_KEY)).toBe(expected);
        expect(mockStorage.getItem(PERSONA_STORAGE_KEY)).not.toContain(
          LEGACY_SUMMARY_PERSONA_VALUE
        );
      }
    );

    it("defaults to Professional on a first visit and for unknown values", async () => {
      safeStorage.clear();
      expect((await renderProbe())()).toBe("professional");

      safeStorage.clear();
      mockStorage.setItem(PERSONA_STORAGE_KEY, "executive");
      expect((await renderProbe())()).toBe("professional");
    });

    it("normalizes values without a provider", () => {
      expect(normalizePersona(undefined)).toBe("professional");
      expect(normalizePersona(42)).toBe("professional");
      expect(normalizePersona(" Behind-The-Scenes ")).toBe("behind-the-scenes");
      expect(normalizePersona(LEGACY_DEEP_DIVE_PERSONA_VALUE)).toBe(
        "behind-the-scenes"
      );
      expect(normalizePersona(LEGACY_SUMMARY_PERSONA_VALUE)).toBe(
        "professional"
      );
    });

    it("resolves a legacy value through the provider-less fallback", async () => {
      safeStorage.clear();
      mockStorage.setItem(PERSONA_STORAGE_KEY, LEGACY_DEEP_DIVE_PERSONA_VALUE);
      let current = "";
      const Orphan = () => {
        current = usePersona().persona;
        return null;
      };
      await act(async () => {
        root.render(<Orphan />);
      });
      expect(current).toBe("behind-the-scenes");
    });
  });

  describe("navigation reading-mode controls", () => {
    let announcer: LiveAnnouncer;
    const renderNavbar = async () => {
      safeStorage.clear();
      announcer = new LiveAnnouncer();
      vi.spyOn(announcer, "announce");
      await act(async () => {
        root.render(
          <A11yProvider announcer={announcer}>
            <PersonaProvider>
              <Navbar />
            </PersonaProvider>
          </A11yProvider>
        );
      });
    };

    const openPreferences = async () => {
      const trigger = container.querySelector(
        'button[aria-controls="navigation-preferences"]'
      ) as HTMLButtonElement;
      await act(async () => {
        trigger.click();
      });
    };

    it("renders Professional and Behind the Scenes controls with Professional pressed by default", async () => {
      await renderNavbar();
      await openPreferences();

      const professional = container.querySelectorAll(
        'button[aria-label^="Switch to Professional Mode"]'
      );
      const story = container.querySelectorAll(
        'button[aria-label^="Switch to Behind the Scenes Mode"]'
      );
      // The Preferences menu renders its panel on open; the drawer mounts on open.
      expect(professional.length).toBeGreaterThan(0);
      expect(story.length).toBe(professional.length);
      professional.forEach((b) =>
        expect(b.getAttribute("aria-pressed")).toBe("true")
      );
      story.forEach((b) =>
        expect(b.getAttribute("aria-pressed")).toBe("false")
      );

      const desktop = container.querySelector(
        '[role="group"][aria-label="Reading Mode Selection"]'
      );
      expect(desktop?.textContent).toContain("PRO");
      expect(desktop?.textContent).toContain("STORY");
      expect(container.textContent?.toLowerCase()).not.toContain(
        LEGACY_SUMMARY_PERSONA_VALUE
      );
    });

    it("announces each mode with its screen-reader description", async () => {
      await renderNavbar();
      await openPreferences();
      const story = container.querySelector(
        'button[aria-label^="Switch to Behind the Scenes Mode"]'
      ) as HTMLButtonElement;
      await act(async () => {
        story.click();
      });
      expect(story.getAttribute("aria-pressed")).toBe("true");
      expect(announcer.announce).toHaveBeenLastCalledWith(
        "Behind the Scenes Mode: Candid reality and engineering stories",
        "assertive"
      );
      expect(PERSONA_ANNOUNCEMENTS["behind-the-scenes"]).toBe(
        "Behind the Scenes Mode: Candid reality and engineering stories"
      );

      const professional = container.querySelector(
        'button[aria-label^="Switch to Professional Mode"]'
      ) as HTMLButtonElement;
      await act(async () => {
        professional.click();
      });
      expect(professional.getAttribute("aria-pressed")).toBe("true");
      expect(announcer.announce).toHaveBeenLastCalledWith(
        "Professional Mode: Concise overview of technical responsibilities and systems impact",
        "assertive"
      );
      announcer.destroy();
    });

    it("labels the mobile drawer controls in full", async () => {
      await renderNavbar();
      const hamburger = container.querySelector(
        'button[aria-controls="mobile-navigation"]'
      ) as HTMLButtonElement;
      await act(async () => {
        hamburger.click();
      });
      const drawer = document.getElementById("mobile-navigation");
      expect(drawer?.textContent).toContain("PROFESSIONAL");
      expect(drawer?.textContent).toContain("BEHIND THE SCENES");
      const group = drawer?.querySelector(
        '[role="group"][aria-label="Reading Mode Selection"]'
      );
      const describedBy = group?.getAttribute("aria-describedby") ?? "";
      expect(document.getElementById(describedBy)?.textContent).toContain(
        "Professional Mode"
      );
    });
  });
});
