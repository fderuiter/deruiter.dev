import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/dynamic", () => ({
  default: () =>
    function PattyDriveThruStub() {
      return <div data-testid="pdt-game" />;
    },
}));

import { PattyDriveThruClient } from "@/components/arcade/PattyDriveThruClient";
import PattyDriveThruPage, {
  metadata,
} from "@/app/arcade/patty-drive-thru/page";

describe("Patty's Drive-Thru route (#1813)", () => {
  it("frames the cabinet with the diary blurb and the companion post", () => {
    render(<PattyDriveThruClient />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Patty's Drive-Thru"
    );
    expect(
      screen
        .getByRole("link", { name: "Read the notes behind it" })
        .getAttribute("href")
    ).toBe("/blog/notes-from-my-first-job");
    expect(
      screen.getAllByRole("button", { name: /Launch Cabinet/i }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: /Study Director/ }).getAttribute("href")
    ).toBe("/arcade/study-director");
  });

  it("publishes the page's metadata and structured data", () => {
    expect(String(metadata.title)).toContain("Patty's Drive-Thru");
    const { container } = render(<PattyDriveThruPage />);
    const jsonLd = container.querySelector(
      'script[type="application/ld+json"]'
    );
    expect(jsonLd?.textContent).toContain("/arcade/patty-drive-thru");
  });
});
