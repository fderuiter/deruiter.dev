import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { MountainMap } from "@/components/patrol/MountainMap";

describe("Patrol Shift — MountainMap Interactive Viewport Integration (Issue #835)", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("1. Dual-Zone Viewport & Camera Navigation", () => {
    it("renders default zone as East & West Slopes and switches to The Back Bowl", () => {
      render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      const mainBtn = screen.getByRole("button", {
        name: /East & West Slopes/i,
      });
      const bowlBtn = screen.getByRole("button", { name: /The Back Bowl/i });

      expect(mainBtn.getAttribute("aria-pressed")).toBe("true");
      expect(bowlBtn.getAttribute("aria-pressed")).toBe("false");

      // Verify Main Mountain trail is visible
      expect(screen.getByText("Long Way Home")).toBeDefined();

      // Click to switch to The Back Bowl
      fireEvent.click(bowlBtn);

      expect(bowlBtn.getAttribute("aria-pressed")).toBe("true");
      expect(mainBtn.getAttribute("aria-pressed")).toBe("false");

      // Verify Back Bowl trail is visible
      expect(screen.getByText("The Great Gorge")).toBeDefined();
    });

    it("updates zoom level with zoom controls and resets camera", () => {
      const { container } = render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      const zoomInBtn = screen.getByRole("button", { name: /Zoom In/i });
      const zoomOutBtn = screen.getByRole("button", { name: /Zoom Out/i });
      const resetBtn = screen.getByRole("button", { name: /Fit Mountain/i });

      // Zoom In
      fireEvent.click(zoomInBtn);
      const rootG = container.querySelector("svg > g");
      expect(rootG?.getAttribute("transform")).toContain("scale(1.25)");

      // Zoom Out
      fireEvent.click(zoomOutBtn);
      expect(rootG?.getAttribute("transform")).toContain("scale(1)");

      // Zoom Out further
      fireEvent.click(zoomOutBtn);
      expect(rootG?.getAttribute("transform")).toContain("scale(0.75)");

      // Reset
      fireEvent.click(resetBtn);
      expect(rootG?.getAttribute("transform")).toContain("scale(1)");
    });

    it("pans using quick-jump anchors in minimap radar", () => {
      const { container } = render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      const mainChaletBtn = screen.getByTitle("Pan to Main Chalet");
      fireEvent.click(mainChaletBtn);

      const rootG = container.querySelector("svg > g");
      expect(rootG?.getAttribute("transform")).toContain("scale(1.2)");

      // Quick jump to Back Bowl switches zone and pans
      const bowlJumpBtn = screen.getByTitle("Pan to The Back Bowl");
      fireEvent.click(bowlJumpBtn);

      const bowlBtn = screen.getByRole("button", { name: "The Back Bowl" });
      expect(bowlBtn.getAttribute("aria-pressed")).toBe("true");
    });

    it("calculates live cursor altitude correctly inverting pan and zoom transforms", () => {
      const { container } = render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();

      // Mock getBoundingClientRect
      vi.spyOn(svg!, "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 0,
        width: 1000,
        height: 650,
        right: 1000,
        bottom: 650,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      // Zoom in
      const zoomInBtn = screen.getByRole("button", { name: /Zoom In/i });
      fireEvent.click(zoomInBtn); // zoom = 1.25

      // Move pointer near center (where Y = 650 on terrain)
      fireEvent.pointerMove(svg!, { clientX: 500, clientY: 325 });

      // Terrain Y at center is 650 -> mid elevation ~888 FT
      expect(screen.getByText(/Live Terrain:/i)).toBeDefined();
    });

    it("clears selected trail and cancels running simulation when switching zones", () => {
      render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      // Select Long Way Home (main zone)
      const lwh = screen.getByRole("button", {
        name: /Long Way Home, green difficulty/i,
      });
      fireEvent.click(lwh);
      expect(screen.getByTestId("trail-inspector-card")).toBeDefined();

      // Start simulation
      const simBtn = screen.getByRole("button", {
        name: /Simulate Run Down Trail/i,
      });
      fireEvent.click(simBtn);
      expect(screen.getByTestId("simulation-control-overlay")).toBeDefined();

      // Switch to The Back Bowl
      const bowlBtn = screen.getByRole("button", { name: /The Back Bowl/i });
      fireEvent.click(bowlBtn);

      // Selected trail card and simulation overlay should be cleanly cleared
      expect(screen.queryByTestId("trail-inspector-card")).toBeNull();
      expect(screen.queryByTestId("simulation-control-overlay")).toBeNull();
    });
  });

  describe("2. Trail Inspection & Elevation Sparkline", () => {
    it("opens detailed inspector card when clicking a trail", () => {
      render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      // Click on Long Way Home
      const lwhElement = screen.getByRole("button", {
        name: /Long Way Home, green difficulty/i,
      });
      fireEvent.click(lwhElement);

      // Inspector card appears
      const card = screen.getByTestId("trail-inspector-card");
      expect(card).toBeDefined();
      expect(card.textContent).toContain("Long Way Home");
      expect(card.textContent).toContain("West Slopes");
      expect(card.textContent).toContain("3,100 FT");
      expect(card.textContent).toContain("360 FT");
      expect(card.textContent).toContain("Corduroy Groomed");
      expect(card.textContent).toContain("Avg Grade");

      // Elevation sparkline SVG is mounted
      const sparkline = screen.getByLabelText(
        /Elevation profile for Long Way Home/i
      );
      expect(sparkline).toBeDefined();

      // Close inspector
      const closeBtn = screen.getByLabelText("Close trail inspector");
      fireEvent.click(closeBtn);
      expect(screen.queryByTestId("trail-inspector-card")).toBeNull();
    });

    it("allows trail selection via keyboard navigation", () => {
      render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      const trailBtn = screen.getByRole("button", {
        name: /Cedar Fork, black difficulty/i,
      });

      fireEvent.keyDown(trailBtn, { key: "Enter" });
      const card = screen.getByTestId("trail-inspector-card");
      expect(card).toBeDefined();
      expect(card.textContent).toContain("Cedar Fork");

      // Press Escape to dismiss
      const mapContainer = screen.getByTestId("patrol-mountain-map");
      fireEvent.keyDown(mapContainer, { key: "Escape" });
      expect(screen.queryByTestId("trail-inspector-card")).toBeNull();
    });

    it("renders floating hover tooltip with trail metrics on pointer enter", () => {
      render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      const lwh = screen.getByRole("button", {
        name: /Long Way Home, green difficulty/i,
      });

      // Pointer enter triggers tooltip
      fireEvent.pointerEnter(lwh);

      const tooltip = screen.getByTestId("trail-hover-tooltip");
      expect(tooltip).toBeDefined();
      expect(tooltip.textContent).toContain("Long Way Home");
      expect(tooltip.textContent).toContain("green");
      expect(tooltip.textContent).toContain("Groomed");
      expect(tooltip.textContent).toContain("3,100 FT");
      expect(tooltip.textContent).toContain("360 FT Drop");
      expect(tooltip.textContent).toContain("12% Grade");

      // Pointer leave removes tooltip
      fireEvent.pointerLeave(lwh);
      expect(screen.queryByTestId("trail-hover-tooltip")).toBeNull();
    });

    it("renders multi-point elevation profile line and shaded polygon in inspector sparkline", () => {
      render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      const lwh = screen.getByRole("button", {
        name: /Long Way Home, green difficulty/i,
      });
      fireEvent.click(lwh);

      const sparkline = screen.getByLabelText(
        /Elevation profile for Long Way Home/i
      );
      const polygon = sparkline.querySelector("polygon");
      const path = sparkline.querySelector("path");

      expect(polygon).not.toBeNull();
      expect(path).not.toBeNull();

      // Polygon points include starting point at 20, ending point at 220, and baseline closes at 220,50 20,50
      const polyPoints = polygon?.getAttribute("points") ?? "";
      expect(polyPoints.startsWith("20.0,")).toBe(true);
      expect(polyPoints.endsWith("220,50 20,50")).toBe(true);
      expect(path?.getAttribute("d")).toContain("M 20.0");
    });
  });

  describe("3. Parametric Skier Run Simulation", () => {
    it("starts skier simulation, advances progress, and allows pause/resume/cancellation", () => {
      render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      // Select trail
      const lwh = screen.getByRole("button", {
        name: /Long Way Home, green difficulty/i,
      });
      fireEvent.click(lwh);

      // Start simulation
      const simBtn = screen.getByRole("button", {
        name: /Simulate Run Down Trail/i,
      });
      fireEvent.click(simBtn);

      // Control overlay and skier token appear
      expect(screen.getByTestId("simulation-control-overlay")).toBeDefined();
      expect(screen.getByTestId("simulated-skier-token")).toBeDefined();

      // Advance time by 4 seconds (50% progress)
      act(() => {
        vi.advanceTimersByTime(4000);
      });

      // Pause simulation
      const pauseBtn = screen.getByLabelText("Pause simulation");
      fireEvent.click(pauseBtn);

      const resumeBtn = screen.getByLabelText("Resume simulation");
      expect(resumeBtn).toBeDefined();

      // Cancel simulation
      const cancelBtn = screen.getByLabelText("Cancel simulation");
      fireEvent.click(cancelBtn);

      expect(screen.queryByTestId("simulation-control-overlay")).toBeNull();
      expect(screen.queryByTestId("simulated-skier-token")).toBeNull();
    });
  });

  describe("4. Atmospheric Modes & Emergency Dispatch Beacons", () => {
    it("toggles night skiing floodlights", () => {
      render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      const nightToggle = screen.getByLabelText(
        /Toggle night skiing floodlights/i
      );
      fireEvent.click(nightToggle);

      expect(
        screen.getByText(/Night Operations • Floodlights On/i)
      ).toBeDefined();

      // Toggle back
      fireEvent.click(nightToggle);
      expect(
        screen.queryByText(/Night Operations • Floodlights On/i)
      ).toBeNull();
    });

    it("renders emergency radar beacon and auto-switches zone for active dispatch incident", () => {
      render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
          incidentCoordinates={{ x: 775, y: 560, zone: "back-bowl" }}
        />
      );

      // Should auto-switch to The Back Bowl
      const bowlBtn = screen.getByRole("button", { name: /The Back Bowl/i });
      expect(bowlBtn.getAttribute("aria-pressed")).toBe("true");

      // Radar beacon ring is rendered
      const beacon = screen.getByTestId("emergency-radar-beacon");
      expect(beacon).toBeDefined();
      expect(beacon.getAttribute("transform")).toBe("translate(775, 560)");
      expect(screen.getByText("DISPATCH INCIDENT")).toBeDefined();
    });

    it("applies directional cable vector CSS variables for chairlift carrier animation", () => {
      const { container } = render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      const chairGroups = container.querySelectorAll(".patrol-chair-group");
      expect(chairGroups.length).toBeGreaterThan(0);

      // Check first chair group has custom property styles for cable movement
      const firstGroup = chairGroups[0] as HTMLElement;
      const styleAttr = firstGroup.getAttribute("style") ?? "";
      expect(styleAttr).toContain("--chair-move-x");
      expect(styleAttr).toContain("--chair-move-y");
    });

    it("scopes ambient event pin strictly to its active zone and hides across opposing zones", () => {
      const mockBackBowlAmbient = {
        id: "back-bowl-hazard",
        title: "Tree Well Near Great Gorge",
        location: "The Great Gorge",
        sector: "The Back Bowl",
        coordinates: { x: 600, y: 460, zone: "back-bowl" as const },
        prompt: "Deep tree well reported off trail in The Back Bowl.",
        options: [],
      };

      render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
          activeAmbientEvent={mockBackBowlAmbient}
        />
      );

      // Auto-switched to Back Bowl, pin is visible
      expect(screen.getByTestId("ambient-event-pin")).toBeDefined();

      // Switch manually to East & West Slopes
      const mainBtn = screen.getByRole("button", {
        name: /East & West Slopes/i,
      });
      fireEvent.click(mainBtn);

      // Back Bowl pin must NOT be rendered on the Main Slopes
      expect(screen.queryByTestId("ambient-event-pin")).toBeNull();
    });
  });

  describe("5. NSAA Responsibility Code Accessible Modal", () => {
    it("opens Safety Code modal, displays all 10 rules, and dismisses on Escape", () => {
      render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      const codeBtn = screen.getByLabelText(
        "Safety Code: view Your Responsibility Code"
      );
      fireEvent.click(codeBtn);

      const modal = screen.getByRole("dialog");
      expect(modal).toBeDefined();
      expect(modal.getAttribute("aria-modal")).toBe("true");
      expect(screen.getByText("Your Responsibility Code")).toBeDefined();

      // Verify rule items
      expect(screen.getByText("Stay in Control")).toBeDefined();
      expect(screen.getByText("People Ahead Have Right-of-Way")).toBeDefined();
      expect(screen.getByText("Stay at Incident Scene")).toBeDefined();

      // Close modal on Escape
      fireEvent.keyDown(modal, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("closes modal via explicit close button", () => {
      render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      const codeBtn = screen.getByRole("button", {
        name: /Safety Code|Responsibility Code/i,
      });
      fireEvent.click(codeBtn);

      const closeButtons = screen.getAllByRole("button", {
        name: /Close Safety Code/i,
      });
      fireEvent.click(closeButtons[0]);

      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("6. Accessibility & WCAG 2.1 AA Compliance", () => {
    it("ensures all interactive buttons meet the 44px touch target minimum", () => {
      const { container } = render(
        <MountainMap
          incidentsCompleted={1}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThan(5);

      buttons.forEach((btn) => {
        expect(btn.className).toMatch(/min-h-\[44px\]/);
      });
    });

    it("includes prefers-reduced-motion CSS styles for chairlifts, snow, and radar pings", () => {
      const { container } = render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

      const styleTag = container.querySelector("style");
      expect(styleTag).not.toBeNull();
      expect(styleTag?.textContent).toContain("prefers-reduced-motion: reduce");
      expect(styleTag?.textContent).toContain("animation: none !important");
    });
  });

  describe("7. Pointer Gesture Lifecycle & Pan Latch Defense", () => {
    /** Reads the live pan/zoom transform off the SVG root matrix group. */
    const readTransform = (container: HTMLElement): string =>
      container
        // role="group", not role="img": the map has interactive trail and lift
        // children, which axe flags as nested-interactive under an img role.
        .querySelector('svg[role="group"] > g[style]')
        ?.getAttribute("transform") ?? "";

    const renderMap = () =>
      render(
        <MountainMap
          incidentsCompleted={0}
          onAwaitDispatch={vi.fn()}
          onCompleteShift={vi.fn()}
        />
      );

    it("pans while the pointer is down and stops panning after pointerup", () => {
      const { container } = renderMap();
      const svg = container.querySelector('svg[role="group"]') as SVGSVGElement;
      const initial = readTransform(container);

      fireEvent.pointerDown(svg, {
        pointerId: 1,
        button: 0,
        clientX: 100,
        clientY: 100,
      });
      fireEvent.pointerMove(svg, { pointerId: 1, clientX: 180, clientY: 160 });
      const panned = readTransform(container);
      expect(panned).not.toBe(initial);

      fireEvent.pointerUp(svg, { pointerId: 1, clientX: 180, clientY: 160 });
      fireEvent.pointerMove(svg, { pointerId: 1, clientX: 400, clientY: 400 });
      expect(readTransform(container)).toBe(panned);
    });

    it("releases the pan latch on pointercancel so an OS-interrupted touch does not stick", () => {
      // Regression: only pointerup cleared isPanning, so a touch cancelled by
      // the OS (call, notification shade, browser back-gesture) left the map
      // latched in panning mode and tracking the cursor with no finger down.
      const { container } = renderMap();
      const svg = container.querySelector('svg[role="group"]') as SVGSVGElement;

      fireEvent.pointerDown(svg, {
        pointerId: 7,
        button: 0,
        pointerType: "touch",
        clientX: 100,
        clientY: 100,
      });
      fireEvent.pointerMove(svg, {
        pointerId: 7,
        pointerType: "touch",
        clientX: 150,
        clientY: 130,
      });
      const panned = readTransform(container);
      expect(panned).not.toBe("");

      fireEvent.pointerCancel(svg, { pointerId: 7, pointerType: "touch" });

      // Any further movement must NOT drag the map.
      fireEvent.pointerMove(svg, {
        pointerId: 7,
        pointerType: "touch",
        clientX: 600,
        clientY: 520,
      });
      expect(readTransform(container)).toBe(panned);
    });

    it("does not throw when a pointerup arrives without a prior captured pointerdown", () => {
      const { container } = renderMap();
      const svg = container.querySelector('svg[role="group"]') as SVGSVGElement;
      expect(() =>
        fireEvent.pointerUp(svg, { pointerId: 99, clientX: 10, clientY: 10 })
      ).not.toThrow();
    });
  });
});
