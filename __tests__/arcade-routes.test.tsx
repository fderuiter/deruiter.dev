/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// Mock ResizeObserver and IntersectionObserver for JSDOM
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

// Mock Canvas 2D context
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
  arc: vi.fn(),
  arcTo: vi.fn(),
  ellipse: vi.fn(),
  roundRect: vi.fn(),
  quadraticCurveTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  measureText: vi.fn(() => ({
    width: 50,
    actualBoundingBoxAscent: 10,
    actualBoundingBoxDescent: 2,
  })),
  rect: vi.fn(),
  clip: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  setLineDash: vi.fn(),
};

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as any);
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  left: 0,
  top: 0,
  width: 768,
  height: 420,
  right: 768,
  bottom: 420,
  x: 0,
  y: 0,
  toJSON: () => {},
}));

// Mock framer-motion with full proxy and hooks support
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const Component = ({
    children,
    className,
    style,
    onClick,
    ...props
  }: any) => (
    <div className={className} style={style} onClick={onClick} {...props}>
      {children}
    </div>
  );
  const Button = ({
    children,
    className,
    style,
    onClick,
    type,
    ...props
  }: any) => (
    <button
      type={type || "button"}
      className={className}
      style={style}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );

  return {
    ...actual,
    motion: new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === "button") return Button;
          return Component;
        },
      }
    ),
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useReducedMotion: () => false,
    useInView: () => true,
  };
});

// Mock AudioProvider
vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
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
  };
});

// Mock useTelemetry
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(true),
  }),
}));

