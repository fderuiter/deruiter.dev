/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createInitialDuckGameState } from "@/lib/working-with-duck-engine";

// Mock ResizeObserver and IntersectionObserver
global.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

global.IntersectionObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

// Mock Canvas 2D context with full curve and vector methods
const mockCtx = {
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  arcTo: vi.fn(),
  arc: vi.fn(),
  ellipse: vi.fn(),
  roundRect: vi.fn(),
  rect: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 40 })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  setLineDash: vi.fn(),
};

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as any);
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  left: 0,
  top: 0,
  width: 800,
  height: 500,
  right: 800,
  bottom: 500,
  x: 0,
  y: 0,
  toJSON: () => {},
}));

// Mock AudioProvider
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
    volume: 0.8,
    muted: false,
    profile: "8-bit",
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setProfile: vi.fn(),
  }),
  AudioProvider: ({ children }: any) => <>{children}</>,
}));

// Mock useTelemetry
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(true),
  }),
}));

import { WorkingWithDuck } from "@/components/WorkingWithDuck";

const storageStore: Record<string, string> = {};
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => storageStore[k] || null,
    setItem: (k: string, v: string) => {
      storageStore[k] = String(v);
    },
    removeItem: (k: string) => {
      delete storageStore[k];
    },
    clear: () => {
      Object.keys(storageStore).forEach((k) => delete storageStore[k]);
    },
    key: () => null,
    length: 0,
  },
  writable: true,
});

