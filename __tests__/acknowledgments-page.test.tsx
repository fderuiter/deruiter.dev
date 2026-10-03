// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { CREDITS_DATASET } from "@/lib/oss-credits/dataset";
import { AcknowledgmentsView } from "@/components/acknowledgments/AcknowledgmentsView";
import AcknowledgmentsPage from "@/app/acknowledgments/page";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({ playHover: vi.fn(), playSuccess: vi.fn() }),
}));

describe("Acknowledgments page", () => {
  afterEach(cleanup);

  it("renders the page shell with root clearance and structured data", () => {
    const { container } = render(<AcknowledgmentsPage />);
    expect(container.firstElementChild?.className).toContain("min-h-screen");
    expect(
      screen.getByRole("heading", { level: 1, name: /open source/i })
    ).toBeTruthy();
    expect(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).toHaveLength(2);
  });

  it("groups direct runtime dependencies by purpose", () => {
    render(<AcknowledgmentsView />);
    expect(
      screen.getByRole("heading", { name: /framework and runtime/i })
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^Licenses$/ })).toBeTruthy();
    expect(screen.getByText(/Notable licenses/)).toBeTruthy();
    expect(screen.getByText(/libvips binaries/)).toBeTruthy();
  });

  it("opens every outbound link in a new tab safely", () => {
    const { container } = render(<AcknowledgmentsView />);
    const external = container.querySelectorAll('a[href^="http"]');
    expect(external.length).toBeGreaterThan(20);
    for (const a of external) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
      expect(a.getAttribute("rel")).toContain("noreferrer");
      expect(a.textContent).toContain("opens in new tab");
    }
  });

  it("filters shipped packages and announces the count", () => {
    render(<AcknowledgmentsView />);
    const input = screen.getByLabelText(/search shipped packages/i);
    const status = document.getElementById("ack-search-status")!;
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain(
      `of ${CREDITS_DATASET.counts.runtime} shipped packages`
    );
    expect(screen.getByRole("button", { name: /show \d+ more/i })).toBeTruthy();

    fireEvent.change(input, { target: { value: "react-dom" } });
    expect(status.textContent).toMatch(/Showing \d+ of \d+ shipped packages/);
    expect(status.textContent).not.toContain(
      `of ${CREDITS_DATASET.counts.runtime} `
    );

    fireEvent.change(input, { target: { value: "zzz-no-such-package" } });
    expect(status.textContent).toBe("No packages match your search.");
    expect(screen.queryByRole("button", { name: /more/i })).toBeNull();
  });

  it("searches shipped packages only and never serialises the raw dataset", () => {
    render(<AcknowledgmentsView />);
    const runtimeNames = CREDITS_DATASET.packages
      .filter((p) => p.scope === "runtime")
      .map((p) => p.name);
    const toolingOnly = CREDITS_DATASET.packages.find(
      (p) =>
        p.scope === "tooling" &&
        !p.direct &&
        !runtimeNames.some((n) => n.includes(p.name))
    );
    expect(toolingOnly).toBeDefined();
    fireEvent.change(screen.getByLabelText(/search shipped packages/i), {
      target: { value: toolingOnly!.name },
    });
    expect(document.getElementById("ack-search-status")!.textContent).toBe(
      "No packages match your search."
    );
    expect(document.body.innerHTML).not.toContain("schemaVersion");
  });
});
