/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fireEvent } from "@testing-library/react";
import { Timeline } from "@/components/Timeline";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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

// Mock framer-motion with full proxy and hooks support to prevent transition freezes in jsdom tests
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const Component = ({
    children,
    className,
    style,
    onClick,
    ...props
  }: any) => {
    // filter out motion-specific properties that react 19 warns about
    const {
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...rest
    } = props;
    return (
      <div className={className} style={style} onClick={onClick} {...rest}>
        {children}
      </div>
    );
  };
  const Button = ({
    children,
    className,
    style,
    onClick,
    type,
    ...props
  }: any) => {
    const {
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...rest
    } = props;
    return (
      <button
        type={type || "button"}
        className={className}
        style={style}
        onClick={onClick}
        {...rest}
      >
        {children}
      </button>
    );
  };

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

describe("Timeline Inline-Marked RichNarrative Integration", () => {
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
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    mockStorage.clear();
  });

  it("should render timeline in reality mode when selected", async () => {
    await act(async () => {
      root.render(<Timeline />);
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const realityBtn = buttons.find((btn) =>
      btn.textContent?.includes("BEHIND THE SCENES REALITY")
    );
    expect(realityBtn).toBeDefined();

    await act(async () => {
      realityBtn?.click();
    });

    // Should contain some reality descriptions
    expect(container.textContent).toContain(
      "A study protocol can run to 150 pages."
    );
    expect(container.textContent).not.toContain(
      "I build and maintain the clinical databases"
    );
  });

  it("should toggle to the Professional Summary and render GxP and eCRF marked terms", async () => {
    await act(async () => {
      root.render(<Timeline />);
    });

    // Find and click the 'PROFESSIONAL SUMMARY' button
    const buttons = Array.from(container.querySelectorAll("button"));
    const professionalBtn = buttons.find((btn) =>
      btn.textContent?.includes("PROFESSIONAL SUMMARY")
    );
    expect(professionalBtn).toBeDefined();

    await act(async () => {
      professionalBtn?.click();
    });

    // GxP and eCRF should now be rendered inside interactive tooltip trigger spans
    // and Source Document Verification (SDV) too
    const triggers = Array.from(
      container.querySelectorAll("span[aria-describedby]")
    );
    expect(triggers.length).toBeGreaterThanOrEqual(3);

    const triggerTexts = triggers.map((t) => t.textContent);
    expect(triggerTexts).toContain("GxP");
    expect(triggerTexts).toContain("eCRFs");
    expect(triggerTexts).toContain("Source Document Verification (SDV)");
  });

  it("presents the current BRIGHT role as ongoing work in Professional mode and keeps the candid story behind the scenes", async () => {
    await act(async () => {
      root.render(<Timeline />);
    });

    // Professional is the default perspective.
    const pressed = container.querySelector(
      '[aria-label="Timeline Reading Perspective"] [aria-pressed="true"]'
    );
    expect(pressed?.textContent).toBe("PROFESSIONAL SUMMARY");
    expect(container.textContent).toContain(
      "I build and maintain the clinical databases behind active GxP research studies"
    );

    // The card-level toggle flips only that card to the candid version.
    const cardToggle = container.querySelector(
      'button[aria-label^="Professional view of Clinical Data Specialist"]'
    ) as HTMLButtonElement;
    expect(cardToggle?.textContent).toBe("Professional");
    await act(async () => {
      cardToggle.click();
    });
    expect(cardToggle.textContent).toBe("Behind the Scenes");
    expect(container.textContent).toContain(
      "The footnotes tend to earn their keep."
    );
    expect(container.textContent).toContain("I used Epic SlicerDicer");
  });

  it("should dynamically translate terms and render simplified timeline dictionary slice when simplified-terminology switch is toggled", async () => {
    // Enable simplified-terminology in mock localStorage
    mockStorage.setItem("simplified-terminology", JSON.stringify(true));

    await act(async () => {
      root.render(<Timeline />);
    });

    // Switch to the Professional Summary
    const buttons = Array.from(container.querySelectorAll("button"));
    const professionalBtn = buttons.find((btn) =>
      btn.textContent?.includes("PROFESSIONAL SUMMARY")
    );
    await act(async () => {
      professionalBtn?.click();
    });

    // Timeline entries should display content from the simplified timeline dictionary slice
    expect(container.textContent).toContain(
      "I improved recruitment using hospital records"
    );
    expect(container.textContent).toContain(
      "I managed the day-to-day work of clinical studies"
    );

    // Should not contain detailed terminology strings
    expect(container.textContent).not.toContain(
      "I used Epic SlicerDicer and MyChart"
    );
  });

  it("should render tooltip elements with proper typographic style isolation ignoring parent italics", async () => {
    await act(async () => {
      root.render(<Timeline />);
    });

    // Switch to the Professional Summary
    const professionalBtn = Array.from(
      container.querySelectorAll("button")
    ).find((btn) => btn.textContent?.includes("PROFESSIONAL SUMMARY"));
    await act(async () => {
      professionalBtn?.click();
    });

    // Find the GxP trigger
    const gxpTrigger = Array.from(
      container.querySelectorAll("span[aria-describedby]")
    ).find((t) => t.textContent === "GxP");
    expect(gxpTrigger).toBeDefined();

    // Hover to trigger tooltip rendering using React testing library fireEvent
    await act(async () => {
      fireEvent.mouseEnter(gxpTrigger!);
    });

    // The tooltip should be active in the DOM
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toContain("Good Practice standards");

    // Verify typography isolation classes
    const classes = tooltip?.className;
    expect(classes).toContain("not-italic");
    expect(classes).toContain("font-sans");
    expect(classes).toContain("font-normal");
  });
});