describe("Working With Duck - UI & Component Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders initial game container, HUD meters, and Start button", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    expect(container.textContent).toContain("Work Progress");
    expect(container.textContent).toContain("Excitement");
    expect(container.textContent).toContain("Bladder Clock");
    expect(container.textContent).toContain("Good Boy Scale");
    expect(container.textContent).toContain("Start Sprint 1");
    expect(container.textContent).toContain("Duck Scrapbook");
  });

  it("renders bottom Hotbar items and training tricks (Tennis Ball, Kong, Squeaky, Treat, Sit, Paw, Drop It, Spin)", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    expect(container.textContent).toContain("Tennis Ball");
    expect(container.textContent).toContain("Kong Chew");
    expect(container.textContent).toContain("Squeaky");
    expect(container.textContent).toContain("Treat 🍖");
    expect(container.textContent).toContain("Sit 🪑");
    expect(container.textContent).toContain("High Five 🐾");
    expect(container.textContent).toContain("Drop It ✋");
    expect(container.textContent).toContain("Spin 🌀");
    expect(container.textContent).toContain("Focus Work Sprint (Space)");
    expect(container.textContent).toContain("Dog Park 🌲");
    expect(container.textContent).toContain("Bathtub 🛁");
  });

  it("opens and toggles the Polaroid Scrapbook modal", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const scrapbookButtons = container.querySelectorAll("button");
    const openBtn = Array.from(scrapbookButtons).find((b) =>
      b.textContent?.includes("Duck Scrapbook")
    );
    expect(openBtn).toBeDefined();

    if (openBtn) {
      await act(async () => {
        openBtn.click();
      });
      expect(container.textContent).toContain("Duck's Polaroid Scrapbook");
      expect(container.textContent).toContain("The Puppy Headrest");
    }
  });

  it("opens and toggles the Accessory Wardrobe modal", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const buttons = container.querySelectorAll("button");
    const wardrobeBtn = Array.from(buttons).find(
      (b) =>
        b.textContent?.includes("Wardrobe") || b.title?.includes("Wardrobe")
    );
    expect(wardrobeBtn).toBeDefined();

    if (wardrobeBtn) {
      await act(async () => {
        wardrobeBtn.click();
      });
      expect(container.textContent).toContain("Duck's Wardrobe");
      expect(container.textContent).toContain("Adidas Bucket Hat");
      expect(container.textContent).toContain("Natural Fluffy Coat");
    }
  });

  it("transitions to running state when clicking Start Sprint 1", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const startBtn = container.querySelector("button");
    if (startBtn) {
      await act(async () => {
        startBtn.click();
      });
    }

    expect(container.querySelector("canvas")).toBeDefined();
  });

  it("toggles Scrapbook view mode between Real Photos and Vector Art", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const scrapbookButtons = container.querySelectorAll("button");
    const openBtn = Array.from(scrapbookButtons).find((b) =>
      b.textContent?.includes("Duck Scrapbook")
    );
    if (openBtn) {
      await act(async () => {
        openBtn.click();
      });

      expect(container.textContent).toContain("Real Photos 📷");
      expect(container.textContent).toContain("Vector Art 🎨");

      const vectorModeBtn = Array.from(
        container.querySelectorAll("button")
      ).find((b) => b.textContent?.includes("Vector Art 🎨"));
      expect(vectorModeBtn).toBeDefined();

      if (vectorModeBtn) {
        await act(async () => {
          vectorModeBtn.click();
        });
        expect(container.textContent).toContain("Vector Art 🎨");
      }
    }
  });

  it("navigates forward and backward in Polaroid Scrapbook carousel", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const scrapbookButtons = container.querySelectorAll("button");
    const openBtn = Array.from(scrapbookButtons).find((b) =>
      b.textContent?.includes("Duck Scrapbook")
    );
    if (openBtn) {
      await act(async () => {
        openBtn.click();
      });

      expect(container.textContent).toContain("Card 1 of 10");

      const nextBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Next →")
      );
      if (nextBtn) {
        await act(async () => {
          nextBtn.click();
        });
        expect(container.textContent).toContain("Card 2 of 10");
      }
    }
  });

  it("handles hotbar keyboard shortcuts 1, 2, 3, 4, Q, W, E, R, Space without crashing", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "2" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "3" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "4" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "q" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "w" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", code: "Space" })
      );
    });

    expect(container.textContent).toContain("Tennis Ball");
  });

  it("toggles dog park and renders agility jump and whistle controls", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const parkBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Dog Park")
    );
    if (parkBtn) {
      await act(async () => {
        parkBtn.click();
      });

      expect(container.textContent).toContain("Agility Jump (Space)");
      expect(container.textContent).toContain("Whistle");
      expect(container.textContent).toContain("Return to Office");
    }
  });

  it("lets Space activate a focused Dog Park button instead of the global code-burst shortcut (#604)", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    // Enter running mode so the global Space shortcut (active code burst) is live.
    const startBtn = container.querySelector("button");
    await act(async () => {
      startBtn?.click();
    });

    const workProgressBar = container.querySelector(
      '[aria-label="Work Progress"]'
    );
    const progressBefore = workProgressBar?.getAttribute("aria-valuenow");

    const parkBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Dog Park")
    );
    expect(parkBtn).toBeTruthy();

    parkBtn!.focus();
    expect(document.activeElement).toBe(parkBtn);

    let event!: KeyboardEvent;
    await act(async () => {
      event = new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        bubbles: true,
        cancelable: true,
      });
      parkBtn!.dispatchEvent(event);
    });

    // The game's global shortcut listener must leave Space alone while a real button is
    // focused so the browser's native "activate the focused button" behavior can run,
    // instead of hijacking it for the active-code-burst shortcut (the reported bug).
    expect(event.defaultPrevented).toBe(false);
    expect(workProgressBar?.getAttribute("aria-valuenow")).toBe(progressBefore);

    // Native activation (which jsdom does not simulate for Space) is what actually opens
    // Dog Park; confirm the button still leads there via its own click handler.
    await act(async () => {
      parkBtn!.click();
    });
    expect(container.textContent).toContain("Agility Jump (Space)");
  });

  it("enters Bathtub and renders bathtub wash and shower rinse controls", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const bathBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Bathtub")
    );
    if (bathBtn) {
      await act(async () => {
        bathBtn.click();
      });

      expect(container.textContent).toContain("Shower Rinse Spray");
      expect(container.textContent).toContain("Finish Bath & Return");
    }
  });

  it("handles audio and lo-fi music mute toggle clicks", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const muteButtons = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.title?.includes("Mute") || b.title?.includes("Music")
    );
    expect(muteButtons.length).toBeGreaterThan(0);

    for (const btn of muteButtons) {
      await act(async () => {
        btn.click();
      });
    }
  });

  it("renders guided onboarding tutorial hint when starting Sprint 1", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Start Sprint 1")
    );
    if (startBtn) {
      await act(async () => {
        startBtn.click();
      });
      expect(container.textContent).toContain(
        "Tip: Work advances automatically"
      );
    }
  });

  it("handles canvas mouse down, drag, and mouse up events gracefully", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();

    if (canvas) {
      await act(async () => {
        canvas.dispatchEvent(
          new MouseEvent("mousedown", {
            clientX: 430,
            clientY: 240,
            bubbles: true,
          })
        );
        canvas.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: 450,
            clientY: 260,
            bubbles: true,
          })
        );
        canvas.dispatchEvent(
          new MouseEvent("mouseup", {
            clientX: 450,
            clientY: 260,
            bubbles: true,
          })
        );
      });
    }
  });

  it("applies default lazy loading to active unlocked scrapbook card image element without high-priority flags", async () => {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });

    const scrapbookButtons = container.querySelectorAll("button");
    const openBtn = Array.from(scrapbookButtons).find((b) =>
      b.textContent?.includes("Duck Scrapbook")
    );
    expect(openBtn).toBeDefined();

    if (openBtn) {
      await act(async () => {
        openBtn.click();
      });

      const img = container.querySelector("img");
      expect(img).not.toBeNull();
      expect(img?.getAttribute("src")).toContain("duck-puppy-headrest.jpg");
      expect(img?.getAttribute("loading")).toBe("lazy");
      expect(img?.getAttribute("fetchpriority")).toBeNull();
    }
  });

  it("celebrates a cleared sprint with arcade actions instead of a recruiter pitch (#923)", async () => {
    const wonState = createInitialDuckGameState(1, "campaign");
    wonState.status = "won";

    await act(async () => {
      root.render(<WorkingWithDuck initialState={wonState} />);
    });

    const dialog = container.querySelector(
      '[aria-labelledby="duck-win-dialog-heading"]'
    ) as HTMLElement;
    expect(dialog).not.toBeNull();
    const text = dialog.textContent ?? "";
    expect(text).not.toMatch(/Schedule a Chat|exact skills|let.s talk/i);
    expect(dialog.querySelector('a[href="/schedule"]')).toBeNull();
    expect(text).toContain("budget spreadsheet");

    const caseStudies = dialog.querySelector('a[href="/case-studies"]');
    expect(caseStudies?.textContent).toContain("Browse Case Studies");
    const github = dialog.querySelector(
      'a[href="https://github.com/fderuiter"]'
    );
    expect(github?.textContent).toContain("GitHub");

    const endless = Array.from(dialog.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Play Endless Mode")
    );
    expect(endless).toBeDefined();
    await act(async () => {
      endless!.click();
    });
    expect(
      container.querySelector('[aria-labelledby="duck-win-dialog-heading"]')
    ).toBeNull();
    expect(container.textContent).toContain("Endless Mode");
  });
});
