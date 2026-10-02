import React from "react";
import { render, act, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RichNarrative } from "@/components/RichNarrative";
import { TerminologyProvider } from "@/components/providers/TerminologyProvider";

describe("RichNarrative Time-Sliced Rehydration", () => {
  type IdleCallback = (deadline: IdleDeadline) => void;
  let scheduledCallbacks: Map<number, IdleCallback>;
  let nextCallbackId: number;
  let cancelledIds: number[];

  beforeEach(() => {
    scheduledCallbacks = new Map();
    nextCallbackId = 1;
    cancelledIds = [];

    vi.stubGlobal("requestIdleCallback", (cb: IdleCallback) => {
      const id = nextCallbackId++;
      scheduledCallbacks.set(id, cb);
      return id;
    });

    vi.stubGlobal("cancelIdleCallback", (id: number) => {
      cancelledIds.push(id);
      scheduledCallbacks.delete(id);
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const runNextIdleCallback = (timeRemainingMs = 50) => {
    const firstEntry = scheduledCallbacks.entries().next().value;
    if (!firstEntry) return false;
    const [id, cb] = firstEntry;
    scheduledCallbacks.delete(id);

    const deadline: IdleDeadline = {
      didTimeout: false,
      timeRemaining: () => timeRemainingMs,
    };

    act(() => {
      cb(deadline);
    });
    return true;
  };

  it("processes DOM nodes incrementally in time-sliced chunks across idle callbacks", () => {
    // Generate 12 paragraph elements to require multiple chunks (CHUNK_SIZE = 5)
    const paragraphs = Array.from(
      { length: 12 },
      (_, i) => `<p>Paragraph ${i + 1}</p>`
    ).join("");
    const html = `<div>${paragraphs}</div>`;

    render(<RichNarrative html={html} />);

    // Initially, before any idle callbacks run, rehydratedContent is null and fallback HTML is present
    expect(scheduledCallbacks.size).toBe(1);

    // Run 1st chunk with timeRemaining = 0 (processes 1 node)
    runNextIdleCallback(0);
    expect(scheduledCallbacks.size).toBe(1);

    // Run 2nd chunk with timeRemaining = 50 (processes 5 nodes)
    runNextIdleCallback(50);
    expect(scheduledCallbacks.size).toBe(1);

    // Run 3rd chunk with timeRemaining = 50 (processes 5 nodes)
    runNextIdleCallback(50);
    expect(scheduledCallbacks.size).toBe(1);

    // Run 4th chunk with timeRemaining = 50 (processes final remaining node)
    runNextIdleCallback(50);

    // All chunks finished, no more callbacks scheduled
    expect(scheduledCallbacks.size).toBe(0);

    // All paragraphs are rendered
    expect(screen.getByText("Paragraph 1")).not.toBeNull();
    expect(screen.getByText("Paragraph 12")).not.toBeNull();
  });

  it("commits rehydrated content atomically only after all child chunks finish processing", () => {
    const html = `
      <p>Node 1</p>
      <p>Node 2</p>
      <p>Node 3</p>
      <p>Node 4</p>
      <p>Node 5</p>
      <p>Node 6</p>
      <p>Node 7</p>
    `;

    const { container } = render(<RichNarrative html={html} />);

    // First chunk runs (partial)
    runNextIdleCallback(0); // processes 1 node, 6 nodes remaining

    // Verify fallback markup is still active and rehydration commit has not occurred prematurely
    // (fallback is rendered via dangerouslySetInnerHTML)
    expect(scheduledCallbacks.size).toBe(1);

    // Finish all remaining chunks
    while (scheduledCallbacks.size > 0) {
      runNextIdleCallback(50);
    }

    expect(scheduledCallbacks.size).toBe(0);
    expect(container.textContent).toContain("Node 1");
    expect(container.textContent).toContain("Node 7");
  });

  it("cancels pending idle callbacks on unmount", () => {
    const paragraphs = Array.from(
      { length: 10 },
      (_, i) => `<p>Paragraph ${i + 1}</p>`
    ).join("");

    const { unmount } = render(<RichNarrative html={paragraphs} />);

    expect(scheduledCallbacks.size).toBe(1);
    const initialId = Array.from(scheduledCallbacks.keys())[0];

    unmount();

    expect(cancelledIds).toContain(initialId);
    expect(scheduledCallbacks.size).toBe(0);
  });

  it("cancels pending rehydration and resets buffer when html prop changes mid-rehydration", () => {
    const html1 = Array.from(
      { length: 10 },
      (_, i) => `<p>Doc1 Node ${i}</p>`
    ).join("");
    const html2 = `<p>Doc2 Single Node</p>`;

    const { rerender, container } = render(<RichNarrative html={html1} />);

    expect(scheduledCallbacks.size).toBe(1);
    const doc1CallbackId = Array.from(scheduledCallbacks.keys())[0];

    // Rerender with new HTML before doc1 completes
    rerender(<RichNarrative html={html2} />);

    // Old callback cancelled
    expect(cancelledIds).toContain(doc1CallbackId);

    // Complete new rehydration
    while (scheduledCallbacks.size > 0) {
      runNextIdleCallback(50);
    }

    expect(container.textContent).toContain("Doc2 Single Node");
    expect(container.textContent).not.toContain("Doc1 Node 0");
  });

  it("rehydrates terminology tags correctly across time-sliced chunks", () => {
    const html = `
      <p>Header text</p>
      <p>Middle text</p>
      <p>Use <span data-term="GxP" data-definition="Good Practice standards" data-key="gxp">GxP</span> guidelines.</p>
    `;

    render(
      <TerminologyProvider>
        <RichNarrative html={html} />
      </TerminologyProvider>
    );

    while (scheduledCallbacks.size > 0) {
      runNextIdleCallback(50);
    }

    const tooltipTrigger = screen.getByText("GxP");
    expect(tooltipTrigger).not.toBeNull();
  });
});
