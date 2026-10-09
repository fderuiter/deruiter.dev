// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  CRO_FLOOR,
  ROOM_IDS,
  SITE_MAPS,
  roomConditions,
  tileAt,
  type FloorMood,
  type TileKind,
  type WorldMap,
} from "@/lib/study-director-world";
import {
  FloorRenderer,
  TILE,
  type FloorScene,
} from "@/components/study-director-world/floor-renderer";
import {
  AFTER_HOURS_ALPHA,
  ALARM_CLUTTER,
  PLAYER_LOOK,
  ROLE_LOOKS,
  ROOM_FLOORS,
  SITE_STAFF_LOOKS,
  SLUMP_CLUTTER,
  SPRITE_H,
  SPRITE_W,
  STATION_ART,
  TILE_ART,
  floorTone,
  isAfterHours,
  lightTint,
  siteLookFor,
  spriteBounds,
  spriteRects,
  strainOf,
  tileNoise,
  walkFrame,
} from "@/components/study-director-world/world-art";

const ALL_MAPS: WorldMap[] = [CRO_FLOOR, ...Object.values(SITE_MAPS)];

// Compile-time list: adding a TileKind without adding it here fails the build.
const TILE_KINDS: Record<TileKind, true> = {
  wall: true,
  floor: true,
  door: true,
  desk: true,
  table: true,
  whiteboard: true,
  shelf: true,
  reception: true,
  plant: true,
  car: true,
  fridge: true,
  station: true,
};

describe("study director world art: every tile, station and room has art", () => {
  it("has art for every tile kind", () => {
    expect(Object.keys(TILE_ART).sort()).toEqual(
      Object.keys(TILE_KINDS).sort()
    );
    for (const text of Object.values(TILE_ART))
      expect(text.length).toBeGreaterThan(0);
  });

  it("draws every tile that appears on the CRO floor and the site maps", () => {
    for (const map of ALL_MAPS)
      for (let y = 0; y < map.height; y += 1)
        for (let x = 0; x < map.width; x += 1)
          expect(
            TILE_ART[tileAt(map, x, y)],
            `${map.id} ${x},${y}`
          ).toBeDefined();
  });

  it("has art for every station on every map", () => {
    const seen = new Set<string>();
    for (const map of ALL_MAPS)
      for (const s of map.stations) {
        seen.add(s.id);
        expect(STATION_ART[s.id], s.id).toBeTruthy();
      }
    // Five CRO stations plus the nine site stations (the car is shared).
    expect(seen.size).toBe(14);
    expect(Object.keys(STATION_ART)).toHaveLength(14);
  });

  it("gives every room a floor, and every room on a map one too", () => {
    for (const id of ROOM_IDS) expect(ROOM_FLOORS[id], id).toBeDefined();
    for (const map of ALL_MAPS)
      for (const room of map.rooms)
        expect(ROOM_FLOORS[room.id], room.id).toBeDefined();
  });

  it("lays floors out deterministically", () => {
    const style = ROOM_FLOORS.dataManagement;
    for (let i = 0; i < 20; i += 1) {
      expect(tileNoise(i, 3)).toBe(tileNoise(i, 3));
      expect([style.base, style.alt]).toContain(floorTone(style, i, 3));
    }
    const checker = ROOM_FLOORS.breakRoom;
    expect(floorTone(checker, 0, 0)).not.toBe(floorTone(checker, 1, 0));
  });

  it("gives each clinical site its own look and the CRO none", () => {
    const looks = Object.keys(SITE_MAPS).map((id) => siteLookFor(`site:${id}`));
    expect(new Set(looks.map((l) => l.accent)).size).toBe(looks.length);
    expect(siteLookFor(CRO_FLOOR.id).tintAlpha).toBe(0);
  });
});

