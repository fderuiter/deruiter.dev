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
import RecruiterSimulator from "@/components/simulator/RecruiterSimulatorClient";

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

describe("RecruiterSimulator - Ecosystem-Aligned Accessibility Integration", () => {
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
    expect(typeof RecruiterSimulator).toBe("function");
  });

  it("delays and assigns focus to the active question card container on mount and step transitions", () => {
    const { container } = render(<RecruiterSimulator />);

    // On mount, cardRef should focus after 400ms
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Find the focused element
    const activeCard = container.querySelector('[tabindex="-1"]');
    expect(activeCard).not.toBeNull();
    expect(document.activeElement).toBe(activeCard);

    // Click an option to transition
    const optionBtn = screen.getAllByText("Systems & Performance")[0];
    fireEvent.click(optionBtn);

    // Advancing timers should trigger the next delayed focus redirection
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // After transition completes, activeCard should be focused again
    const newActiveCard = container.querySelector('[tabindex="-1"]');
    expect(document.activeElement).toBe(newActiveCard);
  });

  it("announces progress changes politely on step transitions", () => {
    render(<RecruiterSimulator />);

    // Click an option to trigger transition
    const optionBtn = screen.getAllByText("Systems & Performance")[0];
    fireEvent.click(optionBtn);

    // Verify polite announcement
    expect(mockAnnounce).toHaveBeenCalledWith("Step completed", "polite");
  });

  it("triggers assertive audio announcement with score and title, and provides accessible circular gauge description on completion", () => {
    render(<RecruiterSimulator />);

    // Step 1
    fireEvent.click(screen.getAllByText("Systems & Performance")[0]);
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Step 2
    fireEvent.click(
      screen.getAllByText(
        "Engage Distributed Circuit Breaker & Fallback Queue"
      )[0]
    );
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Step 3
    fireEvent.click(
      screen.getAllByText(
        "Enforce Exhaustive Idempotency Keys & Deduplication Window"
      )[0]
    );
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Assertive announcement
    expect(mockAnnounce).toHaveBeenCalledWith(
      expect.stringContaining("Alignment complete. Result: A Focus on Systems"),
      "assertive"
    );
    expect(mockAnnounce).toHaveBeenCalledWith(
      expect.stringContaining("Match"),
      "assertive"
    );

    // Visual gauge replacement label
    const gaugeContainer = screen.getByRole("img", { name: /Scenario match/i });
    expect(gaugeContainer).toBeDefined();
    expect(gaugeContainer.getAttribute("aria-label")).toContain(
      "Scenario match (just for exploration):"
    );
  });

  it("hides decorative vector graphics and raw symbol arrows using aria-hidden", () => {
    const { container } = render(<RecruiterSimulator />);

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

  it("transmits targeted telemetry events for option selection, milestone completion, and schedule click", () => {
    render(<RecruiterSimulator />);

    // Step 1: Option Select
    const option1 = screen.getAllByText("Systems & Performance")[0];
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

    // Click Schedule on Google Calendar CTA
    const scheduleLink = screen.getByText(/Schedule on Google Calendar/i);
    fireEvent.click(scheduleLink);
    expect(mockRecordEvent).toHaveBeenCalledWith(
      "simulator",
      "simulator_schedule_click"
    );
  });

  it("synchronizes option selections to URL hash parameters and supports direct deep link state restoration", () => {
    window.location.hash = "#step=final_eval&ans=0,1,0";

    render(<RecruiterSimulator />);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Verify completed evaluation is restored directly from hash parameters
    expect(screen.getByText("A Focus on Systems")).toBeDefined();
    const gaugeContainer = screen.getByRole("img", { name: /Scenario match/i });
    expect(gaugeContainer).toBeDefined();
  });

  it("updates hash parameters on option selection and supports back button state recovery", () => {
    render(<RecruiterSimulator />);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Click step 1 option
    const optionBtn = screen.getAllByText("Systems & Performance")[0];
    fireEvent.click(optionBtn);

    expect(window.location.hash).toBe("#step=incident_triage&ans=0");

    // Click back button in simulator
    const backBtn = screen.getByRole("button", { name: "Back" });
    fireEvent.click(backBtn);

    expect(window.location.hash).toBe("");
  });

  it("follows browser Back/Forward navigation through the hash without local state drift", () => {
    render(<RecruiterSimulator />);

    fireEvent.click(screen.getAllByText("Systems & Performance")[0]);
    expect(screen.getByText(/Live Incident Commander/)).toBeDefined();

    // Simulate the browser restoring the previous history entry
    act(() => {
      window.history.replaceState(null, "", window.location.pathname);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByText(/Define Your Target Profile/)).toBeDefined();
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
    const { unmount } = render(<RecruiterSimulator />);
    expect(screen.getByText(/Code Review Speed Challenge/)).toBeDefined();
    unmount();

    window.location.hash = "#step=bogus&ans=0";
    render(<RecruiterSimulator />);
    expect(screen.getByText(/Define Your Target Profile/)).toBeDefined();
  });

  it("hydrates a deep link without a server/client markup mismatch", async () => {
    const { renderToString } = await import("react-dom/server");
    const { hydrateRoot } = await import("react-dom/client");

    window.location.hash = "#step=final_eval&ans=0,1,0";
    const html = renderToString(<RecruiterSimulator />);
    // The server snapshot has no hash, so SSR renders the welcome step
    expect(html).toContain("Define Your Target Profile");

    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const recoverable = vi.fn();

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(host, <RecruiterSimulator />, {
        onRecoverableError: recoverable,
      });
    });

    expect(recoverable).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    // After hydration the client snapshot restores the deep-linked result
    expect(host.textContent).toContain("A Focus on Systems");

    act(() => root?.unmount());
    host.remove();
    errorSpy.mockRestore();
  });
});
