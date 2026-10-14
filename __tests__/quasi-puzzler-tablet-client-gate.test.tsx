// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { PHONE_QUERY } from "@/components/arcade/mobile";

const cabinetProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock("@/components/arcade/PlayCabinet", () => ({
  PlayCabinet: (props: Record<string, unknown>) => {
    cabinetProps.current = props;
    return null;
  },
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

import { QuasiPuzzlerClient } from "@/components/arcade/QuasiPuzzlerClient";

describe("QuasiPuzzlerClient cabinet wiring (#2042)", () => {
  beforeEach(() => {
    cabinetProps.current = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("lays the game out to fit the touch cabinet viewport", () => {
    render(<QuasiPuzzlerClient />);
    expect(cabinetProps.current?.mobileLayout).toBe("fit");
  });

  it("needs no control dock or auto-pause: every shortcut has an on-screen control", () => {
    render(<QuasiPuzzlerClient />);
    expect(cabinetProps.current?.controlDock).toBeUndefined();
    expect(cabinetProps.current?.onAutoPause).toBeUndefined();
  });

  it("keeps the desktop-only notice behind the phone query, so tablets get the game", () => {
    const { container } = render(<QuasiPuzzlerClient />);
    const notice = container.querySelector(
      '[data-testid="desktop-only-notice"]'
    );
    expect(notice).not.toBeNull();
    // The notice shows only inside PHONE_QUERY (phones, and Split View panes
    // narrower than 744px). iPads are wider than that in both orientations.
    const phoneBound = PHONE_QUERY.match(/max-width:\s*(\d+)px/);
    expect(phoneBound?.[1]).toBe("743");
    expect(notice?.className).toContain("(max-width:743px)");
    expect(notice?.className).toContain("(max-height:500px)");
  });
});
