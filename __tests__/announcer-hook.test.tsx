import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import {
  A11yProvider,
  useAnnouncer,
  sanitizePII,
  liveAnnouncer,
} from "@/components/providers/A11yProvider";

function TestAnnouncerComponent() {
  const { announce } = useAnnouncer();
  return (
    <div>
      <button
        onClick={() =>
          announce(
            "Proof discharged successfully: Modus Ponens verified",
            "polite"
          )
        }
      >
        Announce Polite
      </button>
      <button
        onClick={() =>
          announce(
            "Critical Error: Circular dependency detected in CRF rule DAG",
            "assertive"
          )
        }
      >
        Announce Assertive
      </button>
      <button
        onClick={() =>
          announce("Sensitive record with SSN 123-45-6789 processed", "polite")
        }
      >
        Announce SPI
      </button>
    </div>
  );
}

describe("A11yProvider & useAnnouncer Dynamic Screen Reader Engine", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    liveAnnouncer.clear();
  });

  afterEach(() => {
    liveAnnouncer.clear();
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders polite and assertive aria-live regions in the DOM", () => {
    render(
      <A11yProvider>
        <TestAnnouncerComponent />
      </A11yProvider>
    );

    const politeRegion = document.querySelector('[aria-live="polite"]');
    const assertiveRegion = document.querySelector('[aria-live="assertive"]');

    expect(politeRegion).not.toBeNull();
    expect(assertiveRegion).not.toBeNull();
    expect(politeRegion?.getAttribute("aria-atomic")).toBe("true");
    expect(assertiveRegion?.getAttribute("aria-atomic")).toBe("true");
  });

  it("dispatches polite announcements to aria-live polite region", () => {
    render(
      <A11yProvider>
        <TestAnnouncerComponent />
      </A11yProvider>
    );

    const politeBtn = screen.getByRole("button", { name: "Announce Polite" });
    act(() => {
      politeBtn.click();
    });

    const politeRegion = document.querySelector('[aria-live="polite"]');
    expect(politeRegion?.textContent).toContain(
      "Proof discharged successfully: Modus Ponens verified"
    );
  });

  it("dispatches assertive announcements with high priority to aria-live assertive region", () => {
    render(
      <A11yProvider>
        <TestAnnouncerComponent />
      </A11yProvider>
    );

    const assertiveBtn = screen.getByRole("button", {
      name: "Announce Assertive",
    });
    act(() => {
      assertiveBtn.click();
    });

    const assertiveRegion = document.querySelector('[aria-live="assertive"]');
    expect(assertiveRegion?.textContent).toContain(
      "Critical Error: Circular dependency detected in CRF rule DAG"
    );
  });

  it("redacts sensitive personal information (SPI) from screen reader announcements", () => {
    render(
      <A11yProvider>
        <TestAnnouncerComponent />
      </A11yProvider>
    );

    const spiBtn = screen.getByRole("button", { name: "Announce SPI" });
    act(() => {
      spiBtn.click();
    });

    const politeRegion = document.querySelector('[aria-live="polite"]');
    expect(politeRegion?.textContent).toContain("***-**-****");
    expect(politeRegion?.textContent).not.toContain("123-45-6789");
  });

  it("plays the newest of rapid polite messages after the active one's dwell, without resetting its timer", () => {
    function SequentialTester() {
      const { announce } = useAnnouncer();
      return (
        <div>
          <button onClick={() => announce("Message 1", "polite")}>Msg1</button>
          <button onClick={() => announce("Message 2", "polite")}>Msg2</button>
          <button onClick={() => announce("Message 3", "polite")}>Msg3</button>
        </div>
      );
    }

    render(
      <A11yProvider>
        <SequentialTester />
      </A11yProvider>
    );

    const politeRegion = document.querySelector('[aria-live="polite"]');
    const seen: string[] = [];
    const observer = () => {
      const text = politeRegion?.textContent ?? "";
      if (text && seen[seen.length - 1] !== text) seen.push(text);
    };

    act(() => {
      screen.getByRole("button", { name: "Msg1" }).click();
    });
    observer();
    expect(politeRegion?.textContent).toBe("Message 1");

    act(() => {
      vi.advanceTimersByTime(500);
      screen.getByRole("button", { name: "Msg2" }).click();
    });
    observer();
    expect(politeRegion?.textContent).toBe("Message 1");

    act(() => {
      vi.advanceTimersByTime(300);
      screen.getByRole("button", { name: "Msg3" }).click();
    });
    observer();
    expect(politeRegion?.textContent).toBe("Message 1");

    // Message 1's 1000ms dwell was not reset by the queued messages.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    observer();
    expect(politeRegion?.textContent).toBe("Message 3");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(politeRegion?.textContent).toBe("");

    // Message 2 was superseded before it was played.
    expect(seen).toEqual(["Message 1", "Message 3"]);
  });

  it("assertive alerts immediately supersede active polite announcements without repeating interrupted message", () => {
    function PreemptionTester() {
      const { announce } = useAnnouncer();
      return (
        <div>
          <button onClick={() => announce("Polite Update 1", "polite")}>
            Polite1
          </button>
          <button onClick={() => announce("Polite Update 2", "polite")}>
            Polite2
          </button>
          <button onClick={() => announce("Critical Alert", "assertive")}>
            Assertive1
          </button>
        </div>
      );
    }

    render(
      <A11yProvider>
        <PreemptionTester />
      </A11yProvider>
    );

    const politeRegion = document.querySelector('[aria-live="polite"]');
    const assertiveRegion = document.querySelector('[aria-live="assertive"]');

    act(() => {
      screen.getByRole("button", { name: "Polite1" }).click();
    });
    expect(politeRegion?.textContent).toBe("Polite Update 1");

    act(() => {
      vi.advanceTimersByTime(500);
      screen.getByRole("button", { name: "Polite2" }).click();
    });
    expect(politeRegion?.textContent).toBe("Polite Update 1");

    act(() => {
      vi.advanceTimersByTime(300);
      screen.getByRole("button", { name: "Assertive1" }).click();
    });

    expect(assertiveRegion?.textContent).toBe("Critical Alert");
    expect(politeRegion?.textContent).toBe("");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(assertiveRegion?.textContent).toBe("");
    expect(politeRegion?.textContent).toBe("Polite Update 2");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(politeRegion?.textContent).toBe("");
  });

  it("preserves stable reference identity for the announce callback to prevent render loops", () => {
    const announceRef = { current: null as unknown };

    function StabilityComponent() {
      const { announce } = useAnnouncer();
      React.useEffect(() => {
        announceRef.current = announce;
      }, [announce]);
      return <button onClick={() => announce("Test")}>Test</button>;
    }

    const { rerender } = render(
      <A11yProvider>
        <StabilityComponent />
      </A11yProvider>
    );

    const initialRef = announceRef.current;
    expect(initialRef).toBeTypeOf("function");

    rerender(
      <A11yProvider>
        <StabilityComponent />
      </A11yProvider>
    );

    expect(announceRef.current).toBe(initialRef);
  });

  it("sanitizes Social Security Numbers using sanitizePII helper", () => {
    expect(sanitizePII("User SSN is 123-45-6789")).toBe(
      "User SSN is ***-**-****"
    );
    expect(sanitizePII("Multiple SSNs: 987-65-4321 and 111-22-3333")).toBe(
      "Multiple SSNs: ***-**-**** and ***-**-****"
    );
    expect(sanitizePII("Clean message without PII")).toBe(
      "Clean message without PII"
    );
  });
});
