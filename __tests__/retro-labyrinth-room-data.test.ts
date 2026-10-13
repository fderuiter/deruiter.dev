import { describe, it, expect } from "vitest";
import {
  serializeGrid,
  serializeNodes,
} from "@/components/retro-labyrinth/room-data";
import { markNodeVisited } from "@/components/retro-labyrinth/tsp-nodes";

describe("serializeGrid", () => {
  it("writes one row per line, '#' for walls and '.' for floor", () => {
    const grid = [
      ["#", "#", "#"],
      ["#", " ", "E"],
      ["#", "H", "#"],
    ];
    expect(serializeGrid(grid)).toBe("###|#..|#.#");
  });

  it("treats moving walls as walls and terminals and the exit as floor", () => {
    expect(serializeGrid([["W", "T", "H", "E", " "]])).toBe("#....");
  });
});

describe("serializeNodes", () => {
  it("lists x,y and a 0 or 1 visited flag, joined with semicolons", () => {
    expect(
      serializeNodes([
        { x: 3, y: 1, visited: true },
        { x: 7, y: 2, visited: false },
      ])
    ).toBe("3,1:1;7,2:0");
  });

  it("is empty for a room with no route nodes", () => {
    expect(serializeNodes([])).toBe("");
  });
});

describe("markNodeVisited", () => {
  const nodes = [
    { id: 1, x: 3, y: 1, visited: false },
    { id: 2, x: 7, y: 2, visited: false },
  ];

  it("marks the node on the cell and reports it collected", () => {
    const result = markNodeVisited(nodes, 3, 1);
    expect(result.collected).toBe(true);
    expect(result.nodes[0].visited).toBe(true);
    expect(result.nodes[1].visited).toBe(false);
  });

  it("does not mutate the input list", () => {
    markNodeVisited(nodes, 3, 1);
    expect(nodes[0].visited).toBe(false);
  });

  it("reports nothing collected on a cell with no node", () => {
    const result = markNodeVisited(nodes, 0, 0);
    expect(result.collected).toBe(false);
    expect(result.nodes).toEqual(nodes);
  });

  it("does not collect an already visited node twice", () => {
    const once = markNodeVisited(nodes, 3, 1);
    const again = markNodeVisited(once.nodes, 3, 1);
    expect(again.collected).toBe(false);
  });
});
