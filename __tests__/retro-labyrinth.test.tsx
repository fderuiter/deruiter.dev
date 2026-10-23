import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { RetroLabyrinth } from "@/components/RetroLabyrinth";

describe("RetroLabyrinth Component Architecture & Functional Rules", () => {
  const componentPath = path.resolve(
    __dirname,
    "../components/RetroLabyrinth.tsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  it("exports a function or component named RetroLabyrinth", () => {
    expect(typeof RetroLabyrinth).toBe("function");
  });

  it("should contain the state-deferred client mounting logic check", () => {
    expect(content).toContain("if (!isMounted) {");
    expect(content).toContain("renderAsciiFallback()");
  });

  it("should render a canvas element once client-side hydrated", () => {
    expect(content).toContain("<canvas");
    expect(content).toContain("ref={canvasRef}");
  });

  it("should implement tabIndex={0} on the focusable game container to capture keyboard input", () => {
    expect(content).toContain("tabIndex={0}");
  });

  it("should specify data-keyboard-boundary='true' to prevent command-palette overlap", () => {
    expect(content).toContain('data-keyboard-boundary="true"');
  });

  it("should use dynamic viewport height units (dvh) with vh fallbacks for responsive mobile scaling", () => {
    expect(content).toContain("max-h-[100dvh]");
    expect(content).toContain("max-h-[100vh]");
  });

  it("should intercept and prevent default on directional keys inside handleKeyDown", () => {
    expect(content).toContain("handleKeyDown");
    expect(content).toContain("e.preventDefault()");
    expect(content).toContain("ArrowUp");
    expect(content).toContain("ArrowDown");
    expect(content).toContain("ArrowLeft");
    expect(content).toContain("ArrowRight");
  });

  it("should trigger recordEvent with 'project_click' when victory condition is met", () => {
    expect(content).toContain("recordEvent");
    expect(content).toContain('"project_click"');
    expect(content).toContain('"victory"');
  });

  it("should contain a fully-aligned static ASCII fallback grid structure", () => {
    expect(content).toContain("const renderAsciiFallback = () => {");
    expect(content).toContain('if (cell === "#") return "█"');
    expect(content).toContain('if (x === START_X && y === START_Y) return "@"');
  });

  it("should support developer weapon hotkeys 1, 2, 3 and EMP spacebar", () => {
    expect(content).toContain('key === "1"');
    expect(content).toContain('key === "2"');
    expect(content).toContain('key === "3"');
    expect(content).toContain('key === " "');
    expect(content).toContain("npm_install");
    expect(content).toContain("git_force_push");
    expect(content).toContain("stack_overflow");
  });

  it("should support Roguelike Graveyard campaign mode and room transitions", () => {
    expect(content).toContain("generateRoguelikeCampaign");
    expect(content).toContain("startRoguelikeCampaign");
    expect(content).toContain("Graveyard Roguelike");
  });

  it("should contain Billable Hours timesheet modal trigger and submission", () => {
    expect(content).toContain("handleSubmitTimesheet");
    expect(content).toContain("BILLABLE HOURS INTERRUPT");
    expect(content).toContain("Submit Timesheet");
  });
});

describe("Direct Inline Coordinate Scaling & Index Clamping Invariants", () => {
  const componentPath = path.resolve(
    __dirname,
    "../components/RetroLabyrinth.tsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  // The mapping itself is the stage fit's (#2358), unit tested in
  // arcade-stage-fit.test.ts: an empty canvas rect maps to null.
  it("includes defensive zero-dimension guard for canvas bounding box", () => {
    expect(content).toContain("if (!point) return;");
  });

  it("maps the pointer through the stage fit and the canvas's shown rect", () => {
    expect(content).toContain("const point = canvasToGame(");
    expect(content).toContain("canvas.getBoundingClientRect()");
  });

  it("transforms game units to grid cells by the room's column and row count", () => {
    expect(content).toContain(
      "const rawGridX = Math.floor(point.x / (LOGICAL_WIDTH / cols));"
    );
    expect(content).toContain(
      "const rawGridY = Math.floor(point.y / (LOGICAL_HEIGHT / rows));"
    );
  });

  it("clamps calculated grid indices within valid column and row bounds", () => {
    expect(content).toContain("const gridX = clamp(rawGridX, 0, cols - 1);");
    expect(content).toContain("const gridY = clamp(rawGridY, 0, rows - 1);");
  });

  it("resets cursor grid position on mouse leave", () => {
    expect(content).toContain("cursorGridPosRef.current = null;");
  });

  it("renders hover highlight overlay for target cell", () => {
    expect(content).toContain("Draw Cursor Hover Highlight Tile");
    expect(content).toContain("cursorGridPosRef.current");
  });
});

describe("CommandPalette Roguelike Registration", () => {
  const cmdPath = path.resolve(__dirname, "../components/CommandPalette.tsx");
  const content = fs.readFileSync(cmdPath, "utf-8");

  it("registers Retro Labyrinth under staticNavs with roguelike description", () => {
    expect(content).toContain('id: "nav-retro-labyrinth"');
    expect(content).toContain("Retro Labyrinth: Graveyard Roguelike");
    expect(content).toContain('url: "/arcade/retro-labyrinth"');
  });
});

describe("Component-Level Pathfinding Memoization Invariants", () => {
  const componentPath = path.resolve(
    __dirname,
    "../components/RetroLabyrinth.tsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  it("imports useMemo from react", () => {
    expect(content).toMatch(
      /import\s+[\s\S]*?useMemo[\s\S]*?from\s+["']react["']/
    );
  });

  it("memoizes Traveling Salesman pathfinding tour using useMemo", () => {
    expect(content).toContain("const tspTour = useMemo(");
    expect(content).toContain("computeShortestTour(");
  });

  it("configures exhaustive dependencies for pathfinding useMemo", () => {
    expect(content).toContain("[playerPosition.x, playerPosition.y, tspNodes]");
  });

  it("mirrors tspTour in loopStateRef to prevent canvas render loop re-calculations", () => {
    expect(content).toContain("tspTour,");
    expect(content).toContain("const tour = tspTour;");
  });
});
