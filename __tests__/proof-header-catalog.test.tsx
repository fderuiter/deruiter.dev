import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProofHeader } from "@/components/proof/ProofHeader";
import { THEOREMS } from "@/lib/proof-utils";

const renderHeader = (onSwitch = vi.fn()) =>
  render(
    <ProofHeader
      activeTheoremId="modus-ponens"
      handleSwitchTheorem={onSwitch}
      isE_Proven={false}
      edges={THEOREMS["modus-ponens"].initialEdges}
      handleCopyShareLink={vi.fn()}
      setIsCustomStudioOpen={vi.fn()}
      setIsExportModalOpen={vi.fn()}
      mobileActiveView="canvas"
      setMobileActiveView={vi.fn()}
      setActiveTab={vi.fn()}
    />
  );

describe("ProofHeader mobile catalog disclosure (#1236)", () => {
  afterEach(cleanup);

  it("collapses the catalog below md and names the active proof on the toggle", () => {
    renderHeader();
    const toggle = screen.getByTestId("proof-catalog-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain(THEOREMS["modus-ponens"].title);
    expect(screen.getByTestId("proof-catalog").className).toContain(
      "hidden md:grid"
    );
  });

  it("opens on toggle, then closes and returns focus after choosing a proof", () => {
    const onSwitch = vi.fn();
    renderHeader(onSwitch);
    const toggle = screen.getByTestId("proof-catalog-toggle");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("proof-catalog").className).not.toContain(
      "hidden md:grid"
    );

    const other = Object.keys(THEOREMS).find((k) => k !== "modus-ponens")!;
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(
          THEOREMS[other as keyof typeof THEOREMS].title.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          )
        ),
      })
    );
    expect(onSwitch).toHaveBeenCalledWith(other);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });
});
