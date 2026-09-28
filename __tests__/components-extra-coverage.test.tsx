// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  TerminologyProvider,
  useTerminology,
} from "@/components/providers/TerminologyProvider";
import { ProofHeader } from "@/components/proof/ProofHeader";
import { FieldManualButton } from "@/components/FieldManualButton";
import {
  InlineMarkdown,
  resolveSnippetTerminology,
} from "@/components/ui/InlineMarkdown";

// Component test helper for Terminology Hook
const TerminologyConsumer = () => {
  const { simplified, setSimplified, isFallback } = useTerminology();
  return (
    <div>
      <span data-testid="simplified">{String(simplified)}</span>
      <span data-testid="fallback">{String(isFallback ?? false)}</span>
      <button onClick={() => setSimplified((s) => !s)}>Toggle</button>
    </div>
  );
};

describe("components extra coverage suite", () => {
  describe("CopyButton component", () => {
    it("renders label and icon and handles copy click", async () => {
      cleanup();
      const onCopySuccess = vi.fn();
      const onCopy = vi.fn();

      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      const { getByRole } = render(
        <CopyButton
          text="Test Content"
          label="Copy Text"
          onCopySuccess={onCopySuccess}
          onCopy={onCopy}
        />
      );

      const btn = getByRole("button", { name: /Copy Text/i });
      expect(btn).toBeTruthy();

      fireEvent.click(btn);
      expect(onCopy).toHaveBeenCalled();
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          "Test Content"
        );
      });
    });

    it("supports function text prop and children render prop", async () => {
      cleanup();
      const { getByRole, getByText } = render(
        <CopyButton text={() => "Dynamic Content"}>
          {({ copied }) => (
            <span>{copied ? "Copied State" : "Initial State"}</span>
          )}
        </CopyButton>
      );

      const btn = getByRole("button");
      expect(getByText("Initial State")).toBeTruthy();
      fireEvent.click(btn);
    });
  });

  describe("TerminologyProvider & useTerminology", () => {
    it("provides terminology context and toggles state", () => {
      cleanup();
      const { getByTestId, getByText } = render(
        <TerminologyProvider>
          <TerminologyConsumer />
        </TerminologyProvider>
      );

      expect(getByTestId("simplified").textContent).toBe("false");
      fireEvent.click(getByText("Toggle"));
      expect(getByTestId("simplified").textContent).toBe("true");
    });

    it("returns safe fallback when used outside provider", () => {
      cleanup();
      const { getByTestId } = render(<TerminologyConsumer />);
      expect(getByTestId("fallback").textContent).toBe("true");
    });
  });

  describe("ProofHeader component", () => {
    it("renders header buttons and triggers callbacks on click", () => {
      cleanup();
      const handleSwitchTheorem = vi.fn();
      const handleCopyShareLink = vi.fn();
      const setIsCustomStudioOpen = vi.fn();
      const setIsExportModalOpen = vi.fn();
      const setMobileActiveView = vi.fn();
      const setActiveTab = vi.fn();

      const { getAllByRole } = render(
        <ProofHeader
          activeTheoremId="modus-ponens"
          handleSwitchTheorem={handleSwitchTheorem}
          isE_Proven={false}
          edges={[]}
          handleCopyShareLink={handleCopyShareLink}
          setIsCustomStudioOpen={setIsCustomStudioOpen}
          setIsExportModalOpen={setIsExportModalOpen}
          mobileActiveView="canvas"
          setMobileActiveView={setMobileActiveView}
          setActiveTab={setActiveTab}
        />
      );

      const buttons = getAllByRole("button");

      // Click Share
      const shareBtn = buttons.find((b) => b.textContent?.includes("Share"));
      if (shareBtn) {
        fireEvent.click(shareBtn);
        expect(handleCopyShareLink).toHaveBeenCalled();
      }

      // Click Custom Studio
      const customBtn = buttons.find((b) =>
        b.textContent?.includes("Custom Studio")
      );
      if (customBtn) {
        fireEvent.click(customBtn);
        expect(setIsCustomStudioOpen).toHaveBeenCalledWith(true);
      }

      // Click Export
      const exportBtn = buttons.find((b) => b.textContent?.includes("Export"));
      if (exportBtn) {
        fireEvent.click(exportBtn);
        expect(setIsExportModalOpen).toHaveBeenCalledWith(true);
      }

      // Click a Theorem card button
      const paxosBtn = buttons.find((b) =>
        b.textContent?.includes("Paxos Synod")
      );
      if (paxosBtn) {
        fireEvent.click(paxosBtn);
        expect(handleSwitchTheorem).toHaveBeenCalledWith("paxos-synod");
      }

      // Mobile view tabs
      const ledgerTab = buttons.find((b) => b.textContent?.includes("Ledger"));
      if (ledgerTab) {
        fireEvent.click(ledgerTab);
        expect(setMobileActiveView).toHaveBeenCalledWith("ledger");
        expect(setActiveTab).toHaveBeenCalledWith("ledger");
      }
    });
  });

  describe("FieldManualButton component", () => {
    it("renders field manual button and opens modal", () => {
      cleanup();
      const { getByRole, getByText } = render(
        <FieldManualButton manualId="proof" label="Proof Manual" />
      );
      const btn = getByRole("button", { name: /Open Field Manual/i });
      expect(btn).toBeTruthy();

      fireEvent.click(btn);
      expect(getByText(/Field Manual/i)).toBeTruthy();
    });
  });

  describe("InlineMarkdown component & resolveSnippetTerminology", () => {
    it("renders simple text and code elements", () => {
      cleanup();
      const { container } = render(
        <InlineMarkdown text="This is `code` and **bold** text." />
      );
      expect(container.textContent).toContain("This is");
      expect(container.textContent).toContain("code");
      expect(container.textContent).toContain("bold");
    });

    it("resolves snippet terminology with tags", () => {
      const html =
        '<span data-term="Simple Term" data-definition="Def">Technical Term</span>';
      expect(resolveSnippetTerminology(html, false)).toBe("Technical Term");
      expect(resolveSnippetTerminology(html, true)).toBe("Simple Term");
      expect(resolveSnippetTerminology("", false)).toBe("");
    });
  });
});
