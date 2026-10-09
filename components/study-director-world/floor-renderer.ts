import { ArcadeEngine, applyCanvasScale } from "@/lib/arcade";
import {
  countMarks,
  stepFrom,
  tileAt,
  type PersonPlacement,
  type PlayerState,
  type RoomCondition,
  type RoomId,
  type TilePoint,
  type WorldMap,
} from "@/lib/study-director-world";
import {
  drawActivity,
  drawDressing,
  drawFire,
  drawFurniture,
  drawGround,
  drawLabels,
  drawLight,
  drawMug,
  drawSprite,
  drawStationGlow,
  drawStations,
  drawStrainIcon,
  drawWalls,
} from "./floor-art";
import {
  PALETTE,
  PLAYER_LOOK,
  ROLE_LOOKS,
  TILE,
  strainOf,
  walkFrame,
} from "./world-art";

export { TILE };

/** Seconds a glide between two tiles takes. */
const GLIDE_SECONDS = 0.11;
/** Seconds per flicker cycle of the bin fire. */
const FLAME_SECONDS = 0.6;
/** Stations this many steps from the player glow, as a hint they can be used. */
const GLOW_DISTANCE = 2;
/** The minute shown when a scene carries no clock: midday, which has no tint. */
const MIDDAY = 720;

/** Everything the floor view draws. */
export interface FloorScene {
  map: WorldMap;
  player: PlayerState;
  people: readonly PersonPlacement[];
  conditions: Partial<Record<RoomId, RoomCondition>>;
  /** The tile the player is facing, highlighted when it holds a target. */
  target: TilePoint | null;
  /** Minutes after midnight, for the light. Midday when left out. */
  minute?: number;
}

interface Glide {
  from: TilePoint;
  progress: number;
  /** Where each person who moved one tile started, by member id. */
  people?: Map<string, TilePoint>;
}

/** A stable string for a set of room conditions, cached by reference. */
const signatures = new WeakMap<object, string>();
function signatureOf(conditions: object): string {
  let sig = signatures.get(conditions);
  if (sig === undefined) {
    sig = JSON.stringify(conditions);
    signatures.set(conditions, sig);
  }
  return sig;
}

/** True when a scene has a burning bin to animate. */
export function sceneHasFire(scene: Pick<FloorScene, "conditions">): boolean {
  return Object.values(scene.conditions).some((c) => countMarks(c, "fire") > 0);
}

/**
 * Draws the CRO floor and the site maps in pixel art on a Canvas 2D context,
 * on top of the shared arcade engine. The unchanging layer (floors, walls,
 * furniture, stations, labels and set dressing) is painted once to an
 * offscreen canvas and copied each frame; only the glide, the flames, the
 * people and the light are drawn live. It renders on demand: a frame is drawn
 * when the scene changes, and the loop only runs while the player glides
 * between tiles or the bin burns. Under reduced motion there is no glide, so
 * people step from tile to tile without a walk cycle and no loop runs at all.
 */
export class FloorRenderer extends ArcadeEngine<FloorScene, null> {
  private glide: Glide | null = null;
  private scale = 1;
  private reducedMotion = false;
  /** Flicker phase of the bin fire, 0 to 1. Stays 0 under reduced motion. */
  private flame = 0;
  /** Tiles walked so far, to alternate the walk frames. */
  private steps = 0;
  private layer: HTMLCanvasElement | null = null;
  private layerKey = "";
  /** How many times the unchanging layer was painted, for tests. */
  public layerPaints = 0;

  public init(): void {}

  public createSnapshot(): null {
    return null;
  }

