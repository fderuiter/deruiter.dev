// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DesktopOnlyGate } from "../components/arcade/DesktopOnlyGate";
import { PHONE_QUERY } from "../components/arcade/mobile";

const mockCopy = vi.fn(async (text: string) => {
  void text;
});

vi.mock("@/lib/clipboard", () => ({
  copyToClipboard: (text: string) => mockCopy(text),
}));

const GATE_QUERY =
  "[@media(pointer:coarse)_and_((max-width:743px)_or_(max-height:500px))]";

describe("DesktopOnlyGate", () => {
  afterEach(() => {
    cleanup();
    mockCopy.mockClear();
  });

  it("server-renders both the cabinet and the notice, split by the touch media query", () => {
    const html = renderToStaticMarkup(
      <DesktopOnlyGate gameId="laser-loon" gameTitle="Laser Loon">
        <div data-testid="cabinet">cabinet</div>
      </DesktopOnlyGate>
    );
    // The markup a browser receives before any script runs.
    const container = document.createElement("div");
    container.innerHTML = html;

    const cabinetWrapper = container.querySelector(
      '[data-testid="cabinet"]'
    )?.parentElement;
    expect(cabinetWrapper?.className).toContain(`${GATE_QUERY}:hidden`);

    const notice = container.querySelector(
      '[data-testid="desktop-only-notice"]'
    );
    expect(notice?.className).toContain("hidden");
    expect(notice?.className).toContain(`${GATE_QUERY}:block`);
    expect(notice?.textContent).toContain("Laser Loon needs a bigger screen");
  });

  it("gates on exactly PHONE_QUERY, so tablets keep the game", () => {
    // Tailwind's arbitrary @media variant spells the query with no spaces.
    expect(GATE_QUERY).toBe(
      `[@media${PHONE_QUERY.replace(/: /g, ":").replace(/ /g, "_")}]`
    );
  });

  it("points at parts of the site that work on a phone", () => {
    render(
      <DesktopOnlyGate gameId="retro-labyrinth" gameTitle="Retro Labyrinth">
        <div />
      </DesktopOnlyGate>
    );

    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["/arcade/meme-vault", "/blog"]);
  });

  it("copies the page link when the share sheet is unavailable", async () => {
    render(
      <DesktopOnlyGate gameId="garmin-watch" gameTitle="Monkey C Mayhem">
        <div />
      </DesktopOnlyGate>
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Save link for later" })
    );

    expect(
      await screen.findByRole("button", { name: "Link copied" })
    ).toBeTruthy();
    expect(mockCopy).toHaveBeenCalledWith(window.location.href);
  });

  it("reveals only the cabinet after Try it anyway", () => {
    render(
      <DesktopOnlyGate gameId="working-with-duck" gameTitle="Working With Duck">
        <div data-testid="cabinet">cabinet</div>
      </DesktopOnlyGate>
    );

    fireEvent.click(screen.getByRole("button", { name: "Try it anyway" }));

    expect(screen.queryByTestId("desktop-only-notice")).toBeNull();
    const cabinet = screen.getByTestId("cabinet");
    expect(cabinet.parentElement?.className ?? "").not.toContain(GATE_QUERY);
  });
});
