/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import ArchetypeSimulator from "@/components/simulator/ArchetypeSimulatorClient";

const mockRecordEvent = vi.fn();
const mockPlayNote = vi.fn();
const mockPlaySuccess = vi.fn();
const mockAnnounce = vi.fn();

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: mockRecordEvent,
  }),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: mockPlayNote,
    playSuccess: mockPlaySuccess,
  }),
}));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({
    announce: mockAnnounce,
  }),
}));

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

/** Answers the first option of all three questions (path 0,0,0). */
function completePath() {
  for (const text of [
    "Systems Rigor & Fault Isolation",
    "Engage Distributed Circuit Breaker & Fallback Queue",
    "Enforce Exhaustive Idempotency Keys & Deduplication Window",
  ]) {
    fireEvent.click(screen.getAllByText(text)[0]);
    act(() => {
      vi.advanceTimersByTime(400);
    });
  }
}

describe("ArchetypeSimulator - Ecosystem-Aligned Accessibility Integration", () => {
  beforeEach(() => {
    window.location.hash = "";
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("exports a function as default", () => {
    expect(typeof ArchetypeSimulator).toBe("function");
  });

  it("delays and moves focus to the active step heading on mount and step transitions", () => {
    render(<ArchetypeSimulator />);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const firstHeading = screen.getByRole("heading", {
      level: 2,
      name: /Choose Your Architecture Bias/,
    });
    expect(firstHeading.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(firstHeading);

    fireEvent.click(screen.getAllByText("Systems Rigor & Fault Isolation")[0]);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(document.activeElement).toBe(
      screen.getByRole("heading", { level: 2, name: /Live Incident Commander/ })
    );
  });

  it("uses h2 for step headings so the page keeps a single h1", () => {
    const { container } = render(<ArchetypeSimulator />);
    expect(container.querySelectorAll("h1")).toHaveLength(0);
    expect(container.querySelectorAll("h2")).toHaveLength(1);
  });

  it("announces progress changes politely on step transitions", () => {
    render(<ArchetypeSimulator />);

    // Click an option to trigger transition
    const optionBtn = screen.getAllByText("Systems Rigor & Fault Isolation")[0];
    fireEvent.click(optionBtn);

    // Verify polite announcement
    expect(mockAnnounce).toHaveBeenCalledWith("Step completed", "polite");
  });

  it("announces the archetype and renders the evaluation screen without hiring framing", () => {
    const { container } = render(<ArchetypeSimulator />);

    completePath();

    expect(mockAnnounce).toHaveBeenCalledWith(
      expect.stringContaining(
        "Evaluation complete. Architectural Archetype: Fault-Isolation Architect."
      ),
      "assertive"
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Fault-Isolation Architect",
      })
    ).toBeDefined();
    expect(screen.getByText("Architectural Archetype")).toBeDefined();

    // Circular gauge reports the lead axis, not a percentage match
    const gauge = screen.getByRole("img", { name: /Lead axis/i });
    expect(gauge.getAttribute("aria-label")).toBe(
      "Lead axis: Systems Rigor, 100 out of 100"
    );

    // Four decision-stat meters
    const meters = screen.getAllByRole("meter");
    expect(meters.map((m) => m.getAttribute("aria-labelledby"))).toEqual([
      "simulator-stat-systems",
      "simulator-stat-ui",
      "simulator-stat-resilience",
      "simulator-stat-velocity",
    ]);
    for (const label of [
      "Systems Rigor",
      "UI/UX Craft",
      "Resilience",
      "Velocity",
    ]) {
      expect(screen.getByRole("meter", { name: label })).toBeDefined();
    }
    expect(
      screen
        .getByRole("meter", { name: "UI/UX Craft" })
        .getAttribute("aria-valuenow")
    ).toBe("0");

    // Badges
    expect(screen.getByText("Systems bias")).toBeDefined();
    expect(screen.getByText("Resilience stance")).toBeDefined();

    // No hiring framing or booking link
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/match/i);
    expect(screen.queryByText(/Schedule on Google Calendar/i)).toBeNull();
  });

  it("offers Copy Report, Run Again and Case Studies actions", () => {
    render(<ArchetypeSimulator />);
    completePath();

    expect(screen.getByRole("button", { name: "Copy Report" })).toBeDefined();
    const caseStudies = screen.getByRole("link", { name: "Case Studies" });
    expect(caseStudies.getAttribute("href")).toBe("/case-studies");
    fireEvent.click(caseStudies);
    expect(mockRecordEvent).toHaveBeenCalledWith("simulator", "project_click");

    fireEvent.click(screen.getByRole("button", { name: "Run Again" }));
    expect(window.location.hash).toBe("");
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(document.activeElement).toBe(
      screen.getByRole("heading", {
        level: 2,
        name: /Choose Your Architecture Bias/,
      })
    );
  });

  it("copies a plain-text archetype report to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<ArchetypeSimulator />);
    completePath();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    const report = String(writeText.mock.calls[0][0]);
    expect(report).toContain(
      "Architectural Archetype: Fault-Isolation Architect"
    );
    expect(report).toContain("Systems Rigor: 100/100");
    expect(report).toContain("/simulator#step=final_eval&ans=0,0,0");
    expect(report).not.toMatch(/match|schedule/i);
    expect(mockRecordEvent).toHaveBeenCalledWith(
      "simulator",
      "simulator_report_copy"
    );
  });

  it("hides decorative vector graphics and raw symbol arrows using aria-hidden", () => {
    const { container } = render(<ArchetypeSimulator />);

    // Check option arrows are wrapped and hidden
    const arrowSpans = container.querySelectorAll('span[aria-hidden="true"]');
    expect(arrowSpans.length).toBeGreaterThan(0);
    let foundArrow = false;
    arrowSpans.forEach((span) => {
      if (span.textContent?.trim() === "→") {
        foundArrow = true;
      }
    });
    expect(foundArrow).toBe(true);
  });

  it("transmits targeted telemetry events for option selection and milestone completion", () => {
    render(<ArchetypeSimulator />);

    // Step 1: Option Select
    const option1 = screen.getAllByText("Systems Rigor & Fault Isolation")[0];
    fireEvent.click(option1);
    expect(mockRecordEvent).toHaveBeenCalledWith(
      "simulator",
      "simulator_option_select"
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Step 2: Option Select
    const option2 = screen.getAllByText(
      "Engage Distributed Circuit Breaker & Fallback Queue"
    )[0];
    fireEvent.click(option2);
    expect(mockRecordEvent).toHaveBeenCalledWith(
      "simulator",
      "simulator_option_select"
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Step 3: Milestone Reached (Final step)
    const option3 = screen.getAllByText(
      "Enforce Exhaustive Idempotency Keys & Deduplication Window"
    )[0];
    fireEvent.click(option3);
    expect(mockRecordEvent).toHaveBeenCalledWith(
      "simulator",
      "simulator_option_select"
    );
    expect(mockRecordEvent).toHaveBeenCalledWith(
      "simulator",
      "simulator_milestone_reached"
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });
  });

  it("synchronizes option selections to URL hash parameters and supports direct deep link state restoration", () => {
    window.location.hash = "#step=final_eval&ans=0,1,0";

    render(<ArchetypeSimulator />);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Verify completed evaluation is restored directly from hash parameters
    expect(screen.getByText("Distributed Systems Pragmatist")).toBeDefined();
    expect(screen.getByRole("img", { name: /Lead axis/i })).toBeDefined();
  });

  it("updates hash parameters on option selection and supports back button state recovery", () => {
    render(<ArchetypeSimulator />);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Click step 1 option
    const optionBtn = screen.getAllByText("Systems Rigor & Fault Isolation")[0];
    fireEvent.click(optionBtn);

    expect(window.location.hash).toBe("#step=incident_triage&ans=0");

    // Click back button in simulator
    const backBtn = screen.getByRole("button", { name: "Back" });
    fireEvent.click(backBtn);

    expect(window.location.hash).toBe("");
  });

  it("follows browser Back/Forward navigation through the hash without local state drift", () => {
    render(<ArchetypeSimulator />);

    fireEvent.click(screen.getAllByText("Systems Rigor & Fault Isolation")[0]);
    expect(screen.getByText(/Live Incident Commander/)).toBeDefined();

    // Simulate the browser restoring the previous history entry
    act(() => {
      window.history.replaceState(null, "", window.location.pathname);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByText(/Choose Your Architecture Bias/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();

    // And moving forward again
    act(() => {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}#step=code_review&ans=0,1`
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByText(/Code Review Speed Challenge/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Back" })).toBeDefined();
  });

  it("resumes after the last replayable answer when step is omitted, and falls back to welcome for an unknown step", () => {
    window.location.hash = "#ans=0,1";
    const { unmount } = render(<ArchetypeSimulator />);
    expect(screen.getByText(/Code Review Speed Challenge/)).toBeDefined();
    unmount();

    window.location.hash = "#step=bogus&ans=0";
    render(<ArchetypeSimulator />);
    expect(screen.getByText(/Choose Your Architecture Bias/)).toBeDefined();
  });

  it("drops unreplayable trailing indices when a new answer is chosen", () => {
    window.location.hash = "#ans=0,9";
    render(<ArchetypeSimulator />);
    expect(screen.getByText(/Live Incident Commander/)).toBeDefined();

    fireEvent.click(
      screen.getAllByText(
        "Engage Distributed Circuit Breaker & Fallback Queue"
      )[0]
    );
    const hash = new URLSearchParams(window.location.hash.slice(1));
    expect(hash.get("step")).toBe("code_review");
    expect(hash.get("ans")).toBe("0,0");
  });

  it("hydrates a deep link without a server/client markup mismatch", async () => {
    const { renderToString } = await import("react-dom/server");
    const { hydrateRoot } = await import("react-dom/client");

    window.location.hash = "#step=final_eval&ans=0,1,0";
    const html = renderToString(<ArchetypeSimulator />);
    // The server snapshot has no hash, so SSR renders the welcome step
    expect(html).toContain("Choose Your Architecture Bias");

    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const recoverable = vi.fn();

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(host, <ArchetypeSimulator />, {
        onRecoverableError: recoverable,
      });
    });

    expect(recoverable).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    // After hydration the client snapshot restores the deep-linked result
    expect(host.textContent).toContain("Distributed Systems Pragmatist");

    act(() => root?.unmount());
    host.remove();
    errorSpy.mockRestore();
  });
});
