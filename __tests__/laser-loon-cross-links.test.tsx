// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MerchPrompt } from "@/components/merch/MerchPrompt";
import { ResultCard } from "@/components/arcade/ResultCard";
import { AssetDistributionHub } from "@/components/laser-loon/AssetDistributionHub";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({ playHover: vi.fn(), playSuccess: vi.fn() }),
}));

describe("Laser Loon to /merch cross-links", () => {
  afterEach(cleanup);

  it("MerchPrompt links to /merch and says coming soon while the shop is closed", () => {
    render(<MerchPrompt liveLabel="Get swag at cost" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/merch");
    expect(link.textContent).toMatch(/coming soon/i);
    expect(link.textContent).not.toMatch(/Get swag at cost/);
  });

  it("the asset hub offers a merch entry point next to the licence panel", () => {
    render(<AssetDistributionHub />);
    const links = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") === "/merch");
    expect(links).toHaveLength(1);
    expect(screen.getByText(/physical merch and swag/i)).toBeTruthy();
  });

  it("the victory card keeps its actions and focus trap with the prompt inside it", () => {
    render(
      <ResultCard
        title="History made! F277 prevails"
        stamp="State flag"
        verdict="win"
        stats={[
          { label: "Total score", value: 10 },
          { label: "Acts", value: 4 },
        ]}
        primary={{ label: "Play again", onClick: () => {} }}
      >
        <MerchPrompt liveLabel="Get swag at cost" />
      </ResultCard>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(screen.getByRole("link", { name: /merch/i }))).toBe(
      true
    );
    expect(screen.getByRole("button", { name: /play again/i })).toBeTruthy();
  });

  it("the campaign victory screen renders the prompt, and only that screen", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/LaserLoon.tsx"),
      "utf8"
    );
    const victory = source.slice(
      source.indexOf('gameState === "campaign-victory" && (')
    );
    const nextScreen = victory.indexOf('gameState === "gameover"');
    expect(victory.slice(0, nextScreen)).toContain("<MerchPrompt");
    expect(source.match(/<MerchPrompt/g)).toHaveLength(1);
  });
});
