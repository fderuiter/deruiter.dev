import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  classifyFormFactor,
  parseViewOverride,
  type FormFactor,
} from "@/lib/arcade";
import { useFormFactor } from "@/components/arcade/mobile";

describe("classifyFormFactor (#2354)", () => {
  const cases: Array<[string, number, number, boolean, FormFactor]> = [
    ["iPhone SE portrait", 375, 667, true, "phone"],
    ["iPhone SE landscape", 667, 375, true, "phone"],
    ["iPhone 15 portrait", 393, 852, true, "phone"],
    ["iPhone 15 landscape", 852, 393, true, "phone"],
    ["iPhone Pro Max portrait", 430, 932, true, "phone"],
    ["iPhone Pro Max landscape", 932, 430, true, "phone"],
    ["Pixel 7 portrait", 412, 915, true, "phone"],
    ["Pixel 7 landscape", 915, 412, true, "phone"],
    ["iPad mini portrait", 744, 1133, true, "tablet"],
    ["iPad mini landscape", 1133, 744, true, "tablet"],
    ["iPad Air portrait", 820, 1180, true, "tablet"],
    ["iPad Pro 11 landscape", 1194, 834, true, "tablet"],
    ["iPad Pro 13 portrait", 1024, 1366, true, "tablet"],
    ["iPad Pro 13 landscape", 1366, 1024, true, "tablet"],
    ["Split View half pane", 507, 1024, true, "phone"],
    ["Split View two-thirds pane", 678, 1024, true, "phone"],
    ["1024 desktop", 1024, 768, false, "desktop"],
    ["1280x720 desktop", 1280, 720, false, "desktop"],
    ["1440 desktop", 1440, 900, false, "desktop"],
    ["narrow 700px desktop window", 700, 900, false, "phone"],
    ["short desktop window", 1280, 480, false, "phone"],
    ["touchscreen laptop (fine primary pointer)", 1366, 768, false, "desktop"],
  ];

  it.each(cases)("%s (%ix%i) is a %s", (_, width, height, coarse, view) => {
    expect(classifyFormFactor({ width, height, coarse })).toBe(view);
  });

  it("puts the boundaries exactly on 500 and 744", () => {
    expect(classifyFormFactor({ width: 900, height: 500, coarse: true })).toBe(
      "phone"
    );
    expect(classifyFormFactor({ width: 900, height: 501, coarse: true })).toBe(
      "tablet"
    );
    expect(classifyFormFactor({ width: 743, height: 900, coarse: true })).toBe(
      "phone"
    );
    expect(classifyFormFactor({ width: 744, height: 900, coarse: true })).toBe(
      "tablet"
    );
  });

  it("keeps the phone view until the size is 24px past the line", () => {
    const at = (width: number) =>
      classifyFormFactor({ width, height: 1000, coarse: true }, "phone");
    expect(at(744)).toBe("phone");
    expect(at(767)).toBe("phone");
    expect(at(768)).toBe("tablet");
    const tall = (height: number) =>
      classifyFormFactor({ width: 1000, height, coarse: true }, "phone");
    expect(tall(524)).toBe("phone");
    expect(tall(525)).toBe("tablet");
  });

  it("keeps a larger view until the size is 24px inside the line", () => {
    const at = (width: number) =>
      classifyFormFactor({ width, height: 1000, coarse: false }, "desktop");
    expect(at(743)).toBe("desktop");
    expect(at(720)).toBe("desktop");
    expect(at(719)).toBe("phone");
    const tall = (height: number) =>
      classifyFormFactor({ width: 1000, height, coarse: true }, "tablet");
    expect(tall(477)).toBe("tablet");
    expect(tall(476)).toBe("phone");
  });

  it("switches tablet and desktop on the pointer alone", () => {
    const size = { width: 1024, height: 768 };
    expect(classifyFormFactor({ ...size, coarse: false }, "tablet")).toBe(
      "desktop"
    );
    expect(classifyFormFactor({ ...size, coarse: true }, "desktop")).toBe(
      "tablet"
    );
  });

  it("treats a zero or negative size as a phone", () => {
    expect(classifyFormFactor({ width: 0, height: 0, coarse: false })).toBe(
      "phone"
    );
    expect(classifyFormFactor({ width: -5, height: 900, coarse: true })).toBe(
      "phone"
    );
  });

  it("reads only known ?view= values", () => {
    expect(parseViewOverride("?view=phone")).toBe("phone");
    expect(parseViewOverride("view=tablet&x=1")).toBe("tablet");
    expect(parseViewOverride("?view=desktop")).toBe("desktop");
    expect(parseViewOverride("?view=watch")).toBeNull();
    expect(parseViewOverride("")).toBeNull();
  });
});