// Mock Next.js navigation & Link
vi.mock("next/navigation", () => ({
  usePathname: () => "/arcade",
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

import ArcadePage from "@/app/(desktop)/arcade/page";
import LaserLoonPage from "@/app/(desktop)/arcade/laser-loon/page";
import QuasiPuzzlerPage from "@/app/(desktop)/arcade/quasi-puzzler/page";
import GarminWatchPage from "@/app/(desktop)/arcade/garmin-watch/page";
import ClinicalChaosPage from "@/app/(desktop)/arcade/clinical-chaos/page";
import RetroLabyrinthPage from "@/app/(desktop)/arcade/retro-labyrinth/page";
import WorkingWithDuckPage from "@/app/(desktop)/arcade/working-with-duck/page";
import MemeVaultPage from "@/app/(desktop)/arcade/meme-vault/page";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

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

describe("Arcade Dedicated Routes Suite", () => {
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

  it("renders main Arcade Hub with all games listed and valid CollectionPage JSON-LD", async () => {
    await act(async () => {
      root.render(<ArcadePage />);
    });

    expect(container.textContent).toContain("Engineering");
    expect(container.textContent).toContain("Arcade Hub");
    expect(container.textContent).toContain("Working With Duck");
    expect(container.textContent).toContain(
      "Laser Loon: Quest for the State Flag"
    );
    expect(container.textContent).toContain("Quasi-Perfect Puzzler");
    expect(container.textContent).toContain(
      "Monkey C Mayhem: Garmin Schvitz App"
    );
    expect(container.textContent).toContain(
      "Clinical Trial Chaos: CDISC Compliance"
    );
    expect(container.textContent).toContain(
      "Retro Labyrinth: Graveyard Roguelike"
    );

    const script = container.querySelector(
      "script[type='application/ld+json']"
    );
    expect(script).not.toBeNull();
    const ldJson = JSON.parse(script!.innerHTML);
    expect(ldJson["@type"]).toBe("CollectionPage");
    expect(ldJson.name).toBe(ROUTE_METADATA_CONFIGS.arcade.title);
    expect(ldJson.description).toBe(ROUTE_METADATA_CONFIGS.arcade.description);
    expect(ldJson.url).toContain(ROUTE_METADATA_CONFIGS.arcade.path);
  });

  it("renders Working With Duck dedicated game page and aligned WebApplication JSON-LD", async () => {
    await act(async () => {
      root.render(<WorkingWithDuckPage />);
    });
    expect(container.textContent).toContain("Arcade Hub");
    expect(container.textContent).toContain("Working With");
    expect(container.textContent).toContain("Duck");
    expect(container.textContent).toContain(
      "Pet Simulation / Multitasking Arcade"
    );

    const script = container.querySelector(
      "script[type='application/ld+json']"
    );
    expect(script).not.toBeNull();
    const ldJson = JSON.parse(script!.innerHTML);
    expect(ldJson["@type"]).toBe("WebApplication");
    expect(ldJson.name).toBe(ROUTE_METADATA_CONFIGS.workingWithDuck.title);
    expect(ldJson.description).toBe(
      ROUTE_METADATA_CONFIGS.workingWithDuck.description
    );
    expect(ldJson.description).toContain("Duck the puppy");
    expect(ldJson.description).not.toContain("conversational debugging");
  });

  it("renders Laser Loon dedicated game page and aligned WebApplication JSON-LD", async () => {
    await act(async () => {
      root.render(<LaserLoonPage />);
    });
    expect(container.textContent).toContain("Arcade Hub");
    expect(container.textContent).toContain("Laser Loon:");
    expect(container.textContent).toContain("Quest for the State Flag");

    const script = container.querySelector(
      "script[type='application/ld+json']"
    );
    expect(script).not.toBeNull();
    const ldJson = JSON.parse(script!.innerHTML);
    expect(ldJson["@type"]).toBe("WebApplication");
    expect(ldJson.name).toBe(ROUTE_METADATA_CONFIGS.laserLoon.title);
    expect(ldJson.description).toBe(
      ROUTE_METADATA_CONFIGS.laserLoon.description
    );
    expect(ldJson.description).toContain("F277 Laser Loon");
    expect(ldJson.description).not.toContain("stratospheric relay");
  });

  it("renders Quasi-Perfect Puzzler dedicated game page and aligned formal verification JSON-LD", async () => {
    await act(async () => {
      root.render(<QuasiPuzzlerPage />);
    });
    expect(container.textContent).toContain("Arcade Hub");
    expect(container.textContent).toContain("Quasi-Perfect");
    expect(container.textContent).toContain("Puzzler");

    const script = container.querySelector(
      "script[type='application/ld+json']"
    );
    expect(script).not.toBeNull();
    const ldJson = JSON.parse(script!.innerHTML);
    expect(ldJson["@type"]).toBe("WebApplication");
    expect(ldJson.name).toBe(ROUTE_METADATA_CONFIGS.quasiPuzzler.title);
    expect(ldJson.description).toBe(
      ROUTE_METADATA_CONFIGS.quasiPuzzler.description
    );
    expect(ldJson.description).toContain("Lean-inspired");
    expect(ldJson.description).toContain("deductive proof tactics");
    expect(ldJson.description).not.toContain("crystallographic");
    expect(ldJson.description).not.toContain("Penrose");
  });

  it("renders Garmin Watch Simulator dedicated game page and aligned WebApplication JSON-LD", async () => {
    await act(async () => {
      root.render(<GarminWatchPage />);
    });
    expect(container.textContent).toContain("Arcade Hub");
    expect(container.textContent).toContain("Monkey C Mayhem");
    expect(container.textContent).toContain("Garmin Schvitz App");

    const script = container.querySelector(
      "script[type='application/ld+json']"
    );
    expect(script).not.toBeNull();
    const ldJson = JSON.parse(script!.innerHTML);
    expect(ldJson["@type"]).toBe("WebApplication");
    expect(ldJson.name).toBe(ROUTE_METADATA_CONFIGS.garminWatch.title);
    expect(ldJson.description).toBe(
      ROUTE_METADATA_CONFIGS.garminWatch.description
    );
  });

  it("renders Clinical Trial Chaos dedicated game page and aligned WebApplication JSON-LD", async () => {
    await act(async () => {
      root.render(<ClinicalChaosPage />);
    });
    expect(container.textContent).toContain("Arcade Hub");
    expect(container.textContent).toContain("Clinical Trial Chaos:");
    expect(container.textContent).toContain("CDISC Compliance");

    const script = container.querySelector(
      "script[type='application/ld+json']"
    );
    expect(script).not.toBeNull();
    const ldJson = JSON.parse(script!.innerHTML);
    expect(ldJson["@type"]).toBe("WebApplication");
    expect(ldJson.name).toBe(ROUTE_METADATA_CONFIGS.clinicalChaos.title);
    expect(ldJson.description).toBe(
      ROUTE_METADATA_CONFIGS.clinicalChaos.description
    );
  });

  it("renders Retro Labyrinth dedicated game page and aligned WebApplication JSON-LD", async () => {
    await act(async () => {
      root.render(<RetroLabyrinthPage />);
    });
    expect(container.textContent).toContain("Arcade Hub");
    expect(container.textContent).toContain("Retro Labyrinth:");
    expect(container.textContent).toContain("Graveyard Roguelike");

    const script = container.querySelector(
      "script[type='application/ld+json']"
    );
    expect(script).not.toBeNull();
    const ldJson = JSON.parse(script!.innerHTML);
    expect(ldJson["@type"]).toBe("WebApplication");
    expect(ldJson.name).toBe(ROUTE_METADATA_CONFIGS.retroLabyrinth.title);
    expect(ldJson.description).toBe(
      ROUTE_METADATA_CONFIGS.retroLabyrinth.description
    );
  });

  it("renders Meme Vault dedicated game page and aligned WebApplication JSON-LD", async () => {
    await act(async () => {
      root.render(<MemeVaultPage />);
    });
    expect(container.textContent).toContain("Arcade Hub");

    const script = container.querySelector(
      "script[type='application/ld+json']"
    );
    expect(script).not.toBeNull();
    const ldJson = JSON.parse(script!.innerHTML);
    expect(ldJson["@type"]).toBe("WebApplication");
    expect(ldJson.name).toBe(ROUTE_METADATA_CONFIGS.memeVault.title);
    expect(ldJson.description).toBe(
      ROUTE_METADATA_CONFIGS.memeVault.description
    );
  });
});
