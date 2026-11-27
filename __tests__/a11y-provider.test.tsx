import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import {
  A11yProvider,
  useAnnouncer,
} from "@/components/providers/A11yProvider";
import { LiveAnnouncer } from "@/lib/a11y/announcer";

function TestComponent() {
  const { announce } = useAnnouncer();
  return (
    <div>
      <button onClick={() => announce("Proof verified successfully", "polite")}>
        Announce Polite
      </button>
      <button
        onClick={() =>
          announce("Critical Error: Rule cycle detected", "assertive")
        }
      >
        Announce Assertive
      </button>
      <button
        onClick={() => announce("User SSN 123-45-6789 verified", "polite")}
      >
        Announce PII
      </button>
    </div>
  );
}

describe("A11yProvider Integration (Thin DOM Live-Region Renderer)", () => {
  let customAnnouncer: LiveAnnouncer;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    customAnnouncer = new LiveAnnouncer();
  });

  afterEach(() => {
    cleanup();
    customAnnouncer.destroy();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders polite and assertive screen reader live-region DOM nodes", () => {
    render(
      <A11yProvider announcer={customAnnouncer}>
        <TestComponent />
      </A11yProvider>
    );

    const politeNode = document.querySelector('[aria-live="polite"]');
    const assertiveNode = document.querySelector('[aria-live="assertive"]');

    expect(politeNode).not.toBeNull();
    expect(assertiveNode).not.toBeNull();
    expect(politeNode?.getAttribute("aria-atomic")).toBe("true");
    expect(assertiveNode?.getAttribute("aria-atomic")).toBe("true");
    expect(politeNode?.classList.contains("sr-only")).toBe(true);
    expect(assertiveNode?.classList.contains("sr-only")).toBe(true);
  });

  it("renders polite announcement text into the polite live region", () => {
    render(
      <A11yProvider announcer={customAnnouncer}>
        <TestComponent />
      </A11yProvider>
    );

    const politeBtn = screen.getByRole("button", { name: "Announce Polite" });
    act(() => {
      politeBtn.click();
    });

    const politeNode = document.querySelector('[aria-live="polite"]');
    expect(politeNode?.textContent).toBe("Proof verified successfully");
  });

  it("renders assertive announcement text and preempts polite live region", () => {
    render(
      <A11yProvider announcer={customAnnouncer}>
        <TestComponent />
      </A11yProvider>
    );

    const politeBtn = screen.getByRole("button", { name: "Announce Polite" });
    act(() => {
      politeBtn.click();
    });

    const politeNode = document.querySelector('[aria-live="polite"]');
    expect(politeNode?.textContent).toBe("Proof verified successfully");

    const assertiveBtn = screen.getByRole("button", {
      name: "Announce Assertive",
    });
    act(() => {
      assertiveBtn.click();
    });

    const assertiveNode = document.querySelector('[aria-live="assertive"]');
    expect(assertiveNode?.textContent).toBe(
      "Critical Error: Rule cycle detected"
    );
    expect(politeNode?.textContent).toBe("");
  });

  it("masks sensitive personal identifiers (PII) before rendering to live region", () => {
    render(
      <A11yProvider announcer={customAnnouncer}>
        <TestComponent />
      </A11yProvider>
    );

    const piiBtn = screen.getByRole("button", { name: "Announce PII" });
    act(() => {
      piiBtn.click();
    });

    const politeNode = document.querySelector('[aria-live="polite"]');
    expect(politeNode?.textContent).toContain("***-**-****");
    expect(politeNode?.textContent).not.toContain("123-45-6789");
  });

  it("advances queued polite messages in FIFO order across 3-second auto-expiration timers", () => {
    function MultiMessageComponent() {
      const { announce } = useAnnouncer();
      return (
        <div>
          <button onClick={() => announce("Message 1", "polite")}>Msg 1</button>
          <button onClick={() => announce("Message 2", "polite")}>Msg 2</button>
        </div>
      );
    }

    render(
      <A11yProvider announcer={customAnnouncer}>
        <MultiMessageComponent />
      </A11yProvider>
    );

    const politeNode = document.querySelector('[aria-live="polite"]');

    act(() => {
      screen.getByRole("button", { name: "Msg 1" }).click();
      screen.getByRole("button", { name: "Msg 2" }).click();
    });

    expect(politeNode?.textContent).toBe("Message 1");

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(politeNode?.textContent).toBe("Message 2");

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(politeNode?.textContent).toBe("");
  });

  it("maintains stable referential identity for the announce callback across re-renders", () => {
    const callbackRefs: Array<
      (msg: string, priority?: "polite" | "assertive") => void
    > = [];

    function RefTracker() {
      const { announce } = useAnnouncer();
      callbackRefs.push(announce);
      return <button onClick={() => announce("Test")}>Test</button>;
    }

    const { rerender } = render(
      <A11yProvider announcer={customAnnouncer}>
        <RefTracker />
      </A11yProvider>
    );

    expect(callbackRefs.length).toBe(1);

    rerender(
      <A11yProvider announcer={customAnnouncer}>
        <RefTracker />
      </A11yProvider>
    );

    expect(callbackRefs.length).toBe(2);
    expect(callbackRefs[0]).toBe(callbackRefs[1]);
  });

  it("provides safe fallback announcer when useAnnouncer is called outside of A11yProvider", () => {
    function StandaloneComponent() {
      const { announce } = useAnnouncer();
      return (
        <button onClick={() => announce("Standalone message")}>
          Standalone
        </button>
      );
    }

    render(<StandaloneComponent />);

    const btn = screen.getByRole("button", { name: "Standalone" });
    expect(() => {
      act(() => {
        btn.click();
      });
    }).not.toThrow();
  });
});