describe("useFormFactor (#2354)", () => {
  const originalMatchMedia = window.matchMedia;
  let coarse = false;
  const pointerListeners = new Set<() => void>();

  function setWindow(width: number, height: number) {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: height,
    });
  }

  beforeEach(() => {
    coarse = false;
    pointerListeners.clear();
    window.matchMedia = vi.fn((query: string) => ({
      get matches() {
        return query === "(pointer: coarse)" ? coarse : false;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, fn: () => void) => {
        pointerListeners.add(fn);
      },
      removeEventListener: (_type: string, fn: () => void) => {
        pointerListeners.delete(fn);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    window.history.replaceState(null, "", "/");
    setWindow(1280, 800);
  });

  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
    window.history.replaceState(null, "", "/");
  });

  function Probe({ override }: { override?: FormFactor | "auto" }) {
    const view = useFormFactor({ override });
    return <output data-testid="view">{view}</output>;
  }

  const view = () => screen.getByTestId("view").textContent;

  it("measures the window and follows resizes, with hysteresis", () => {
    render(<Probe />);
    expect(view()).toBe("desktop");

    act(() => {
      setWindow(730, 900);
      window.dispatchEvent(new Event("resize"));
    });
    expect(view()).toBe("desktop");

    act(() => {
      setWindow(700, 900);
      window.dispatchEvent(new Event("resize"));
    });
    expect(view()).toBe("phone");

    act(() => {
      setWindow(760, 900);
      window.dispatchEvent(new Event("resize"));
    });
    expect(view()).toBe("phone");

    act(() => {
      setWindow(1024, 900);
      window.dispatchEvent(new Event("resize"));
    });
    expect(view()).toBe("desktop");
  });

  it("updates every component that reads it", () => {
    render(
      <>
        <Probe />
        <Probe />
      </>
    );
    act(() => {
      setWindow(700, 900);
      window.dispatchEvent(new Event("resize"));
    });
    expect(
      screen.getAllByTestId("view").map((node) => node.textContent)
    ).toEqual(["phone", "phone"]);
  });

  it("forgets the last view's hysteresis once nothing reads it", () => {
    setWindow(700, 900);
    const { unmount } = render(<Probe />);
    expect(view()).toBe("phone");
    unmount();
    // 760 px keeps a phone view, but a fresh read from a desktop does not.
    setWindow(760, 900);
    render(<Probe />);
    expect(view()).toBe("desktop");
  });

  it("follows a pointer change between desktop and tablet", () => {
    render(<Probe />);
    expect(view()).toBe("desktop");
    act(() => {
      coarse = true;
      pointerListeners.forEach((fn) => fn());
    });
    expect(view()).toBe("tablet");
  });

  it("honours the stored setting, and ?view= over it", () => {
    const { rerender } = render(<Probe override="phone" />);
    expect(view()).toBe("phone");
    rerender(<Probe override="auto" />);
    expect(view()).toBe("desktop");

    window.history.replaceState(null, "", "/?view=tablet");
    rerender(<Probe override="phone" />);
    expect(view()).toBe("tablet");
  });

  it("never measures the inline cabinet box", () => {
    // A 1280x720 desktop with an inline cabinet 460 px tall before Launch.
    setWindow(1280, 720);
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        width: 1100,
        height: 460,
        top: 0,
        left: 0,
        right: 1100,
        bottom: 460,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
    render(
      <div style={{ height: 460 }}>
        <Probe />
      </div>
    );
    expect(view()).toBe("desktop");
    rect.mockRestore();
  });

  it("holds the view while a text field has focus", () => {
    render(
      <>
        <input aria-label="Name" />
        <Probe />
      </>
    );
    expect(view()).toBe("desktop");
    const field = screen.getByLabelText("Name");
    act(() => {
      field.focus();
      setWindow(1280, 400);
      window.dispatchEvent(new Event("resize"));
    });
    expect(view()).toBe("desktop");
    act(() => {
      field.blur();
      fireEvent.focusOut(field);
    });
    expect(view()).toBe("phone");
  });
});
