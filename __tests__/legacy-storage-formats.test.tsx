// @vitest-environment jsdom
/**
 * #1468: FieldManualButton and the telemetry cache now go through
 * lib/safe-storage. Their stored keys and formats must stay exactly as they
 * were so returning visitors keep their data. The offline queue moved to
 * IndexedDB (#3807); its one-time import of the old localStorage arrays is
 * covered in offline-queue-hook-storage.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FieldManualButton } from "@/components/FieldManualButton";
import { safeStorage } from "@/lib/safe-storage";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({ playHover: vi.fn() }),
}));

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
    const newHint = () =>
      container.querySelector(".motion-safe\\:animate-ping-settle");

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
});
