// @vitest-environment jsdom
/**
 * #1468: FieldManualButton, the offline queue and the telemetry cache now go
 * through lib/safe-storage. Their stored keys and formats must stay exactly
 * as they were so returning visitors keep their data.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FieldManualButton } from "@/components/FieldManualButton";
import {
  clearOfflineQueue,
  enqueueOfflineRequest,
  getOfflineQueue,
  type QueuedRequest,
} from "@/hooks/useOfflineQueue";
import { safeStorage } from "@/lib/safe-storage";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({ playHover: vi.fn() }),
}));

const QUEUE_KEY = "portfolio_offline_queue";

describe("legacy storage formats (#1468)", () => {
  beforeEach(() => {
    localStorage.clear();
    safeStorage.clearCache();
  });

  describe("FieldManualButton", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(async () => {
      await act(async () => root.unmount());
      container.remove();
    });

    const openButton = () =>
      container.querySelector<HTMLButtonElement>(
        'button[aria-label^="Open Field Manual"]'
      );
    const newHint = () => container.querySelector(".animate-ping");

    it('writes a bare "true" under seen_manual_<id> and hides the hint', async () => {
      await act(async () => {
        root.render(<FieldManualButton manualId="patrol" />);
      });
      expect(newHint()).not.toBeNull();

      await act(async () => {
        openButton()!.click();
      });

      expect(localStorage.getItem("seen_manual_patrol")).toBe("true");
      expect(newHint()).toBeNull();
    });

    it("reads a value stored by the previous implementation", async () => {
      localStorage.setItem("seen_manual_patrol", "true");
      await act(async () => {
        root.render(<FieldManualButton manualId="patrol" />);
      });
      expect(openButton()).not.toBeNull();
      expect(newHint()).toBeNull();
    });
  });

  describe("offline queue", () => {
    afterEach(() => clearOfflineQueue());

    it("stores the queue as a bare JSON array, not an envelope", () => {
      enqueueOfflineRequest({
        type: "reaction",
        endpoint: "/api/reactions",
        body: { emoji: "+1" },
      });
      const stored = JSON.parse(localStorage.getItem(QUEUE_KEY)!);
      expect(Array.isArray(stored)).toBe(true);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        type: "reaction",
        endpoint: "/api/reactions",
        body: { emoji: "+1" },
      });
    });

    it("reads a queue written by the previous implementation", () => {
      const legacy: QueuedRequest[] = [
        {
          id: "legacy-1",
          type: "feedback",
          endpoint: "/api/feedback",
          body: { text: "hi" },
          createdAt: 1,
          retries: 0,
        },
      ];
      localStorage.setItem(QUEUE_KEY, JSON.stringify(legacy));
      expect(getOfflineQueue()).toEqual(legacy);
    });

    it("ignores a malformed stored value instead of throwing", () => {
      localStorage.setItem(QUEUE_KEY, "{not json");
      expect(getOfflineQueue()).toEqual([]);
    });

    it("does not throw when localStorage rejects the write", () => {
      const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new DOMException("full", "QuotaExceededError");
        });
      try {
        expect(() =>
          enqueueOfflineRequest({
            type: "reaction",
            endpoint: "/api/reactions",
            body: { n: 1 },
          })
        ).not.toThrow();
      } finally {
        setItem.mockRestore();
      }
    });
  });
});