  /** Backing-store pixels per logical unit, from `computeCanvasResolution`. */
  public setScale(scale: number): void {
    this.scale = scale;
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced) {
      this.glide = null;
      this.flame = 0;
    }
  }

  /**
   * Replaces the scene. A one-tile move glides unless motion is reduced;
   * anything else (a turn, a jump, a new day) is drawn in place.
   */
  public setScene(scene: FloorScene): void {
    const prev = this.state.player;
    const dist =
      Math.abs(prev.x - scene.player.x) + Math.abs(prev.y - scene.player.y);
    // People walking their schedules glide too, one tile per player step.
    const people = new Map<string, TilePoint>();
    for (const p of scene.people) {
      const was = this.state.people.find((q) => q.memberId === p.memberId);
      if (was && Math.abs(was.x - p.x) + Math.abs(was.y - p.y) === 1)
        people.set(p.memberId, { x: was.x, y: was.y });
    }
    if (dist === 1 || people.size > 0) this.steps += 1;
    this.glide =
      (dist === 1 || people.size > 0) && !this.reducedMotion
        ? {
            from: dist === 1 ? { x: prev.x, y: prev.y } : scene.player,
            progress: 0,
            people,
          }
        : null;
    this.state = scene;
  }

  /** True while a glide is in progress and frames are needed. */
  public isMoving(): boolean {
    return this.glide !== null;
  }

  /**
   * True while frames are needed: a glide, or a burning bin. The fire only
   * flickers when motion is allowed; under reduced motion it is drawn still
   * and the loop does not run for it.
   */
  public isAnimating(): boolean {
    return (
      this.glide !== null || (!this.reducedMotion && sceneHasFire(this.state))
    );
  }

  public update(dt: number): void {
    if (!this.reducedMotion && sceneHasFire(this.state))
      this.flame = (this.flame + dt / FLAME_SECONDS) % 1;
    if (!this.glide) return;
    this.glide.progress += dt / GLIDE_SECONDS;
    if (this.glide.progress >= 1) {
      this.glide = null;
      this.emit("settled", null);
    }
  }

  private paintBase(ctx: CanvasRenderingContext2D): void {
    const { map, conditions } = this.state;
    drawGround(ctx, map);
    drawWalls(ctx, map);
    drawFurniture(ctx, map, conditions);
    drawDressing(ctx, map, conditions);
    drawStations(ctx, map);
    drawLabels(ctx, map);
    this.layerPaints += 1;
  }

  /**
   * Paints the unchanging layer, from the offscreen copy when there is one.
   * The copy is rebuilt only when the map, the scale or the room conditions
   * change; without a DOM the layer is painted straight onto the context.
   */
  private paintStatic(ctx: CanvasRenderingContext2D): void {
    const { map, conditions } = this.state;
    if (typeof document === "undefined") {
      this.paintBase(ctx);
      return;
    }
    const key = `${map.id}|${this.scale}|${signatureOf(conditions)}`;
    if (!this.layer || this.layerKey !== key) {
      const layer = this.layer ?? document.createElement("canvas");
      layer.width = Math.max(1, Math.round(map.width * TILE * this.scale));
      layer.height = Math.max(1, Math.round(map.height * TILE * this.scale));
      const layerCtx = layer.getContext("2d");
      if (!layerCtx) {
        this.layer = null;
        this.paintBase(ctx);
        return;
      }
      applyCanvasScale(layerCtx, this.scale);
      this.paintBase(layerCtx);
      this.layer = layer;
      this.layerKey = key;
    }
    if (typeof ctx.setTransform === "function")
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.layer, 0, 0);
    applyCanvasScale(ctx, this.scale);
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const { map, player, people, conditions, target, minute } = this.state;
    applyCanvasScale(ctx, this.scale);
    if ("imageSmoothingEnabled" in ctx) ctx.imageSmoothingEnabled = false;
    this.paintStatic(ctx);

    // Stations within reach glow at low opacity; the one you face, fully.
    for (const s of map.stations) {
      const near =
        Math.abs(s.x - player.x) + Math.abs(s.y - player.y) <= GLOW_DISTANCE;
      const faced = target?.x === s.x && target?.y === s.y;
      if (near || faced) drawStationGlow(ctx, s.x, s.y, faced);
    }
    drawFire(ctx, map, conditions, this.flame);

    const t = this.glide ? Math.min(1, this.glide.progress) : 1;
    const moving = this.glide !== null;
    const stepFrame = (walking: boolean) => walkFrame(this.steps, walking);

    // Everyone is drawn back to front so a person in front hides one behind.
    interface Figure {
      y: number;
      draw: () => void;
    }
    const figures: Figure[] = [];
    for (const p of people) {
      const start = this.glide?.people?.get(p.memberId) ?? p;
      const fx = (start.x + (p.x - start.x) * t) * TILE;
      const fy = (start.y + (p.y - start.y) * t) * TILE;
      const walking = moving && this.glide?.people?.has(p.memberId) === true;
      const strain = strainOf(conditions[p.room]?.clutter ?? 0);
      figures.push({
        y: fy,
        draw: () => {
          drawSprite(
            ctx,
            ROLE_LOOKS[p.role],
            p.facing,
            stepFrame(walking),
            strain.posture,
            fx,
            fy
          );
          drawStrainIcon(ctx, strain.icon, fx, fy);
          drawActivity(ctx, fx, fy, p.activity);
        },
      });
    }
    const from = this.glide?.from ?? player;
    const px = (from.x + (player.x - from.x) * t) * TILE;
    const py = (from.y + (player.y - from.y) * t) * TILE;
    const playerWalking =
      moving && (from.x !== player.x || from.y !== player.y);
    figures.push({
      y: py,
      draw: () => {
        drawSprite(
          ctx,
          PLAYER_LOOK,
          player.facing,
          stepFrame(playerWalking),
          "upright",
          px,
          py
        );
        // The Study Director always carries the FINE mug.
        drawMug(ctx, px, py);
      },
    });
    figures.sort((a, b) => a.y - b.y);
    for (const f of figures) f.draw();

    drawLight(ctx, map, conditions, minute ?? MIDDAY);

    if (target) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = PALETTE.amber;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(
        target.x * TILE + 0.5,
        target.y * TILE + 0.5,
        TILE - 1,
        TILE - 1
      );
      ctx.setLineDash([]);
    }
  }
}

/** The tile in front of the player, if it holds a person or a station. */
export function highlightedTile(
  map: WorldMap,
  player: PlayerState,
  people: readonly PersonPlacement[]
): TilePoint | null {
  const front = stepFrom(player, player.facing);
  if (people.some((p) => p.x === front.x && p.y === front.y)) return front;
  return tileAt(map, front.x, front.y) === "station" ? front : null;
}