describe("study director world art: time-of-day light", () => {
  const at = (h: number, m = 0) => lightTint(h * 60 + m);

  it("is cool in the morning, clear at midday, amber late and dim after hours", () => {
    expect(at(8).color[2]).toBeGreaterThan(at(8).color[0]);
    expect(at(12).alpha).toBe(0);
    const late = at(17, 30);
    expect(late.color[0]).toBeGreaterThan(late.color[2]);
    expect(at(20).alpha).toBeGreaterThanOrEqual(AFTER_HOURS_ALPHA);
    expect(at(20).alpha).toBeGreaterThan(at(17).alpha);
  });

  it("is pure and wraps around midnight", () => {
    expect(lightTint(500)).toEqual(lightTint(500));
    expect(lightTint(500 + 1440)).toEqual(lightTint(500));
    expect(lightTint(-100)).toEqual(lightTint(1340));
    expect(lightTint(Number.NaN)).toEqual(lightTint(720));
  });

  it("changes smoothly, with no jump from one minute to the next", () => {
    for (let m = 0; m < 1440; m += 1) {
      const a = lightTint(m);
      const b = lightTint(m + 1);
      expect(Math.abs(a.alpha - b.alpha)).toBeLessThan(0.02);
      for (let i = 0; i < 3; i += 1)
        expect(Math.abs(a.color[i] - b.color[i])).toBeLessThan(8);
    }
  });

  it("shows desk lamps only once the office is dim in the evening", () => {
    expect(isAfterHours(8 * 60)).toBe(false);
    expect(isAfterHours(12 * 60)).toBe(false);
    expect(isAfterHours(17 * 60)).toBe(false);
    expect(isAfterHours(20 * 60)).toBe(true);
    // Before dawn is dim too, but there are no lamps to read as lit.
    expect(isAfterHours(5 * 60)).toBe(false);
  });
});

describe("study director world art: characters", () => {
  const facings = ["up", "down", "left", "right"] as const;

  it("picks a walk frame: standing when still, alternating steps when moving", () => {
    expect(walkFrame(0, false)).toBe(0);
    expect(walkFrame(7, false)).toBe(0);
    expect(walkFrame(0, true)).toBe(1);
    expect(walkFrame(1, true)).toBe(2);
    expect(walkFrame(2, true)).toBe(1);
    expect(walkFrame(-3, true)).toBe(2);
  });

  it("draws every facing and frame inside the sprite box", () => {
    const looks = [
      PLAYER_LOOK,
      ...Object.values(ROLE_LOOKS),
      ...Object.values(SITE_STAFF_LOOKS),
    ];
    for (const look of looks)
      for (const facing of facings)
        for (const frame of [0, 1, 2] as const)
          for (const posture of ["upright", "slumped"] as const)
            for (const r of spriteRects(look, facing, frame, posture)) {
              expect(r.x).toBeGreaterThanOrEqual(0);
              expect(r.y).toBeGreaterThanOrEqual(0);
              expect(r.x + r.w).toBeLessThanOrEqual(SPRITE_W);
              expect(r.y + r.h).toBeLessThanOrEqual(SPRITE_H);
            }
  });

  it("changes the picture with the frame and the facing", () => {
    const sig = (...a: Parameters<typeof spriteRects>) =>
      JSON.stringify(spriteRects(...a));
    const look = ROLE_LOOKS.dataManager;
    expect(sig(look, "down", 0)).not.toBe(sig(look, "down", 1));
    expect(sig(look, "down", 1)).not.toBe(sig(look, "down", 2));
    expect(sig(look, "down", 0)).not.toBe(sig(look, "up", 0));
    expect(sig(look, "left", 0)).not.toBe(sig(look, "right", 0));
    expect(sig(look, "down", 0, "upright")).not.toBe(
      sig(look, "down", 0, "slumped")
    );
  });

  it("gives the player and each of the six team roles a different look", () => {
    const looks = [PLAYER_LOOK, ...Object.values(ROLE_LOOKS)];
    expect(Object.keys(ROLE_LOOKS)).toHaveLength(6);
    const pictures = new Set(
      looks.map((look) => JSON.stringify(spriteRects(look, "down", 0)))
    );
    expect(pictures.size).toBe(looks.length);
    // The shirt colours differ too, so each role reads at a distance.
    expect(new Set(looks.map((l) => l.shirt)).size).toBe(looks.length);
  });

  it("gives the site coordinator and investigator their own figures", () => {
    const coordinator = SITE_STAFF_LOOKS.coordinator;
    const pi = SITE_STAFF_LOOKS.pi;
    expect(coordinator).toBeDefined();
    expect(pi?.coat).toBe(true);
    expect(JSON.stringify(spriteRects(coordinator!, "down", 0))).not.toBe(
      JSON.stringify(spriteRects(pi!, "down", 0))
    );
  });

  it("keeps sprites the size of a tile or smaller", () => {
    const size = spriteBounds(spriteRects(PLAYER_LOOK, "down", 0));
    expect(size.height).toBeLessThanOrEqual(TILE);
    expect(size.width).toBeLessThanOrEqual(TILE);
  });

  it("shows strain as posture and an icon, never a number", () => {
    expect(strainOf(0)).toEqual({ posture: "upright", icon: "none" });
    expect(strainOf(SLUMP_CLUTTER - 0.01).icon).toBe("none");
    expect(strainOf(SLUMP_CLUTTER)).toEqual({
      posture: "slumped",
      icon: "sweat",
    });
    expect(strainOf(ALARM_CLUTTER)).toEqual({
      posture: "slumped",
      icon: "alarm",
    });
    expect(strainOf(Number.NaN)).toEqual({ posture: "upright", icon: "none" });
  });
});

