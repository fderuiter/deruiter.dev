// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  CRO_FLOOR,
  SITE_MAPS,
  placePeople,
  newWorld,
  startDay,
  roomConditions,
  type PlayerState,
} from "@/lib/study-director-world";
import {
  VIEW_TILES,
  followCamera,
  inView,
  viewSize,
} from "@/components/study-director-world/camera";
import {
  FloorRenderer,
  TILE,
  type FloorScene,
} from "@/components/study-director-world/floor-renderer";
import { Minimap } from "@/components/study-director-world/Minimap";

const at = (x: number, y: number) => ({ x, y });

describe("camera maths", () => {
  it("shows a fixed window of a big map and the whole of a small one", () => {
    expect(viewSize(CRO_FLOOR)).toEqual({ w: VIEW_TILES.w, h: VIEW_TILES.h });
    expect(viewSize({ width: 10, height: 8 })).toEqual({ w: 10, h: 8 });
    expect(viewSize({ width: 30, height: 8 })).toEqual({ w: 22, h: 8 });
  });

  it("centres on the middle of the player's tile", () => {
    const v = followCamera(at(20, 11), CRO_FLOOR);
    expect(v.x).toBe(20 + 0.5 - 11);
    expect(v.y).toBe(11 + 0.5 - 6.5);
  });

  it("stops at every edge, so the view never leaves the map", () => {
    const { width, height } = CRO_FLOOR;
    const corners = [
      at(0, 0),
      at(width - 1, 0),
      at(0, height - 1),
      at(width - 1, height - 1),
    ];
    for (const c of corners) {
      const v = followCamera(c, CRO_FLOOR);
      expect(v.x).toBeGreaterThanOrEqual(0);
      expect(v.y).toBeGreaterThanOrEqual(0);
      expect(v.x + v.w).toBeLessThanOrEqual(width);
      expect(v.y + v.h).toBeLessThanOrEqual(height);
    }
    expect(followCamera(at(0, 0), CRO_FLOOR)).toMatchObject({ x: 0, y: 0 });
    expect(followCamera(at(width - 1, height - 1), CRO_FLOOR)).toMatchObject({
      x: width - VIEW_TILES.w,
      y: height - VIEW_TILES.h,
    });
  });

  it("pans smoothly with a fractional focus and does not move on a map that fits", () => {
    const a = followCamera(at(20, 11), CRO_FLOOR);
    const b = followCamera(at(20.5, 11), CRO_FLOOR);
    expect(b.x - a.x).toBeCloseTo(0.5);
    const small = { width: 12, height: 8 };
    expect(followCamera(at(11, 7), small)).toMatchObject({
      x: 0,
      y: 0,
      w: 12,
      h: 8,
    });
  });

  it("is pure and always keeps the focus on screen", () => {
    for (let x = 0; x < CRO_FLOOR.width; x += 3)
      for (let y = 0; y < CRO_FLOOR.height; y += 3) {
        const v = followCamera(at(x, y), CRO_FLOOR);
        expect(v).toEqual(followCamera(at(x, y), CRO_FLOOR));
        expect(inView(v, at(x, y))).toBe(true);
      }
  });

  it("tells whether a tile is on screen", () => {
    const v = { x: 5, y: 5, w: 10, h: 6 };
    expect(inView(v, at(5, 5))).toBe(true);
    expect(inView(v, at(14, 10))).toBe(true);
    expect(inView(v, at(15, 5))).toBe(false);
    expect(inView(v, at(4, 5))).toBe(false);
    expect(inView(v, at(5, 11))).toBe(false);
  });
});

function sceneAt(player: PlayerState): FloorScene {
  const world = startDay(newWorld("camera", "standard")).world;
  return {
    map: CRO_FLOOR,
    player,
    people: placePeople(world, CRO_FLOOR),
    conditions: roomConditions(CRO_FLOOR),
    target: null,
    minute: 600,
  };
}

