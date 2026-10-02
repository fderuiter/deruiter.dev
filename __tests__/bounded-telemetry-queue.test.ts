// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  enqueueRetryItem,
  getRetryQueue,
  getRetryQueueLength,
  getQueueCapacity,
  setQueueCapacity,
  clearRetryQueue,
  DEFAULT_MAX_QUEUE_CAPACITY,
} from "@/hooks/useTelemetry";

describe("In-Memory Bounded FIFO Telemetry Queue", () => {
  beforeEach(() => {
    clearRetryQueue();
    setQueueCapacity(DEFAULT_MAX_QUEUE_CAPACITY);
  });

  afterEach(() => {
    clearRetryQueue();
    setQueueCapacity(DEFAULT_MAX_QUEUE_CAPACITY);
  });

  it("should have default maximum queue capacity of 50", () => {
    expect(getQueueCapacity()).toBe(50);
    expect(DEFAULT_MAX_QUEUE_CAPACITY).toBe(50);
  });

  it("should enforce configurable maximum queue capacity limit", () => {
    setQueueCapacity(5);
    expect(getQueueCapacity()).toBe(5);

    for (let i = 1; i <= 10; i++) {
      enqueueRetryItem({
        projectSlug: `project-${i}`,
        eventType: "page_view",
        retries: 0,
      });
    }

    expect(getRetryQueueLength()).toBe(5);
  });

  it("should evict oldest event (FIFO) and retain newest event when full", () => {
    setQueueCapacity(3);

    enqueueRetryItem({
      projectSlug: "event-1",
      eventType: "page_view",
      retries: 0,
    });
    enqueueRetryItem({
      projectSlug: "event-2",
      eventType: "project_click",
      retries: 1,
    });
    enqueueRetryItem({
      projectSlug: "event-3",
      eventType: "route_error",
      retries: 2,
    });

    expect(getRetryQueueLength()).toBe(3);
    const initialQueue = getRetryQueue();
    expect(initialQueue[0].projectSlug).toBe("event-1");

    // Add 4th event to full queue
    enqueueRetryItem({
      projectSlug: "event-4",
      eventType: "page_view",
      retries: 0,
    });

    expect(getRetryQueueLength()).toBe(3);
    const updatedQueue = getRetryQueue();
    expect(updatedQueue[0].projectSlug).toBe("event-2");
    expect(updatedQueue[1].projectSlug).toBe("event-3");
    expect(updatedQueue[2].projectSlug).toBe("event-4");
  });

  it("should preserve existing retry attempt counts and ordering for un-evicted items", () => {
    setQueueCapacity(3);

    enqueueRetryItem({
      projectSlug: "evicted",
      eventType: "page_view",
      retries: 0,
    });
    enqueueRetryItem({
      projectSlug: "stay-1",
      eventType: "project_click",
      retries: 2,
    });
    enqueueRetryItem({
      projectSlug: "stay-2",
      eventType: "route_error",
      retries: 1,
    });

    // Evict oldest item
    enqueueRetryItem({
      projectSlug: "new-item",
      eventType: "page_view",
      retries: 0,
    });

    const queue = getRetryQueue();
    expect(queue.length).toBe(3);
    expect(queue[0]).toEqual({
      projectSlug: "stay-1",
      eventType: "project_click",
      retries: 2,
    });
    expect(queue[1]).toEqual({
      projectSlug: "stay-2",
      eventType: "route_error",
      retries: 1,
    });
    expect(queue[2]).toEqual({
      projectSlug: "new-item",
      eventType: "page_view",
      retries: 0,
    });
  });

  it("should dynamically trim queue from oldest end when reducing queue capacity", () => {
    setQueueCapacity(10);
    for (let i = 1; i <= 10; i++) {
      enqueueRetryItem({
        projectSlug: `event-${i}`,
        eventType: "page_view",
        retries: 0,
      });
    }
    expect(getRetryQueueLength()).toBe(10);

    // Reduce capacity to 4
    setQueueCapacity(4);

    expect(getQueueCapacity()).toBe(4);
    expect(getRetryQueueLength()).toBe(4);

    const queue = getRetryQueue();
    expect(queue.map((item) => item.projectSlug)).toEqual([
      "event-7",
      "event-8",
      "event-9",
      "event-10",
    ]);
  });

  it("should clear retry queue and reset length synchronously when requested", () => {
    enqueueRetryItem({
      projectSlug: "test",
      eventType: "page_view",
      retries: 0,
    });
    expect(getRetryQueueLength()).toBe(1);

    clearRetryQueue();
    expect(getRetryQueueLength()).toBe(0);
    expect(getRetryQueue()).toEqual([]);
  });
});
