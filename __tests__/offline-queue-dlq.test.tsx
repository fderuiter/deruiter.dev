import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  useOfflineQueue,
  enqueueOfflineRequest,
  clearOfflineQueue,
  clearDLQ,
  getOfflineQueue,
  getOfflineQueueLength,
  getDLQ,
  getDLQLength,
  flushOfflineQueue,
  type DeadLetterItem,
} from "@/hooks/useOfflineQueue";
import { CaseStudyFeedbackSection } from "@/components/CaseStudyFeedbackSection";
import { logger } from "@/lib/logger";

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

function TestDLQComponent() {
  const {
    queueLength,
    dlqQueue,
    dlqLength,
    clearDLQ: clearAllDLQ,
    dismissDLQItem: dismiss,
    retryDLQItem: retry,
  } = useOfflineQueue();

  return (
    <div>
      <span data-testid="queue-length">{queueLength}</span>
      <span data-testid="dlq-length">{dlqLength}</span>
      <button onClick={() => clearAllDLQ()}>Clear DLQ</button>
      <ul>
        {dlqQueue.map((item) => (
          <li key={item.id} data-testid={`dlq-item-${item.id}`}>
            {item.id}:{item.statusCode}:{item.failureReason}
            <button
              data-testid={`dismiss-${item.id}`}
              onClick={() => dismiss(item.id)}
            >
              Dismiss
            </button>
            <button
              data-testid={`retry-${item.id}`}
              onClick={() => retry(item.id)}
            >
              Retry
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

describe("Offline Queue Dead-Letter Queue (DLQ) & Failure Events Suite", () => {
  let originalLocalStorage: Storage;
  let fetchMock: ReturnType<typeof vi.fn>;
  let loggerErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    clearOfflineQueue();
    clearDLQ();

    loggerErrorSpy = vi.spyOn(logger, "error").mockImplementation(() => ({
      level: "error",
      message: "",
      timestamp: "",
    }));

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
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      };
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    clearOfflineQueue();
    clearDLQ();
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  describe("Requirement 1 & Requirement 2: 4xx Errors Moved to DLQ", () => {
    it("increments failed count, excludes from processed count, and saves 4xx non-retriable items to portfolio_offline_dlq", async () => {
      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: "Validation failed: Invalid comments" }),
      }));

      enqueueOfflineRequest({
        type: "feedback",
        endpoint: "/api/case-studies/feedback",
        body: {
          caseStudySlug: "test-slug",
          takeaways: [],
          comments: "Bad input",
        },
      });

      expect(getOfflineQueueLength()).toBe(1);

      let flushResult: { processed: number; failed: number } = {
        processed: 0,
        failed: 0,
      };
      await act(async () => {
        flushResult = await flushOfflineQueue();
      });

      // 1. Flush stats
      expect(flushResult.processed).toBe(0);
      expect(flushResult.failed).toBe(1);

      // 2. Active offline queue is empty
      expect(getOfflineQueueLength()).toBe(0);

      // 3. DLQ storage contains the item
      const dlqItems = getDLQ();
      expect(dlqItems.length).toBe(1);
      expect(dlqItems[0].statusCode).toBe(400);
      expect(dlqItems[0].failureReason).toBe(
        "Validation failed: Invalid comments"
      );
      expect(typeof dlqItems[0].failedAt).toBe("number");

      // 4. Verify LocalStorage key portfolio_offline_dlq
      const rawDLQ = localStorage.getItem("portfolio_offline_dlq");
      expect(rawDLQ).toBeDefined();
      expect(rawDLQ).toContain("Validation failed: Invalid comments");
    });

    it("continues processing remaining queued items after moving a 4xx item to DLQ", async () => {
      // First call fails with 422, second succeeds with 200
      fetchMock
        .mockImplementationOnce(async () => ({
          ok: false,
          status: 422,
          json: async () => ({ message: "Unprocessable entity" }),
        }))
        .mockImplementationOnce(async () => ({
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        }));

      enqueueOfflineRequest({
        id: "item-422",
        type: "feedback",
        endpoint: "/api/case-studies/feedback",
        body: { caseStudySlug: "slug-1" },
      });

      enqueueOfflineRequest({
        id: "item-200",
        type: "telemetry",
        endpoint: "/api/telemetry",
        body: { projectSlug: "slug-2" },
      });

      expect(getOfflineQueueLength()).toBe(2);

      let flushResult: { processed: number; failed: number } = {
        processed: 0,
        failed: 0,
      };
      await act(async () => {
        flushResult = await flushOfflineQueue();
      });

      expect(flushResult.processed).toBe(1);
      expect(flushResult.failed).toBe(1);

      expect(getOfflineQueueLength()).toBe(0);
      expect(getDLQLength()).toBe(1);
      expect(getDLQ()[0].id).toBe("item-422");
    });

    it("does not move retriable HTTP 429 or 408 to DLQ immediately", async () => {
      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: "Rate limit exceeded" }),
      }));

      enqueueOfflineRequest({
        type: "telemetry",
        endpoint: "/api/telemetry",
        body: { event: "rate_test" },
      });

      await act(async () => {
        await flushOfflineQueue();
      });

      // Stays in main queue for retry, not in DLQ
      expect(getDLQLength()).toBe(0);
      expect(getOfflineQueueLength()).toBe(1);
      expect(getOfflineQueue()[0].retries).toBe(1);
    });
  });

  describe("Requirement 4: Logging and Event Dispatching", () => {
    it("logs error via logger.error and dispatches portfolio-offline-queue-error when request moves to DLQ", async () => {
      const errorListener = vi.fn();
      window.addEventListener("portfolio-offline-queue-error", errorListener);

      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: "Forbidden access" }),
      }));

      enqueueOfflineRequest({
        id: "item-403",
        type: "feedback",
        endpoint: "/api/case-studies/feedback",
        body: { caseStudySlug: "forbidden-test" },
      });

      await act(async () => {
        await flushOfflineQueue();
      });

      expect(loggerErrorSpy).toHaveBeenCalled();
      expect(errorListener).toHaveBeenCalledTimes(1);

      const event = errorListener.mock
        .calls[0][0] as CustomEvent<DeadLetterItem>;
      expect(event.detail.id).toBe("item-403");
      expect(event.detail.statusCode).toBe(403);
      expect(event.detail.failureReason).toBe("Forbidden access");

      window.removeEventListener(
        "portfolio-offline-queue-error",
        errorListener
      );
    });
  });

  describe("Constraints: Capping DLQ Size at 50 Items (FIFO)", () => {
    it("caps dead-letter queue size at 50 items using FIFO eviction rule", async () => {
      fetchMock.mockImplementation(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: "Bad Request" }),
      }));

      // Enqueue 55 failing requests
      for (let i = 1; i <= 55; i++) {
        enqueueOfflineRequest({
          id: `req-${i}`,
          type: "telemetry",
          endpoint: `/api/test-${i}`,
          body: { idx: i },
        });
      }

      await act(async () => {
        await flushOfflineQueue();
      });

      const dlq = getDLQ();
      expect(dlq.length).toBe(50);
      // First 5 items (req-1 to req-5) evicted; earliest remaining is req-6
      expect(dlq[0].id).toBe("req-6");
      expect(dlq[49].id).toBe("req-55");
    });
  });

  describe("Requirement 5: DLQ Helpers & Hook State", () => {
    it("exposes clearDLQ, dismissDLQItem, and retryDLQItem on useOfflineQueue", async () => {
      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid parameters" }),
      }));

      enqueueOfflineRequest({
        id: "dlq-target",
        type: "feedback",
        endpoint: "/api/case-studies/feedback",
        body: { caseStudySlug: "dlq-helper-test" },
      });

      await act(async () => {
        await flushOfflineQueue();
      });

      render(<TestDLQComponent />);

      expect(screen.getByTestId("dlq-length").textContent).toBe("1");
      expect(screen.getByTestId("dlq-item-dlq-target")).toBeDefined();

      // Test Retry button
      const retryBtn = screen.getByTestId("retry-dlq-target");
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });
      await act(async () => {
        fireEvent.click(retryBtn);
      });

      // Item moved back to active offline queue
      expect(screen.getByTestId("dlq-length").textContent).toBe("0");
      expect(getOfflineQueueLength()).toBe(1);
      expect(getOfflineQueue()[0].type).toBe("feedback");

      // Move back to DLQ for Dismiss test
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      });
      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid parameters" }),
      }));

      await act(async () => {
        await flushOfflineQueue();
      });

      expect(screen.getByTestId("dlq-length").textContent).toBe("1");

      // Test Dismiss button
      const dismissBtn = screen.getByTestId("dismiss-dlq-target");
      await act(async () => {
        fireEvent.click(dismissBtn);
      });

      expect(screen.getByTestId("dlq-length").textContent).toBe("0");
      expect(getDLQLength()).toBe(0);
    });
  });

  describe("Acceptance Criterion 5: CaseStudyFeedbackSection DLQ Notifications", () => {
    it("displays error notification in CaseStudyFeedbackSection when queued request fails with 4xx error", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });

      render(<CaseStudyFeedbackSection slug="clinical-trial-chaos" />);

      // Fill and submit feedback offline
      const takeawayBtn = screen.getAllByRole("button", {
        name: /Architecture & System Design/i,
      })[0];
      fireEvent.click(takeawayBtn);

      const commentInput = screen.getByLabelText(
        /Constructive Comments & Key Takeaways/i
      );
      fireEvent.change(commentInput, {
        target: { value: "Great post-mortem analysis." },
      });

      const submitBtn = screen.getAllByRole("button", {
        name: /Submit Learning Feedback/i,
      })[0];
      fireEvent.click(submitBtn);

      expect(screen.getByText("Feedback Submitted!")).toBeDefined();

      // Simulate coming back online where server returns 422 Unprocessable Entity
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        status: 422,
        json: async () => ({
          error: "Comment contains restricted formatting.",
        }),
      }));

      await act(async () => {
        window.dispatchEvent(new Event("online"));
        await flushOfflineQueue();
      });

      // Error notification is displayed in UI
      expect(screen.queryByText("Feedback Submitted!")).toBeNull();
      expect(screen.getByRole("alert")).toBeDefined();
      expect(
        screen.getByText("Comment contains restricted formatting.")
      ).toBeDefined();
    });
  });
});
