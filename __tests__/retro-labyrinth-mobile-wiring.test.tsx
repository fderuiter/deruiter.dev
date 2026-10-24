// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, cleanup, screen } from "@testing-library/react";

const cabinetProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock("@/components/arcade/PlayCabinet", () => ({
  PlayCabinet: (props: Record<string, unknown>) => {
    cabinetProps.current = props;
    return null;
  },
}));

import { RetroLabyrinthClient } from "@/components/arcade/RetroLabyrinthClient";
import { LABYRINTH_CONTROLS } from "@/lib/retro-labyrinth";

describe("RetroLabyrinthClient phone wiring (ADR 0061)", () => {
  afterEach(() => {
    cleanup();
    cabinetProps.current = null;
  });

  it("declares a landscape fit layout and its views, behind the phone gate", () => {
    render(<RetroLabyrinthClient />);

    expect(cabinetProps.current?.mobileOrientation).toBe("landscape");
    expect(cabinetProps.current?.mobileLayout).toBe("fit");
    // The cabinet's pause service replaces the old auto-pause count (#2376):
    // the session slot mirrors it, and the tablet and phone borrow the
    // desktop view until their own passes.
    const views = cabinetProps.current?.views as {
      session?: unknown;
      resolved: Record<string, string>;
    };
    expect(views.session).toBeTruthy();
    expect(views.resolved).toEqual({
      desktop: "desktop",
      tablet: "desktop",
      phone: "desktop",
    });
    expect(cabinetProps.current?.onAutoPause).toBeUndefined();
    // The control list is generated from the action map, so it names the
    // tool keys the game reads (it once said 1-3).
    expect(cabinetProps.current?.controls).toEqual([...LABYRINTH_CONTROLS]);
    expect(LABYRINTH_CONTROLS).toContainEqual({
      key: "1-5",
      action: "Fire Class Tools",
    });
    // The gate is CSS (PHONE_QUERY): the notice is in the markup for phones
    // and hidden on tablets, which the cabinet owns (#2032).
    expect(screen.getByTestId("desktop-only-notice")).toBeTruthy();
  });
});
