// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { fromAny } from "@total-typescript/shoehorn";
import { TOUCH_DEVICE_QUERY } from "@/components/arcade/mobile";

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

import { WorkingWithDuckClient } from "@/components/arcade/WorkingWithDuckClient";

/** Makes only the given media queries match, as a device does. */
function setMatching(matching: string[]) {
  window.matchMedia = fromAny(
    vi.fn((query: string) => ({
      matches: matching.includes(query),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
}

describe("WorkingWithDuckClient cabinet wiring (ADR 0061)", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    cabinetProps.current = null;
  });

  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
  });

  it("gives a desktop cabinet no control dock, so its layout is unchanged", () => {
    setMatching([]);
    render(<WorkingWithDuckClient />);
    expect(cabinetProps.current?.controlDock).toBeUndefined();
    expect(typeof cabinetProps.current?.onAutoPause).toBe("function");
  });

  it("gives a touch device the control dock", () => {
    setMatching([TOUCH_DEVICE_QUERY]);
    render(<WorkingWithDuckClient />);
    expect(cabinetProps.current?.controlDock).toBeTruthy();
    expect(typeof cabinetProps.current?.onAutoPause).toBe("function");
  });
});
