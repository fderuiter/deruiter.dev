import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { RetroLabyrinth } from "@/components/RetroLabyrinth";

/** Reads a source file of the game, relative to the repository root. */
function source(file: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", file), "utf-8");
}

// Since #2376 the room is a view over a session: the view renders, the
// session holds the rules, the maze canvas maps the pointer and the painter
// draws, and the action map owns the keys.
const VIEW = "components/retro-labyrinth/views/DesktopView.tsx";
const SESSION = "components/retro-labyrinth/useRetroLabyrinthSession.ts";
const CANVAS = "components/retro-labyrinth/parts/MazeCanvas.tsx";
const PAINTER = "components/retro-labyrinth/parts/paint-maze.ts";
const ACTIONS = "lib/retro-labyrinth/actions.ts";

describe("RetroLabyrinth Component Architecture & Functional Rules", () => {
  const content = source(VIEW);
  const session = source(SESSION);
  const canvas = source(CANVAS);
  const actions = source(ACTIONS);

  it("exports a function or component named RetroLabyrinth", () => {
    expect(typeof RetroLabyrinth).toBe("function");
  });

  it("should contain the state-deferred client mounting logic check", () => {
    expect(content).toContain("if (!isMounted) {");
    expect(content).toContain("renderAsciiFallback()");
  });

  it("should render a canvas element once client-side hydrated", () => {
    expect(content).toContain("<MazeCanvas");
    expect(canvas).toContain("<canvas");
    expect(canvas).toContain("ref={setCanvas}");
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

  it("binds the directional keys through the action map, which prevents their default", () => {
    expect(content).toContain("useActionInput(LABYRINTH_ACTIONS");
    for (const code of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
      expect(actions).toContain(`"${code}"`);
    }
    expect(actions).toContain("preventDefault: true");
  });

  it("should trigger recordEvent with 'project_click' when victory condition is met", () => {
    expect(session).toContain("recordEvent");
    expect(session).toContain('"project_click"');
    expect(session).toContain('"victory"');
  });

  it("should contain a fully-aligned static ASCII fallback grid structure", () => {
    expect(content).toContain("const renderAsciiFallback = () => {");
    expect(content).toContain('if (cell === "#") return "█"');
    expect(content).toContain('if (x === START_X && y === START_Y) return "@"');
  });

  it("binds tool slots 1 to 5 and the EMP to Space", () => {
    for (const slot of [1, 2, 3, 4, 5]) {
      expect(actions).toContain(`"Digit${slot}"`);
    }
    expect(actions).toContain('keys: ["Space"]');
    expect(session).toContain("npm_install");
    expect(session).toContain("git_force_push");
    expect(session).toContain("stack_overflow");
  });

  it("should support Roguelike Graveyard campaign mode and room transitions", () => {
    expect(session).toContain("generateRoguelikeCampaign");
    expect(session).toContain("startRoguelikeCampaign");
    expect(content).toContain("Graveyard Roguelike");
  });

  it("should contain Billable Hours timesheet modal trigger and submission", () => {
    expect(session).toContain("handleSubmitTimesheet");
    const card = source("components/retro-labyrinth/parts/TimesheetCard.tsx");
    expect(content).toContain("<TimesheetCard");
    expect(card).toContain("BILLABLE HOURS INTERRUPT");
    expect(card).toContain("Submit Timesheet");
  });
});

describe("Direct Inline Coordinate Scaling & Index Clamping Invariants", () => {
  const canvas = source(CANVAS);
  const session = source(SESSION);
  const painter = source(PAINTER);

  // The mapping itself is the stage fit's (#2358), unit tested in
  // arcade-stage-fit.test.ts: an empty canvas rect maps to null.
  it("includes defensive zero-dimension guard for canvas bounding box", () => {
    expect(canvas).toContain("if (!point) return;");
  });

  it("maps the pointer through the stage fit and the canvas's shown rect", () => {
    expect(canvas).toContain("const point = toGame(");
    expect(canvas).toContain("event.currentTarget.getBoundingClientRect()");
  });

  it("transforms game units to grid cells by the room's column and row count", () => {
    expect(canvas).toContain(
      "Math.floor(point.x / (LOGICAL_WIDTH / grid.cols))"
    );
    expect(canvas).toContain(
      "Math.floor(point.y / (LOGICAL_HEIGHT / grid.rows))"
    );
  });

  it("clamps calculated grid indices within valid column and row bounds", () => {
    expect(canvas).toContain("grid.cols - 1");
    expect(canvas).toContain("grid.rows - 1");
  });

  it("resets cursor grid position on mouse leave", () => {
    expect(canvas).toContain("onMouseLeave={() => onPointAt(null)}");
    expect(session).toContain("cursorGridPosRef.current = null;");
  });

  it("renders hover highlight overlay for target cell", () => {
    expect(painter).toContain("Draw Cursor Hover Highlight Tile");
    expect(session).toContain("cursor: cursorGridPosRef.current");
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
  const session = source(SESSION);
  const painter = source(PAINTER);

  it("imports useMemo from react", () => {
    expect(session).toMatch(
      /import\s+[\s\S]*?useMemo[\s\S]*?from\s+["']react["']/
    );
  });

  it("memoizes Traveling Salesman pathfinding tour using useMemo", () => {
    expect(session).toContain("const tspTour = useMemo(");
    expect(session).toContain("computeShortestTour(");
  });

  it("configures exhaustive dependencies for pathfinding useMemo", () => {
    expect(session).toContain("[playerPosition.x, playerPosition.y, tspNodes]");
  });

  it("hands tspTour to the painter on each frame, which reads it as is", () => {
    expect(session).toContain("tspTour,");
    expect(painter).toContain("const tour = tspTour;");
  });
});
