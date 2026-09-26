// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CardTable } from "@/components/trial-and-error/CardTable";
import { MiniFigure } from "@/components/trial-and-error/cards/MiniFigure";
import { MiniTable } from "@/components/trial-and-error/cards/MiniTable";
import { ACT_III, SPONSOR_TOPLINE_SCENARIO } from "@/lib/trial-and-error";

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: () => <button type="button">Manual</button>,
}));

afterEach(cleanup);

const face = (id: string) => {
  const card = SPONSOR_TOPLINE_SCENARIO.deck.find((c) => c.id === id);
  if (!card?.face) throw new Error(`${id} has no face`);
  return card.face;
};

describe("Act III efficacy faces render (#1085)", () => {
  it("draws the forest plot's subgroups and describes them for the detail view", () => {
    const forest = face("C-F14.2.4");
    if (forest.kind !== "FIGURE") throw new Error("expected a figure");
    render(
      <MiniFigure
        plot={forest.plot}
        size="detail"
        label="Primary by subgroup"
      />
    );
    const img = screen.getByRole("img", { name: "Primary by subgroup" });
    for (const label of ["Overall", "Age < 65", "Age ≥ 65", "Female", "Male"]) {
      expect(img.textContent).toContain(label);
    }
  });

  it("renders the primary efficacy table by arm", () => {
    const table = face("C-T14.2.1");
    if (table.kind !== "TABLE") throw new Error("expected a table");
    render(<MiniTable face={table} size="detail" caption="Primary endpoint" />);
    expect(screen.getByRole("columnheader", { name: "Active" })).not.toBeNull();
    expect(screen.getByRole("rowheader", { name: "Resolved" })).not.toBeNull();
    expect(screen.getByText("5 (83)")).not.toBeNull();
  });

  it("opens Act III on the blinded data review with the forest plot dealt", () => {
    render(<CardTable act={ACT_III} seed="alpha" />);
    expect(screen.getAllByText(/Blinded Data Review/).length).toBeGreaterThan(
      0
    );
    const dealt = Array.from(
      document.querySelectorAll<HTMLElement>("[data-card-id]")
    ).map((el) => el.dataset.cardId);
    expect(dealt).toEqual(
      expect.arrayContaining(["C-T14.2.1-DRY", "C-F14.2.1", "C-F14.2.4"])
    );
  });
});
