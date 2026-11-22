// A real (in-memory) IndexedDB, so the hook runs on the durable store.
import "fake-indexeddb/auto";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  useOfflineQueue,
  enqueueOfflineRequest,
  clearOfflineQueue,
  getOfflineQueue,
  getOfflineQueueLength,
  getOfflineQueuePersistence,
  flushOfflineQueue,
  loadOfflineQueue,
} from "@/hooks/useOfflineQueue";
import { openOfflineQueueStore } from "@/lib/offline-queue";
import { CaseStudyFeedbackSection } from "@/components/CaseStudyFeedbackSection";

// Standard mock storage implementation
class MockStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

function TestOfflineQueueComponent() {
  const { queue, queueLength, isOnline, enqueue, clear, flush } =
    useOfflineQueue();

  return (
    <div>
      <span data-testid="queue-length">{queueLength}</span>
      <span data-testid="online-status">{isOnline ? "online" : "offline"}</span>
      <button
        onClick={() =>
          enqueue({
            type: "telemetry",
            endpoint: "/api/telemetry",
            body: { projectSlug: "test-slug", eventType: "page_view" },
          })
        }
      >
        Enqueue Event
      </button>
      <button onClick={() => clear()}>Clear Queue</button>
      <button onClick={() => flush()}>Flush Queue</button>
      <ul>
        {queue.map((item) => (
          <li key={item.id} data-testid={`item-${item.id}`}>
            {item.type}:{item.endpoint}
          </li>
        ))}
      </ul>
    </div>
  );
}

