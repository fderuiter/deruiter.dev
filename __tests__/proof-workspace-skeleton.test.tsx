// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProofWorkspaceSkeleton } from "../app/(desktop)/proof/ProofWorkspaceSkeleton";

describe("ProofWorkspaceSkeleton (#589)", () => {
  afterEach(() => {
    cleanup();
  });

  it("disables the Share, Custom Studio, and Export toolbar buttons while the real workspace is still loading", () => {
    render(<ProofWorkspaceSkeleton />);

    // Regression: these buttons previously rendered as fully interactive,
    // focusable controls with no onClick/disabled state while the real
    // ProofWorkspaceClient (dynamically imported with ssr:false) was still
    // mounting -- a keyboard/screen-reader user tabbing during that window
    // reached three "buttons" that silently did nothing.
    const shareBtn = screen.getByRole("button", { name: /share/i });
    const customStudioBtn = screen.getByRole("button", {
      name: /custom studio/i,
    });
    const exportBtn = screen.getByRole("button", { name: /export/i });

    for (const btn of [shareBtn, customStudioBtn, exportBtn]) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    }
  });
});
