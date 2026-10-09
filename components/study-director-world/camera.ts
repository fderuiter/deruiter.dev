import { clamp } from "@/lib/game-utils";
import type { TilePoint, WorldMap } from "@/lib/study-director-world";

/**
 * Tiles across and down the stage shows at once. The office is forty tiles
 * wide; this is about half of it, which puts a tile at roughly 45 pixels on
 * a laptop screen, large enough to read the art and the labels.
 */
export const VIEW_TILES = { w: 22, h: 13 } as const;

/** The part of a map on screen: the top left corner and size, in tiles. */
export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How many tiles the stage shows of a map: the usual view, or all of a small map. */
export function viewSize(map: Pick<WorldMap, "width" | "height">) {
  return {
    w: Math.min(map.width, VIEW_TILES.w),
    h: Math.min(map.height, VIEW_TILES.h),
  };
}

/**
 * The view that keeps a point centred, held inside the map: near an edge the
 * camera stops and the point moves off centre instead. The point is in tile
 * units and may be fractional, so a glide between tiles pans smoothly; the
 * centre of the tile is what is followed.
 */
export function followCamera(
  focus: TilePoint,
  map: Pick<WorldMap, "width" | "height">
): View {
  const size = viewSize(map);
  return {
    ...size,
    x: clamp(focus.x + 0.5 - size.w / 2, 0, map.width - size.w),
    y: clamp(focus.y + 0.5 - size.h / 2, 0, map.height - size.h),
  };
}

/** True when a tile is at least partly inside the view. */
export function inView(view: View, tile: TilePoint): boolean {
  return (
    tile.x + 1 > view.x &&
    tile.x < view.x + view.w &&
    tile.y + 1 > view.y &&
    tile.y < view.y + view.h
  );
}