describe("study director world art: the renderer", () => {
  const sceneFor = (
    map: WorldMap,
    conditions = roomConditions(map),
    minute?: number
  ): FloorScene => ({
    map,
    player: { x: map.stations[0].x, y: map.stations[0].y + 1, facing: "up" },
    people: [],
    conditions,
    target: null,
    minute,
  });

  const mood: Record<FloorMood, true> = {
    calm: true,
    stressed: true,
    crisis: true,
  };

  it("paints the CRO floor and every site map without error", () => {
    expect(Object.keys(mood)).toHaveLength(3);
    for (const map of ALL_MAPS) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      expect(ctx).toBeTruthy();
      const engine = new FloorRenderer(sceneFor(map));
      expect(() =>
        engine.render(ctx as CanvasRenderingContext2D)
      ).not.toThrow();
    }
  });

  it("paints the unchanging layer once, not every frame", () => {
    const ctx = document.createElement("canvas").getContext("2d");
    const engine = new FloorRenderer(sceneFor(CRO_FLOOR));
    engine.setScale(2);
    for (let i = 0; i < 5; i += 1)
      engine.render(ctx as CanvasRenderingContext2D);
    expect(engine.layerPaints).toBe(1);
  });

  it("repaints the layer only when the map, the scale or the room conditions change", () => {
    const ctx = document
      .createElement("canvas")
      .getContext("2d") as CanvasRenderingContext2D;
    const calm = roomConditions(CRO_FLOOR);
    const engine = new FloorRenderer(sceneFor(CRO_FLOOR, calm));
    engine.setScale(2);
    engine.render(ctx);
    // A move and a new clock leave the layer alone.
    engine.setScene({
      ...sceneFor(CRO_FLOOR, calm, 600),
      player: { x: 3, y: 7, facing: "right" },
    });
    engine.render(ctx);
    expect(engine.layerPaints).toBe(1);
    // A new scale, then a messier office, each repaint it once.
    engine.setScale(3);
    engine.render(ctx);
    expect(engine.layerPaints).toBe(2);
    const messy = roomConditions(CRO_FLOOR);
    messy.dataManagement = { clutter: 1, marks: ["printout", "printout"] };
    engine.setScene(sceneFor(CRO_FLOOR, messy));
    engine.render(ctx);
    expect(engine.layerPaints).toBe(3);
    const site = Object.values(SITE_MAPS)[0];
    engine.setScene(sceneFor(site));
    engine.render(ctx);
    expect(engine.layerPaints).toBe(4);
  });

  it("walks the player one tile per step and ends with a settled frame", () => {
    const engine = new FloorRenderer(sceneFor(CRO_FLOOR));
    const start = sceneFor(CRO_FLOOR);
    engine.setScene({
      ...start,
      player: { ...start.player, x: start.player.x + 1, facing: "right" },
    });
    expect(engine.isMoving()).toBe(true);
    engine.update(1);
    expect(engine.isMoving()).toBe(false);
  });

  it("does not glide under reduced motion", () => {
    const engine = new FloorRenderer(sceneFor(CRO_FLOOR));
    engine.setReducedMotion(true);
    const start = sceneFor(CRO_FLOOR);
    engine.setScene({
      ...start,
      player: { ...start.player, x: start.player.x + 1 },
    });
    expect(engine.isMoving()).toBe(false);
  });
});