describe("FloorRenderer camera", () => {
  const blits = (ctx: CanvasRenderingContext2D) =>
    (ctx.drawImage as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c.length === 9
    );

  it("copies only the window around the player, in whole device pixels", () => {
    const ctx = document
      .createElement("canvas")
      .getContext("2d") as CanvasRenderingContext2D;
    (ctx.drawImage as unknown as ReturnType<typeof vi.fn>).mockClear();
    const engine = new FloorRenderer(sceneAt({ x: 35, y: 12, facing: "up" }));
    engine.setScale(2);
    engine.render(ctx);
    const [call] = blits(ctx);
    const view = followCamera({ x: 35, y: 12 }, CRO_FLOOR);
    expect(call.slice(1)).toEqual([
      Math.round(view.x * TILE * 2),
      Math.round(view.y * TILE * 2),
      VIEW_TILES.w * TILE * 2,
      VIEW_TILES.h * TILE * 2,
      0,
      0,
      VIEW_TILES.w * TILE * 2,
      VIEW_TILES.h * TILE * 2,
    ]);
  });

  it("pins the camera to the corner when the player is at the edge", () => {
    const ctx = document
      .createElement("canvas")
      .getContext("2d") as CanvasRenderingContext2D;
    (ctx.drawImage as unknown as ReturnType<typeof vi.fn>).mockClear();
    const engine = new FloorRenderer(sceneAt({ x: 1, y: 1, facing: "down" }));
    engine.setScale(2);
    engine.render(ctx);
    const [call] = blits(ctx);
    expect(call.slice(1, 3)).toEqual([0, 0]);
  });

  it("pans with the glide and settles on the final view", () => {
    const ctx = document
      .createElement("canvas")
      .getContext("2d") as CanvasRenderingContext2D;
    const start = sceneAt({ x: 20, y: 11, facing: "right" });
    const engine = new FloorRenderer(start);
    engine.setScale(2);
    engine.setScene({ ...start, player: { x: 21, y: 11, facing: "right" } });
    (ctx.drawImage as unknown as ReturnType<typeof vi.fn>).mockClear();
    engine.update(0.055);
    engine.render(ctx);
    const mid = blits(ctx)[0][1] as number;
    engine.update(1);
    (ctx.drawImage as unknown as ReturnType<typeof vi.fn>).mockClear();
    engine.render(ctx);
    const end = blits(ctx)[0][1] as number;
    const first = Math.round(
      followCamera({ x: 20, y: 11 }, CRO_FLOOR).x * TILE * 2
    );
    expect(mid).toBeGreaterThan(first);
    expect(end).toBeGreaterThan(mid);
    expect(end).toBe(
      Math.round(followCamera({ x: 21, y: 11 }, CRO_FLOOR).x * TILE * 2)
    );
  });

  it("renders every map at its edges without error", () => {
    const ctx = document
      .createElement("canvas")
      .getContext("2d") as CanvasRenderingContext2D;
    for (const map of [CRO_FLOOR, ...Object.values(SITE_MAPS)]) {
      const world = startDay(newWorld("camera", "standard")).world;
      const engine = new FloorRenderer({
        map,
        player: { x: map.width - 2, y: map.height - 2, facing: "up" },
        people: [],
        conditions: roomConditions(map),
        target: null,
        minute: world.minute,
      });
      engine.setScale(2);
      expect(() => engine.render(ctx)).not.toThrow();
    }
  });
});

describe("Minimap", () => {
  afterEach(cleanup);

  it("is a decorative canvas covering the whole map", () => {
    const world = startDay(newWorld("camera", "standard")).world;
    render(
      <Minimap
        map={CRO_FLOOR}
        player={world.player}
        people={placePeople(world, CRO_FLOOR)}
        view={followCamera(world.player, CRO_FLOOR)}
      />
    );
    const canvas = screen.getByTestId("world-minimap") as HTMLCanvasElement;
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    expect(canvas.width).toBe(CRO_FLOOR.width * 3);
    expect(canvas.height).toBe(CRO_FLOOR.height * 3);
  });
});
