/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  ArcadeHubClient,
  ArcadeOrientationBanner,
  CATEGORY_TABS,
  type ArcadeCategory,
} from "@/components/arcade/ArcadeHubClient";
import {
  safeSetRawItem,
  safeGetRawItem,
  safeRemoveItem,
} from "@/lib/safe-storage";

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

// Mock framer-motion
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
  };
});

// Mock Next.js navigation & Link
vi.mock("next/navigation", () => ({
  usePathname: () => "/arcade",
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

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

describe("Arcade Hub Onboarding Banner & Category Filters Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.keys(storageStore).forEach((k) => delete storageStore[k]);
    safeRemoveItem("arcade_hub_onboarding_dismissed");
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

  it("renders orientation banner when not dismissed and allows dismissing it", async () => {
    await act(async () => {
      root.render(<ArcadeHubClient />);
    });

    expect(container.textContent).toContain("Welcome to the Arcade");
    expect(container.textContent).toContain(
      "Hands-on Software Architecture & Domain Prototypes"
    );
    expect(container.textContent).toContain("Recommended Starters:");

    const dismissBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) =>
        btn.getAttribute("aria-label") === "Dismiss orientation banner" ||
        btn.textContent?.trim() === "Dismiss"
    );
    expect(dismissBtn).toBeDefined();

    await act(async () => {
      dismissBtn?.click();
    });

    expect(safeGetRawItem("arcade_hub_onboarding_dismissed")).toBe("true");
    expect(container.textContent).not.toContain(
      "Hands-on Software Architecture & Domain Prototypes"
    );
  });

  it("hides orientation banner if previously dismissed in storage", async () => {
    safeSetRawItem("arcade_hub_onboarding_dismissed", "true");

    await act(async () => {
      root.render(<ArcadeHubClient />);
    });

    expect(container.textContent).not.toContain(
      "Hands-on Software Architecture & Domain Prototypes"
    );
  });

  it("renders category filter tabs and filters game cards dynamically", async () => {
    await act(async () => {
      root.render(<ArcadeHubClient />);
    });

    for (const tab of CATEGORY_TABS) {
      expect(container.textContent).toContain(tab.label);
    }

    // Default 'All Games' shows all 8 games
    expect(container.textContent).toContain("Working With Duck");
    expect(container.textContent).toContain(
      "Laser Loon: Quest for the State Flag"
    );
    expect(container.textContent).toContain("Quasi-Perfect Puzzler");
    expect(container.textContent).toContain(
      "Clinical Trial Chaos: CDISC Compliance"
    );

    // Click 'Clinical & RegTech' filter tab
    const clinicalTab = Array.from(container.querySelectorAll("button")).find(
      (btn) =>
        btn.getAttribute("role") === "tab" &&
        btn.textContent?.includes("Clinical & RegTech")
    );
    expect(clinicalTab).toBeDefined();

    await act(async () => {
      clinicalTab?.click();
    });

    // Should show clinical games and filter out others
    const h2Titles = Array.from(container.querySelectorAll("h2")).map(
      (h) => h.textContent
    );
    expect(h2Titles).toContain("Clinical Trial Chaos: CDISC Compliance");
    expect(h2Titles).toContain("Trial & Error: Biostat Ops");
    expect(h2Titles).toContain("Study Director: Everything Is Fine");
    expect(h2Titles).not.toContain("Working With Duck");
    expect(h2Titles).not.toContain("Laser Loon: Quest for the State Flag");

    // Click 'Logic & Verification' filter tab
    const logicTab = Array.from(container.querySelectorAll("button")).find(
      (btn) =>
        btn.getAttribute("role") === "tab" &&
        btn.textContent?.includes("Logic & Verification")
    );
    expect(logicTab).toBeDefined();

    await act(async () => {
      logicTab?.click();
    });

    const logicH2Titles = Array.from(container.querySelectorAll("h2")).map(
      (h) => h.textContent
    );
    expect(logicH2Titles).toContain("Quasi-Perfect Puzzler");
    expect(logicH2Titles).not.toContain(
      "Clinical Trial Chaos: CDISC Compliance"
    );
  });

  it("renders ArcadeOrientationBanner directly and handles dismissal", async () => {
    const dummyCat: ArcadeCategory = "clinical";
    expect(dummyCat).toBe("clinical");

    await act(async () => {
      root.render(<ArcadeOrientationBanner />);
    });

    expect(container.textContent).toContain("Welcome to the Arcade");
    const dismissBtn = container.querySelector("button");
    expect(dismissBtn).not.toBeNull();

    await act(async () => {
      dismissBtn?.click();
    });

    expect(safeGetRawItem("arcade_hub_onboarding_dismissed")).toBe("true");
    expect(container.textContent).toBe("");
  });

  it("renders Recommended Starter badges on introductory games", async () => {
    await act(async () => {
      root.render(<ArcadeHubClient />);
    });

    const starterBadges = Array.from(container.querySelectorAll("span")).filter(
      (span) => span.textContent?.includes("Recommended Starter")
    );
    expect(starterBadges.length).toBeGreaterThanOrEqual(2);
  });
});