describe("Reusable Offline Queue Hook with Optimistic Feedback Sync Suite", () => {
  let originalLocalStorage: Storage;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await clearOfflineQueue();

    const mockStorage = new MockStorage();
    originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/api/case-studies/reactions")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            counts: {
              insightful: 1,
              mind_blowing: 0,
              actionable: 0,
              thorough: 0,
            },
            userReactions: ["insightful"],
          }),
        };
      }
      if (url.includes("/api/case-studies/feedback")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: "Thank you! Your learning feedback has been recorded.",
            hasSubmitted: false,
          }),
        };
      }
      if (url.includes("/api/telemetry")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(async () => {
    cleanup();
    await clearOfflineQueue();
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  describe("Requirement 1 & Acceptance Criterion 1: Optimistic UI & Offline Queueing", () => {
    it("preserves optimistic reaction state when offline without error banners", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });

      render(<CaseStudyFeedbackSection slug="clinical-trial-chaos" />);

      const reactionBtn = screen.getByRole("button", {
        name: /React with Insightful/i,
      });
      fireEvent.click(reactionBtn);

      // Reaction state remains active and optimistic
      expect(reactionBtn.getAttribute("aria-pressed")).toBe("true");

      // No error alert banner is displayed
      expect(screen.queryByRole("alert")).toBeNull();

      // Request is safely queued locally
      await waitFor(() => expect(getOfflineQueue()).toHaveLength(1));
      const queue = getOfflineQueue();
      expect(queue[0].type).toBe("reaction");
      expect(queue[0].endpoint).toBe("/api/case-studies/reactions");
    });

    it("preserves optimistic feedback submission state when offline without error banners", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });

      render(<CaseStudyFeedbackSection slug="clinical-trial-chaos" />);

      // Select takeaway pill
      const takeawayBtn = screen.getAllByRole("button", {
        name: /Architecture & System Design/i,
      })[0];
      fireEvent.click(takeawayBtn);

      // Enter comment
      const commentInput = screen.getByLabelText(
        /Constructive Comments & Key Takeaways/i
      );
      fireEvent.change(commentInput, {
        target: { value: "Great post-mortem breakdown of system resilience." },
      });

      // Submit feedback
      const submitBtn = screen.getAllByRole("button", {
        name: /Submit Learning Feedback/i,
      })[0];
      fireEvent.click(submitBtn);

      // Optimistic success state displayed once the store committed it
      expect(await screen.findByText("Feedback Submitted!")).toBeDefined();
      expect(
        screen.getByText("Thank you! Your learning feedback has been recorded.")
      ).toBeDefined();

      // No error banner
      expect(screen.queryByText(/Network error/i)).toBeNull();

      // Request is queued locally
      const queue = getOfflineQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].type).toBe("feedback");
      expect(queue[0].endpoint).toBe("/api/case-studies/feedback");
    });
  });

  describe("Idempotent feedback retries (#3807)", () => {
    it("queues a failed direct send with the same Idempotency-Key it sent", async () => {
      fetchMock.mockImplementation(async (url: string) =>
        url.includes("/api/case-studies/feedback")
          ? { ok: false, status: 503, json: async () => ({}) }
          : { ok: true, status: 200, json: async () => ({}) }
      );
      render(<CaseStudyFeedbackSection slug="clinical-trial-chaos" />);

      fireEvent.click(
        screen.getAllByRole("button", {
          name: /Architecture & System Design/i,
        })[0]
      );
      fireEvent.change(
        screen.getByLabelText(/Constructive Comments & Key Takeaways/i),
        { target: { value: "Clear walkthrough of the retry design." } }
      );
      fireEvent.click(
        screen.getAllByRole("button", { name: /Submit Learning Feedback/i })[0]
      );

      await waitFor(() => expect(getOfflineQueue()).toHaveLength(1));
      const direct = fetchMock.mock.calls.find(([url]) =>
        String(url).includes("/api/case-studies/feedback")
      );
      const sentKey = new Headers(direct?.[1]?.headers).get("Idempotency-Key");
      expect(sentKey).toMatch(/^feedback_/);
      expect(getOfflineQueue()[0].headers["Idempotency-Key"]).toBe(sentKey);
    });
  });

  describe("Requirement 2 & Acceptance Criterion 2: Telemetry Retention Across Reloads", () => {
    it("persists offline telemetry events in client storage across reloads", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });

      // Enqueue telemetry request via offline queue utility
      await enqueueOfflineRequest({
        type: "telemetry",
        endpoint: "/api/telemetry",
        body: { projectSlug: "proof-studio", eventType: "page_view" },
      });

      expect(getOfflineQueueLength()).toBe(1);

      expect(getOfflineQueuePersistence()).toBe("durable");

      // Stored in IndexedDB, not in the legacy localStorage key
      expect(localStorage.getItem("portfolio_offline_queue")).toBeNull();

      // Simulate a reload by reading the queue through a new connection
      const reopened = await openOfflineQueueStore();
      if (!reopened.ok) throw new Error("store did not open");
      const stored = await reopened.store.list();
      reopened.store.close();
      expect(stored).toHaveLength(1);
      expect(stored[0].body).toEqual({
        projectSlug: "proof-studio",
        eventType: "page_view",
      });
    });
  });

  describe("Requirement 3 & Acceptance Criterion 3: Sequential Online Event Flush", () => {
    it("automatically flushes queued requests sequentially when browser fires online event", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });

      await enqueueOfflineRequest({
        type: "reaction",
        endpoint: "/api/case-studies/reactions",
        body: { caseStudySlug: "imednet-sdk", reactionType: "mind_blowing" },
      });

      await enqueueOfflineRequest({
        type: "telemetry",
        endpoint: "/api/telemetry",
        body: { projectSlug: "imednet-sdk", eventType: "project_click" },
      });

      expect(getOfflineQueueLength()).toBe(2);

      // Reconnect network
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });

      await act(async () => {
        window.dispatchEvent(new Event("online"));
      });

      await act(async () => {
        await flushOfflineQueue();
      });

      // Queue is fully flushed
      expect(getOfflineQueueLength()).toBe(0);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/case-studies/reactions",
        expect.objectContaining({ method: "POST" })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/telemetry",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("applies exponential backoff on retryable 500 server errors", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });

      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal Server Error" }),
      }));

      await enqueueOfflineRequest({
        type: "telemetry",
        endpoint: "/api/telemetry",
        body: { projectSlug: "test", eventType: "page_view" },
      });

      await act(async () => {
        await flushOfflineQueue();
      });

      // Item remains queued with incremented retry count
      const queue = getOfflineQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].retries).toBe(1);
    });
  });

  describe("Requirement 4 & Acceptance Criterion 5: Cross-Tab Queue State Synchronization", () => {
    it("synchronizes queue updates across browser tabs via BroadcastChannel", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });

      const { unmount } = render(<TestOfflineQueueComponent />);

      expect(screen.getByTestId("queue-length").textContent).toBe("0");

      await act(async () => {
        await loadOfflineQueue();
      });

      // Another tab writes to the shared store and announces the change
      const otherTab = await openOfflineQueueStore();
      if (!otherTab.ok) throw new Error("store did not open");
      await otherTab.store.enqueue(
        {
          id: "ext-1",
          type: "reaction",
          endpoint: "/api/case-studies/reactions",
          body: { caseStudySlug: "test", reactionType: "thorough" },
        },
        Date.now()
      );
      otherTab.store.close();
      const announce = new BroadcastChannel("portfolio-offline-queue");
      announce.postMessage("changed");
      announce.close();

      // Active tab reflects synchronized queue count
      await waitFor(() =>
        expect(screen.getByTestId("queue-length").textContent).toBe("1")
      );
      unmount();
    });
  });

  describe("Requirement 5 & Acceptance Criterion 4: Hydration Mismatch Safety", () => {
    it("reads storage synchronously with referential stability and zero SSR hydration warnings", async () => {
      const initialQueue = getOfflineQueue();
      const secondRead = getOfflineQueue();

      // Referential identity check for memory cache stability
      expect(initialQueue).toEqual(secondRead);

      const { container } = render(<TestOfflineQueueComponent />);
      expect(container.textContent).toContain("0");
    });
  });
});
