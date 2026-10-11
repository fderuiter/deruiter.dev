import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/dynamic", () => ({
  default: () =>
    function ForBetterOrBulkStub() {
      return <div data-testid="fbb-game" />;
    },
}));

import { ForBetterOrBulkClient } from "@/components/arcade/ForBetterOrBulkClient";
import ForBetterOrBulkPage, {
  metadata,
} from "@/app/arcade/for-better-or-bulk/page";

describe("For Better or Bulk route (#1906)", () => {
  it("frames the cabinet with the story and a link to the real wedding", () => {
    render(<ForBetterOrBulkClient />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "For Better or Bulk"
    );
    expect(
      screen
        .getByRole("link", { name: "See the real wedding" })
        .getAttribute("href")
    ).toBe("/wedding");
    expect(
      screen.getAllByRole("button", { name: /Launch Cabinet/i }).length
    ).toBeGreaterThan(0);
    expect(
      screen
        .getByRole("link", { name: /Patty's Drive-Thru/ })
        .getAttribute("href")
    ).toBe("/arcade/patty-drive-thru");
  });

  it("publishes the page's metadata and structured data", () => {
    expect(String(metadata.title)).toContain("For Better or Bulk");
    const { container } = render(<ForBetterOrBulkPage />);
    const jsonLd = container.querySelector(
      'script[type="application/ld+json"]'
    );
    expect(jsonLd?.textContent).toContain("/arcade/for-better-or-bulk");
  });
});
