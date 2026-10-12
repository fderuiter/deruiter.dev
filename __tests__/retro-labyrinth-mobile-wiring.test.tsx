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

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

import { RetroLabyrinthClient } from "@/components/arcade/RetroLabyrinthClient";

describe("RetroLabyrinthClient phone wiring (ADR 0061)", () => {
  afterEach(() => {
    cleanup();
    cabinetProps.current = null;
  });

  it("declares a landscape fit layout and an auto-pause handler, and no desktop-only gate", () => {
    render(<RetroLabyrinthClient />);

    expect(cabinetProps.current?.mobileOrientation).toBe("landscape");
    expect(cabinetProps.current?.mobileLayout).toBe("fit");
    expect(typeof cabinetProps.current?.onAutoPause).toBe("function");
    expect(screen.queryByTestId("desktop-only-notice")).toBeNull();
  });
});
