import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The Labyrinth's views choose the cabinet for the layout they share
// (ADR 0062, #2859); the layout itself reads no device.
const layoutProps = vi.hoisted(() => ({
  current: [] as Array<Record<string, unknown>>,
}));
const device = vi.hoisted(() => ({ touch: false, phone: false }));

vi.mock("@/components/retro-labyrinth/parts/LabyrinthLayout", () => ({
  LabyrinthLayout: (props: Record<string, unknown>) => {
    layoutProps.current.push(props);
    return null;
  },
}));

vi.mock("@/components/arcade/mobile", () => ({
  useCabinetTouch: () => device.touch,
  usePhone: () => device.phone,
}));

import { DesktopView } from "@/components/retro-labyrinth/views/DesktopView";
import { TabletView } from "@/components/retro-labyrinth/views/TabletView";
import { PhoneView } from "@/components/retro-labyrinth/views/PhoneView";

describe("Retro Labyrinth views (#2859)", () => {
  beforeEach(() => {
    layoutProps.current = [];
    device.touch = false;
    device.phone = false;
  });

  it("lays the tablet view out as a tablet's touch cabinet", () => {
    render(<TabletView isMounted={false} />);
    expect(layoutProps.current.at(-1)).toEqual({
      isMounted: false,
      touch: true,
      phone: false,
    });
  });

  it("lays the phone view out as a phone's touch cabinet (#2917)", () => {
    render(<PhoneView isMounted={false} />);
    expect(layoutProps.current.at(-1)).toEqual({
      isMounted: false,
      touch: true,
      phone: true,
    });
  });

  it("passes the desktop view's cabinet state through", () => {
    render(<DesktopView />);
    expect(layoutProps.current.at(-1)).toEqual({
      isMounted: true,
      touch: false,
      phone: false,
    });

    // The shared layout still reads the cabinet state until #2863.
    device.touch = true;
    device.phone = true;
    render(<DesktopView />);
    expect(layoutProps.current.at(-1)).toEqual({
      isMounted: true,
      touch: true,
      phone: true,
    });
  });
});
