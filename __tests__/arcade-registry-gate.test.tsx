// @vitest-environment jsdom
//
// The registry alone decides the phone gate and the phone badges (#2368):
// PlayCabinet wraps a game whose phone view is gated in DesktopOnlyGate, and
// the hub and the daily panel read the same flag, so flipping it needs no
// other code change.
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import {
  FIRST_ON_PHONE,
  PhoneReadinessBadge,
} from "@/components/arcade/phone-readiness";
import { PHONE_QUERY } from "@/components/arcade/mobile";
import { ARCADE_REGISTRY, isPhoneGated } from "@/lib/arcade";

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    volume: 0.3,
    muted: false,
  }),
}));

const PHONE_VARIANT = `[@media${PHONE_QUERY.replace(/: /g, ":").replace(/ /g, "_")}]`;

function renderCabinet(gameId: string) {
  return render(
    <PlayCabinet
      gameId={gameId}
      title="A Game"
      icon={<span>G</span>}
      instructions="Play."
      controls={[{ key: "Space", action: "Go" }]}
      importComponent={() => Promise.resolve({})}
    />
  );
}

afterEach(() => cleanup());

describe("registry-driven phone gate (#2368)", () => {
  it.each(ARCADE_REGISTRY.map((game) => [game.slug, game.views.phone]))(
    "%s: the cabinet is gated on phones exactly when its phone view is %s",
    (slug) => {
      const { container } = renderCabinet(slug);
      const notice = container.querySelector(
        '[data-testid="desktop-only-notice"]'
      );
      if (isPhoneGated(slug)) {
        expect(notice).not.toBeNull();
        // The notice is behind PHONE_QUERY, so tablets get the game.
        expect(notice?.className).toContain(`${PHONE_VARIANT}:block`);
      } else {
        expect(notice).toBeNull();
      }
      // The cabinet itself always renders, behind CSS on a gated phone.
      expect(container.textContent).toContain("A Game");
    }
  );

  it("leaves a game outside the registry ungated", () => {
    const { container } = renderCabinet("not-in-the-registry");
    expect(
      container.querySelector('[data-testid="desktop-only-notice"]')
    ).toBeNull();
  });

  it("has both kinds of game, so the gate and its absence are both covered", () => {
    expect(ARCADE_REGISTRY.some((game) => game.views.phone === "gated")).toBe(
      true
    );
    expect(ARCADE_REGISTRY.some((game) => game.views.phone === "ready")).toBe(
      true
    );
  });
});

describe("PhoneReadinessBadge (#2368)", () => {
  it.each(ARCADE_REGISTRY.map((game) => [game.slug]))(
    "%s: reads its badge from the registry, shown on phones only",
    (slug) => {
      const { container } = render(<PhoneReadinessBadge slug={slug} />);
      const badge = container.firstElementChild as HTMLElement;
      expect(badge.textContent).toBe(
        isPhoneGated(slug) ? "Best on a bigger screen" : "Plays on phone"
      );
      expect(badge.className).toContain("hidden");
      expect(badge.className).toContain(`${PHONE_VARIANT}:inline-flex`);
    }
  );

  it("orders phone-ready games first with the same phone query", () => {
    expect(FIRST_ON_PHONE).toBe(`${PHONE_VARIANT}:order-first`);
  });
});
